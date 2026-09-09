import { Worker } from 'bullmq';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Redis from 'ioredis';
import { PipelineEngine, PipelineValidator } from '@pipeforge/pipeline-engine';
import { executionSchema, pipelineSchema, createLogger } from '@pipeforge/shared';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pipeforge';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6380', 10);
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);

const redisPublisher = new Redis({ host: REDIS_HOST, port: REDIS_PORT });

const Execution = mongoose.model('Execution', executionSchema);
const Pipeline = mongoose.model('Pipeline', pipelineSchema);
const logger = createLogger('worker');

async function startWorker() {
  await mongoose.connect(MONGODB_URI);
  logger.info('Worker connected to MongoDB');

  const engine = new PipelineEngine();

  const runPipeline = async (jobId: string | undefined, executionId: string, pipeline: any) => {
    logger.info({ jobId, executionId }, 'Processing execution');

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
      logger.info({ jobId, executionId }, 'Execution completed successfully');
    } catch (error: any) {
      logger.error({ jobId, executionId, err: error }, 'Execution failed');
      await Execution.findByIdAndUpdate(executionId, {
        status: 'FAILED',
        completedAt: new Date(),
        error: error.message
      });

      publishUpdate({ type: 'STATUS', status: 'FAILED', error: error.message });
      throw error;
    }
  };

  const worker = new Worker('pipeline-executions', async job => {
    if (job.name === 'scheduled-execution') {
      // A cron schedule fired — unlike a manual run, there's no HTTP request
      // that already created the Execution record, so do that here. Fetch
      // the pipeline fresh (not a snapshot) so edits since the schedule was
      // set are picked up automatically.
      const { pipelineId, projectId, ownerId } = job.data;
      const pipeline = await Pipeline.findOne({ _id: pipelineId, projectId, deletedAt: null });
      if (!pipeline) {
        logger.warn({ jobId: job.id, pipelineId }, 'Scheduled execution skipped: pipeline not found or deleted');
        return;
      }

      const validation = new PipelineValidator().validate(pipeline);
      if (!validation.isValid) {
        logger.warn({ jobId: job.id, pipelineId, errors: validation.errors }, 'Scheduled execution skipped: pipeline invalid');
        return;
      }

      const execution = await Execution.create({
        pipelineId: pipeline._id,
        projectId: pipeline.projectId,
        ownerId,
        pipelineSnapshot: { nodes: pipeline.nodes, edges: pipeline.edges },
        status: 'PENDING'
      });

      await runPipeline(job.id, execution._id.toString(), pipeline);
    } else {
      const { executionId, pipeline } = job.data;
      await runPipeline(job.id, executionId, pipeline);
    }
  }, {
    connection: {
      host: REDIS_HOST,
      port: REDIS_PORT
    },
    concurrency: WORKER_CONCURRENCY
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Job failed');
  });

  logger.info({ concurrency: WORKER_CONCURRENCY }, 'Worker started, listening for pipeline executions');

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down worker gracefully');
    try {
      await worker.close(); // stops accepting new jobs, waits for active ones to finish
      await redisPublisher.quit();
      await mongoose.disconnect();
      logger.info('Worker shut down cleanly');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startWorker().catch(err => {
  logger.error({ err }, 'Fatal error starting worker');
  process.exit(1);
});
