import { Response } from 'express';
import { Execution } from '../models/Execution';
import { AuthRequest } from '../middleware/auth.middleware';
import { pipelineService } from '../services/pipeline.service';
import { queueService } from '../services/queue.service';
import { MAX_CONCURRENT_EXECUTIONS_PER_USER } from '../config/env';

export const executionController = {
  async listExecutions(req: AuthRequest, res: Response) {
    try {
      const { projectId, pipelineId } = req.params;

      // Verifies the requesting user owns the project/pipeline before exposing executions.
      await pipelineService.getById(pipelineId as string, projectId as string, req.user.id);

      const executions = await Execution.find({ pipelineId })
        .sort({ createdAt: -1 })
        .select('-results') // don't send heavy results payload in list
        .limit(50);

      res.json(executions);
    } catch (err: any) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      res.status(500).json({ error: err.message });
    }
  },

  async getExecution(req: AuthRequest, res: Response) {
    try {
      const { projectId, pipelineId, executionId } = req.params;

      // Verifies the requesting user owns the project/pipeline before exposing this execution.
      await pipelineService.getById(pipelineId as string, projectId as string, req.user.id);

      const execution = await Execution.findOne({ _id: executionId, pipelineId });
      if (!execution) return res.status(404).json({ error: 'Execution not found' });

      res.json(execution);
    } catch (err: any) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      res.status(500).json({ error: err.message });
    }
  },

  // Re-runs the EXACT pipeline definition captured at the time of a past
  // execution (its frozen pipelineSnapshot) — not whatever the pipeline
  // looks like now — so retrying a failed run is an apples-to-apples
  // attempt, unaffected by edits made since.
  async retryExecution(req: AuthRequest, res: Response) {
    try {
      const { projectId, pipelineId, executionId } = req.params;

      const pipeline = await pipelineService.getById(pipelineId as string, projectId as string, req.user.id);

      const original = await Execution.findOne({ _id: executionId, pipelineId });
      if (!original) return res.status(404).json({ error: 'Execution not found' });

      const activeCount = await Execution.countDocuments({
        ownerId: req.user.id,
        status: { $in: ['PENDING', 'RUNNING'] }
      });
      if (activeCount >= MAX_CONCURRENT_EXECUTIONS_PER_USER) {
        return res.status(429).json({
          error: `You have ${activeCount} pipeline executions already running. Wait for one to finish before starting another (limit: ${MAX_CONCURRENT_EXECUTIONS_PER_USER}).`
        });
      }

      const retry = new Execution({
        pipelineId: original.pipelineId,
        projectId: original.projectId,
        ownerId: req.user.id,
        pipelineSnapshot: original.pipelineSnapshot,
        status: 'PENDING'
      });
      await retry.save();

      // The frozen snapshot only has {nodes, edges} — the worker also needs
      // the pipeline id (for routing live Socket.IO updates), name, and
      // current notification preferences (those are a pipeline-level
      // setting, not something to freeze from the original run), so merge
      // those in from the current pipeline while keeping the old snapshot's
      // nodes/edges as the thing that actually gets re-executed.
      await queueService.queueExecution(retry._id.toString(), {
        _id: pipeline._id,
        name: pipeline.name,
        notifications: pipeline.notifications,
        ...original.pipelineSnapshot
      });

      res.status(202).json({ id: retry._id.toString(), status: retry.status });
    } catch (err: any) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      res.status(500).json({ error: err.message });
    }
  }
};
