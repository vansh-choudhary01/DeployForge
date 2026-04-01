import { executeSSHCommands } from "../helpers/ssh";
import Service from "../models/Service";

setInterval(async () => {
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

    const idleServices = await Service.find({
        status: 'running',
        lastRequestAt: { $lt: fifteenMinsAgo }
    }).populate('ec2Host');

    for (const service of idleServices) {
        await sleepService(service);
    }
}, 5 * 60 * 1000); // Check every 5 minutes

async function sleepService(service) {
    const appName = `app-${service._id}`;

    await executeSSHCommands([`docker stop ${appName}`], [], () => {}, service.ec2Host?.ip);

    service.status = 'sleeping';
    await service.save();
    console.log(`Service ${service.name} is now sleeping`);
}