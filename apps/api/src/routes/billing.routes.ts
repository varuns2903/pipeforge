import { Router } from 'express';
import { billingController } from '../controllers/billing.controller';
import { requireAuth } from '../middleware/auth.middleware';

// The raw-body webhook route is mounted separately in app.ts, before the
// app-wide express.json() — it is NOT part of this router.
export const billingRouter = Router();

billingRouter.use(requireAuth);
billingRouter.get('/plan', billingController.getPlan);
billingRouter.post('/checkout', billingController.createCheckout);
billingRouter.post('/portal', billingController.createPortal);
