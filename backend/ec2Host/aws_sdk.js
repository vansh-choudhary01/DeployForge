import { EC2Client, RunInstancesCommand } from "@aws-sdk/client-ec2";
import { Ec2Registry } from "../models/ec2Registry.js";

export async function provisionNewEC2() {
    const client = new EC2Client({ region: "ap-south-1"});

    const command = new RunInstancesCommand({
        ImageId: process.env.EC2_AMI_ID, // your EC2 AMI
        InstanceType: process.env.EC2_INSTANCE_TYPE,
        MinCount: 1,
        MaxCount: 1,
        KeyName: process.env.EC2_KEY_NAME,
        SecurityGroupIds: [process.env.EC2_SECURITY_GROUP_ID]
    });

    const response = await client.send(command);
    const newIp = response.Instances[0].PublicIpAddress;

    // save to DB
    await Ec2Registry.create({ ip: newIp, cpu: 0, ram: 0, status: 'active' });

    return response.Instances[0];
}