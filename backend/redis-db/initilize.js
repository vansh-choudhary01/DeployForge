import { createClient } from "redis";
import dotenv from "dotenv";
dotenv.config();

export class RedisService {
    static initilClient = null;
    static async create(type) {
        const instance = new RedisService();

        if (RedisService.initilClient) {
            instance.client = RedisService.initilClient;
        } else {
            const client = createClient({
                username: "default",
                password: process.env.REDIS_PASSWORD,
                socket: {
                    host: process.env.REDIS_HOST,
                    port: Number(process.env.REDIS_PORT)
                }
            });

            await client.connect();

            instance.client = client;
            RedisService.initilClient = client;
        }

        return instance;
    }

    async insertToList(key, message) {
        await this.client.rPush(key, message);
    }

    async batchInsertToList(key, messages) {
        if (messages.length > 0) {
            await this.client.rPush(key, ...messages);
        }
    }

    async get(key) {
        const logs = await this.client.lRange(key, 0, -1);
        return logs;
    }

    async clearLogs(key) {
        await this.client.del(key);
    }

    async publish(channel, message) {
        await this.client.publish(channel, message);
    }

    async subscribe(channel, callback) {
        const subscriber = this.client.duplicate();
        await subscriber.connect();
        await subscriber.subscribe(channel, (message) => {
            callback(message);
        });
    }
}