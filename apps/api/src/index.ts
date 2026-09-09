import './config/env'; // must load first: populates process.env before other modules read it

import mongoose from 'mongoose';
import { app } from './app';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { PORT, MONGODB_URI, JWT_SECRET, REDIS_HOST, REDIS_PORT, WEB_URL } from './config/env';

const httpServer = createServer(app);

// Socket.io Setup
const io = new Server(httpServer, {
  cors: { origin: WEB_URL }
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
const redisSubscriber = new Redis({ host: REDIS_HOST, port: REDIS_PORT });

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
