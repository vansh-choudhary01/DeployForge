import express from 'express';
import mongoose from 'mongoose';
import allRoutes from './routes/index.js';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import './ec2Host/ec2_monitor.js';
import './ec2Host/sleep_monitor.js';
import { consumeFromQueue, initializeQueue } from './RabbitMQ/queue.js';
import { consumeFromQueue as consumeWakeupQueue, initializeQueue as initializeWakeupQueue } from './RabbitMQ/wakeupQueue.js';
import { WakeServiceSubDomain, subdomainProxy } from './controllers/proxy.js';
import Deployment from './models/Deployment.js';
import Service from './models/Service.js';
import { RedisService } from './redis-db/initilize.js';
import { app, io, server, sockets } from './realtime/socket.js';
import { createClient } from 'redis';
dotenv.config();

function connectRabbitMQ() {
    initializeQueue()
        // .then(() => {
        //     // consumeFromQueue(deployFromQueue);
        // })
        .catch(err => {
            console.error('Failed to initialize RabbitMQ queue:', err);
            process.exit(1);
        });
    initializeWakeupQueue()
        .then(() => {
            consumeWakeupQueue(WakeServiceSubDomain);
        })
        .catch(err => {
            console.error('Failed to initialize RabbitMQ wakeup queue:', err);
            process.exit(1);
        });
}
connectRabbitMQ();

function connectDB() {
    mongoose.connect(process.env.MONGO_URI)
        .then(() => console.log('MongoDB connected'))
        .catch(err => {
            console.log(err);
            process.exit(1);
        });
}

connectDB();

app.use(cors({
    origin: [process.env.FRONTEND_URL || 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use('/api/proxy/:subdomain', subdomainProxy);
app.use(cookieParser());
app.use(express.json());

app.get('/', (req, res) => {
    res.send("Hello, World - RENDER MASTER!");
});

app.use('/api', allRoutes);

io.use((socket, next) => {
    try {
        const cookies = socket.handshake.headers.cookie || '';
        const tokenCookie = cookies.split('; ').find(c => c.startsWith('token='));
        const token = tokenCookie ? tokenCookie.split('=')[1] : null;

        if (!token) {
            return next(new Error('Authentication failed: missing token'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded || !decoded.userId) {
            return next(new Error('Authentication failed: invalid token'));
        }

        socket.userId = decoded.userId;
        sockets.set(decoded.userId, socket.id);
        next();
    } catch (err) {
        console.error('Socket auth error', err.message);
        next(new Error('Authentication failed: invalid token'));
    }
});

const redis = await RedisService.create();
export const getDeploymentLogs = async (deploymentId, userId) => {
    const userSocketId = sockets.get(userId);

    // check if the user is the owner of the deployment
    const deployment = await Deployment.findById(deploymentId);
    const service = await Service.findById(deployment.service);
    if (!deployment) return;
    if (!service) return;
    if (service.user.toString() !== userId) {
        return;
    }

    io.to(userSocketId).emit('deployment:previous-logs', {
        deploymentId: deploymentId,
        logs: await redis.get(deploymentId) || [],
    });
};

async function initializeRedisSubscriber() {
    const redisSubscriber = await RedisService.create();
    await redisSubscriber.subscribe('deployment_logs', (message) => {
        const { userId, event, data } = JSON.parse(message);
        const socketId = sockets.get(userId);
        if (socketId) {
            io.to(socketId).emit(event, data);
        }
    });
    console.log(
        'Subscribed to deployment_logs'
    );
}

initializeRedisSubscriber();

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('deployment:subscribe', async (payload) => {
        const deploymentId = payload?.deploymentId;

        if (deploymentId) {
            getDeploymentLogs(deploymentId, socket.userId);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        if (socket.userId) {
            sockets.delete(socket.userId);
        }
    });
});

const port = process.env.PORT || 4000;

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})