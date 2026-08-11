import 'server-only';
import { gte, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { durableAt, durableCount, newest, type FamilyFacts } from './durable';

/**
 * Account growth, from `user`.
 *
 * Three columns are read — `createdAt`, `emailVerified` and `id` for counting —
 * out of a table that also holds names, emails, images, two-factor state and
 * the encrypted data key. Nothing else is selected.
 *
 * No registration is attributed to a feature. The telemetry that could support
 * that claim — a value action followed by a sign-up inside an agreed window —
 * needs the two to be linked across the moment identity changes, and that link
 * is only reliable where the session survived the transition. It is a Phase 4
 * question, and inventing an attribution here would be the kind of number that
 * gets quoted for a year.
 */
export async function accountFacts(since: Date): Promise<FamilyFacts> {
  const generatedAt = new Date().toISOString();
  const at = durableAt('user', generatedAt);

  const [totals] = await db
    .select({
      users: sql<number>`count(*)::int`,
      verified: sql<number>`count(*) filter (where ${schema.user.emailVerified})::int`,
      newest: sql<Date | null>`max(${schema.user.createdAt})`,
    })
    .from(schema.user);

  const [inWindow] = await db
    .select({ users: sql<number>`count(*)::int` })
    .from(schema.user)
    .where(gte(schema.user.createdAt, since));

  /*
   * A daily trend, bounded by the window the caller already validated. Dates
   * only — a per-day count of registrations names nobody.
   */
  const trend = await db
    .select({
      day: sql<string>`to_char(${schema.user.createdAt}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.user)
    .where(gte(schema.user.createdAt, since))
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  return {
    family: 'accounts',
    sources: ['user'],
    generatedAt,
    freshestAt: newest(totals?.newest),
    metrics: {
      registeredUsers: durableCount(totals?.users ?? 0, at, 'accounts_registered_users'),
      verifiedUsers: durableCount(totals?.verified ?? 0, at, 'accounts_verified_users'),
      newRegistrations: durableCount(inWindow?.users ?? 0, at, 'accounts_new_registrations'),
    },
    distributions: {
      registrationsPerDay: trend.map((row) => ({ key: row.day, count: row.count })),
    },
    limitations: [
      'Counts only. Name, email, image, two-factor state and the encrypted data key are in this table and are never selected.',
      'No registration is attributed to a feature. That needs a reliable link across the moment identity changes, and inventing one here would produce a number that gets quoted for a year.',
      'Registered users is a lifetime total; new registrations respects the selected window.',
    ],
  };
}
