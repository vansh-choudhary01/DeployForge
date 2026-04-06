import { executeSSHCommands } from '../helpers/ssh.js';
import { Ec2Registry } from '../models/ec2Registry.js';
import Service from '../models/Service.js';
import fs from 'fs';
import { stopEc2 } from './aws_sdk.js';

setInterval(async () => {
    try {
        const machines = await Ec2Registry.find({ status: 'active' });

        // find underloaded EC2s with 2 or fewer services and low CPU usage
        const underloaded = machines.filter(m => m.totalServices <= 2 && m.cpu < 20);

        if (underloaded.length > 1) {
            const drain = underloaded[0]; // pick the first underloaded machine to drain
            const target = underloaded[1]; // pick the next underloaded machine to move workloads to

            // move all workloads from drain to target 
            console.log(`Draining EC2 ${drain.ip} and moving workloads to ${target.ip}`);

            const services = await Service.find({ ec2Host: drain._id, status: 'sleeping' });
            console.log(`Found ${services.length} sleeping services to migrate from ${drain.ip} to ${target.ip}`);
            for (const service of services) {
                const freshTarget = await Ec2Registry.findById(target._id); // re-fetch target to get latest stats
                if (freshTarget.cpu > 75 || freshTarget.ram > 75) {
                    console.log(`Target EC2 ${target.ip} is now overloaded, stopping migration`);
                    break; // stop migration if target becomes overloaded
                }
                await migrateService(service, drain, target);
                console.log(`Migrated service ${service._id} from EC2 ${drain.ip} to EC2 ${target.ip}`);
            }

            const activeServicesLength = await Service.countDocuments({ ec2Host: drain._id, status: 'running' });
            console.log(`After migration, EC2 ${drain.ip} has ${activeServicesLength} active services`);
            if (activeServicesLength === 0) {
                await Ec2Registry.updateOne({ _id: drain._id }, { status: 'offline' }); // mark as offline before stopping to avoid new deployments
                await stopEc2(drain);
                await Ec2Registry.findByIdAndDelete(drain._id);
                console.log(`EC2 ${drain.ip} has been stopped and removed from registry`);
            }
            console.log(`Finished consolidation check. Underloaded EC2s: ${underloaded.length}, Drained EC2: ${drain.ip}, Target EC2: ${target.ip}`);
        }
    } catch (err) {
        console.error('Error during EC2 consolidation:', err);
    }
}, 5 * 60 * 1000); // Check every 5 minutes

export async function migrateService(service, fromEc2, toEc2) {
    const appName = `app-${service._id}`;
    const remoteKeyPath = '/tmp/ec2key.pem';
    const pemKeyBase64 = process.env.EC2_SSH_KEY_BASE64;

    try {
        // Step 1 - write pem key onto fromEc2 safely via base64
        await executeSSHCommands([
            `echo '${pemKeyBase64}' | base64 -d > ${remoteKeyPath} && chmod 400 ${remoteKeyPath}`
        ], [], () => {}, fromEc2.ip);

        // Step 2 - transfer docker image directly fromEc2 → toEc2
        await executeSSHCommands([
            `docker save ${appName} | gzip | ssh -i ${remoteKeyPath} -o StrictHostKeyChecking=no ubuntu@${toEc2.ip} 'gunzip | docker load'`
        ], [], () => {}, fromEc2.ip);

        // Step 3 - cleanup fromEc2
        await executeSSHCommands([
            `docker stop ${appName} || true`,
            `docker rm ${appName} || true`,
            `rm -f ${remoteKeyPath}`
        ], [], () => {}, fromEc2.ip);

        // Step 4 - update DB
        service.ec2Host = toEc2;
        await service.save();
        await Ec2Registry.updateOne({ _id: fromEc2._id }, { $inc: { totalServices: -1 } });
        await Ec2Registry.updateOne({ _id: toEc2._id }, { $inc: { totalServices: 1 } });

        console.log(`Migrated ${appName} from ${fromEc2.ip} to ${toEc2.ip}`);

    } catch (err) {
        // cleanup key from fromEc2 on failure
        await executeSSHCommands([`rm -f ${remoteKeyPath}`], [], () => {}, fromEc2.ip).catch(() => {});
        throw err;
    }
}