import { Request, Response, NextFunction } from 'express';
import { pipelineService } from '../services/pipeline.service';
import { activityLogService } from '../services/activityLog.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { PipelineValidator } from '@pipeforge/pipeline-engine';
import { Execution } from '../models/Execution';
import { queueService } from '../services/queue.service';
import { getConcurrentExecutionLimit } from '../services/quota.service';
import { pipelineExecutionsTotal } from '../metrics';

const mapToDTO = (doc: any) => ({
  id: doc._id.toString(),
  projectId: doc.projectId.toString(),
  name: doc.name,
  nodes: doc.nodes,
  edges: doc.edges,
  schedule: doc.schedule ? {
    cronExpression: doc.schedule.cronExpression ?? null,
    timezone: doc.schedule.timezone ?? null,
    enabled: !!doc.schedule.enabled,
  } : { cronExpression: null, timezone: null, enabled: false },
  notifications: {
    onFailure: doc.notifications?.onFailure ?? true,
    onComplete: doc.notifications?.onComplete ?? false,
  },
  // Secret is intentionally omitted here — fetched separately via
  // GET .../webhook, which decrypts it. This just says whether one's set.
  webhook: {
    configured: !!doc.webhook?.url,
    url: doc.webhook?.url ?? null,
    onFailure: doc.webhook?.onFailure ?? true,
    onComplete: doc.webhook?.onComplete ?? false,
  },
  createdAt: doc.createdAt.toISOString(),
  updatedAt: doc.updatedAt.toISOString(),
  deletedAt: doc.deletedAt ? doc.deletedAt.toISOString() : null,
});

export class PipelineController {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pipeline = await pipelineService.create(req.body.name, (req.params.projectId as string), req.user.id);
      await activityLogService.log(
        req.params.projectId as string, req.user.id, 'pipeline.created',
        `Created pipeline "${pipeline.name}"`, { pipelineId: pipeline._id.toString() }
      );
      res.status(201).json(mapToDTO(pipeline));
    } catch (err: any) {
      if (err.message === 'Project not found') return res.status(404).json({ error: err.message });
      next(err);
    }
  }

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pipelines = await pipelineService.list((req.params.projectId as string), req.user.id);
      res.json(pipelines.map(mapToDTO));
    } catch (err: any) {
      if (err.message === 'Project not found') return res.status(404).json({ error: err.message });
      next(err);
    }
  }

  async listTrashed(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pipelines = await pipelineService.listTrashed((req.params.projectId as string), req.user.id);
      res.json(pipelines.map(mapToDTO));
    } catch (err: any) {
      if (err.message === 'Project not found') return res.status(404).json({ error: err.message });
      next(err);
    }
  }

  async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pipeline = await pipelineService.getById((req.params.pipelineId as string), (req.params.projectId as string), req.user.id);
      res.json(mapToDTO(pipeline));
    } catch (err: any) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      next(err);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, nodes, edges, notifications } = req.body;
      const pipeline = await pipelineService.update((req.params.pipelineId as string), (req.params.projectId as string), req.user.id, { name, nodes, edges, notifications });
      await activityLogService.log(
        req.params.projectId as string, req.user.id, 'pipeline.updated',
        `Updated pipeline "${pipeline.name}"`, { pipelineId: pipeline._id.toString() }
      );
      res.json(mapToDTO(pipeline));
    } catch (err: any) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      next(err);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pipeline = await pipelineService.delete((req.params.pipelineId as string), (req.params.projectId as string), req.user.id);
      await activityLogService.log(
        req.params.projectId as string, req.user.id, 'pipeline.deleted',
        `Deleted pipeline "${pipeline.name}"`, { pipelineId: pipeline._id.toString() }
      );
      res.status(204).send();
    } catch (err: any) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      next(err);
    }
  }

  async restore(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pipeline = await pipelineService.restore((req.params.pipelineId as string), (req.params.projectId as string), req.user.id);
      res.json(mapToDTO(pipeline));
    } catch (err: any) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      next(err);
    }
  }

  async setSchedule(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { cronExpression, timezone } = req.body;
      if (!cronExpression) {
        return res.status(400).json({ error: 'cronExpression is required' });
      }
      const pipeline = await pipelineService.setSchedule(
        (req.params.pipelineId as string), (req.params.projectId as string), req.user.id, cronExpression, timezone
      );
      res.json(mapToDTO(pipeline));
    } catch (err: any) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      if (err.message.startsWith('Invalid cron expression')) return res.status(400).json({ error: err.message });
      next(err);
    }
  }

  async clearSchedule(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pipeline = await pipelineService.clearSchedule(
        (req.params.pipelineId as string), (req.params.projectId as string), req.user.id
      );
      res.json(mapToDTO(pipeline));
    } catch (err: any) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      next(err);
    }
  }

  async getWebhook(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const webhook = await pipelineService.getWebhook(
        (req.params.pipelineId as string), (req.params.projectId as string), req.user.id
      );
      res.json(webhook);
    } catch (err: any) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      next(err);
    }
  }

  async setWebhook(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { url, onFailure, onComplete, regenerateSecret } = req.body;
      if (!url) return res.status(400).json({ error: 'url is required' });
      const webhook = await pipelineService.setWebhook(
        (req.params.pipelineId as string), (req.params.projectId as string), req.user.id,
        { url, onFailure: !!onFailure, onComplete: !!onComplete, regenerateSecret: !!regenerateSecret }
      );
      res.json(webhook);
    } catch (err: any) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      if (err.message.startsWith('Invalid webhook URL') || err.message.startsWith('Webhook URL must')) {
        return res.status(400).json({ error: err.message });
      }
      next(err);
    }
  }

  async clearWebhook(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await pipelineService.clearWebhook(
        (req.params.pipelineId as string), (req.params.projectId as string), req.user.id
      );
      res.status(204).send();
    } catch (err: any) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      next(err);
    }
  }

  async validate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pipeline = await pipelineService.getById((req.params.pipelineId as string), (req.params.projectId as string), req.user.id);
      const validator = new PipelineValidator();
      const result = validator.validate(pipeline);
      res.json(result);
    } catch (err: any) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      next(err);
    }
  }

  async run(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pipeline = await pipelineService.getById((req.params.pipelineId as string), (req.params.projectId as string), req.user.id, 'editor');

      const validator = new PipelineValidator();
      const validation = validator.validate(pipeline);
      if (!validation.isValid) {
        return res.status(400).json({ error: 'Pipeline is invalid', details: validation.errors });
      }

      const [activeCount, executionLimit] = await Promise.all([
        Execution.countDocuments({ ownerId: req.user.id, status: { $in: ['PENDING', 'RUNNING'] } }),
        getConcurrentExecutionLimit(req.user.id),
      ]);
      if (activeCount >= executionLimit) {
        return res.status(429).json({
          error: `You have ${activeCount} pipeline executions already running. Wait for one to finish before starting another (limit: ${executionLimit}).`
        });
      }

      // Create an execution record
      const execution = new Execution({
        pipelineId: pipeline._id,
        projectId: pipeline.projectId,
        ownerId: req.user.id,
        pipelineSnapshot: {
          nodes: pipeline.nodes,
          edges: pipeline.edges
        },
        status: 'PENDING'
      });
      await execution.save();

      // Queue the job
      await queueService.queueExecution(execution._id.toString(), pipeline);
      pipelineExecutionsTotal.inc({ trigger: 'manual' });
      await activityLogService.log(
        req.params.projectId as string, req.user.id, 'pipeline.executed',
        `Ran pipeline "${pipeline.name}"`, { pipelineId: pipeline._id.toString(), executionId: execution._id.toString() }
      );

      res.status(202).json({
        id: execution._id.toString(),
        status: execution.status
      });
    } catch (err: any) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      next(err);
    }
  }
}

export const pipelineController = new PipelineController();
