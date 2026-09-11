import { Response, NextFunction } from 'express';
import { File } from '../models/File';
import { AuthRequest } from '../middleware/auth.middleware';
import { projectService } from '../services/project.service';
import '../models/Project'; // registers the 'Project' model populate() below resolves against

const mapToDTO = (doc: any) => ({
  id: doc._id.toString(),
  filePath: doc.filePath,
  originalName: doc.originalName,
  size: doc.size,
  createdAt: doc.createdAt.toISOString(),
  project: doc.projectId && typeof doc.projectId === 'object'
    ? { id: doc.projectId._id.toString(), name: doc.projectId.name }
    : { id: doc.projectId?.toString?.() ?? null, name: null },
});

export const myFilesController = {
  // Every file uploaded to any project this user can currently see (owner or
  // member) — not just files this user personally uploaded, since the whole
  // point of project-scoping is that teammates share each other's datasets.
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const projectIds = await projectService.listAccessibleProjectIds(req.user.id);
      const files = await File.find({ projectId: { $in: projectIds } })
        .sort({ createdAt: -1 })
        .limit(200)
        .populate('projectId', 'name');

      res.json(files.map(mapToDTO));
    } catch (err) { next(err); }
  },
};
