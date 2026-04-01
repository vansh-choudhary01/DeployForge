import { EC2Client, RunInstancesCommand, StopInstancesCommand, waitUntilInstanceRunning } from "@aws-sdk/client-ec2";
import { Ec2Registry } from "../models/ec2Registry.js";

const client = new EC2Client({ region: process.env.AWS_REGION || "ap-south-1" });

export async function provisionNewEC2() {
    const command = new RunInstancesCommand({
        ImageId: process.env.EC2_AMI_ID,
        InstanceType: process.env.EC2_INSTANCE_TYPE,
        MinCount: 1,
        MaxCount: 1,
        KeyName: process.env.EC2_KEY_NAME,
        SecurityGroupIds: [process.env.EC2_SECURITY_GROUP_ID]
    });

    const response = await client.send(command);
    const instance = response.Instances[0];

    // wait until EC2 is running and has a public IP
    await waitUntilInstanceRunning(
        { client, maxWaitTime: 120 },
        { InstanceIds: [instance.InstanceId] }
    );

    // save to DB
    const ec2 = await Ec2Registry.create({
        ip: instance.PublicIpAddress,
        instanceId: instance.InstanceId,
        region: process.env.AWS_REGION || "ap-south-1",
        cpu: 0,
        ram: 0,
        status: 'active'
    });

    return ec2;
}

export async function stopEc2(ec2) {
    const command = new StopInstancesCommand({
        InstanceIds: [ec2.instanceId]
    });

    await client.send(command);
    await Ec2Registry.updateOne({ _id: ec2._id }, { status: 'stopped' });
}