import { Ec2Registry } from "../models/ec2Registry.js";
import { provisionNewEC2 } from "./aws_sdk.js";

export async function getBestEc2() {
    let machine = await Ec2Registry.findOne({ status: 'active', totalServices: { $lt: process.env.MAX_SERVICES_PER_EC2 } }).sort({ totalServices: 1, cpu: 1, ram: 1 });
    const newMachine = await Ec2Registry.findOne({ status: 'waking' }).sort({ createdAt: 1 });
    if (!machine && newMachine) {
        console.log(`Found waking EC2 ${newMachine.ip}, waiting for it to be ready...`);
        // wait for the waking EC2 to be initialized (should take around 1-2 mins)
        for (let i = 0; i < 12; i++) { // check every 10 seconds for up to 2 minutes
            const updated = await Ec2Registry.findById(newMachine._id);
            if (updated.isInitialized && updated.status === 'active') {
                console.log(`EC2 ${newMachine.ip} is now initialized.`);
                machine = updated;
                break;
            }
            console.log(`EC2 ${newMachine.ip} is still initializing...`);
            await new Promise(resolve => setTimeout(resolve, 10000)); // wait 10 seconds before checking again
        }
    }


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