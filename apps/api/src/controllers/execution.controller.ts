import { Request, Response } from 'express';
import { Execution } from '../models/Execution';

export const executionController = {
  async listExecutions(req: Request, res: Response) {
    try {
      const { pipelineId } = req.params;
      
      const executions = await Execution.find({ pipelineId })
        .sort({ createdAt: -1 })
        .select('-results') // don't send heavy results payload in list
        .limit(50);
        
      res.json(executions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
  
  async getExecution(req: Request, res: Response) {
    try {
      const { executionId } = req.params;
      
      const execution = await Execution.findById(executionId);
      if (!execution) return res.status(404).json({ error: 'Execution not found' });
      
      res.json(execution);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
};
