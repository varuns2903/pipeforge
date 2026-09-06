import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { app } from './app';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pipeforge';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

const httpServer = createServer(app);

// Socket.io Setup
const io = new Server(httpServer, {
  cors: { origin: '*' } // Match frontend origin in prod
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    (socket as any).user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  
  socket.on('subscribe_pipeline', (pipelineId) => {
    socket.join(`pipeline_${pipelineId}`);
    console.log(`Socket ${socket.id} joined pipeline_${pipelineId}`);
  });
  
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Redis Subscriber for Worker Updates
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6380', 10);
const redisSubscriber = new Redis({ host: redisHost, port: redisPort });

redisSubscriber.subscribe('execution-updates');
redisSubscriber.on('message', (channel, message) => {
  if (channel === 'execution-updates') {
    try {
      const data = JSON.parse(message);
      if (data.pipelineId) {
        io.to(`pipeline_${data.pipelineId}`).emit('execution_update', data);
      }
    } catch (err) {
      console.error('Error parsing execution update:', err);
    }
  }
});

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    httpServer.listen(PORT, () => {
      console.log(`API server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
