import Deployment from "../models/Deployment.js";
import Service from "../models/Service.js";
import { io, sockets } from '../index.js';
import UsedPortAndSubDomain from "../models/UsedPort.js";
import { collectContainerLogs, detectContainerPort, ensureDockerContainerRunning, isContainerRunning, stopAndRemoveContainer } from "../helpers/docker.js";
import { getStableSubdomain } from "../helpers/subdomains.js";
import { getPort, pickNewPortForBlueGreen } from "../helpers/ports.js";
import { executeSSHCommands } from "../helpers/ssh.js";
import { setupSubdomain } from "../helpers/nginx.js";
import { getBestEc2 } from "../ec2Host/ec2_deployment.js";
import { migrateService } from "../ec2Host/ec2_consolidation.js";
import { createEcrRepo } from "../ec2Host/aws_ecr.js";

// Start deployment worker - polls every 2 seconds for queued deployments
const DEPLOYMENT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes timeout for deployments

export async function deployFromQueue(deploymentId) {
    try {
        const deployment = await Deployment.findOneAndUpdate(
            { status: "queued", _id: deploymentId },
            { status: "building" },
            { sort: { createdAt: 1 } }
        );

        if (!deployment) return;

        // Get service details
        const service = await Service.findById(deployment.service).populate('ec2Host');
        if (!service) {
            await Deployment.updateOne(
                { _id: deployment._id },
                { status: "failed", logs: ["Service not found"] }
            );
            return;
        }
        if ((!service.ec2Host || service.status === "sleeping") && service.subdomain !== 'api') {
            const bestEc2 = await getBestEc2();
            service.ec2Host = bestEc2;;
            await service.save();
            const totalServices = await Service.countDocuments({ ec2Host: bestEc2._id, status: {$in : ['running', 'waking', 'pending']} });
            bestEc2.totalServices = totalServices;
            await bestEc2.save();
        }

        await runDeployment(deployment, service)
            .catch(err => console.error('Unhandled deployment error:', err));
    } catch (err) {
        console.error('Worker error:', err);
    }
};

const logsMap = new Map(); // In-memory map to store logs for each deployment

export const getDeploymentLogs = async (deploymentId, userId) => {
    const userSocketId = sockets.get(userId);

    // check if the user is the owner of the deployment
    const deployment = await Deployment.findById(deploymentId);
    const service = await Service.findById(deployment.service);
    if (service.user.toString() !== userId) {
        return;
    }

    io.to(userSocketId).emit('deployment:previous-logs', {
        deploymentId: deploymentId,
        logs: logsMap.get(deploymentId) || [],
    });
};

async function runDeployment(deployment, service) {
    const startTime = Date.now();
    const logs = [];
    logsMap.set(deployment._id.toString(), logs); // Store reference to logs in the map

    // Helper function to push logs and emit via socket.io
    const pushLog = (message) => {
        logs.push(message);
        let userSocketId = sockets.get(service.user.toString());
        if (userSocketId) {
            io.to(userSocketId).emit('deployment:log', {
                deploymentId: deployment._id.toString(),
                log: message
            });
        }
    };

    // AFTER — extract a helper, call it once per emit
    const emitToUser = (event, data) => {
        const socketId = sockets.get(service.user.toString());
        if (socketId) {
            io.to(socketId).emit(event, data);
        }
    };

    try {
        pushLog(`[${new Date().toISOString()}] Starting deployment...`);
        pushLog(`Repository: ${service.gitRepositoryUrl}`);
        pushLog(`Branch: ${service.gitBranch}`);

        // Emit deployment started event
        emitToUser('deployment:started', {
            deploymentId: deployment._id.toString(),
            status: 'building'
        });

        let timeoutHandle;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutHandle = setTimeout(
                () => reject(new Error('Deployment timed out after 10 minutes')),
                DEPLOYMENT_TIMEOUT_MS
            );
        });

        try {
            await Promise.race([deployViaSSH(deployment, service, logs, pushLog), timeoutPromise]);
        } finally {
            clearTimeout(timeoutHandle);
        }

        // Update service status
        service.status = "running";

        // Update deployment
        deployment.status = "running";
        deployment.deployedUrl = service.publicUrl;

        pushLog(`[${new Date().toISOString()}] Deployment completed successfully!`);
        pushLog(`Service available at: ${service.publicUrl}`);

        // Emit deployment completed event
        emitToUser('deployment:completed', {
            deploymentId: deployment._id.toString(),
            status: 'running',
            deployedUrl: service.publicUrl
        });

    } catch (err) {
        console.error('Deployment error:', err);
        pushLog(`[${new Date().toISOString()}] ERROR: ${err.message}`);

        const running = await isContainerRunning(`app-${service._id}`, service.ec2Host?.ip);
        service.status = running ? "running" : "failed";
        deployment.status = "failed";

        // Emit deployment failed event
        emitToUser('deployment:failed', {
            deploymentId: deployment._id.toString(),
            status: 'failed',
            error: err.message
        });
    } finally {
        logsMap.delete(deployment._id.toString()); // Clean up logs from memory after deployment is done
    }

    deployment.duration = Math.round((Date.now() - startTime) / 1000); // Calculate duration in seconds
    deployment.logs = logs;
    // Save changes
    await service.save();
    await deployment.save();
}

async function deployViaSSH(deployment, service, logs, pushLog) {
    const appName = `app-${service._id}`;
    const tempName = `${appName}-new`;
    const { gitRepositoryUrl, gitBranch, startCommand, environmentVariables } = service;

    // Reuse same subdomain for the service across redeploys
    const subdomain = await getStableSubdomain(service);
    let port = service.port;

    const existingPortRecord = await UsedPortAndSubDomain.findOne({ subdomain });
    if (existingPortRecord) {
        port = existingPortRecord.port;
    }

    const oldInstanceRunning = await isContainerRunning(appName, service.ec2Host?.ip);

    // If there is an old instance, deploy to temp instance first
    const targetContainerName = oldInstanceRunning ? tempName : appName;
    const targetAppFolder = oldInstanceRunning ? `${appName}-new` : appName;

    port = oldInstanceRunning ? await pickNewPortForBlueGreen(port, subdomain) : await getPort(port, subdomain);

    // Persist stable mapping attributes on service for future redeploys (after successful deploy we may adjust)
    service.subdomain = subdomain;
    service.port = port;

    pushLog(`[${new Date().toISOString()}] Initializing deployment...`);

    try {
        // Validate GitHub URL
        if (!gitRepositoryUrl.startsWith('https://github.com/')) {
            throw new Error('Invalid GitHub URL. Only https://github.com/ URLs are supported.');
        }

        pushLog(`[${new Date().toISOString()}] Repository validation passed`);

        // Validate PORT environment variable requirement
        pushLog(`[${new Date().toISOString()}] IMPORTANT: Your application must listen on process.env.PORT`);
        pushLog(`[${new Date().toISOString()}] Example: const PORT = process.env.PORT || 3000; app.listen(PORT, '0.0.0.0');`);

        // Build commands to execute on EC2
        const commands = [
            `docker container prune -f`, // Clean up any stopped containers to free resources before deployment
            `docker image prune -af`,  // remove all unused images
            `rm -rf ~/apps`, // Clean up old app folders to free disk space before deployment (it's just code and it's going to be re-cloned or reuse from the container, so safe to remove)
            // Ensure base directory exists
            `mkdir -p ~/apps`, // create base directory if it doesn't exist
            `cd ~/apps`,
        ];

        if (oldInstanceRunning) {
            // Keep old container running until new one is verified
            commands.push(`rm -rf ${targetAppFolder}`);
            commands.push(`docker rm -f ${targetContainerName} || true`);
        } else {
            commands.push(`docker stop ${appName} || true`);
            commands.push(`docker rm ${appName} || true`);
            commands.push(`rm -rf ${targetAppFolder}`);
        }

        commands.push(`git clone --branch ${gitBranch} ${gitRepositoryUrl} ${targetAppFolder}`);
        commands.push(`cd ${targetAppFolder}`);

        let relativeRootDirectory = '.';
        // Navigate to rootDirectory if specified
        if (service.rootDirectory && service.rootDirectory !== '/') {
            const relativeDir = service.rootDirectory.startsWith('/') ? '.' + service.rootDirectory : service.rootDirectory;
            relativeRootDirectory = relativeDir;
            commands.push(`cd ${relativeDir}`);
        }

        pushLog(`[${new Date().toISOString()}] Repository cloning and setup commands prepared`);

        // Execute pre-deploy command if exists like db migrations (Database schema update) or installing dependencies before build
        if (service.preDeployCommand) {
            pushLog(`[${new Date().toISOString()}] Pre-deploy command: ${service.preDeployCommand}`);
            commands.push(`${service.preDeployCommand}`);
        }

        // Execute build command if exists
        if (service.buildCommand && service.buildCommand !== '.') {
            pushLog(`[${new Date().toISOString()}] Build command: ${service.buildCommand}`);
            commands.push(`${service.buildCommand}`);
        }

        // Create .env file if environment variables exist
        if (environmentVariables && environmentVariables.length > 0) {
            pushLog(`[${new Date().toISOString()}] Creating .env file with ${environmentVariables.length} variables`);
            const envContent = environmentVariables
                .map(ev => `${ev.key}=${ev.value}`)
                .join('\n');

            commands.push(`cat > .env << 'ENVFILEEOF'
${envContent}
ENVFILEEOF`); // create .env file with environment variables
        }

        // Dynamically generate Dockerfile
        const dockerfile = `FROM node:20
RUN apt-get update && apt-get install -y iproute2
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV PORT=3000
EXPOSE 3000
CMD ["sh","-c","${startCommand}"]`;

        pushLog(`[${new Date().toISOString()}] Generating Dockerfile`);
        commands.push(`cat > Dockerfile << 'DOCKERFILEEOF'
${dockerfile}
DOCKERFILEEOF`);

        // Build Docker image without cache
        pushLog(`[${new Date().toISOString()}] Building Docker image: ${appName}`);
        // commands.push(`docker build --no-cache -t ${appName} .`);
        commands.push(`docker build -t ${appName} .`);
        // Delete node_modules and .git after build — no longer needed, saves disk space
        commands.push(`rm -rf node_modules .git`);

        // Start the container
        pushLog(`[${new Date().toISOString()}] Starting Docker container on port ${port}`);
        let dockerRunCmd = `docker run -d --name ${targetContainerName} ${service.subdomain === 'api' ? '--network appnet' : ''} -e PORT=3000 -p ${port}:3000`;

        if (environmentVariables && environmentVariables.length > 0) {
            dockerRunCmd += ` --env-file .env`;
        }

        dockerRunCmd += ` ${appName}`;
        commands.push(dockerRunCmd);

        // Execute all commands via SSH
        pushLog(`[${new Date().toISOString()}] Connecting to EC2...`);
        const result = await executeSSHCommands(commands, logs, pushLog, service.ec2Host?.ip);

        pushLog(`[${new Date().toISOString()}] Docker container started successfully: ${targetContainerName}`);

        const detectedPort = await detectContainerPort(targetContainerName, pushLog, service.ec2Host?.ip);

        if (detectedPort && detectedPort !== 3000) {

            pushLog(`[${new Date().toISOString()}] Detected port ${detectedPort}, restarting container with correct port mapping`);

            const restartCommands = [
                `cd ~/apps/${targetAppFolder}`,
                `cd ${relativeRootDirectory}`,

                `docker stop ${targetContainerName} || true`,
                `docker rm ${targetContainerName} || true`,

                `docker run -d --name ${targetContainerName} ${service.subdomain === 'api' ? '--network appnet' : ''} -e PORT=${detectedPort} -p ${port}:${detectedPort}${environmentVariables && environmentVariables.length > 0 ? ' --env-file .env' : ''} ${appName}`
            ];

            await executeSSHCommands(restartCommands, logs, pushLog, service.ec2Host?.ip);

            // Ensure the restarted container is running before proceeding.
            await ensureDockerContainerRunning(targetContainerName, pushLog, service.ec2Host?.ip);
            service.servicePort = detectedPort; // Store the actual port the service is listening on
        }

        // Store deployment metadata
        deployment.dockerImage = appName;
        deployment.port = port;

        // setup global certificate and subdomain in nginx on main backend server to proxy to the service's EC2 host and port
        // await setupSubdomain(subdomain, port, pushLog);

        if (subdomain === 'api') {
            await setupSubdomain(subdomain, port, pushLog, service.ec2Host?.ip);
            await setupSubdomain('wildcard-proxy', port, pushLog, service.ec2Host?.ip, true); // setup proxy-only config on the service's EC2 host to forward to main backend for /api requests
        }
        service.publicUrl = `https://${subdomain}.naaspeeti.xyz`;

        // Maintain stable subdomain mapping across redeploys
        await UsedPortAndSubDomain.findOneAndUpdate(
            { subdomain },
            { subdomain, port, deployment: deployment._id },
            { upsert: true }
        );

        if (oldInstanceRunning) {
            try {
                await stopAndRemoveContainer(appName, pushLog, service.ec2Host?.ip);
                const commands = [
                    `docker rename ${targetContainerName} ${appName}`,
                    `rm -rf ~/apps/${appName}`,
                    `mv ~/apps/${targetAppFolder} ~/apps/${appName}`
                ];
                await executeSSHCommands(commands, logs, pushLog, service.ec2Host?.ip);
            } catch (err) {
                pushLog(`[${new Date().toISOString()}] WARNING: Blue-green swap failed: ${err.message}. Manual cleanup may be needed.`);
                // Don't rethrow — new container IS running, deployment succeeded
            }
        } 

        await createEcrRepo(service._id);
        const ecrRepo = process.env.ECR_REPO_URL;
        const imageTag = `${ecrRepo}/app-${service._id}:latest`;

        await executeSSHCommands([
            `aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin ${ecrRepo}`,
            `docker tag app-${service._id} ${imageTag}`,
            `docker push ${imageTag}`,
            `docker rmi app-${service._id} || true`,
            `docker rmi ${imageTag} || true`
        ], logs, pushLog, service.ec2Host?.ip);

        service.imageUrl = imageTag;
        await collectContainerLogs(appName, pushLog, service.ec2Host?.ip);
    } catch (err) {
        // On deploy failure, if we did blue-green attempt, remove temporary deployment and keep old running
        const stagingDir = `${appName}-new`;

        await stopAndRemoveContainer(tempName, pushLog, service.ec2Host?.ip);
        await executeSSHCommands([
            `rm -rf ~/apps/${stagingDir} || true`,
            `docker rmi app-${service._id} || true`,
        ], [], pushLog, service.ec2Host?.ip);

        throw new Error(`SSH deployment failed: ${err.message}`);
    }
}