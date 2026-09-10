import { MAX_USER_STORAGE_MB, MAX_CONCURRENT_EXECUTIONS_PER_USER, STRIPE_PRICE_ID_PRO } from './env';

export type PlanId = 'free' | 'pro';

export interface PlanLimits {
  id: PlanId;
  name: string;
  maxStorageMB: number;
  maxConcurrentExecutions: number;
  /** The Stripe Price to check out for this plan; null for the Free plan (nothing to buy). */
  priceId: string | null;
}

// Free plan's limits are the existing per-user quota env vars (unchanged
// behavior for anyone not on Pro); Pro gets a flat multiplier rather than
// its own pair of env vars — one more knob than this needs right now.
export const PLANS: Record<PlanId, PlanLimits> = {
  free: {
    id: 'free',
    name: 'Free',
    maxStorageMB: MAX_USER_STORAGE_MB,
    maxConcurrentExecutions: MAX_CONCURRENT_EXECUTIONS_PER_USER,
    priceId: null,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    maxStorageMB: MAX_USER_STORAGE_MB * 10,
    maxConcurrentExecutions: MAX_CONCURRENT_EXECUTIONS_PER_USER * 5,
    priceId: STRIPE_PRICE_ID_PRO,
  },
};

export function getPlanLimits(plan: string | undefined | null): PlanLimits {
  return PLANS[plan as PlanId] ?? PLANS.free;
}
