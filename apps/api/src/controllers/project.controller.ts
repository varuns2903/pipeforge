import { Request, Response, NextFunction } from 'express';
import { projectService } from '../services/project.service';
import { AuthRequest } from '../middleware/auth.middleware';

const mapToDTO = (doc: any) => ({
  id: doc._id.toString(),
  name: doc.name,
  ownerId: doc.ownerId.toString(),
  createdAt: doc.createdAt.toISOString(),
  updatedAt: doc.updatedAt.toISOString(),
});

export class ProjectController {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const project = await projectService.create(req.body.name, req.user.id);
      res.status(201).json(mapToDTO(project));
    } catch (err) { next(err); }
  }

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const projects = await projectService.list(req.user.id);
      res.json(projects.map(mapToDTO));
    } catch (err) { next(err); }
  }

  async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const project = await projectService.getById((req.params.projectId as string), req.user.id);
      res.json(mapToDTO(project));
    } catch (err: any) {
      if (err.message === 'Project not found') return res.status(404).json({ error: err.message });
      next(err);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const project = await projectService.update((req.params.projectId as string), req.user.id, req.body.name);
      res.json(mapToDTO(project));
    } catch (err: any) {
      if (err.message === 'Project not found') return res.status(404).json({ error: err.message });
      next(err);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await projectService.delete((req.params.projectId as string), req.user.id);
      res.status(204).send();
    } catch (err: any) {
      if (err.message === 'Project not found') return res.status(404).json({ error: err.message });
      next(err);
    }
  }

  async restore(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const project = await projectService.restore((req.params.projectId as string), req.user.id);
      res.json(mapToDTO(project));
    } catch (err: any) {
      if (err.message === 'Deleted project not found') return res.status(404).json({ error: err.message });
      next(err);
    }
  }
}

export const projectController = new ProjectController();
