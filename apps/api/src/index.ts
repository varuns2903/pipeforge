import './config/env'; // must load first: populates process.env before other modules read it

import mongoose from 'mongoose';
import { app, logger } from './app';
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
  logger.info({ socketId: socket.id }, 'Socket connected');
  
  socket.on('subscribe_pipeline', (pipelineId) => {
    socket.join(`pipeline_${pipelineId}`);
    logger.info({ socketId: socket.id, pipelineId }, 'Socket joined pipeline room');
  });
  
  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Socket disconnected');
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
      logger.error({ err }, 'Error parsing execution update');
    }
  }
});

mongoose.connect(MONGODB_URI)
  .then(() => {
    logger.info('Connected to MongoDB');
    httpServer.listen(PORT, () => {
      logger.info({ port: PORT }, 'API server running');
    });
  })
  .catch(err => {
    logger.error({ err }, 'MongoDB connection error');
    process.exit(1);
  });

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutting down API server gracefully');
  try {
    await new Promise<void>((resolve, reject) => {
      httpServer.close(err => (err ? reject(err) : resolve()));
    });
    io.close();
    await redisSubscriber.quit();
    await mongoose.disconnect();
    logger.info('API server shut down cleanly');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
