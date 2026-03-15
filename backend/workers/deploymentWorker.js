import Deployment from "../models/Deployment.js";
import Service from "../models/Service.js";
import { Client } from 'ssh2';
import fs from 'fs';
import { io, sockets } from '../index.js';
import UsedPortAndSubDomain from "../models/UsedPort.js";
// Start deployment worker - polls every 2 seconds for queued deployments
setInterval(async () => {
    try {
        const deployment = await Deployment.findOneAndUpdate(
            { status: "queued" },
            { status: "building" },
            { sort: { createdAt: 1 } }
        );

        if (!deployment) return;

        // Get service details
        const service = await Service.findById(deployment.service);
        if (!service) {
            await Deployment.updateOne(
                { _id: deployment._id },
                { status: "failed", logs: ["Service not found"] }
            );
            return;
        }

        await runDeployment(deployment, service);
    } catch (err) {
        console.error('Worker error:', err);
    }
}, 2000);

const logsMap = new Map(); // In-memory map to store logs for each deployment

export const getDeploymentLogs = (deploymentId, userId) => {
    const userSocketId = sockets.get(userId);

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
        io.to(userSocketId).emit('deployment:log', {
            deploymentId: deployment._id.toString(),
            log: message
        });
    };

    try {
        pushLog(`[${new Date().toISOString()}] Starting deployment...`);
        pushLog(`Repository: ${service.gitRepositoryUrl}`);
        pushLog(`Branch: ${service.gitBranch}`);

        // Emit deployment started event
        var userSocketId = sockets.get(service.user.toString());
        io.to(userSocketId).emit('deployment:started', {
            deploymentId: deployment._id.toString(),
            status: 'building'
        });

        // Deploy using SSH
        await deployViaSSH(deployment, service, logs, pushLog);

        // Update service status
        service.status = "running";

        // Update deployment
        deployment.status = "running";
        deployment.deployedUrl = service.publicUrl;

        pushLog(`[${new Date().toISOString()}] Deployment completed successfully!`);
        pushLog(`Service available at: ${service.publicUrl}`);
        deployment.logs = logs;

        // Emit deployment completed event
        var userSocketId = sockets.get(service.user.toString());
        io.to(userSocketId).emit('deployment:completed', {
            deploymentId: deployment._id.toString(),
            status: 'running',
            deployedUrl: service.publicUrl
        });

    } catch (err) {
        console.error('Deployment error:', err);
        pushLog(`[${new Date().toISOString()}] ERROR: ${err.message}`);

        const running = await isContainerRunning(`app-${service._id}`);
        service.status = running ? "running" : "failed";
        deployment.status = "failed";
        deployment.logs = logs;

        // Emit deployment failed event
        var userSocketId = sockets.get(service.user.toString());
        io.to(userSocketId).emit('deployment:failed', {
            deploymentId: deployment._id.toString(),
            status: 'failed',
            error: err.message
        });
    }

    deployment.duration = Math.round((Date.now() - startTime) / 1000); // Calculate duration in seconds

    // Save changes
    await service.save();
    await deployment.save();

    logsMap.delete(deployment._id.toString()); // Clean up logs from memory after deployment is done
}

async function getPort(preferredPort, serviceSubdomain) {
    if (preferredPort) {
        const existingPort = await UsedPortAndSubDomain.findOne({ port: preferredPort });
        if (!existingPort || existingPort.subdomain === serviceSubdomain) {
            return preferredPort;
        }
        console.log(`Preferred port ${preferredPort} is used by ${existingPort.subdomain}, selecting a new port`);
    }

    let port = Math.floor(Math.random() * (65535 - 1024) + 1024); // Random port between 1024 and 65535
    let existingPort = await UsedPortAndSubDomain.findOne({ port });

    while (existingPort) {
        console.log('Port already in use, trying another...', existingPort);
        port = Math.floor(Math.random() * (65535 - 1024) + 1024); // Random port between 1024 and 65535
        existingPort = await UsedPortAndSubDomain.findOne({ port });
    }

    return port;
}

async function getSubdomain(serviceName) {
    const base = serviceName.toLowerCase().replace(/_/g, '-');
    let subdomain = base;

    while (await UsedPortAndSubDomain.findOne({ subdomain })) {
        subdomain = `${base}-${Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 4)}`;
    }

    return subdomain;
}

async function getStableSubdomain(service) {
    // Keep the same subdomain across redeploys if already set.
    if (service.subdomain) {
        return service.subdomain;
    }

    // Fallback to fresh subdomain generation if not set.
    const subdomain = await getSubdomain(service.name);
    service.subdomain = subdomain;
    return subdomain;
}

async function isContainerRunning(containerName) {
    try {
        const result = await executeSSHCommands([`docker ps -q -f name=^/${containerName}$`], [], () => {});
        return Boolean(result.output && result.output.trim());
    } catch (err) {
        return false;
    }
}

async function pickNewPortForBlueGreen(oldPort, serviceSubdomain) {
    if (!oldPort) {
        return await getPort(null, serviceSubdomain);
    }
    let port = await getPort(oldPort, serviceSubdomain);
    if (port === oldPort) {
        // find alternative port
        for (let i = 0; i < 5; i++) {
            port = await getPort(null, serviceSubdomain);
            if (port !== oldPort) break;
        }
    }
    return port;
}

async function stopAndRemoveContainer(containerName, pushLog) {
    try {
        await executeSSHCommands([
            `docker stop ${containerName} || true`,
            `docker rm ${containerName} || true`
        ], [], pushLog);
    } catch (err) {
        pushLog(`[${new Date().toISOString()}] Warning: could not stop/remove ${containerName}: ${err.message}`);
    }
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

    const oldInstanceRunning = await isContainerRunning(appName);

    // If there is an old instance, deploy to temp instance first
    const targetContainerName = oldInstanceRunning ? tempName : appName;
    const targetAppFolder = oldInstanceRunning ? `${appName}-new` : appName;

    port = oldInstanceRunning ? await pickNewPortForBlueGreen(port, subdomain) : await getPort(port, subdomain);

    // Persist stable mapping attributes on service for future redeploys (after successful deploy we may adjust)
    service.subdomain = subdomain;
    service.port = oldInstanceRunning ? port : port;

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

        let relativeRootDirectory = '/';
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

            commands.push(`cat > .env << 'ENVFILE'\n${envContent}\nENVFILE`); // create .env file with environment variables
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
        commands.push(`cat > Dockerfile << 'DOCKERFILE'\n${dockerfile}\nDOCKERFILE`);

        // Build Docker image without cache
        pushLog(`[${new Date().toISOString()}] Building Docker image: ${appName}`);
        // commands.push(`docker build --no-cache -t ${appName} .`);
        commands.push(`docker build -t ${appName} .`);

        // Start the container
        pushLog(`[${new Date().toISOString()}] Starting Docker container on port ${port}`);
        let dockerRunCmd = `docker run -d --name ${targetContainerName} -e PORT=3000 -p ${port}:3000`;

        if (environmentVariables && environmentVariables.length > 0) {
            dockerRunCmd += ` --env-file .env`;
        }

        dockerRunCmd += ` ${appName}`;
        commands.push(dockerRunCmd);

        // Execute all commands via SSH
        pushLog(`[${new Date().toISOString()}] Connecting to EC2...`);
        const result = await executeSSHCommands(commands, logs, pushLog);

        pushLog(`[${new Date().toISOString()}] Docker container started successfully: ${targetContainerName}`);

        const detectedPort = await detectContainerPort(targetContainerName, pushLog);

        if (detectedPort && detectedPort !== 3000) {

            pushLog(`[${new Date().toISOString()}] Detected port ${detectedPort}, restarting container with correct port mapping`);

            const restartCommands = [
                `cd ~/apps/${targetAppFolder}`,
                `cd ${relativeRootDirectory}`,

                `docker stop ${targetContainerName} || true`,
                `docker rm ${targetContainerName} || true`,

                `docker run -d --name ${targetContainerName} -e PORT=${detectedPort} -p ${port}:${detectedPort}${environmentVariables && environmentVariables.length > 0 ? ' --env-file .env' : ''} ${appName}`
            ];

            await executeSSHCommands(restartCommands, logs, pushLog);

            // Ensure the restarted container is running before proceeding.
            await ensureDockerContainerRunning(targetContainerName, pushLog);
        }

        // Store deployment metadata
        deployment.dockerImage = appName;
        deployment.port = port;

        // Maintain stable subdomain mapping across redeploys
        await UsedPortAndSubDomain.findOneAndUpdate(
            { subdomain },
            { subdomain, port, deployment: deployment._id },
            { upsert: true, new: true }
        );

        await setupSubdomain(subdomain, port, pushLog);
        service.publicUrl = `https://${subdomain}.naaspeeti.xyz`;

        if (oldInstanceRunning) {
            await stopAndRemoveContainer(appName, pushLog);
            const commands = [
                `docker rename ${targetContainerName} ${appName}`,
                `rm -rf ~/apps/${appName}`,
                `mv ~/apps/${targetAppFolder} ~/apps/${appName}`
            ];
            await executeSSHCommands(commands, logs, pushLog);
            await collectContainerLogs(appName, pushLog);
        } else {
            await collectContainerLogs(appName, pushLog);
        }
    } catch (err) {
        // On deploy failure, if we did blue-green attempt, remove temporary deployment and keep old running
        const tempName = `${appName}-new`;
        const stagingDir = `${appName}-new`;

        await stopAndRemoveContainer(tempName, pushLog);
        await executeSSHCommands([`rm -rf ~/apps/${stagingDir}`], [], pushLog);

        throw new Error(`SSH deployment failed: ${err.message}`);
    }
}

function executeSSHCommands(commands, logs, pushLog) {
    return new Promise((resolve, reject) => {
        const conn = new Client();

        conn.on('ready', () => {
            pushLog(`[${new Date().toISOString()}] Connected to EC2`);

            const fullCommand = 'set -e\n' + commands.join('\n');

            conn.exec(fullCommand, (err, stream) => {
                if (err) {
                    conn.end();
                    return reject(err);
                }

                let output = '';
                let error = '';

                stream.on('data', (data) => {
                    const message = data.toString();
                    output += message;
                    pushLog(`[${new Date().toISOString()}] ${message}`);
                });

                stream.stderr.on('data', (data) => {
                    const message = data.toString();

                    // const isWarning =
                    //     message.toLowerCase().includes('warn') ||
                    //     message.toLowerCase().includes('deprecated') ||
                    //     message.toLowerCase().includes('notice');

                    // if (isWarning) {
                    pushLog(`[${new Date().toISOString()}] WARNING: ${message}`);
                    // } else {
                    error += message;
                    //     pushLog(`[${new Date().toISOString()}] ERROR: ${message}`);
                    // }
                });

                stream.on('close', (code) => {
                    conn.end();

                    if (code === 0) {
                        pushLog(`[${new Date().toISOString()}] Commands executed successfully`);
                        resolve({ output, error: '', code });
                    } else {
                        reject(new Error(error || `Commands failed with exit code ${code}`));
                    }
                });
            });
        });

        conn.on('error', (err) => {
            pushLog(`[${new Date().toISOString()}] CONNECTION ERROR: ${err.message}`);
            reject(err);
        });

        // Connect to EC2
        try {
            conn.connect({
                host: process.env.EC2_HOST || 'localhost',
                port: 22,
                username: process.env.EC2_USER || 'ubuntu',
                privateKey: fs.readFileSync(process.env.EC2_SSH_KEY_PATH),
                readyTimeout: 30000,
            });
        } catch (err) {
            pushLog(`[${new Date().toISOString()}] SSH CONFIG ERROR: ${err.message}`);
            reject(new Error(`Failed to read SSH key: ${err.message}`));
        }
    });
}

async function ensureDockerContainerRunning(containerName, pushLog) {
    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            const stateCommands = [`docker inspect -f '{{.State.Running}}' ${containerName}`];
            const stateResult = await executeSSHCommands(stateCommands, [], () => {});
            const state = (stateResult.output || '').trim();
            pushLog(`[${new Date().toISOString()}] Container ${containerName} state: ${state}`);

            if (state === 'true') {
                return true;
            }

            pushLog(`[${new Date().toISOString()}] Container ${containerName} is not running (state=${state}), retrying in 2 seconds (${attempt}/5)`);
        } catch (err) {
            pushLog(`[${new Date().toISOString()}] Error checking container state for ${containerName}: ${err.message}. Retry ${attempt}/5`);
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    await collectContainerLogs(containerName, pushLog); // Collect logs to help diagnose why container isn't running
    throw new Error(`Container ${containerName} is not running after 5 retries`);
}

async function detectContainerPort(containerName, pushLog) {
    await ensureDockerContainerRunning(containerName, pushLog);

    for (let i = 0; i < 5; i++) {
        try {
            const detectCommands = [`docker exec ${containerName} ss -tulpn`];
            const result = await executeSSHCommands(detectCommands, [], () => {}); // no logs
            const output = result.output;
            const lines = output.split('\n');
            for (const line of lines) {
                if (line.includes('node')) {
                    // const match = line.match(/0\.0\.0\.0:(\d+)/);
                    const match = line.match(/:(\d{2,5})/);
                    if (match) {
                        const port = parseInt(match[1]);
                        pushLog(`[${new Date().toISOString()}] Detected listening port: ${port}`);
                        return port;
                    }
                }
            }
        } catch (err) {
            pushLog(`[${new Date().toISOString()}] Error while detecting container port: ${err.message}`);
        }
        pushLog(`[${new Date().toISOString()}] Port not detected yet, retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    await collectContainerLogs(containerName, pushLog); // Collect logs to help diagnose why container isn't running
    throw new Error('Unable to detect listening port after 5 retries');
}

async function setupSubdomain(subdomain, port, pushLog) {
    const nginxConfig = `
server {
    listen 80;
    server_name ${subdomain}.naaspeeti.xyz;

    location / {
        proxy_pass http://localhost:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}`;

    const commands = [
        // Remove old config if redeploying
        `sudo rm -f /etc/nginx/sites-enabled/${subdomain}`,
        `sudo rm -f /etc/nginx/sites-available/${subdomain}`,

        // Write new nginx config
        `echo '${nginxConfig}' | sudo tee /etc/nginx/sites-available/${subdomain}`,

        // Enable it
        `sudo ln -sf /etc/nginx/sites-available/${subdomain} /etc/nginx/sites-enabled/${subdomain}`,

        // Test and reload nginx
        `sudo nginx -t && sudo nginx -s reload`,

        // Issue SSL cert for this subdomain
        `sudo certbot --nginx -d ${subdomain}.naaspeeti.xyz --non-interactive --agree-tos -m your@email.com`
    ];

    await executeSSHCommands(commands, [], pushLog);

    pushLog(`[${new Date().toISOString()}] Subdomain ready: https://${subdomain}.naaspeeti.xyz`);
}

async function collectContainerLogs(appName, pushLog) {
    pushLog(`[${new Date().toISOString()}] Collecting logs for ${appName}...`);
    pushLog(`[${new Date().toISOString()}] Streaming logs in real-time.`);
    const commands = [`timeout 12 docker logs -f --tail 200 ${appName} || true`]; // Stream logs for 12 seconds to capture startup logs

    await executeSSHCommands(
        commands,
        [],
        pushLog
    );

    pushLog(`[${new Date().toISOString()}] Log streaming finished`);
}
