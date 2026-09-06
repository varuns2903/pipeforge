import { Queue } from 'bullmq';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6380', 10);

export const pipelineQueue = new Queue('pipeline-executions', {
  connection: {
    host: redisHost,
    port: redisPort,
  }
});

export class QueueService {
  async queueExecution(executionId: string, pipelineData: any) {
    await pipelineQueue.add('execute-pipeline', {
      executionId,
      pipeline: pipelineData
    });
  }
}

export const queueService = new QueueService();
