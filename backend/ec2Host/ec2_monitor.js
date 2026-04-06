import { executeSSHCommands } from "../helpers/ssh.js";
import { Ec2Registry } from "../models/ec2Registry.js";

setInterval(async () => {
    try {
        // first will get the all ec2
        const machines = await Ec2Registry.find({
            status: { $nin: ["offline", "waking"] }
        });

        for (const machine of machines) {
            const stats = await getEC2Stats(machine.ip);

            // update cpu, ram in DB
            await Ec2Registry.updateOne({ _id: machine._id }, {
                cpu: stats.cpu,
                ram: stats.ram,
                disk: stats.disk,
                status: stats.cpu > 80 || stats.ram > 80 ? 'full' : 'active'
            });
        }
    } catch (err) {
        console.error('Error during EC2 monitoring:', err);
    }
}, 30 * 1000); // run every 30 seconds

async function getEC2Stats(machineIp) {
    const commands = [
        `top -bn2 | grep "Cpu(s)" | tail -1 | awk '{print $2}' && echo "---"`,
        `free | awk '/Mem/{printf("%.0f", $3/$2*100)}' && echo "---"`,
        `df / | awk 'NR==2{print $5}' | tr -d '%' && echo "---"`
    ];

    const result = await executeSSHCommands(commands, [], () => {}, machineIp);
    
    const sections = result.output.split('---\n').map(s => s.trim()).filter(Boolean);
    
    const cpu = parseFloat(sections[0]) || 0;
    const ram = parseFloat(sections[1]) || 0;
    const disk = parseFloat(sections[2]) || 0;

    return { cpu, ram, disk };
}

// if cpu is empty then increase the cpu limit for active docer contaners ( but make sure every active have the same storage and cpu access)
