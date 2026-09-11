import { Response, NextFunction } from 'express';
import { Execution } from '../models/Execution';
import { AuthRequest } from '../middleware/auth.middleware';
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
      const executions = await Execution.find({ ownerId: req.user.id })
        .sort({ createdAt: -1 })
        .limit(100)
        .select('-results -pipelineSnapshot') // heavy fields, not needed for a list view
        .populate('pipelineId', 'name')
        .populate('projectId', 'name');

      res.json(executions.map(mapToDTO));
    } catch (err) { next(err); }
  },
};
