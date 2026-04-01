import Service from "../models/Service.js";
import { wakingUpPage, notFoundPage } from "../utils/pages.js";

async function WakeServiceSubDomain(service) {
    const appName = `app-${service._id}`;
    service.status = 'waking';
    await service.save();

    const bestEc2 = await getBestEc2();
    if (bestEc2.ip !== service.ec2Host?.ip) {
        console.log(`Migrating service ${service._id} from EC2 ${service.ec2Host?.ip} to EC2 ${bestEc2.ip}`);
        await migrateService(service, service.ec2Host, bestEc2);
    }

    await executeSSHCommands([`docker start ${appName}`], [], () => { }, service.ec2Host?.ip);

    // wait for container to start
    await new Promise(resolve => setTimeout(resolve, 5000));
    await ensureDockerContainerRunning(appName, () => { });

    service.status = 'running';
    await service.save();
}

export async function subdomainProxy(req, res) {
    try {
        const { subdomain } = req.params;
        const service = await Service.findOne({ subdomain }).populate('ec2Host');

        if (!service) return res.status(404).send(notFoundPage(subdomain));

        // update last request
        await Service.findByIdAndUpdate(service._id, { lastRequestAt: new Date() });

        // sleeping? wake it
        if (service.status === 'sleeping') {
            WakeServiceSubDomain(service);
            return res.send(wakingUpPage(subdomain));
        }

        // forward the request to the service's EC2 host
        const targetUrl = `http://${service.ec2Host.ip}:${service.port}${req.path}`;
        res.redirect(targetUrl);
    } catch (err) {
        console.error('Proxy error', err);
        res.status(500).send("Internal Server Error");
    }
}