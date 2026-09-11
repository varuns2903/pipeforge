import { Router } from 'express';
import { myExecutionsController } from '../controllers/myExecutions.controller';
import { requireAuth } from '../middleware/auth.middleware';

export const myExecutionsRouter = Router();

myExecutionsRouter.use(requireAuth);
myExecutionsRouter.get('/', myExecutionsController.list);
