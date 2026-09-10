import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

// Mock only the network-calling parts of the Stripe SDK (customer/checkout/
// portal creation) so this suite is deterministic and doesn't depend on
// real API availability or test-mode rate limits under parallel test runs.
// `webhooks` is left as the REAL implementation — signature verification is
// pure local HMAC computation, no network involved, and is exactly the part
// worth testing for real: it's what proves an inbound request actually came
// from Stripe. This mocked flow was additionally verified live against the
// real Stripe API (real checkout session, real Checkout Session completed
// via a live browser payment, real `stripe listen`-forwarded webhook with
// signature verification, plan correctly synced to 'pro' and back to
// 'free' on cancellation) — see the feature's commit message for details.
vi.mock('stripe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('stripe')>();
  const RealStripe = actual.default;

  function MockStripe(this: any) {
    this.customers = {
      create: vi.fn().mockResolvedValue({ id: 'cus_mock123' }),
    };
    this.checkout = {
      sessions: {
        create: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_mock123' }),
      },
    };
    this.billingPortal = {
      sessions: {
        create: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/p/session/mock123' }),
      },
    };
    this.webhooks = RealStripe.webhooks;
  }
  (MockStripe as any).webhooks = RealStripe.webhooks;

  return { default: MockStripe };
});

const { app } = await import('../src/app');
const { User } = await import('../src/models/User');
const { STRIPE_WEBHOOK_SECRET } = await import('../src/config/env');
const Stripe = (await import('stripe')).default;

const TEST_MONGODB_URI = 'mongodb://localhost:27017/pipeforge_test_billing';

let token: string;
let userId: string;

beforeAll(async () => {
  await mongoose.connect(TEST_MONGODB_URI);
  await User.deleteMany({});

  const res = await request(app).post('/api/auth/register').send({ email: 'billing@example.com', password: 'password123', name: 'Billing User' });
  token = res.body.token;
  userId = res.body.user.id;
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('GET /api/billing/plan', () => {
  it('defaults to the free plan with its limits and the full plan list', async () => {
    const res = await request(app).get('/api/billing/plan').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.plan).toBe('free');
    expect(res.body.subscriptionStatus).toBeNull();
    expect(res.body.limits.id).toBe('free');
    expect(res.body.plans).toHaveLength(2);
    expect(res.body.plans.map((p: any) => p.id).sort()).toEqual(['free', 'pro']);
    // Pro's limits should genuinely exceed Free's, or the "upgrade" is pointless.
    const [free, pro] = [res.body.plans.find((p: any) => p.id === 'free'), res.body.plans.find((p: any) => p.id === 'pro')];
    expect(pro.maxStorageMB).toBeGreaterThan(free.maxStorageMB);
    expect(pro.maxConcurrentExecutions).toBeGreaterThan(free.maxConcurrentExecutions);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/billing/plan');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/billing/checkout', () => {
  it('creates a checkout session and persists a Stripe customer id', async () => {
    const res = await request(app).post('/api/billing/checkout').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);

    const user = await User.findOne({ email: 'billing@example.com' });
    expect(user?.stripeCustomerId).toBe('cus_mock123');
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/billing/checkout');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/billing/portal', () => {
  it('succeeds once a Stripe customer exists (created by the checkout test above)', async () => {
    const res = await request(app).post('/api/billing/portal').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/^https:\/\/billing\.stripe\.com\//);
  });

  it('rejects a user with no billing account yet', async () => {
    await request(app).post('/api/auth/register').send({ email: 'no-billing@example.com', password: 'password123', name: 'No Billing' });
    const login = await request(app).post('/api/auth/login').send({ email: 'no-billing@example.com', password: 'password123' });
    const res = await request(app).post('/api/billing/portal').set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no billing account/i);
  });
});

describe('POST /api/billing/webhook', () => {
  it('rejects a request with no Stripe-Signature header', async () => {
    const res = await request(app).post('/api/billing/webhook').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Stripe-Signature/);
  });

  it('rejects a request with an invalid signature', async () => {
    const res = await request(app)
      .post('/api/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', 't=1,v1=not-a-real-signature')
      .send(JSON.stringify({ type: 'checkout.session.completed' }));
    expect(res.status).toBe(400);
  });

  // STRIPE_WEBHOOK_SECRET only gets set once `stripe listen` (local) or a
  // dashboard endpoint (deployed) has run at least once — see config/env.ts.
  // Skip rather than fail in an environment where it's genuinely unset.
  it.skipIf(!STRIPE_WEBHOOK_SECRET)('upgrades the user to pro on a genuinely signed checkout.session.completed event', async () => {
    const payload = JSON.stringify({
      id: 'evt_test_1',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          object: 'checkout.session',
          metadata: { userId },
          subscription: 'sub_test_1',
          customer: 'cus_mock123',
        },
      },
    });
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: STRIPE_WEBHOOK_SECRET! });

    const res = await request(app)
      .post('/api/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', signature)
      .send(payload);
    expect(res.status).toBe(200);

    const planRes = await request(app).get('/api/billing/plan').set('Authorization', `Bearer ${token}`);
    expect(planRes.body.plan).toBe('pro');
    expect(planRes.body.subscriptionStatus).toBe('active');
  });

  it.skipIf(!STRIPE_WEBHOOK_SECRET)('downgrades the user to free on a genuinely signed customer.subscription.deleted event', async () => {
    const payload = JSON.stringify({
      id: 'evt_test_2',
      object: 'event',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_test_1',
          object: 'subscription',
          status: 'canceled',
          customer: 'cus_mock123',
        },
      },
    });
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: STRIPE_WEBHOOK_SECRET! });

    const res = await request(app)
      .post('/api/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', signature)
      .send(payload);
    expect(res.status).toBe(200);

    const planRes = await request(app).get('/api/billing/plan').set('Authorization', `Bearer ${token}`);
    expect(planRes.body.plan).toBe('free');
    expect(planRes.body.subscriptionStatus).toBe('canceled');
  });
});
