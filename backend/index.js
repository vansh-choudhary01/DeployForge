import express from 'express';
import mongoose from 'mongoose';
import allRoutes from './routes/index.js';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import './workers/deploymentWorker.js';
dotenv.config();

const app = express();
const server = createServer(app);

// Socket.io initialization
export const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000',
        credentials: true,
    }
});

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
    origin: ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(cookieParser());
app.use(express.json());

app.get('/', (req, res) => {
    res.send("Hello, World!");
});

app.use('/api', allRoutes);

// store a map in memory for (userId: socketId)
export const sockets = new Map();
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

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

const port = process.env.PORT || 4000;

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})