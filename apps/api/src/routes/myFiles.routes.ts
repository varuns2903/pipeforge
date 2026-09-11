import { Router } from 'express';
import { myFilesController } from '../controllers/myFiles.controller';
import { requireAuth } from '../middleware/auth.middleware';

export const myFilesRouter = Router();

myFilesRouter.use(requireAuth);
myFilesRouter.get('/', myFilesController.list);
