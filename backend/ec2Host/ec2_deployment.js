import { Ec2Registry } from "../models/ec2Registry.js";
import { provisionNewEC2 } from "./aws_sdk.js";

export async function getBestEc2() {
    const machine = await Ec2Registry.findOne({ status: 'active', totalServices: { $lt: process.env.MAX_SERVICES_PER_EC2 } }).sort({ totalServices: 1, cpu: 1, ram: 1 });

    if (machine && machine.cpu < 80 && machine.ram < 80) {
        return machine;
    }
    if (machine) {
        machine.status = 'full';
        await machine.save();
    }

    // if no EC2 has capacity, provision a new one
    const newEc2 = await provisionNewEC2();
    return newEc2;
}