import { CronExpressionParser } from 'cron-parser';
import { Pipeline } from '../models/Pipeline';
import { projectService } from './project.service';
import { queueService } from './queue.service';

export class PipelineService {
  async create(name: string, projectId: string, ownerId: string) {
    await projectService.getById(projectId, ownerId); // verify ownership
    const pipeline = new Pipeline({ name, projectId });
    await pipeline.save();
    return pipeline;
  }

  async list(projectId: string, ownerId: string) {
    await projectService.getById(projectId, ownerId);
    // Safety cap against unbounded scans; real cursor-based pagination is a
    // separate, larger change (needs a frontend contract change too).
    return Pipeline.find({ projectId, deletedAt: null }).sort({ updatedAt: -1 }).limit(200);
  }

  async getById(pipelineId: string, projectId: string, ownerId: string) {
    await projectService.getById(projectId, ownerId);
    const pipeline = await Pipeline.findOne({ _id: pipelineId, projectId, deletedAt: null });
    if (!pipeline) throw new Error('Pipeline not found');
    return pipeline;
  }

  async update(pipelineId: string, projectId: string, ownerId: string, data: { name?: string, nodes?: any[], edges?: any[], notifications?: { onFailure?: boolean, onComplete?: boolean } }) {
    await projectService.getById(projectId, ownerId);
    const pipeline = await Pipeline.findOneAndUpdate(
      { _id: pipelineId, projectId, deletedAt: null },
      data,
      { new: true }
    );
    if (!pipeline) throw new Error('Pipeline not found');
    return pipeline;
  }

  // Soft delete: keeps the pipeline (and its execution history) around for
  // recovery instead of destroying it outright.
  async delete(pipelineId: string, projectId: string, ownerId: string) {
    const pipeline = await this.getById(pipelineId, projectId, ownerId);
    if (pipeline.schedule?.enabled) {
      await queueService.unscheduleRecurring(pipelineId);
    }
    pipeline.deletedAt = new Date();
    await pipeline.save();
    return pipeline;
  }

  async listTrashed(projectId: string, ownerId: string) {
    await projectService.getById(projectId, ownerId);
    return Pipeline.find({ projectId, deletedAt: { $ne: null } }).sort({ deletedAt: -1 }).limit(200);
  }

  async restore(pipelineId: string, projectId: string, ownerId: string) {
    await projectService.getById(projectId, ownerId);
    const pipeline = await Pipeline.findOneAndUpdate(
      { _id: pipelineId, projectId, deletedAt: { $ne: null } },
      { deletedAt: null },
      { new: true }
    );
    if (!pipeline) throw new Error('Deleted pipeline not found');
    return pipeline;
  }

  async setSchedule(pipelineId: string, projectId: string, ownerId: string, cronExpression: string, timezone?: string) {
    const pipeline = await this.getById(pipelineId, projectId, ownerId);

    try {
      CronExpressionParser.parse(cronExpression, timezone ? { tz: timezone } : undefined);
    } catch (err: any) {
      throw new Error(`Invalid cron expression: ${err.message}`);
    }

    // upsertJobScheduler (called inside scheduleRecurring) replaces any
    // existing schedule for this pipeline id in one call — no separate
    // remove-then-add needed.
    await queueService.scheduleRecurring({ pipelineId, projectId, ownerId, cronExpression, timezone });

    pipeline.schedule = { cronExpression, timezone, enabled: true };
    await pipeline.save();
    return pipeline;
  }

  async clearSchedule(pipelineId: string, projectId: string, ownerId: string) {
    const pipeline = await this.getById(pipelineId, projectId, ownerId);

    if (pipeline.schedule?.enabled) {
      await queueService.unscheduleRecurring(pipelineId);
    }

    pipeline.schedule = { cronExpression: undefined, timezone: undefined, enabled: false };
    await pipeline.save();
    return pipeline;
  }
}

export const pipelineService = new PipelineService();
