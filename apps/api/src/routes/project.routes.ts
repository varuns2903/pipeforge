import { Router } from 'express';
import { body } from 'express-validator';
import { projectController } from '../controllers/project.controller';
import { pipelineController } from '../controllers/pipeline.controller';
import { executionController } from '../controllers/execution.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validationResult } from 'express-validator';

export const projectRouter = Router();

const validate = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const nameValidation = [
  body('name').notEmpty().withMessage('Name is required').trim()
];

projectRouter.use(requireAuth);

// Project Routes
projectRouter.post('/', nameValidation, validate, projectController.create);
projectRouter.get('/', projectController.list);
projectRouter.get('/:projectId', projectController.get);
projectRouter.put('/:projectId', nameValidation, validate, projectController.update);
projectRouter.delete('/:projectId', projectController.delete);
projectRouter.post('/:projectId/restore', projectController.restore);

// Pipeline Routes (nested)
projectRouter.post('/:projectId/pipelines', nameValidation, validate, pipelineController.create);
projectRouter.get('/:projectId/pipelines', pipelineController.list);
projectRouter.get('/:projectId/pipelines/:pipelineId', pipelineController.get);
projectRouter.get('/:projectId/pipelines/:pipelineId/validate', pipelineController.validate);
projectRouter.post('/:projectId/pipelines/:pipelineId/run', pipelineController.run);
projectRouter.get('/:projectId/pipelines/:pipelineId/executions', executionController.listExecutions);
projectRouter.get('/:projectId/pipelines/:pipelineId/executions/:executionId', executionController.getExecution);
projectRouter.put('/:projectId/pipelines/:pipelineId', pipelineController.update);
projectRouter.delete('/:projectId/pipelines/:pipelineId', pipelineController.delete);
projectRouter.post('/:projectId/pipelines/:pipelineId/restore', pipelineController.restore);
