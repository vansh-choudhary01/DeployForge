import UsedPortAndSubDomain from '../models/UsedPort.js';

export async function getPort(preferredPort, serviceSubdomain) {
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

export async function pickNewPortForBlueGreen(oldPort, serviceSubdomain) {
    if (!oldPort) {
        return await getPort(null, serviceSubdomain);
    }

    // Try incrementing from oldPort upward until we find a free one
    for (let candidate = oldPort + 1; candidate <= 65535; candidate++) {
        const inUse = await UsedPortAndSubDomain.findOne({ port: candidate });
        if (!inUse) return candidate;
    }

    // Fallback: wrap around from 1024 downward
    for (let candidate = 1024; candidate < oldPort; candidate++) {
        const inUse = await UsedPortAndSubDomain.findOne({ port: candidate });
        if (!inUse) return candidate;
    }

    throw new Error('No available ports found for blue-green deployment');
}