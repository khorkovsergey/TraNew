import 'server-only';
import { gte, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { MARKETPLACE_MIN_SAMPLE } from '../dictionary';
import {
  distribution,
  durableAt,
  durableCount,
  durableRate,
  newest,
  pick,
  type FamilyFacts,
} from './durable';
import { attendanceDenominator } from './semantics';

/**
 * Events, from the tables.
 *
 * `event_registration` is the business fact: a row is a seat. The Events
 * section's telemetry — `event_registration_started`, `event_registration_completed`
 * — is behavioural evidence that a UI reported a flow, and the two are never
 * added. One is how many registrations exist; the other is how many times a
 * form said it had worked.
 *
 * ## Reconciliation rather than a preference
 *
 * `event_metric` is a per-event daily counter the Events section maintains,
 * including a `registration` metric of its own. That gives two independent
 * numbers for the same concept, and the temptation is to quietly publish
 * whichever looks better. Instead both are reported with the difference between
 * them: a gap is a data-health finding about the organiser counters, not
 * something for a metric to smooth over.
 *
 * ## What is never selected
 *
 * `event_registration` holds `name`, `email`, `company`, `role` and
 * `experienceLevel` — attendee identity, one column away from the status we
 * want. Nothing here selects a row; every query is an aggregate over named
 * columns, and a test asserts the file contains no `select *`.
 */
export async function eventsFacts(since: Date): Promise<FamilyFacts> {
  const generatedAt = new Date().toISOString();
  const at = durableAt('event_registration', generatedAt);

  const statusRows = await db
    .select({ key: schema.eventRegistration.status, count: sql<number>`count(*)::int` })
    .from(schema.eventRegistration)
    .groupBy(schema.eventRegistration.status);

  const [totals] = await db
    .select({
      registrations: sql<number>`count(*)::int`,
      people: sql<number>`count(distinct ${schema.eventRegistration.userId})::int`,
      events: sql<number>`count(distinct ${schema.eventRegistration.eventId})::int`,
      newest: sql<Date | null>`max(${schema.eventRegistration.createdAt})`,
    })
    .from(schema.eventRegistration);

  const [inWindow] = await db
    .select({ created: sql<number>`count(*)::int` })
    .from(schema.eventRegistration)
    .where(gte(schema.eventRegistration.createdAt, since));

  const [supply] = await db
    .select({
      published: sql<number>`count(*) filter (where ${schema.event.status} = 'published')::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(schema.event);

  /* The organiser counter, for reconciliation only. */
  const [counters] = await db
    .select({ registrations: sql<number>`coalesce(sum(${schema.eventMetric.count}), 0)::int` })
    .from(schema.eventMetric)
    .where(sql`${schema.eventMetric.metric} = 'registration'`);

  const status = distribution(statusRows);
  const registered = pick(status, 'registered');
  const waitlisted = pick(status, 'waitlisted');
  const cancelled = pick(status, 'cancelled');
  const attended = pick(status, 'attended');
  const noShow = pick(status, 'no_show');

  const durableTotal = totals?.registrations ?? 0;
  const counterTotal = counters?.registrations ?? 0;

  return {
    family: 'events',
    sources: ['event_registration', 'event', 'event_metric'],
    generatedAt,
    freshestAt: newest(totals?.newest),
    metrics: {
      registrations: durableCount(durableTotal, at, 'events_registrations'),
      registered: durableCount(registered, at, 'events_registered'),
      waitlisted: durableCount(waitlisted, at, 'events_waitlisted'),
      cancelled: durableCount(cancelled, at, 'events_cancelled'),
      attended: durableCount(attended, at, 'events_attended'),
      noShow: durableCount(noShow, at, 'events_no_show'),
      peopleRegistered: durableCount(totals?.people ?? 0, at, 'events_people'),
      eventsWithRegistrations: durableCount(totals?.events ?? 0, at, 'events_with_registrations'),
      registrationsInWindow: durableCount(inWindow?.created ?? 0, at, 'events_registrations_window'),
      publishedEvents: durableCount(supply?.published ?? 0, durableAt('event', generatedAt), 'events_published'),
      totalEvents: durableCount(supply?.total ?? 0, durableAt('event', generatedAt), 'events_total'),

      /*
       * Attendance is only meaningful once somebody has marked it. Divided by
       * registrations rather than by attendance-marked events, because the
       * denominator that matters is seats taken — and thresholded, because a
       * ratio over a handful of rows is not an attendance rate.
       */
      attendanceRate: durableRate(
        attended,
        attendanceDenominator(Object.fromEntries(status.map((row) => [row.key, row.count]))),
        at,
        'events_attendance_rate',
        MARKETPLACE_MIN_SAMPLE
      ),

      /*
       * Not a metric so much as a data-health check. Non-zero means the
       * organiser counters and the registration rows disagree, which is worth
       * knowing and is not a thing to average away.
       */
      counterDiscrepancy: durableCount(
        counterTotal - durableTotal,
        durableAt('event_metric', generatedAt),
        'events_counter_discrepancy'
      ),
    },
    distributions: { status },
    limitations: [
      'A durable registration and a `event_registration_completed` event are different evidence about the same flow. They are never added: one is a seat, the other is a form reporting success.',
      '`event_metric` is the organiser-facing daily counter and is read only to reconcile against the rows. Where the two disagree the difference is shown rather than resolved.',
      'Attendance and no-show only exist where an organiser has marked them, so the attendance rate describes the events that were marked, not all events.',
      'No attendee field is read. Name, email, company, role and experience level are in this table and are never selected.',
    ],
  };
}
