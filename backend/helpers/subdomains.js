import UsedPortAndSubDomain from '../models/UsedPort.js';

export async function getSubdomain(serviceName) {
    const base = serviceName.toLowerCase().replace(/_/g, '-');
    let subdomain = base;

    let attempts = 0;
    while (await UsedPortAndSubDomain.findOne({ subdomain })) {
        if (++attempts > 10) throw new Error(`Cannot generate unique subdomain for ${base} after 10 attempts`);
        subdomain = `${base}-${Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 4)}`;
    }

    return subdomain;
}

export async function getStableSubdomain(service) {
    // Keep the same subdomain across redeploys if already set.
    if (service.subdomain) {
        return service.subdomain;
    }

    // Fallback to fresh subdomain generation if not set.
    const subdomain = await getSubdomain(service.name);
    service.subdomain = subdomain;
    return subdomain;
}