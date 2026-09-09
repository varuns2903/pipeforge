import { Router } from 'express';
import { connectionController } from '../controllers/connection.controller';
import { requireAuth } from '../middleware/auth.middleware';

export const connectionRouter = Router();

connectionRouter.use(requireAuth);

connectionRouter.post('/', connectionController.create);
connectionRouter.get('/', connectionController.list);
connectionRouter.get('/:connectionId', connectionController.get);
connectionRouter.delete('/:connectionId', connectionController.delete);
