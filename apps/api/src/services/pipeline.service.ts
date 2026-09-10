import crypto from 'crypto';
import { CronExpressionParser } from 'cron-parser';
import { encryptSecret, decryptSecret } from '@pipeforge/shared';
import { Pipeline } from '../models/Pipeline';
import { projectService, ProjectRole } from './project.service';
import { queueService } from './queue.service';
import { CONNECTION_ENCRYPTION_KEY } from '../config/env';

export class PipelineService {
  async create(name: string, projectId: string, ownerId: string) {
    await projectService.getById(projectId, ownerId, 'editor');
    const pipeline = new Pipeline({ name, projectId });
    await pipeline.save();
    return pipeline;
  }

  async list(projectId: string, ownerId: string) {
    await projectService.getById(projectId, ownerId, 'viewer');
    // Safety cap against unbounded scans; real cursor-based pagination is a
    // separate, larger change (needs a frontend contract change too).
    return Pipeline.find({ projectId, deletedAt: null }).sort({ updatedAt: -1 }).limit(200);
  }

  async getById(pipelineId: string, projectId: string, ownerId: string, minRole: ProjectRole = 'viewer') {
    await projectService.getById(projectId, ownerId, minRole);
    const pipeline = await Pipeline.findOne({ _id: pipelineId, projectId, deletedAt: null });
    if (!pipeline) throw new Error('Pipeline not found');
    return pipeline;
  }

  async update(pipelineId: string, projectId: string, ownerId: string, data: { name?: string, nodes?: any[], edges?: any[], notifications?: { onFailure?: boolean, onComplete?: boolean } }) {
    await projectService.getById(projectId, ownerId, 'editor');
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
    const pipeline = await this.getById(pipelineId, projectId, ownerId, 'editor');
    if (pipeline.schedule?.enabled) {
      await queueService.unscheduleRecurring(pipelineId);
    }
    pipeline.deletedAt = new Date();
    await pipeline.save();
    return pipeline;
  }

  async listTrashed(projectId: string, ownerId: string) {
    await projectService.getById(projectId, ownerId, 'viewer');
    return Pipeline.find({ projectId, deletedAt: { $ne: null } }).sort({ deletedAt: -1 }).limit(200);
  }

  async restore(pipelineId: string, projectId: string, ownerId: string) {
    await projectService.getById(projectId, ownerId, 'editor');
    const pipeline = await Pipeline.findOneAndUpdate(
      { _id: pipelineId, projectId, deletedAt: { $ne: null } },
      { deletedAt: null },
      { new: true }
    );
    if (!pipeline) throw new Error('Deleted pipeline not found');
    return pipeline;
  }

  async setSchedule(pipelineId: string, projectId: string, ownerId: string, cronExpression: string, timezone?: string) {
    const pipeline = await this.getById(pipelineId, projectId, ownerId, 'editor');

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
    const pipeline = await this.getById(pipelineId, projectId, ownerId, 'editor');

    if (pipeline.schedule?.enabled) {
      await queueService.unscheduleRecurring(pipelineId);
    }

    pipeline.schedule = { cronExpression: undefined, timezone: undefined, enabled: false };
    await pipeline.save();
    return pipeline;
  }

  // Returns the webhook config with its signing secret decrypted, so the
  // pipeline's owner/editor can copy it into whatever verifies deliveries on
  // their receiving end. Read-only access (viewer) can see it too — same
  // sensitivity level as being able to see the pipeline's definition.
  async getWebhook(pipelineId: string, projectId: string, ownerId: string) {
    const pipeline = await this.getById(pipelineId, projectId, ownerId, 'viewer');
    if (!pipeline.webhook?.url) return null;
    return {
      url: pipeline.webhook.url,
      secret: pipeline.webhook.secretEncrypted ? decryptSecret(pipeline.webhook.secretEncrypted, CONNECTION_ENCRYPTION_KEY) : null,
      onFailure: !!pipeline.webhook.onFailure,
      onComplete: !!pipeline.webhook.onComplete,
    };
  }

  // Generates a new signing secret only the first time a webhook is set (or
  // whenever `regenerateSecret` is explicitly requested) — updating just the
  // URL or event flags shouldn't silently invalidate a receiver's existing
  // verification setup.
  async setWebhook(pipelineId: string, projectId: string, ownerId: string, data: { url: string, onFailure: boolean, onComplete: boolean, regenerateSecret?: boolean }) {
    let parsed: URL;
    try {
      parsed = new URL(data.url);
    } catch {
      throw new Error('Invalid webhook URL');
    }
    // Format-only validation — this does not protect against SSRF (a URL
    // that resolves to an internal address); the worker delivering this
    // request runs inside the same trust boundary as the rest of the infra,
    // so treat any webhook URL as able to reach internal services.
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Webhook URL must use http or https');
    }

    const pipeline = await this.getById(pipelineId, projectId, ownerId, 'editor');

    let secretEncrypted = pipeline.webhook?.secretEncrypted;
    if (!secretEncrypted || data.regenerateSecret) {
      const plainSecret = crypto.randomBytes(24).toString('hex');
      secretEncrypted = encryptSecret(plainSecret, CONNECTION_ENCRYPTION_KEY);
    }

    pipeline.webhook = { url: data.url, secretEncrypted, onFailure: data.onFailure, onComplete: data.onComplete };
    await pipeline.save();
    return this.getWebhook(pipelineId, projectId, ownerId);
  }

  async clearWebhook(pipelineId: string, projectId: string, ownerId: string) {
    const pipeline = await this.getById(pipelineId, projectId, ownerId, 'editor');
    pipeline.webhook = { url: undefined, secretEncrypted: undefined, onFailure: true, onComplete: false };
    await pipeline.save();
    return pipeline;
  }
}

export const pipelineService = new PipelineService();
