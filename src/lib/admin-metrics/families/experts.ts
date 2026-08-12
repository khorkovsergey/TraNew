import 'server-only';
import { and, gte, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { ownedByCustomer } from '../internalTraffic';
import { distribution, durableAt, durableCount, newest, pick, type FamilyFacts } from './durable';
import { openPipeline } from './semantics';

/**
 * Expert services, from `expert_booking`.
 *
 * ## Customer bookings only
 *
 * A booking owned by an `admin` or `moderator` account is a walkthrough of the
 * intake flow, not consultation demand, and it would otherwise land in the
 * pipeline, in the mean rating and in bookings-with-purchase. The Experts
 * catalogue is untouched: it lives in `src/content/experts.ts` and is inventory
 * — how many experts are offered says nothing about who booked one.
 *
 * ## A pipeline, not a conversion funnel
 *
 * `status` is overwritten as a booking moves, so the distribution is **the
 * current state of the pipeline** and nothing else. `draft → confirmed →
 * completed` looks like a funnel and is not one: there is no transition
 * history, so a booking that went all the way appears only in `completed`, and
 * dividing `completed` by `draft` would compare today's finished bookings
 * against today's unstarted ones. That number would move when somebody opens a
 * new draft, which is the opposite of what a conversion rate should do.
 *
 * So no rate is published here. The counts are stated, the pipeline is called a
 * pipeline, and the conversion question is answered honestly as not measurable
 * until transition history exists.
 *
 * ## What is never read
 *
 * `briefEnc` is what somebody is trying to do with their money. `summaryEnc` is
 * what an expert concluded about it. `sharedContext` is the list of financial
 * blocks they agreed to hand over. None of the three is selected, and none is
 * grouped by.
 */

export async function expertsFacts(since: Date): Promise<FamilyFacts> {
  const generatedAt = new Date().toISOString();
  const at = durableAt('expert_booking', generatedAt);

  const customerBooking = ownedByCustomer(schema.expertBooking.userId);

  const statusRows = await db
    .select({ key: schema.expertBooking.status, count: sql<number>`count(*)::int` })
    .from(schema.expertBooking)
    .where(customerBooking)
    .groupBy(schema.expertBooking.status);

  const [totals] = await db
    .select({
      bookings: sql<number>`count(*)::int`,
      people: sql<number>`count(distinct ${schema.expertBooking.userId})::int`,
      rated: sql<number>`count(${schema.expertBooking.rating})::int`,
      /* An average of a 1–5 rating is a product fact and identifies nobody. */
      meanRating: sql<number | null>`avg(${schema.expertBooking.rating})`,
      /* The link to a purchase, which is what makes money real. */
      withPurchase: sql<number>`count(${schema.expertBooking.purchaseId})::int`,
      newest: sql<Date | null>`max(${schema.expertBooking.updatedAt})`,
    })
    .from(schema.expertBooking)
    .where(customerBooking);

  const [inWindow] = await db
    .select({ created: sql<number>`count(*)::int` })
    .from(schema.expertBooking)
    .where(and(customerBooking, gte(schema.expertBooking.createdAt, since)));

  const status = distribution(statusRows);
  const open = openPipeline(Object.fromEntries(status.map((row) => [row.key, row.count])));

  return {
    family: 'experts',
    sources: ['expert_booking'],
    generatedAt,
    freshestAt: newest(totals?.newest),
    metrics: {
      bookings: durableCount(totals?.bookings ?? 0, at, 'experts_bookings'),
      peopleWithBooking: durableCount(totals?.people ?? 0, at, 'experts_people'),
      bookingsInWindow: durableCount(inWindow?.created ?? 0, at, 'experts_bookings_window'),
      openPipeline: durableCount(open, at, 'experts_open_pipeline'),
      confirmed: durableCount(pick(status, 'confirmed'), at, 'experts_confirmed'),
      completed: durableCount(pick(status, 'completed'), at, 'experts_completed'),
      cancelled: durableCount(pick(status, 'cancelled'), at, 'experts_cancelled'),
      refunded: durableCount(pick(status, 'refunded'), at, 'experts_refunded'),
      noShow: durableCount(pick(status, 'no_show'), at, 'experts_no_show'),
      disputed: durableCount(pick(status, 'disputed'), at, 'experts_disputed'),
      ratedBookings: durableCount(totals?.rated ?? 0, at, 'experts_rated'),
      meanRating: durableCount(Number((totals?.meanRating ?? 0).toFixed?.(2) ?? 0), at, 'experts_mean_rating'),
      bookingsWithPurchase: durableCount(totals?.withPurchase ?? 0, at, 'experts_with_purchase'),
    },
    distributions: { status },
    limitations: [
      'Customer bookings only. Rows owned by an `admin` or `moderator` account are excluded from the pipeline, the counts, the ratings and bookings-with-purchase. The Experts catalogue is inventory and is not read here at all.',
      'Status is overwritten in place, so this is the current pipeline and not a conversion funnel. A booking that completed appears only under `completed`.',
      'No conversion rate is published. Dividing completed by draft would compare finished bookings against unstarted ones and would move when somebody opens a new draft.',
      'A booking existing is not money. Only a linked `purchase` row can be that, and even then see the commerce family for why a paid row is not confirmed revenue.',
      'The brief, the summary and the shared financial context are encrypted and are never selected.',
    ],
  };
}
