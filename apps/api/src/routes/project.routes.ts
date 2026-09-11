import { Router } from 'express';
import { body } from 'express-validator';
import { projectController } from '../controllers/project.controller';
import { pipelineController } from '../controllers/pipeline.controller';
import { executionController } from '../controllers/execution.controller';
import { connectionController } from '../controllers/connection.controller';
import { fileRouter } from './file.routes';
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
// Must be registered before '/:projectId' or express would try to look up a
// project literally named "trash".
projectRouter.get('/trash', projectController.listTrashed);
projectRouter.get('/:projectId', projectController.get);
projectRouter.put('/:projectId', nameValidation, validate, projectController.update);
projectRouter.delete('/:projectId', projectController.delete);
projectRouter.post('/:projectId/restore', projectController.restore);

// Member Routes (owner-only to mutate; any member can list)
projectRouter.get('/:projectId/members', projectController.listMembers);
projectRouter.post('/:projectId/members', projectController.addMember);
projectRouter.put('/:projectId/members/:memberId', projectController.updateMemberRole);
projectRouter.delete('/:projectId/members/:memberId', projectController.removeMember);

// Pipeline Routes (nested)
projectRouter.post('/:projectId/pipelines', nameValidation, validate, pipelineController.create);
projectRouter.get('/:projectId/pipelines', pipelineController.list);
// Same ordering concern as '/trash' above, one level down.
projectRouter.get('/:projectId/pipelines/trash', pipelineController.listTrashed);
projectRouter.get('/:projectId/pipelines/:pipelineId', pipelineController.get);
projectRouter.get('/:projectId/pipelines/:pipelineId/validate', pipelineController.validate);
projectRouter.post('/:projectId/pipelines/:pipelineId/run', pipelineController.run);
projectRouter.get('/:projectId/pipelines/:pipelineId/executions', executionController.listExecutions);
projectRouter.get('/:projectId/pipelines/:pipelineId/executions/:executionId', executionController.getExecution);
projectRouter.post('/:projectId/pipelines/:pipelineId/executions/:executionId/retry', executionController.retryExecution);
projectRouter.put('/:projectId/pipelines/:pipelineId', pipelineController.update);
projectRouter.delete('/:projectId/pipelines/:pipelineId', pipelineController.delete);
projectRouter.post('/:projectId/pipelines/:pipelineId/restore', pipelineController.restore);
projectRouter.put('/:projectId/pipelines/:pipelineId/schedule', pipelineController.setSchedule);
projectRouter.delete('/:projectId/pipelines/:pipelineId/schedule', pipelineController.clearSchedule);
projectRouter.get('/:projectId/pipelines/:pipelineId/webhook', pipelineController.getWebhook);
projectRouter.put('/:projectId/pipelines/:pipelineId/webhook', pipelineController.setWebhook);
projectRouter.delete('/:projectId/pipelines/:pipelineId/webhook', pipelineController.clearWebhook);

// Connection Routes (nested) — shared with every project member, unlike the
// old global per-user /api/connections.
projectRouter.post('/:projectId/connections', connectionController.create);
projectRouter.get('/:projectId/connections', connectionController.list);
projectRouter.get('/:projectId/connections/:connectionId', connectionController.get);
projectRouter.delete('/:projectId/connections/:connectionId', connectionController.delete);

// File Routes (nested) — mergeParams lets fileRouter read :projectId.
projectRouter.use('/:projectId/files', fileRouter);
