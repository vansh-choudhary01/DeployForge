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
            await sleepService(service);
        }
    } catch (err) {
        console.error('Error during sleep monitoring:', err);
    }
}, 5 * 60 * 1000); // Check every 5 minutes

async function sleepService(service) {
    const appName = `app-${service._id}`;

    await executeSSHCommands([
        `docker stop ${appName} || true`,
        `docker rm ${appName} || true`,
        `docker rmi ${appName} || true`
    ], [], () => { }, service.ec2Host?.ip);

    const ec2 = await Ec2Registry.findById(service.ec2Host?._id);
    if (ec2) {
        ec2.totalServices = ec2.totalServices - 1;
        if(ec2.totalServices <= 0) {
            ec2.status = 'offline';
            await ec2.save();
            const ec2Test = await Ec2Registry.findById(service.ec2Host?._id);
            if (ec2Test.totalServices <= 0) await terminateEc2(ec2);
            else ec2.status = 'active';
        }
        if (ec2.status !== 'offline') await ec2.save();
    }

    service.status = 'sleeping';
    service.ec2Host = null;
    await service.save();
    console.log(`Service ${service.name} is now sleeping`);
}