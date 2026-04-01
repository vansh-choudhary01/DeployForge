import { executeSSHCommands } from '../helpers/ssh.js';
import { Ec2Registry } from '../models/ec2Registry';
import Service from '../models/Service.js';
import fs from 'fs';
import { stopEc2 } from './aws_sdk.js';

setInterval(async () => {
    const machines = await Ec2Registry.find({ status: 'active' });

    // find underloaded EC2s (cpu < 20%, ram < 20%)
    const underloaded = machines.filter(m => m.cpu < 20 && m.ram < 20);

    if (underloaded.length > 1) {
        const drain = underloaded[0]; // pick the first underloaded machine to drain
        const target = underloaded[1]; // pick the next underloaded machine to move workloads to

        // move all workloads from drain to target 
        console.log(`Draining EC2 ${drain.ip} and moving workloads to ${target.ip}`);

        const services = await Service.find({ ec2Ip: drain._id, status: 'sleeping'});
        for (const service of services) {
            await migrateService(service, drain, target);
        }

        await stopEc2(drain);
    }
}, 5 * 60 * 1000); // Check every 5 minutes

async function migrateService(service, fromEc2, toEc2) {
    const appName = `app-${service._id}`;
    const keyPath = '/tmp/ec2key.pem';

    // write pem key to temp file
    fs.writeFileSync(keyPath, Buffer.from(process.env.EC2_SSH_KEY_BASE64, 'base64').toString('utf-8'));
    await executeSSHCommands([`chmod 400 ${keyPath}`], [], () => {});

    try {
        // Step 1 - save image on drain EC2
        await executeSSHCommands([
            `docker save ${appName} | gzip > /tmp/${appName}.tar.gz`
        ], [], () => {}, fromEc2.ip);

        // Step 2 - download from drain EC2 to backend
        await executeSSHCommands([
            `scp -i ${keyPath} -o StrictHostKeyChecking=no ubuntu@${fromEc2.ip}:/tmp/${appName}.tar.gz /tmp/${appName}.tar.gz`
        ], [], () => {});

        // Step 3 - upload from backend to target EC2
        await executeSSHCommands([
            `scp -i ${keyPath} -o StrictHostKeyChecking=no /tmp/${appName}.tar.gz ubuntu@${toEc2.ip}:/tmp/${appName}.tar.gz`
        ], [], () => {});

        // Step 4 - load image on target EC2 and start container
        await executeSSHCommands([
            `docker load < /tmp/${appName}.tar.gz`,
            `docker run -d --name ${appName} -p ${deployment.port}:3000 ${appName}`
        ], [], () => {}, toEc2.ip);

        // Step 5 - cleanup drain EC2
        await executeSSHCommands([
            `docker stop ${appName}`,
            `docker rm ${appName}`,
            `rm /tmp/${appName}.tar.gz`
        ], [], () => {}, fromEc2.ip);

        // Step 6 - cleanup backend
        fs.unlinkSync(`/tmp/${appName}.tar.gz`);

        // Step 7 - update DB
        service.ec2Ip = toEc2._id;
        await service.save();
        await Ec2Registry.updateOne({ _id: fromEc2._id }, { $inc: { totalServices: -1 } });
        await Ec2Registry.updateOne({ _id: toEc2._id }, { $inc: { totalServices: 1 } });
    } finally {
        // always delete pem key even if error occurs
        fs.unlinkSync(keyPath);
    }
}