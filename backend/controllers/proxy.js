import { migrateService } from "../ec2Host/ec2_consolidation.js";
import { getBestEc2 } from "../ec2Host/ec2_deployment.js";
import { isContainerRunning } from "../helpers/docker.js";
import { executeSSHCommands } from "../helpers/ssh.js";
import { Ec2Registry } from "../models/ec2Registry.js";
import Service from "../models/Service.js";
import { sendToQueue } from "../RabbitMQ/wakeupQueue.js";
import { wakingUpPage, notFoundPage } from "../utils/pages.js";
import httpProxy from 'http-proxy';
const proxy = httpProxy.createProxyServer({});

export async function WakeServiceSubDomain({type, serviceId}) {
    try {
        const service = await Service.findById(serviceId).populate('ec2Host');
        if (!service) {
            console.error(`Service with ID ${serviceId} not found for waking up`);
            throw new Error('Service not found');
        }
        const appName = `app-${service._id}`;

        const bestEc2 = await getBestEc2();
        if (bestEc2.ip !== service.ec2Host?.ip) {
            console.log(`Migrating service ${service._id} from EC2 ${service.ec2Host?.ip} to EC2 ${bestEc2.ip}`);
            await migrateService(service, service.ec2Host, bestEc2);
        } else {
            await executeSSHCommands([`docker start ${appName}`], [], () => { }, service.ec2Host?.ip);
        }

        // wait for container to start
        await new Promise(resolve => setTimeout(resolve, 5000));
        if (await isContainerRunning(appName, service.ec2Host?.ip)) {
            service.status = 'running';
            await service.save();
            const totalServices = await Service.countDocuments({ ec2Host: service.ec2Host?._id });
            await Ec2Registry.updateOne({ _id: service.ec2Host }, { totalServices });
            return true;
        }

        return false;
    } catch (err) {
        console.error(`Error waking service ${serviceId}:`, err);
        return false;
    }
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
            // WakeServiceSubDomain(service);
            sendToQueue({ type: 'wake', serviceId: service._id });

            return res.send(wakingUpPage(subdomain));
        }

        // forward the request to the service's EC2 host
        const targetUrl = `http://${service.ec2Host?.ip}:${service.port}`;

        proxy.web(req, res, { target: targetUrl }, (err) => {
            console.error('Proxy error', err);
            res.status(502).send("Bad Gateway");
        });
    } catch (err) {
        console.error('Proxy error', err);
        res.status(500).send("Internal Server Error");
    }
}