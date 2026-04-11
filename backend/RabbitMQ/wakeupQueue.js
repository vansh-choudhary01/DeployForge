import amqp from 'amqplib';

let connection;
let channel;
const queue = 'wakeup_queue';

export async function initializeQueue() {
    connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    channel = await connection.createChannel();

    await channel.assertQueue(queue, {
        durable: true,
        arguments: {
            'x-queue-type': 'quorum'
        }
    });

    console.log('RabbitMQ wakeup queue connected');
}

export async function sendToQueue(msg) {
    await channel.sendToQueue(queue, Buffer.from(JSON.stringify(msg)), {
        persistent: true
    });
}

export function consumeFromQueue(callback) {
    channel.prefetch(1);
    channel.consume(queue, async (msg) => {
        if (!msg) return;
        const message = JSON.parse(msg.content.toString());
        await callback(message);
        channel.ack(msg);
    })
}

process.on('exit', () => {
    connection?.close();
});
process.on('SIGINT', () => {
    connection?.close();
    process.exit(0);
});