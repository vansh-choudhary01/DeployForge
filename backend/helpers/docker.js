import { executeSSHCommands } from "./ssh.js";

export async function isContainerRunning(containerName) {
    try {
        const result = await executeSSHCommands([`docker ps -q -f name=^/${containerName}$`], [], () => { });
        return Boolean(result.output && result.output.trim());
    } catch (err) {
        return false;
    }
}

export async function ensureDockerContainerRunning(containerName, pushLog) {
    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            const stateCommands = [`docker inspect -f '{{.State.Running}}' ${containerName}`];
            const stateResult = await executeSSHCommands(stateCommands, [], () => { });
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

export async function detectContainerPort(containerName, pushLog) {
    await ensureDockerContainerRunning(containerName, pushLog);

    for (let i = 0; i < 5; i++) {
        try {
            const detectCommands = [`docker exec ${containerName} ss -tulpn`];
            const result = await executeSSHCommands(detectCommands, [], () => { }); // no logs
            const output = result.output;
            const lines = output.split('\n');
            for (const line of lines) {
                if (line.includes('node')) {
                    // const match = line.match(/0\.0\.0\.0:(\d+)/);
                    const match =
                        line.match(/0\.0\.0\.0:(\d+)/) ||   // IPv4 explicit bind
                        line.match(/\*:(\d+)/) ||            // wildcard bind
                        line.match(/:::(\d+)/);              // IPv6 all-interfaces

                    if (match) {
                        const port = parseInt(match[1]);
                        if (port >= 1024 && port <= 65535) { // sanity check range
                            pushLog(`[${new Date().toISOString()}] Detected listening port: ${port}`);
                            return port;
                        }
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

export async function stopAndRemoveContainer(containerName, pushLog) {
    try {
        await executeSSHCommands([
            `docker stop ${containerName} || true`,
            `docker rm ${containerName} || true`
        ], [], pushLog);
    } catch (err) {
        pushLog(`[${new Date().toISOString()}] Warning: could not stop/remove ${containerName}: ${err.message}`);
    }
}

export async function collectContainerLogs(appName, pushLog) {
    pushLog(`[${new Date().toISOString()}] Collecting logs for ${appName}...`);
    pushLog(`[${new Date().toISOString()}] Streaming logs in real-time.`);
    const commands = [`(timeout 12 docker logs -f --tail 200 ${appName} || true)`]; // Stream logs for 12 seconds to capture startup logs

    await executeSSHCommands(
        commands,
        [],
        pushLog
    );

    pushLog(`[${new Date().toISOString()}] Log streaming finished`);
}