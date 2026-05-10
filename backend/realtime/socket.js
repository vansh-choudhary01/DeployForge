import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

export const app = express();
export const server = createServer(app);

// Socket.io initialization
export const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true,
    }
});

// store a map in memory for (userId: socketId)
export const sockets = new Map();