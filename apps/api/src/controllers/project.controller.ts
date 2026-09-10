import { Request, Response, NextFunction } from 'express';
import { projectService } from '../services/project.service';
import { AuthRequest } from '../middleware/auth.middleware';

const mapToDTO = (doc: any, userId: string) => ({
  id: doc._id.toString(),
  name: doc.name,
  ownerId: doc.ownerId.toString(),
  // The requesting user's own access level on this project — 'owner',
  // 'editor', or 'viewer' — so the frontend can show/hide management UI
  // (rename, delete, members) without a second round trip.
  myRole: projectService.roleOf(doc, userId),
  createdAt: doc.createdAt.toISOString(),
  updatedAt: doc.updatedAt.toISOString(),
  deletedAt: doc.deletedAt ? doc.deletedAt.toISOString() : null,
});

export class ProjectController {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const project = await projectService.create(req.body.name, req.user.id);
      res.status(201).json(mapToDTO(project, req.user.id));
    } catch (err) { next(err); }
  }

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const projects = await projectService.list(req.user.id);
      res.json(projects.map(p => mapToDTO(p, req.user.id)));
    } catch (err) { next(err); }
  }

  async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const project = await projectService.getById((req.params.projectId as string), req.user.id);
      res.json(mapToDTO(project, req.user.id));
    } catch (err: any) {
      if (err.message === 'Project not found') return res.status(404).json({ error: err.message });
      next(err);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const project = await projectService.update((req.params.projectId as string), req.user.id, req.body.name);
      res.json(mapToDTO(project, req.user.id));
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

  async listTrashed(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const projects = await projectService.listTrashed(req.user.id);
      res.json(projects.map(p => mapToDTO(p, req.user.id)));
    } catch (err) { next(err); }
  }

  async restore(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const project = await projectService.restore((req.params.projectId as string), req.user.id);
      res.json(mapToDTO(project, req.user.id));
    } catch (err: any) {
      if (err.message === 'Deleted project not found') return res.status(404).json({ error: err.message });
      next(err);
    }
  }

  async listMembers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const members = await projectService.listMembers((req.params.projectId as string), req.user.id);
      res.json(members);
    } catch (err: any) {
      if (err.message === 'Project not found') return res.status(404).json({ error: err.message });
      next(err);
    }
  }

  async addMember(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email, role } = req.body;
      if (!email) return res.status(400).json({ error: 'email is required' });
      if (role !== 'editor' && role !== 'viewer') return res.status(400).json({ error: "role must be 'editor' or 'viewer'" });

      const members = await projectService.addMember((req.params.projectId as string), req.user.id, email, role);
      res.status(201).json(members);
    } catch (err: any) {
      if (err.message === 'Project not found') return res.status(404).json({ error: err.message });
      if (err.message === 'No user found with that email' || err.message.includes('already a member')) {
        return res.status(400).json({ error: err.message });
      }
      next(err);
    }
  }

  async updateMemberRole(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { role } = req.body;
      if (role !== 'editor' && role !== 'viewer') return res.status(400).json({ error: "role must be 'editor' or 'viewer'" });

      const members = await projectService.updateMemberRole(
        (req.params.projectId as string), req.user.id, (req.params.memberId as string), role
      );
      res.json(members);
    } catch (err: any) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      next(err);
    }
  }

  async removeMember(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const members = await projectService.removeMember(
        (req.params.projectId as string), req.user.id, (req.params.memberId as string)
      );
      res.json(members);
    } catch (err: any) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      next(err);
    }
  }
}

export const projectController = new ProjectController();
