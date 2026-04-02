import { Client } from "ssh2";

const activeConnections = new Set();
process.on('SIGINT', () => { activeConnections.forEach(c => c.end()); process.exit(0); });
process.on('SIGTERM', () => { activeConnections.forEach(c => c.end()); process.exit(0); });

export function executeSSHCommands(commands, logs, pushLog, ec2Host = process.env.EC2_HOST || 'localhost') {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        activeConnections.add(conn);

        conn.on('ready', () => {
            pushLog(`[${new Date().toISOString()}] Connected to EC2`);

            const fullCommand = 'set -e\n' + commands.join('\n');

            conn.exec(fullCommand, (err, stream) => {
                if (err) {
                    conn.end();
                    activeConnections.delete(conn);
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
                    activeConnections.delete(conn);

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
            activeConnections.delete(conn);
            pushLog(`[${new Date().toISOString()}] CONNECTION ERROR: ${err.message}`);
            reject(err);
        });

        // Connect to EC2
        try {
            conn.connect({
                host: ec2Host,
                port: 22,
                username: process.env.EC2_USER || 'ubuntu',
                privateKey: Buffer.from(process.env.EC2_SSH_KEY_BASE64, 'base64').toString('utf-8'),
                readyTimeout: 30000,
            });
        } catch (err) {
            activeConnections.delete(conn);
            pushLog(`[${new Date().toISOString()}] SSH CONFIG ERROR: ${err.message}`);
            reject(new Error(`Failed to read SSH key: ${err.message}`));
        }
    });
}

export async function waitForSSH(ip, retries = 10, delayMs = 10000) {
    for (let i = 0; i < retries; i++) {
        try {
            await executeSSHCommands(['echo SSH connection successful'], [], () => { }, ip);
            return; // success
        } catch (err) {
            console.log(`SSH not ready yet, attempt ${i + 1}/${retries}. Retrying in ${delayMs / 1000}s...`);
            await new Promise(res => setTimeout(res, delayMs));
        }
    }

    throw new Error(`SSH never became available on ${ip} after ${retries} attempts`);
}