import 'server-only';

/**
 * Rate limiting.
 *
 * In-process and per-instance, which is honest about what it is: enough to stop
 * a script hammering event creation or reports from one browser, not enough to
 * coordinate across replicas. When a shared store exists, `checkRate` is the one
 * function to reimplement.
 *
 * Kept out of the actions themselves so the limits are visible in one list
 * rather than scattered as magic numbers through mutation code.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Anything older than the longest window is dead weight. */
const SWEEP_AFTER = 60 * 60_000;
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_AFTER) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}

export type RateResult = { allowed: boolean; remaining: number; resetAt: number };

export async function checkRate(key: string, limit: number, windowMs: number): Promise<RateResult> {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    const fresh = { count: 1, resetAt: now + windowMs };
    buckets.set(key, fresh);
    return { allowed: true, remaining: limit - 1, resetAt: fresh.resetAt };
  }

  bucket.count += 1;

  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}

/** The limits, in one place, so they can be argued about without a code search. */
export const RATE_LIMITS = {
  /** Creating events: enough for a busy organizer, not enough for a script. */
  eventCreate: { limit: 10, windowMs: 24 * 60 * 60_000 },
  eventSubmit: { limit: 20, windowMs: 24 * 60 * 60_000 },
  registration: { limit: 20, windowMs: 60_000 },
  report: { limit: 5, windowMs: 60 * 60_000 },
  organizerMessage: { limit: 5, windowMs: 24 * 60 * 60_000 },
  externalUrlSubmit: { limit: 20, windowMs: 60 * 60_000 },
} as const;
