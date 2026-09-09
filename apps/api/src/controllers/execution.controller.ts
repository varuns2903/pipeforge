import { Response } from 'express';
import { Execution } from '../models/Execution';
import { AuthRequest } from '../middleware/auth.middleware';
import { pipelineService } from '../services/pipeline.service';

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
  }
};
