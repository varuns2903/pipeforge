import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { projectService } from '../services/project.service';
import { ActivityLog } from '../models/ActivityLog';
import { parsePageParams, toPage } from '../utils/pagination';

export class ActivityLogController {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await projectService.getById(req.params.projectId as string, req.user.id, 'viewer');

      const { limit, cursor } = parsePageParams(req.query);
      const docs = await ActivityLog.find({
        projectId: req.params.projectId,
        ...(cursor ? { _id: { $lt: cursor } } : {}),
      })
        .sort({ _id: -1 })
        .limit(limit + 1)
        .populate('userId', 'name email')
        .lean();

      const { items, nextCursor } = toPage(docs, limit);
      res.json({
        items: items.map((doc: any) => ({
          id: doc._id.toString(),
          action: doc.action,
          message: doc.message,
          metadata: doc.metadata ?? null,
          user: doc.userId ? {
            id: doc.userId._id.toString(),
            name: doc.userId.name ?? null,
            email: doc.userId.email ?? null,
          } : null,
          createdAt: doc.createdAt.toISOString(),
        })),
        nextCursor,
      });
    } catch (err: any) {
      if (err.message === 'Project not found') return res.status(404).json({ error: err.message });
      next(err);
    }
  }
}

export const activityLogController = new ActivityLogController();
