import Deployment from "../models/Deployment.js";
import Service from "../models/Service.js";
import UsedPortAndSubDomain from "../models/UsedPort.js";
import { collectContainerLogs, detectContainerPort, ensureDockerContainerRunning, isContainerRunning, stopAndRemoveContainer } from "../helpers/docker.js";
import { getStableSubdomain } from "../helpers/subdomains.js";
import { getPort, pickNewPortForBlueGreen } from "../helpers/ports.js";
import { executeSSHCommands } from "../helpers/ssh.js";
import { setupSubdomain } from "../helpers/nginx.js";
import { getBestEc2 } from "../ec2Host/ec2_deployment.js";
import { createEcrRepo } from "../ec2Host/aws_ecr.js";
import { deployFrontend } from "../s3Host/deployFrontend.js";
import { RedisService } from "../redis-db/initilize.js";
import { consumeFromQueue, initializeQueue } from "../RabbitMQ/queue.js";
import { debugDeploymentFailure, formatDeploymentDiagnosis } from "../agents/deploymentDebugger.js";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { createClient } from "redis";
dotenv.config();

async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGO_URI)
        console.log('MongoDB connected')
    } catch (err) {
        console.log(err);
        process.exit(1);
    };
}

connectDB().then(() =>
    initializeQueue()
        .then(() => {
            console.log('Deployment worker connected to RabbitMQ, waiting for messages...');
            consumeFromQueue(deployFromQueue);
        })
        .catch(err => {
            console.error('Failed to initialize RabbitMQ queue:', err);
            process.exit(1);
        })
);

const redis = await RedisService.create();
const pubSubRedis = await RedisService.create();
const pubSubChannel = 'deployment_logs';

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

        if (service.deploymentType === 'static') {
            let logs = [];
            const pushLog = (message) => {
                logs.push(message);
                redis.insertToList(deployment._id.toString(), message)
                    .catch(err => console.error('Failed to cache deployment log:', err.message));
                deploymentLogger(message, service.user.toString(), deployment._id.toString());
            };
            // For static deployments, we can directly call the frontend deploy function without going through the SSH deployment process
            let deploymentStatus = 'running';
            deployFrontend(service, pushLog)
                .then(async () => {
                    pushLog(`[${new Date().toISOString()}] Static deployment completed successfully.`);
                    deploymentStatus = 'running';
                    let subdomain = service.subdomain;
                    if (service.subdomain) {
                        pushLog(`[${new Date().toISOString()}] Frontend deployed: https://${service.subdomain}.naaspeeti.xyz`);
                    } else {
                        const newsubdomain = await getStableSubdomain(service);
                        subdomain = newsubdomain;
                        pushLog(`[${new Date().toISOString()}] Frontend deployed: https://${subdomain}.naaspeeti.xyz`);
                    }
                    await Service.updateOne({ _id: service._id }, { subdomain, publicUrl: `https://${subdomain}.naaspeeti.xyz` });

                    statusEmitter('deployment:completed', {
                        deploymentId: deployment._id.toString(),
                        status: 'running',
                        deployedUrl: `https://${subdomain}.naaspeeti.xyz`
                    }, service.user.toString());

                    // Maintain stable subdomain mapping across redeploys
                    await UsedPortAndSubDomain.findOneAndUpdate(
                        { subdomain },
                        { subdomain, deployment: deployment._id },
                        { upsert: true }
                    );
                })
                .catch(async err => {
                    console.error('Static deployment error:', err);
                    pushLog(`[${new Date().toISOString()}] ERROR: ${err.message}`);
                    pushLog(`[${new Date().toISOString()}] Debugging agent is analyzing the failure...`);
                    const diagnosis = await debugDeploymentFailure({ error: err, logs, service });
                    const readableError = formatDeploymentDiagnosis(diagnosis);
                    pushLog(`[${new Date().toISOString()}] DEBUGGER: ${readableError}`);
                    deployment.error = readableError;
                    deployment.diagnosis = diagnosis;
                    deploymentStatus = 'failed';
                    statusEmitter('deployment:failed', {
                        deploymentId: deployment._id.toString(), status: 'failed', error: readableError, diagnosis
                    }, service.user.toString());
                }).finally(async () => {
                    await Promise.all([
                        Deployment.updateOne({ _id: deployment._id }, { status: deploymentStatus, logs, error: deployment.error, diagnosis: deployment.diagnosis }),
                        Service.updateOne({ _id: service._id }, { status: deploymentStatus })
                    ]);
                });
            return;
        }

        if ((!service.ec2Host || service.status === "sleeping") && service.subdomain !== 'api') {
            const logs = [];

            // Helper function to push logs and emit via socket.io
            const pushLog = (message) => {
                logs.push(message);
                redis.insertToList(deployment._id.toString(), message)
                    .catch(err => console.error('Failed to cache deployment log:', err.message));
                deploymentLogger(message, service.user.toString(), deployment._id.toString());
            };
            const bestEc2 = await getBestEc2(pushLog);
            service.ec2Host = bestEc2;;
            await service.save();
            const totalServices = await Service.countDocuments({ ec2Host: bestEc2._id, status: { $in: ['running', 'waking', 'pending'] } });
            bestEc2.totalServices = totalServices;
            await bestEc2.save();
        }

        await runDeployment(deployment, service)
            .catch(err => console.error('Unhandled deployment error:', err));
    } catch (err) {
        console.error('Worker error:', err);
    }
};

const deploymentLogger = (message, userId, deploymentId) => {
        pubSubRedis.publish(pubSubChannel, JSON.stringify({ userId, event: 'deployment:log', data: { deploymentId, log: message } }));
        // io.to(userSocketId).emit('deployment:log', {
        //     deploymentId,
        //     log: message
        // });
}

const statusEmitter = (event, data, userId) => {
        // io.to(socketId).emit(event, data);
        pubSubRedis.publish(pubSubChannel, JSON.stringify({ userId, event, data }));
};

async function runDeployment(deployment, service) {
    const startTime = Date.now();
    const logs = [];

    // Helper function to push logs and emit via socket.io
    const pushLog = (message) => {
        logs.push(message);
        redis.insertToList(deployment._id.toString(), message)
            .catch(err => console.error('Failed to cache deployment log:', err.message));
        deploymentLogger(message, service.user.toString(), deployment._id.toString());
    };

    // AFTER — extract a helper, call it once per emit
    const emitToUser = (event, data) => {
        statusEmitter(event, data, service.user.toString());
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

        pushLog(`[${new Date().toISOString()}] Debugging agent is analyzing the failure...`);
        const diagnosis = await debugDeploymentFailure({ error: err, logs, service });
        const readableError = formatDeploymentDiagnosis(diagnosis);
        pushLog(`[${new Date().toISOString()}] DEBUGGER: ${readableError}`);

        const running = await isContainerRunning(`app-${service._id}`, service.ec2Host?.ip);
        service.status = running ? "running" : "failed";
        deployment.status = "failed";
        deployment.error = readableError;
        deployment.diagnosis = diagnosis;

        // Emit deployment failed event
        emitToUser('deployment:failed', {
            deploymentId: deployment._id.toString(),
            status: 'failed',
            error: readableError,
            diagnosis
        });
    } finally {
        redis.clearLogs(deployment._id.toString()); // Clear logs from Redis after deployment is done to free up memory
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
            //            `docker container prune -f`, // Clean up any stopped containers to free resources before deployment
            //            `docker image prune -af`,  // remove all unused images
            `rm -rf ~/apps`, // Clean up old app folders to free disk space before deployment (it's just code and it's going to be re-cloned or reuse from the container, so safe to remove)
            // Ensure base directory exists
            `mkdir -p ~/apps`, // create base directory if it doesn't exist
            `cd ~/apps`,
        ];

        if (oldInstanceRunning) {
            // Keep old container running until new one is verified
            commands.push(`rm -rf ${targetAppFolder}`);
            commands.push(`docker rm -f ${targetContainerName} >/dev/null 2>&1 || true`);
        } else {
            commands.push(`docker stop ${appName} >/dev/null 2>&1 || true`);
            commands.push(`docker rm ${appName} >/dev/null 2>&1 || true`);
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

                `docker stop ${targetContainerName} >/dev/null 2>&1 || true`,
                `docker rm ${targetContainerName} >/dev/null 2>&1 || true`,

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
            `docker rmi app-${service._id} >/dev/null 2>&1 || true`,
            `docker rmi ${imageTag} >/dev/null 2>&1 || true`
        ], logs, pushLog, service.ec2Host?.ip);

        service.imageUrl = imageTag;
        await collectContainerLogs(appName, pushLog, service.ec2Host?.ip);
    } catch (err) {
        // On deploy failure, if we did blue-green attempt, remove temporary deployment and keep old running
        const stagingDir = `${appName}-new`;

        try {
            await stopAndRemoveContainer(tempName, pushLog, service.ec2Host?.ip);
            await executeSSHCommands([
                `rm -rf ~/apps/${stagingDir} || true`,
                `docker rmi app-${service._id} >/dev/null 2>&1 || true`,
            ], [], pushLog, service.ec2Host?.ip);
        } catch (cleanupError) {
            pushLog(`[${new Date().toISOString()}] WARNING: Failure cleanup was incomplete: ${cleanupError.message}`);
        }

        throw new Error(`SSH deployment failed: ${err.message}`);
    }
}
