import mongoose from 'mongoose';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * Parses `?cursor=<objectId>&limit=<n>` off a request's query string into a
 * safe { cursor, limit } pair — an invalid/missing cursor is treated as "from
 * the start" rather than an error, and limit is clamped so a client can't
 * request an unbounded page.
 */
export function parsePageParams(query: any, defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT) {
  const parsedLimit = parseInt(query?.limit, 10);
  const limit = Math.min(maxLimit, Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : defaultLimit));
  const cursor = typeof query?.cursor === 'string' && mongoose.isValidObjectId(query.cursor)
    ? new mongoose.Types.ObjectId(query.cursor)
    : undefined;
  return { limit, cursor };
}

/**
 * Turns a `limit + 1`-sized fetch (sorted descending by _id) into a page: the
 * extra document is used only to detect "is there more" without a separate
 * count query, then dropped. `_id` doubles as the cursor since it's already
 * monotonically increasing with insertion order — no separate compound
 * (createdAt, _id) cursor needed.
 */
export function toPage<T extends { _id: any }>(docsPlusOne: T[], limit: number): { items: T[]; nextCursor: string | null } {
  const hasMore = docsPlusOne.length > limit;
  const items = hasMore ? docsPlusOne.slice(0, limit) : docsPlusOne;
  const nextCursor = hasMore ? items[items.length - 1]._id.toString() : null;
  return { items, nextCursor };
}
