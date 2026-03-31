import { executeSSHCommands } from "../helpers/ssh.js";
import { Ec2Registry } from "../models/ec2Registry.js";

setInterval(async () => {
    try {
        // first will get the all ec2
        const machines = await Ec2Registry.find({
            status: { $ne: "offline" }
        });

        for (const machine of machines) {
            const stats = await getEC2Stats(machine);

            // update cpu, ram in DB
            await Ec2Registry.updateOne({ _id: machine._id }, {
                cpu: stats.cpu,
                ram: stats.ram,
                status: stats.cpu > 80 || stats.ram > 80 ? 'full' : 'active'
            });
        }
    } catch (err) {

    }
}, 30 * 1000); // run every 30 seconds

async function getEC2Stats(machine) {
    const commands = [
        `top -bn1 | grep "Cpu(s)" | awk '{print $2}'` // cpu %
        `free | awk '/Mem/{printf("%.0f", $3/$2*100)}'` // ram %
    ]
    const result = await executeSSHCommands(commands, machine);
    return { cpu: result.cpu, ram: result.ram };
}

// if cpu is empty then increase the cpu limit for active docer contaners ( but make sure every active have the same storage and cpu access)
