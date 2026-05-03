import { executeSSHCommands } from "../helpers/ssh.js";
import { Ec2Registry } from "../models/ec2Registry.js";
import { terminateEc2 } from "./aws_sdk.js";
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
            if (service.subdomain === 'dravya-aaro-backend') continue; // company running project
            console.log(`Putting service ${service.subdomain} to sleep due to inactivity...`);
            await sleepService(service);
        }
    } catch (err) {
        console.error('Error during sleep monitoring:', err);
    }
}, 5 * 60 * 1000); // Check every 5 minutes

async function sleepService(service) {
    const appName = `app-${service._id}`;
    const serviceEc2 = service.ec2Host;

    await executeSSHCommands([
        `docker stop ${appName} || true`,
        `docker rm ${appName} || true`,
        `docker rmi ${appName} || true`
    ], [], () => { }, service.ec2Host?.ip);

    service.status = 'sleeping';
    service.ec2Host = null;
    await service.save();
    console.log(`Service ${service.name} is now sleeping`);

    const ec2 = await Ec2Registry.findById(serviceEc2?._id);
    if (ec2) {
        ec2.totalServices = Math.max(0, ec2.totalServices - 1);
        if (ec2.totalServices <= 0) {
            const activeServices = await Service.countDocuments({
                ec2Host: ec2._id,
                status: 'running'
            });

            if (activeServices === 0) {
                ec2.status = 'offline';
                await ec2.save();

                await terminateEc2(ec2);
                return;
            }
            else ec2.status = 'active';
        }
        if (ec2.status !== 'offline') await ec2.save();
    }
}