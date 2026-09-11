import { Router } from 'express';
import { billingController } from '../controllers/billing.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { actionLimiter } from '../middleware/rateLimit';

// The raw-body webhook route is mounted separately in app.ts, before the
// app-wide express.json() — it is NOT part of this router.
export const billingRouter = Router();

billingRouter.use(requireAuth);
billingRouter.get('/plan', billingController.getPlan);
// Rate-limited: each call hits the real Stripe API, unlike the rest of this router.
billingRouter.post('/checkout', actionLimiter, billingController.createCheckout);
billingRouter.post('/portal', actionLimiter, billingController.createPortal);
