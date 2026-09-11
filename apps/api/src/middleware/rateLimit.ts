import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { NODE_ENV } from '../config/env';
import type { AuthRequest } from './auth.middleware';

// Baseline abuse guard for the whole API, layered on top of (not instead
// of) auth.routes.ts's much stricter login/register limiter and the
// per-user resource quotas in quota.service.ts. Generous enough that a real
// UI session — a handful of requests per click — never comes close; stops
// naive scanning/flooding from a single source. Keyed by IP (express-rate-
// limit's default) since most of these routes have no user context yet.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => NODE_ENV === 'test',
  message: { error: 'Too many requests, please slow down.' },
});

// Tighter, per-*user* limit (not per-IP) for endpoints that trigger real
// work downstream — queueing a pipeline execution, or a Stripe API call for
// checkout/portal session creation. Keyed by the authenticated user id so
// one user's burst doesn't throttle everyone behind the same office/NAT IP;
// falls back to IP for the rare case this runs before requireAuth resolves
// req.user (it never currently does, but this is defensive, not load-bearing).
export const actionLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => NODE_ENV === 'test',
  keyGenerator: (req) => (req as AuthRequest).user?.id || ipKeyGenerator(req.ip || 'unknown'),
  message: { error: 'Too many requests, please slow down and try again shortly.' },
});
