import { Queue } from 'bullmq';
import { REDIS_HOST, REDIS_PORT } from '../config/env';

export const pipelineQueue = new Queue('pipeline-executions', {
  connection: {
    host: REDIS_HOST,
    port: REDIS_PORT,
  }
});

export class QueueService {
  async queueExecution(executionId: string, pipelineData: any) {
    await pipelineQueue.add('execute-pipeline', {
      executionId,
      pipeline: pipelineData
    }, {
      // Retry transient failures (e.g. a momentary Mongo/Redis blip) instead
      // of failing the job permanently on the first error.
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 7 * 24 * 60 * 60, count: 1000 },
      removeOnFail: { age: 30 * 24 * 60 * 60 }
    });
  }
}

export const queueService = new QueueService();
