import { executeSSHCommands } from "../helpers/ssh.js";
import { Ec2Registry } from "../models/ec2Registry.js";
import Service from "../models/Service.js";

setInterval(async () => {
    try {
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

        const idleServices = await Service.find({
            status: 'running',
            lastRequestAt: { $lt: fifteenMinsAgo }
        }).populate('ec2Host');

        for (const service of idleServices) {
            if (service.subdomain === 'api') continue; // never sleep the API service
            await sleepService(service);
        }
    } catch (err) {
        console.error('Error during sleep monitoring:', err);
    }
}, 5 * 60 * 1000); // Check every 5 minutes

async function sleepService(service) {
    const appName = `app-${service._id}`;

    await executeSSHCommands([`docker stop ${appName}`], [], () => { }, service.ec2Host?.ip);

    service.status = 'sleeping';
    await service.save();
    console.log(`Service ${service.name} is now sleeping`);
}