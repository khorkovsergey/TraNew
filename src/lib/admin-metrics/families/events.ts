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
import { delta } from '@/lib/analytics/states';
import {
  attendanceResolvedSeats,
  attendanceUnresolvedSeats,
  heldSeats,
} from './semantics';

/**
 * Events, from the tables.
 *
 * `event_registration` is the business fact: a row is a seat. The Events
 * section's telemetry — `event_registration_started`, `event_registration_completed`
 * — is behavioural evidence that a UI reported a flow, and the two are never
 * added. One is how many registrations exist; the other is how many times a
 * form said it had worked.
 *
 * ## What is reconciled, and what turned out not to be comparable
 *
 * `event_metric` looked like a second opinion on registrations and is not one.
 * Reading the writer settled it: **only `external_click` is ever written to
 * that table.** There is no `registration` metric in it, so an earlier
 * "discrepancy" was a subtraction from zero — it reported minus every
 * registration in the product and called it a data-health finding. Two numbers
 * sharing the word "registration" is not evidence that they measure the same
 * thing, and this one did not exist.
 *
 * What *is* comparable is `event.registration_count`, the denormalised counter
 * the Events section maintains in step with the rows: +1 on registration, −1 on
 * cancellation, +1 on promotion from the waitlist. That tracks seats currently
 * held, which is exactly the population of rows in `registered`, `attended` and
 * `no_show`. Their difference is published as a signed delta carrying the
 * number of seats compared, because a gap of −5 across six seats and one across
 * six thousand are different findings.
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

  /*
   * The event's own denormalised seat counter, which IS comparable — see the
   * header. Summed across events and checked against the rows.
   */
  const [counters] = await db
    .select({ heldSeats: sql<number>`coalesce(sum(${schema.event.registrationCount}), 0)::int` })
    .from(schema.event);

  const status = distribution(statusRows);
  const registered = pick(status, 'registered');
  const waitlisted = pick(status, 'waitlisted');
  const cancelled = pick(status, 'cancelled');
  const attended = pick(status, 'attended');
  const noShow = pick(status, 'no_show');

  const durableTotal = totals?.registrations ?? 0;
  const counts = Object.fromEntries(status.map((row) => [row.key, row.count]));
  const resolved = attendanceResolvedSeats(counts);
  const unresolved = attendanceUnresolvedSeats(counts);
  const held = heldSeats(counts);
  const counterSeats = counters?.heldSeats ?? 0;

  return {
    family: 'events',
    sources: ['event_registration', 'event'],
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
       * Attendance among seats whose outcome is actually known.
       *
       * `registered` is not in the denominator. It means "holds a seat", which
       * covers a talk next month as much as one last week nobody has marked up
       * — and including it made every future event drag the rate down before
       * attendance was knowable, so the number would rise as organisers did
       * their paperwork rather than as more people turned up.
       */
      attendanceRate: durableRate(attended, resolved, at, 'events_attendance_rate', MARKETPLACE_MIN_SAMPLE),

      /* The two numbers that stop the rate being over-read. */
      attendanceMarkedSeats: durableCount(resolved, at, 'events_attendance_marked'),
      attendanceUnresolvedSeats: durableCount(unresolved, at, 'events_attendance_unresolved'),

      /*
       * How much of the pipeline has been marked at all. A 100% attendance rate
       * over 3% coverage is a different claim from one over 90%, and neither
       * number says so alone.
       */
      attendanceMarkingCoverage: durableRate(
        resolved,
        held,
        at,
        'events_attendance_coverage',
        MARKETPLACE_MIN_SAMPLE
      ),

      /*
       * A data-health check against the event's own seat counter, which is
       * maintained in step with the rows: +1 on registration, -1 on
       * cancellation, +1 on promotion from the waitlist. A signed delta, so it
       * carries its comparable population as evidence rather than pretending
       * the difference is a count of something.
       */
      seatCounterDelta: delta(
        counterSeats - held,
        held,
        {
          metricId: 'events_seat_counter_delta',
          source: 'event.registration_count vs event_registration',
          sourceType: 'derived',
          queriedAt: generatedAt,
        }
      ),
    },
    distributions: { status },
    limitations: [
      'A durable registration and a `event_registration_completed` event are different evidence about the same flow. They are never added: one is a seat, the other is a form reporting success.',
      'The attendance rate is over seats whose outcome is known — attended plus no-show. A `registered` seat may be a future event or an unmarked past one, and putting it in the denominator would report attendance as falling whenever more events were scheduled.',
      'Marking coverage is published beside the rate. A high attendance rate over a low coverage is a claim about the events somebody marked up, not about the product.',
      'The seat-counter delta compares `event.registration_count` against seat-holding rows. It is a signed difference and its evidence is the number of seats compared, not the difference itself.',
      '`event_metric` is NOT reconciled against anything. Only `external_click` is ever written to it — there is no `registration` metric in that table, so a comparison would have been a subtraction from zero dressed up as a discrepancy.',
      'No attendee field is read. Name, email, company, role and experience level are in this table and are never selected.',
    ],
  };
}
