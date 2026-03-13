import Deployment from "../models/Deployment.js";
import Service from "../models/Service.js";
import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { io } from '../index.js';
import UsedPort from "../models/UsedPort.js";
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

async function runDeployment(deployment, service) {
    const logs = [];

    // Helper function to push logs and emit via socket.io
    const pushLog = (message) => {
        logs.push(message);
        io.emit('deployment:log', {
            deploymentId: deployment._id.toString(),
            log: message
        });
    };

    try {
        pushLog(`[${new Date().toISOString()}] Starting deployment...`);
        pushLog(`Repository: ${service.gitRepositoryUrl}`);
        pushLog(`Branch: ${service.gitBranch}`);

        // Emit deployment started event
        io.emit('deployment:started', {
            deploymentId: deployment._id.toString(),
            status: 'building'
        });

        // Deploy using SSH
        await deployViaSSH(deployment, service, logs, pushLog);

        // Update service status
        service.status = "running";
        service.publicUrl = `http://${process.env.EC2_HOST}:${deployment.port}`;

        // Update deployment
        deployment.status = "running";
        deployment.logs = logs;
        deployment.deployedUrl = service.publicUrl;

        pushLog(`[${new Date().toISOString()}] Deployment completed successfully!`);
        pushLog(`Service available at: ${service.publicUrl}`);

        // Emit deployment completed event
        io.emit('deployment:completed', {
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
        io.emit('deployment:failed', {
            deploymentId: deployment._id.toString(),
            status: 'failed',
            error: err.message
        });
    }

    // Save changes
    await service.save();
    await deployment.save();
}

async function getPort() {
    let port = Math.floor(Math.random() * (65535 - 1024) + 1024); // Random port between 1024 and 65535
    let existingPort = await UsedPort.findOne({ port });

    while (existingPort) {
        console.log('Port already in use, trying another...', existingPort);
        port = Math.floor(Math.random() * (65535 - 1024) + 1024); // Random port between 1024 and 65535
        existingPort = await UsedPort.findOne({ port });
    }

    return port;
}

async function deployViaSSH(deployment, service, logs, pushLog) {
    const appName = `app-${deployment._id}`;
    const port = deployment.port || await getPort(); // Fallback port if not set
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
            `mkdir -p ~/apps`,
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

        // Execute pre-deploy command if exists
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

            commands.push(`cat > .env << 'ENVFILE'\n${envContent}\nENVFILE`);
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

        }

        // Store deployment metadata
        deployment.dockerImage = appName;
        deployment.port = port;

        // Store port mapping in Port collection for tracking
        await UsedPort.create({ port, deployment: deployment._id });
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

async function detectContainerPort(containerName, pushLog) {
    for (let i = 0; i < 5; i++) {
        try {
            const detectCommands = [`docker exec ${containerName} ss -tulpn`];
            const result = await executeSSHCommands(detectCommands, [], () => {}); // no logs
            const output = result.output;
            const lines = output.split('\n');
            for (const line of lines) {
                if (line.includes('node')) {
                    // const match = line.match(/0\.0\.0\.0:(\d+)/);
                    const match = line.match(/:(\d+)/);
                    if (match) {
                        const port = parseInt(match[1]);
                        pushLog(`[${new Date().toISOString()}] Detected listening port: ${port}`);
                        return port;
                    }
                }
            }
        } catch (err) {
            // ignore errors during detection
        }
        pushLog(`[${new Date().toISOString()}] Port not detected yet, retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error('Unable to detect listening port after 5 retries');
}