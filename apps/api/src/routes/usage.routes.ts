import { Router } from 'express';
import { usageController } from '../controllers/usage.controller';
import { requireAuth } from '../middleware/auth.middleware';

export const usageRouter = Router();

usageRouter.use(requireAuth);
usageRouter.get('/', usageController.get);
