import Stripe from 'stripe';
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, WEB_URL } from '../config/env';
import { getPlanLimits } from '../config/plans';
import { User } from '../models/User';

export const stripe: Stripe = new Stripe(STRIPE_SECRET_KEY);

export class BillingService {
  // Creates (and persists) a Stripe Customer the first time a user checks
  // out, then reuses it on every subsequent checkout/portal call — Stripe
  // ties subscriptions and payment methods to the customer, not the user.
  private async getOrCreateCustomerId(userId: string): Promise<string> {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId },
    });
    user.stripeCustomerId = customer.id;
    await user.save();
    return customer.id;
  }

  async createCheckoutSession(userId: string): Promise<string> {
    const priceId = getPlanLimits('pro').priceId;
    if (!priceId) throw new Error('Pro plan is not configured');

    const customerId = await this.getOrCreateCustomerId(userId);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${WEB_URL}/billing?checkout=success`,
      cancel_url: `${WEB_URL}/billing?checkout=cancel`,
      // Belt-and-suspenders alongside the customer id: the webhook handler
      // reads this directly on checkout.session.completed rather than
      // relying solely on a customerId -> user lookup.
      metadata: { userId },
    });

    if (!session.url) throw new Error('Stripe did not return a checkout URL');
    return session.url;
  }

  // Stripe's hosted billing portal — lets a Pro user update their card,
  // view invoices, or cancel, without PipeForge building any of that UI.
  async createPortalSession(userId: string): Promise<string> {
    const user = await User.findById(userId);
    if (!user?.stripeCustomerId) {
      throw new Error('No billing account found for this user — upgrade to Pro first');
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${WEB_URL}/billing`,
    });
    return portalSession.url;
  }

  // `rawBody` must be the exact unparsed request body Stripe sent — the
  // signature is computed over those exact bytes, so JSON.stringify(parsed)
  // would not reliably match and verification would fail.
  async handleWebhookEvent(rawBody: Buffer, signature: string): Promise<void> {
    if (!STRIPE_WEBHOOK_SECRET) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured — run `stripe listen --forward-to <this server>/api/billing/webhook` (or set up a dashboard webhook endpoint) and set it in .env');
    }
    const event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (userId && session.subscription) {
          const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
          await User.findByIdAndUpdate(userId, {
            plan: 'pro',
            stripeSubscriptionId: subscriptionId,
            stripeSubscriptionStatus: 'active',
          });
        }
        break;
      }

      // Covers plan changes, cancellations, and payment failures moving a
      // subscription out of active/trialing — always re-derive `plan` from
      // the subscription's current status rather than assuming pro stays
      // pro once granted.
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
        const isActive = subscription.status === 'active' || subscription.status === 'trialing';
        await User.findOneAndUpdate(
          { stripeCustomerId: customerId },
          {
            plan: isActive ? 'pro' : 'free',
            stripeSubscriptionId: subscription.id,
            stripeSubscriptionStatus: subscription.status,
          }
        );
        break;
      }
    }
  }
}

export const billingService = new BillingService();
