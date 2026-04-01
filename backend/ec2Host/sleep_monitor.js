import { executeSSHCommands } from "../helpers/ssh";
import { Ec2Registry } from "../models/ec2Registry";
import Service from "../models/Service";

setInterval(async () => {
    try {
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

        const idleServices = await Service.find({
            status: 'running',
            lastRequestAt: { $lt: fifteenMinsAgo }
        }).populate('ec2Host');

        for (const service of idleServices) {
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

    const ec2Registry = await Ec2Registry.findById(service.ec2Host);
    if (ec2Registry) {
        ec2Registry.totalServices -= 1;
        if (ec2Registry.totalServices < 0) {
            ec2Registry.totalServices = 0;
        }
        ec2Registry.status = 'active'; // mark EC2 as active again since it has capacity now
        await ec2Registry.save();
    }
}