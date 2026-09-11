import { Response, NextFunction } from 'express';
import { Execution } from '../models/Execution';
import { AuthRequest } from '../middleware/auth.middleware';
import { parsePageParams, toPage } from '../utils/pagination';
import '../models/Pipeline'; // registers the 'Pipeline' model populate() below resolves against
import '../models/Project'; // same, for 'Project'

const mapToDTO = (doc: any) => ({
  id: doc._id.toString(),
  status: doc.status,
  createdAt: doc.createdAt.toISOString(),
  startedAt: doc.startedAt ? doc.startedAt.toISOString() : null,
  completedAt: doc.completedAt ? doc.completedAt.toISOString() : null,
  error: doc.error ?? null,
  pipeline: doc.pipelineId && typeof doc.pipelineId === 'object'
    ? { id: doc.pipelineId._id.toString(), name: doc.pipelineId.name }
    : { id: doc.pipelineId?.toString?.() ?? null, name: null }, // pipeline since soft-/hard-deleted
  project: doc.projectId && typeof doc.projectId === 'object'
    ? { id: doc.projectId._id.toString(), name: doc.projectId.name }
    : { id: doc.projectId?.toString?.() ?? null, name: null },
});

export const myExecutionsController = {
  // Every execution *this user personally triggered* (manual runs, retries,
  // or a schedule attributed to them at creation) across every project they
  // can see — not "every execution in projects they belong to", which would
  // also show teammates' runs; that's a separate activity-log concern.
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { limit, cursor } = parsePageParams(req.query);
      const executions = await Execution.find({ ownerId: req.user.id, ...(cursor ? { _id: { $lt: cursor } } : {}) })
        .sort({ _id: -1 })
        .limit(limit + 1)
        .select('-results -pipelineSnapshot') // heavy fields, not needed for a list view
        .populate('pipelineId', 'name')
        .populate('projectId', 'name');

      const { items, nextCursor } = toPage(executions, limit);
      res.json({ items: items.map(mapToDTO), nextCursor });
    } catch (err) { next(err); }
  },
};
