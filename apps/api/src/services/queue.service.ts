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

  /**
   * Schedules recurring executions of a pipeline via BullMQ's Job Scheduler
   * API (queue.add's old `repeat` option was removed in BullMQ 6). The
   * pipeline's own id doubles as the scheduler id — upserting with the same
   * id replaces any existing schedule for that pipeline, so callers don't
   * need to track or persist a separate opaque key.
   *
   * The job payload only carries IDs, not a pipeline snapshot — the worker
   * looks up the pipeline fresh each time the schedule fires, so edits to
   * the pipeline are picked up by the next scheduled run automatically.
   */
  async scheduleRecurring(params: {
    pipelineId: string;
    projectId: string;
    ownerId: string;
    cronExpression: string;
    timezone?: string;
  }): Promise<void> {
    await pipelineQueue.upsertJobScheduler(
      params.pipelineId,
      { pattern: params.cronExpression, tz: params.timezone },
      {
        name: 'scheduled-execution',
        data: { pipelineId: params.pipelineId, projectId: params.projectId, ownerId: params.ownerId },
        opts: {
          removeOnComplete: { age: 7 * 24 * 60 * 60, count: 1000 },
          removeOnFail: { age: 30 * 24 * 60 * 60 }
        }
      }
    );
  }

  async unscheduleRecurring(pipelineId: string): Promise<void> {
    await pipelineQueue.removeJobScheduler(pipelineId);
  }
}

export const queueService = new QueueService();
