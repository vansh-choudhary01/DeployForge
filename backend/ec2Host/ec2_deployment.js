import { Ec2Registry } from "../models/ec2Registry.js";
import { provisionNewEC2 } from "./aws_sdk.js";

export async function getBestEc2() {
    const machine = await Ec2Registry.findOne({
        status: "active"
    });

    if (!machine) {
        // no EC2 availabe -> spin up new one via AWS SDK
        return await provisionNewEC2();
    }

    return machine;
}