import { DescribeInstancesCommand, EC2Client, RunInstancesCommand, StopInstancesCommand, waitUntilInstanceRunning, TerminateInstancesCommand } from "@aws-sdk/client-ec2";
import { Ec2Registry } from "../models/ec2Registry.js";
import { executeSSHCommands, waitForSSH } from "../helpers/ssh.js";

const client = new EC2Client({ region: process.env.AWS_REGION || "ap-south-1" });

export async function provisionNewEC2(pushLog) {
    console.log('Provisioning new EC2 instance...');
    pushLog('Provisioning new EC2 instance...');
    const command = new RunInstancesCommand({
        ImageId: process.env.EC2_AMI_ID,
        InstanceType: process.env.EC2_INSTANCE_TYPE,
        MinCount: 1,
        MaxCount: 1,
        KeyName: process.env.EC2_KEY_NAME,
        SecurityGroupIds: [process.env.EC2_SECURITY_GROUP_ID],
        IamInstanceProfile: {
            Name: 'render-ec2-role'
        },
        BlockDeviceMappings: [
            {
                DeviceName: "/dev/sda1", // root volume
                Ebs: {
                    VolumeSize: 30, // 30GB
                    VolumeType: "gp3",
                    DeleteOnTermination: true
                }
            }
        ]
    });
    // console.log('Provisioning new EC2 instance...');
    // console.log(command);

    const response = await client.send(command);
    const instanceId = response.Instances[0].InstanceId;
    // console.log('Instance created:', instanceId, '— waiting for it to run...');
    pushLog(`EC2 instance created, waiting for it to run...`);
    // save to DB
    const ec2 = await Ec2Registry.create({
        instanceId: instanceId,
        region: process.env.AWS_REGION || "ap-south-1",
        cpu: 0,
        ram: 0,
        status: 'waking',
        isInitialized: false,
        isProtected: false
    });

    // wait until EC2 is running and has a public IP
    await waitUntilInstanceRunning(
        { client, maxWaitTime: 120 },
        { InstanceIds: [instanceId] }
    );
    pushLog(`EC2 instance is now running. Fetching details...`);

    const described = await client.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }));
    const instance = described.Reservations[0].Instances[0];
    // console.log('Instance running. Public IP:', instance.PublicIpAddress);

    // wait for SSH before attempting setup
    await waitForSSH(instance.PublicIpAddress);
    await new Promise(res => setTimeout(res, 20000)); // 20 sec
    pushLog(`EC2 instance is ready for setup. Starting setup...`);

    try {
        await setupInitialEC2(instance.PublicIpAddress, ec2, pushLog);
    } catch (err) {
        console.error('Error during EC2 setup:', err);
        pushLog(`ERROR: during EC2 setup: ${err.message}`);
        // if setup fails, stop the EC2 to avoid unnecessary costs
        await Ec2Registry.findByIdAndUpdate(ec2._id, { status: 'stopped' });
        await client.send(new StopInstancesCommand({ InstanceIds: [instanceId] }));

        pushLog(`ERROR: EC2 instance stopped due to setup failure. Please check the logs and try deploy/redeploy again`);
        return new Error(`EC2 setup failed: ${err.message}`);
    }

    // save to DB
    ec2.ip = instance.PublicIpAddress;
    ec2.status = 'active';
    ec2.isInitialized = true;
    await ec2.save();

    return ec2;
}

export async function stopEc2(ec2) {
    // block protected ec2 from stopping
    if (ec2.isProtected === true) {
        console.warn(`Attempted to stop protected EC2 ${ec2.ip}. Action blocked.`);
        return;
    }
    try {
        const command = new StopInstancesCommand({
            InstanceIds: [ec2.instanceId]
        });
        await client.send(command);
    } catch (err) {
        console.error(`Error stopping EC2 ${ec2.ip}:`, err);
        ec2.status = 'active';
        await ec2.save();
        throw err;
    }

    await Ec2Registry.updateOne({ _id: ec2._id }, { status: 'stopped' });
}

export async function terminateEc2(ec2) {
    // block master ec2 to terminate
    if (ec2.isProtected === true) {
        console.warn(`Attempted to terminate protected EC2 ${ec2.ip}. Action blocked.`);
        return;
    }

    Ec2Registry.updateOne({ _id: ec2._id }, { status: 'offline' });
    try {
        const command = new TerminateInstancesCommand({
            InstanceIds: [ec2.instanceId]
        });
        await client.send(command);
    } catch (err) {
        console.error(`Error terminating EC2 ${ec2.ip}:`, err);
        await Ec2Registry.updateOne({ _id: ec2._id }, { status: 'active' });
        throw err;
    }

    await Ec2Registry.findByIdAndDelete(ec2._id);
}

async function setupInitialEC2(ec2Ip, ec2, pushLog) {
    const commands = [
        `echo "PUSH_LOG: Starting EC2 setup..."`,
        `sudo apt-get update -y`,
        `echo "PUSH_LOG: Updating package list..."`,
        `sudo apt-get install -y docker.io unzip`,
        `echo "PUSH_LOG: Installing Docker..."`,
        `sudo usermod -aG docker ubuntu`,
        `echo "PUSH_LOG: Adding user to docker group..."`,
        `sudo systemctl enable docker`,
        `echo "PUSH_LOG: Starting Docker..."`,
        `sudo systemctl start docker`,

        `echo "PUSH_LOG: Installing Node.js..."`,
        `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -`,
        `sudo apt-get install -y nodejs`,

        // ✅ AWS CLI (correct way)
        `echo "PUSH_LOG: Installing AWS CLI..."`,
        `curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"`,
        `unzip awscliv2.zip`,
        `sudo ./aws/install`,

        `echo "PUSH_LOG: Checking installed versions..."`,
        `docker --version`,
        `node --version`,
        `npm --version`,
        `aws --version`,

        // add 5GB swap to prevent OOM during npm install
        `sudo fallocate -l 5G /swapfile`,
        `sudo chmod 600 /swapfile`,
        `sudo mkswap /swapfile`,
        `sudo swapon /swapfile`,
        `echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab`,
        `echo "PUSH_LOG: EC2 setup completed successfully."`
    ];

    console.log('Setting up EC2 with initial configurations...');
    ec2.initialLogs = ec2.initialLogs || [];
    await executeSSHCommands(
        commands,
        [],
        (msg) => {
            if (msg.includes('PUSH_LOG:')) {
                const logMessage = msg.replace('PUSH_LOG:', '').trim();
                pushLog(logMessage);
                return;
            }
            ec2.initialLogs.push(msg);
        }, ec2Ip);
    console.log('EC2 setup completed');
}