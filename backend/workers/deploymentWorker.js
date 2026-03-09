import Deployment from "../models/Deployment.js";
import Service from "../models/Service.js";
import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';

// Start deployment worker - polls every 2 seconds for queued deployments
setInterval(async () => {
    try {
        const deployment = await Deployment.findOneAndUpdate(
            { status: "queued" },
            { status: "building" }
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

    try {
        logs.push(`[${new Date().toISOString()}] Starting deployment...`);
        logs.push(`Repository: ${service.gitRepositoryUrl}`);
        logs.push(`Branch: ${service.gitBranch}`);

        // Deploy using SSH
        await deployViaSSH(deployment, service, logs);

        // Update service status
        service.status = "running";
        service.publicUrl = `http://${process.env.EC2_HOST}:${deployment.port}`;
        
        // Update deployment
        deployment.status = "running";
        deployment.logs = logs;
        deployment.deployedUrl = service.publicUrl;
        
        logs.push(`[${new Date().toISOString()}] Deployment completed successfully!`);
        logs.push(`Service available at: ${service.publicUrl}`);

    } catch (err) {
        console.error('Deployment error:', err);
        logs.push(`[${new Date().toISOString()}] ERROR: ${err.message}`);
        
        service.status = "failed";
        deployment.status = "failed";
        deployment.logs = logs;
    }

    // Save changes
    await service.save();
    await deployment.save();
}

async function deployViaSSH(deployment, service, logs) {
    const appName = `app-${deployment._id}`;
    const port = deployment.port || 3000;
    const { gitRepositoryUrl, gitBranch, startCommand, environmentVariables } = service;

    logs.push(`[${new Date().toISOString()}] Initializing deployment...`);

    try {
        // Build commands to execute on EC2
        const commands = [
            `mkdir -p ~/apps`,
            `cd ~/apps`,
            `git clone --branch ${gitBranch} ${gitRepositoryUrl} ${appName}`,
            `cd ${appName}`,
        ];

        // Add npm install/build commands
        if (service.preDeployCommand) {
            commands.push(`${service.preDeployCommand}`);
        }
        if (service.buildCommand) {
            commands.push(`${service.buildCommand}`);
        }

        // Create .env file if environment variables exist
        if (environmentVariables && environmentVariables.length > 0) {
            const envContent = environmentVariables
                .map(ev => `${ev.key}=${ev.value}`)
                .join('\\n');
            
            commands.push(`cat > .env << 'EOF'\n${envContent}\nEOF`);
        }

        // Create Dockerfile
        const dockerfile = `FROM node:20
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE ${port}
CMD ["${startCommand.split(' ').join('", "')}"]`;

        commands.push(`cat > Dockerfile << 'EOF'\n${dockerfile}\nEOF`);

        // Build and run Docker image
        commands.push(`docker build -t ${appName} .`);
        
        let dockerRunCmd = `docker run -d --name ${appName} -p ${port}:${port}`;
        if (environmentVariables && environmentVariables.length > 0) {
            dockerRunCmd += ` --env-file .env`;
        }
        dockerRunCmd += ` ${appName}`;
        commands.push(dockerRunCmd);

        // Execute all commands via SSH
        logs.push(`[${new Date().toISOString()}] Connecting to EC2...`);
        const result = await executeSSHCommands(commands, logs);

        logs.push(`[${new Date().toISOString()}] Docker container started: ${appName}`);
        
        deployment.dockerImage = appName;
        deployment.port = port;

    } catch (err) {
        throw new Error(`SSH deployment failed: ${err.message}`);
    }
}

function executeSSHCommands(commands, logs) {
    return new Promise((resolve, reject) => {
        const conn = new Client();

        conn.on('ready', () => {
            logs.push(`[${new Date().toISOString()}] Connected to EC2`);
            
            const fullCommand = commands.join(' && ');
            
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
                    logs.push(`[${new Date().toISOString()}] ${message}`);
                });

                stream.stderr.on('data', (data) => {
                    const message = data.toString();
                    error += message;
                    logs.push(`[${new Date().toISOString()}] ERROR: ${message}`);
                });

                stream.on('close', (code) => {
                    conn.end();

                    if (code === 0) {
                        logs.push(`[${new Date().toISOString()}] Commands executed successfully`);
                        resolve({ output, error: '', code });
                    } else {
                        reject(new Error(error || `Commands failed with exit code ${code}`));
                    }
                });
            });
        });

        conn.on('error', (err) => {
            logs.push(`[${new Date().toISOString()}] CONNECTION ERROR: ${err.message}`);
            reject(err);
        });

        // Connect to EC2
        try {
            conn.connect({
                host: process.env.EC2_HOST || 'localhost',
                port: 22,
                username: process.env.EC2_USER || 'ubuntu',
                privateKey: fs.readFileSync(process.env.EC2_SSH_KEY_PATH || path.join(process.cwd(), 'id_rsa')),
                readyTimeout: 30000,
            });
        } catch (err) {
            logs.push(`[${new Date().toISOString()}] SSH CONFIG ERROR: ${err.message}`);
            reject(new Error(`Failed to read SSH key: ${err.message}`));
        }
    });
}