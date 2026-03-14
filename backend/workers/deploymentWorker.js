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

        service.status = "failed";
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

async function getPort() {
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

async function deployViaSSH(deployment, service, logs, pushLog) {
    const appName = `app-${deployment._id}`;
    const port = await getPort();
    const { gitRepositoryUrl, gitBranch, startCommand, environmentVariables } = service;

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

            // Handle redeployment safely - stop and remove existing container
            `docker stop ${appName} || true`,
            `docker rm ${appName} || true`,

            // Remove previous code directory
            `rm -rf ${appName}`,

            // Clone the repository
            `git clone --branch ${gitBranch} ${gitRepositoryUrl} ${appName}`,
            `cd ${appName}`,
        ];

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
        let dockerRunCmd = `docker run -d --name ${appName} -e PORT=3000 -p ${port}:3000`;

        if (environmentVariables && environmentVariables.length > 0) {
            dockerRunCmd += ` --env-file .env`;
        }

        dockerRunCmd += ` ${appName}`;
        commands.push(dockerRunCmd);

        // Execute all commands via SSH
        pushLog(`[${new Date().toISOString()}] Connecting to EC2...`);
        const result = await executeSSHCommands(commands, logs, pushLog);

        pushLog(`[${new Date().toISOString()}] Docker container started successfully: ${appName}`);

        const detectedPort = await detectContainerPort(appName, pushLog);

        if (detectedPort && detectedPort !== 3000) {

            pushLog(`[${new Date().toISOString()}] Detected port ${detectedPort}, restarting container with correct port mapping`);

            const restartCommands = [
                `cd ~/apps/${appName}`,
                `cd ${relativeRootDirectory}`,

                `docker stop ${appName}`,

                `docker rm ${appName}`,

                `docker run -d --name ${appName} -e PORT=${detectedPort} -p ${port}:${detectedPort}${environmentVariables && environmentVariables.length > 0 ? ' --env-file .env' : ''} ${appName}`

            ];

            await executeSSHCommands(restartCommands, logs, pushLog);

            // Ensure the restarted container is running before proceeding.
            await ensureDockerContainerRunning(appName, pushLog);
        }

        // Store deployment metadata
        deployment.dockerImage = appName;
        deployment.port = port;

        const subdomain = await getSubdomain(service.name);

        // Store port mapping in Port collection for tracking
        await UsedPortAndSubDomain.create({ subdomain, port, deployment: deployment._id });

        await setupSubdomain(subdomain, port, pushLog);
        service.publicUrl = `https://${subdomain}.naaspeeti.xyz`;

        await collectContainerLogs(appName, pushLog);
    } catch (err) {
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
