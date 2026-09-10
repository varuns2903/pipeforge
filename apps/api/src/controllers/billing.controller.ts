import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { billingService } from '../services/billing.service';
import { User } from '../models/User';
import { PLANS, getPlanLimits } from '../config/plans';
import { logger } from '../logger';

const planSummary = (p: (typeof PLANS)[keyof typeof PLANS]) => ({
  id: p.id,
  name: p.name,
  maxStorageMB: p.maxStorageMB,
  maxConcurrentExecutions: p.maxConcurrentExecutions,
});

export class BillingController {
  async getPlan(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await User.findById(req.user.id).select('plan stripeSubscriptionStatus');
      if (!user) return res.status(404).json({ error: 'User not found' });

      res.json({
        plan: user.plan,
        subscriptionStatus: user.stripeSubscriptionStatus || null,
        limits: planSummary(getPlanLimits(user.plan)),
        plans: Object.values(PLANS).map(planSummary),
      });
    } catch (err) { next(err); }
  }

  async createCheckout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const url = await billingService.createCheckoutSession(req.user.id);
      res.json({ url });
    } catch (err: any) {
      if (err.message === 'Pro plan is not configured') return res.status(500).json({ error: err.message });
      next(err);
    }
  }

  async createPortal(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const url = await billingService.createPortalSession(req.user.id);
      res.json({ url });
    } catch (err: any) {
      if (err.message.includes('No billing account')) return res.status(400).json({ error: err.message });
      next(err);
    }
  }

  // Not behind requireAuth — Stripe calls this directly, authenticated only
  // by the signature header (verified inside handleWebhookEvent). `req.body`
  // is the raw Buffer here because this route is mounted with express.raw()
  // before the app-wide express.json(), specifically so the signature check
  // sees the exact bytes Stripe signed.
  async webhook(req: Request, res: Response) {
    const signature = req.headers['stripe-signature'] as string | undefined;
    if (!signature) return res.status(400).json({ error: 'Missing Stripe-Signature header' });

    try {
      await billingService.handleWebhookEvent(req.body, signature);
      res.json({ received: true });
    } catch (err: any) {
      logger.warn({ err }, 'Stripe webhook signature verification failed');
      res.status(400).json({ error: `Webhook error: ${err.message}` });
    }
  }
}

export const billingController = new BillingController();
