import { Worker } from 'bullmq';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Redis from 'ioredis';
import { PipelineEngine } from '@pipeforge/pipeline-engine';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pipeforge';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6380', 10);

const redisPublisher = new Redis({ host: REDIS_HOST, port: REDIS_PORT });

const executionSchema = new mongoose.Schema({
  pipelineId: mongoose.Schema.Types.ObjectId,
  projectId: mongoose.Schema.Types.ObjectId,
  status: String,
  startedAt: Date,
  completedAt: Date,
  results: mongoose.Schema.Types.Mixed,
  error: String
}, { timestamps: true });

const Execution = mongoose.model('Execution', executionSchema);

async function startWorker() {
  await mongoose.connect(MONGODB_URI);
  console.log('Worker connected to MongoDB');

  const engine = new PipelineEngine();

  const worker = new Worker('pipeline-executions', async job => {
    const { executionId, pipeline } = job.data;
    console.log(`[Job ${job.id}] Processing execution: ${executionId}`);
    
    await Execution.findByIdAndUpdate(executionId, {
      status: 'RUNNING',
      startedAt: new Date()
    });

    const publishUpdate = (data: any) => {
      redisPublisher.publish('execution-updates', JSON.stringify({
        executionId,
        pipelineId: pipeline._id || pipeline.id,
        ...data
      }));
    };

    publishUpdate({ type: 'STATUS', status: 'RUNNING' });

    try {
      const results = await engine.execute(pipeline, {
        onNodeStart: (nodeId, type, label) => {
          publishUpdate({ type: 'NODE_START', nodeId, nodeType: type, label });
        },
        onNodeComplete: (nodeId, duration, rowCount) => {
          publishUpdate({ type: 'NODE_COMPLETE', nodeId, duration, rowCount });
        },
        onNodeError: (nodeId, error) => {
          publishUpdate({ type: 'NODE_ERROR', nodeId, error });
        }
      });
      
      await Execution.findByIdAndUpdate(executionId, {
        status: 'COMPLETED',
        completedAt: new Date(),
        results
      });
      
      publishUpdate({ type: 'STATUS', status: 'COMPLETED', results });
      console.log(`[Job ${job.id}] Execution ${executionId} completed successfully`);
    } catch (error: any) {
      console.error(`[Job ${job.id}] Execution ${executionId} failed:`, error.message);
      await Execution.findByIdAndUpdate(executionId, {
        status: 'FAILED',
        completedAt: new Date(),
        error: error.message
      });
      
      publishUpdate({ type: 'STATUS', status: 'FAILED', error: error.message });
      throw error;
    }
  }, {
    connection: {
      host: REDIS_HOST,
      port: REDIS_PORT
    }
  });

  worker.on('failed', (job, err) => {
    console.error(`[Job ${job?.id}] Failed with error:`, err.message);
  });

  console.log('Worker started, listening for pipeline executions...');
}

startWorker().catch(console.error);
