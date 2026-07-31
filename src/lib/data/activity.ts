import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';

/**
 * The activity feed — what the person did, in their own words.
 *
 * Kept separate from `dataAccessLog` on purpose. That log answers "who touched
 * financial data" and is written to be read line by line during a dispute or an
 * audit; folding "viewed a chart" into it would bury the entries that matter. Two
 * logs with two jobs is the right shape, even though it looks like duplication.
 */

export type ActivityType =
  | 'viewed'
  | 'saved'
  | 'asked'
  | 'learned'
  | 'alert'
  | 'booking'
  | 'purchase'
  | 'wealth';

export type ActivityEntry = {
  id: string;
  type: ActivityType;
  title: string;
  kind: string | null;
  ref: string | null;
  createdAt: Date;
};

/**
 * Never throws. A feed entry failing to write must not fail the action it
 * describes — losing one line of history is better than losing the saved item.
 */
export async function recordActivity(options: {
  userId: string;
  type: ActivityType;
  title: string;
  kind?: string;
  ref?: string;
}): Promise<void> {
  try {
    await db.insert(schema.activity).values({
      id: randomUUID(),
      userId: options.userId,
      type: options.type,
      title: options.title,
      kind: options.kind ?? null,
      ref: options.ref ?? null,
    });
  } catch (error) {
    console.error('[activity] failed to record', error);
  }
}

export async function listActivity(
  userId: string,
  type?: ActivityType,
  limit = 100
): Promise<ActivityEntry[]> {
  const rows = await db
    .select()
    .from(schema.activity)
    .where(
      type
        ? and(eq(schema.activity.userId, userId), eq(schema.activity.type, type))
        : eq(schema.activity.userId, userId)
    )
    .orderBy(desc(schema.activity.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    type: row.type as ActivityType,
    title: row.title,
    kind: row.kind,
    ref: row.ref,
    createdAt: row.createdAt,
  }));
}
