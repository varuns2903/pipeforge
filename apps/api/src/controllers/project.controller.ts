import { Request, Response, NextFunction } from 'express';
import { projectService } from '../services/project.service';
import { activityLogService } from '../services/activityLog.service';
import { User } from '../models/User';
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
      await activityLogService.log(project._id.toString(), req.user.id, 'project.created', `Created the project "${project.name}"`);
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
      await activityLogService.log(project._id.toString(), req.user.id, 'project.updated', `Renamed the project to "${project.name}"`);
      res.json(mapToDTO(project, req.user.id));
    } catch (err: any) {
      if (err.message === 'Project not found') return res.status(404).json({ error: err.message });
      next(err);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await projectService.delete((req.params.projectId as string), req.user.id);
      await activityLogService.log(req.params.projectId as string, req.user.id, 'project.deleted', 'Moved the project to trash');
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
      await activityLogService.log(req.params.projectId as string, req.user.id, 'project.member_added', `Added ${email} as ${role}`);
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
      const target = members.find((m: any) => m.userId === req.params.memberId);
      await activityLogService.log(
        req.params.projectId as string, req.user.id, 'project.member_role_changed',
        `Changed ${target?.email || 'a member'}'s role to ${role}`
      );
      res.json(members);
    } catch (err: any) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      next(err);
    }
  }

  async removeMember(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const removedUser = await User.findById(req.params.memberId as string).select('email');
      const members = await projectService.removeMember(
        (req.params.projectId as string), req.user.id, (req.params.memberId as string)
      );
      await activityLogService.log(
        req.params.projectId as string, req.user.id, 'project.member_removed',
        `Removed ${removedUser?.email || 'a member'} from the project`
      );
      res.json(members);
    } catch (err: any) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      next(err);
    }
  }
}

export const projectController = new ProjectController();
