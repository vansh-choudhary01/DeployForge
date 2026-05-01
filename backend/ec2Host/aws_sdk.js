import { DescribeInstancesCommand, EC2Client, RunInstancesCommand, StopInstancesCommand, waitUntilInstanceRunning, TerminateInstancesCommand } from "@aws-sdk/client-ec2";
import { Ec2Registry } from "../models/ec2Registry.js";
import { executeSSHCommands, waitForSSH } from "../helpers/ssh.js";

const client = new EC2Client({ region: process.env.AWS_REGION || "ap-south-1" });

export async function provisionNewEC2() {
    console.log('Provisioning new EC2 instance...');
    const command = new RunInstancesCommand({
        ImageId: process.env.EC2_AMI_ID,
        InstanceType: process.env.EC2_INSTANCE_TYPE,
        MinCount: 1,
        MaxCount: 1,
        KeyName: process.env.EC2_KEY_NAME,
        SecurityGroupIds: [process.env.EC2_SECURITY_GROUP_ID],
        IamInstanceProfile: {
            Name: 'render-ec2-role'
        }
    });
    // console.log('Provisioning new EC2 instance...');
    // console.log(command);

    const response = await client.send(command);
    const instanceId = response.Instances[0].InstanceId;
    // console.log('Instance created:', instanceId, '— waiting for it to run...');
        // save to DB
    const ec2 = await Ec2Registry.create({
        instanceId: instanceId,
        region: process.env.AWS_REGION || "ap-south-1",
        cpu: 0,
        ram: 0,
        status: 'waking',
        isInitialized: false,
    });

    // wait until EC2 is running and has a public IP
    await waitUntilInstanceRunning(
        { client, maxWaitTime: 120 },
        { InstanceIds: [instanceId] }
    );

    const described = await client.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }));
    const instance = described.Reservations[0].Instances[0];
    // console.log('Instance running. Public IP:', instance.PublicIpAddress);

    // wait for SSH before attempting setup
    await waitForSSH(instance.PublicIpAddress);

    try {
        await setupInitialEC2(instance.PublicIpAddress);
    } catch (err) {
        console.error('Error during EC2 setup:', err);
        // if setup fails, stop the EC2 to avoid unnecessary costs
        await client.send(new StopInstancesCommand({ InstanceIds: [instanceId] }));
        ec2.status = 'stopped';
        await ec2.save();
        throw err;
    }

    // save to DB
    ec2.ip = instance.PublicIpAddress;
    ec2.status = 'active';
    ec2.isInitialized = true;
    await ec2.save();

    return ec2;
}

export async function stopEc2(ec2) {
    // block master ec2 to stop
    if (ec2.ip === '3.110.154.171') {
        console.warn(`Attempted to stop master EC2 ${ec2.ip}. Action blocked.`);
        return;
    }
    try {
        const command = new StopInstancesCommand({
            InstanceIds: [ec2.instanceId]
        });
    } catch (err) {
        console.error(`Error stopping EC2 ${ec2.ip}:`, err);
        ec2.status = 'active';
        await ec2.save();
        throw err;
    }

    await client.send(command);
    await Ec2Registry.updateOne({ _id: ec2._id }, { status: 'stopped' });
}

export async function terminateEc2(ec2) {
    // block master ec2 to terminate
    if (ec2.ip === '3.110.154.171') {
        console.warn(`Attempted to stop master EC2 ${ec2.ip}. Action blocked.`);
        ec2.status = 'active';
        return;
    }
    try {
        const command = new TerminateInstancesCommand({
            InstanceIds: [ec2.instanceId]
        });
    } catch (err) {
        console.error(`Error terminating EC2 ${ec2.ip}:`, err);
        ec2.status = 'active';
        await ec2.save();
        throw err;
    }

    await client.send(command);
    await Ec2Registry.findByIdAndDelete(ec2._id);
}

async function setupInitialEC2(ec2Ip) {
    const commands = [
        `sudo apt-get update -y`,
        `sudo apt-get install -y docker.io`,
        `sudo usermod -aG docker ubuntu`,
        `sudo systemctl enable docker`,
        `sudo systemctl start docker`,
        `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -`,
        `sudo apt-get install -y nodejs`,
        `sudo snap install aws-cli --classic`,
        `docker --version`,
        `node --version`,
        `npm --version`,
        `aws --version`
    ];

    console.log('Setting up EC2 with initial configurations...');
    await executeSSHCommands(commands, [], (msg) => {}, ec2Ip);
    console.log('EC2 setup completed');
}