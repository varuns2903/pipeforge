import { Request, Response, NextFunction } from 'express';
import { pipelineService } from '../services/pipeline.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { PipelineValidator } from '@pipeforge/pipeline-engine';
import { Execution } from '../models/Execution';
import { queueService } from '../services/queue.service';

const mapToDTO = (doc: any) => ({
  id: doc._id.toString(),
  projectId: doc.projectId.toString(),
  name: doc.name,
  nodes: doc.nodes,
  edges: doc.edges,
  createdAt: doc.createdAt.toISOString(),
  updatedAt: doc.updatedAt.toISOString(),
});

export class PipelineController {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pipeline = await pipelineService.create(req.body.name, (req.params.projectId as string), req.user.id);
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
      const { name, nodes, edges } = req.body;
      const pipeline = await pipelineService.update((req.params.pipelineId as string), (req.params.projectId as string), req.user.id, { name, nodes, edges });
      res.json(mapToDTO(pipeline));
    } catch (err: any) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      next(err);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await pipelineService.delete((req.params.pipelineId as string), (req.params.projectId as string), req.user.id);
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
      const pipeline = await pipelineService.getById((req.params.pipelineId as string), (req.params.projectId as string), req.user.id);
      
      const validator = new PipelineValidator();
      const validation = validator.validate(pipeline);
      if (!validation.isValid) {
        return res.status(400).json({ error: 'Pipeline is invalid', details: validation.errors });
      }

      // Create an execution record
      const execution = new Execution({
        pipelineId: pipeline._id,
        projectId: pipeline.projectId,
        pipelineSnapshot: {
          nodes: pipeline.nodes,
          edges: pipeline.edges
        },
        status: 'PENDING'
      });
      await execution.save();

      // Queue the job
      await queueService.queueExecution(execution._id.toString(), pipeline);

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
