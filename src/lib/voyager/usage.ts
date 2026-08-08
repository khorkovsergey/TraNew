import 'server-only';
import { createHmac, randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requestFingerprint } from '@/lib/session';

/**
 * Daily question counting.
 *
 * Anonymous visitors are identified by an HMAC of their IP address rather than the
 * address itself: the limit only needs "same visitor as earlier today", and a
 * hashed value cannot be read back into a location. The key is the app secret, so
 * rotating it resets every anonymous counter — an acceptable trade for not keeping
 * a table of who visited from where.
 */

async function subjectKey(userId: string | null): Promise<string> {
  if (userId) return `user:${userId}`;

  const { ipAddress } = await requestFingerprint();
  const secret = process.env.BETTER_AUTH_SECRET ?? 'insecure-development-secret';
  const digest = createHmac('sha256', secret)
    .update(`voyager:${ipAddress ?? 'unknown'}`)
    .digest('base64url');

  return `anon:${digest.slice(0, 32)}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export type UsageVerdict = {
  /** Questions left today, or null when the plan is not metered. */
  remaining: number | null;
  /** True once the person is past the limit — an upgrade card, not a wall. */
  quotaReached: boolean;
  /** Questions spent today. The counter the composer shows before anyone asks. */
  used: number;
  /** The ceiling this verdict was measured against, or null when unmetered. */
  total: number | null;
};

/**
 * Records one question and reports what is left. Counting happens before the model
 * runs, so a slow or failing answer cannot be retried for free in a loop.
 *
 * The quota arrives as a number rather than a tier: how often somebody may ask
 * is a fact about what they pay, and the caller is the only place that knows
 * both the session and the plan.
 */
export async function consumeQuestion(
  userId: string | null,
  quota: number | null
): Promise<UsageVerdict> {
  const subject = await subjectKey(userId);
  const day = today();

  const [row] = await db
    .insert(schema.voyagerUsage)
    .values({ id: randomUUID(), subject, day, count: 1 })
    .onConflictDoUpdate({
      target: [schema.voyagerUsage.subject, schema.voyagerUsage.day],
      set: {
        count: sql`${schema.voyagerUsage.count} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ count: schema.voyagerUsage.count });

  const used = row?.count ?? 1;
  if (quota === null) return { remaining: null, quotaReached: false, used, total: null };

  return {
    remaining: Math.max(0, quota - used),
    quotaReached: used > quota,
    used,
    total: quota,
  };
}

/** Reads the counter without spending a question — for rendering the limit line. */
export async function peekUsage(
  userId: string | null,
  quota: number | null
): Promise<UsageVerdict> {
  if (quota === null) {
    return { remaining: null, quotaReached: false, used: 0, total: null };
  }

  const subject = await subjectKey(userId);
  const [row] = await db
    .select({ count: schema.voyagerUsage.count })
    .from(schema.voyagerUsage)
    .where(
      and(eq(schema.voyagerUsage.subject, subject), eq(schema.voyagerUsage.day, today()))
    )
    .limit(1);

  const used = row?.count ?? 0;
  return {
    remaining: Math.max(0, quota - used),
    quotaReached: used >= quota,
    used,
    total: quota,
  };
}
