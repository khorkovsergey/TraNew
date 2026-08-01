import 'server-only';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db, isDatabaseConfigured, schema } from '@/db';
import { canViewRegistrations } from '@/lib/events/access';
import type { Actor } from '@/lib/events/access';
import type { EventAnalyticsSummary, EventStatus } from '@/lib/events/types';

/**
 * The organizer's own view of their events.
 *
 * Separate from the catalogue reader because it answers a different question and
 * has a different rule: the catalogue shows what is published, this shows what
 * belongs to one person including everything that is not published. Mixing the
 * two would mean one query with a status filter that is easy to get wrong in the
 * direction of showing drafts to strangers.
 */

export type OrganizerEvent = {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  status: EventStatus;
  capacity: number | null;
  registrationCount: number;
  waitlistCount: number;
  moderationReason: string | null;
};

export async function organizerEvents(actor: Actor): Promise<OrganizerEvent[]> {
  if (!isDatabaseConfigured()) return [];

  try {
    const rows = await db
      .select()
      .from(schema.event)
      .where(
        actor.organizerIds.length
          ? inArray(schema.event.organizerId, actor.organizerIds)
          : eq(schema.event.createdBy, actor.id)
      )
      .orderBy(desc(schema.event.startsAt));

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      startsAt: row.startsAt.toISOString(),
      status: row.status as EventStatus,
      capacity: row.capacity,
      registrationCount: row.registrationCount,
      waitlistCount: row.waitlistCount,
      moderationReason: row.moderationReason,
    }));
  } catch {
    return [];
  }
}

export type Attendee = {
  name: string;
  email: string;
  company: string | null;
  role: string | null;
  status: string;
  registeredAt: string;
};

/**
 * The attendee list. Guarded here rather than only in the page, because this
 * function is other people's names and email addresses and there is no version
 * of "the caller probably checked" that is good enough for that.
 */
export async function attendeesFor(
  actor: Actor | null,
  event: { id: string; createdBy: string | null; organizerId: string }
): Promise<Attendee[] | null> {
  if (!canViewRegistrations(actor, event)) return null;
  if (!isDatabaseConfigured()) return [];

  const rows = await db
    .select()
    .from(schema.eventRegistration)
    .where(
      and(
        eq(schema.eventRegistration.eventId, event.id),
        inArray(schema.eventRegistration.status, ['registered', 'waitlisted', 'attended'])
      )
    )
    .orderBy(desc(schema.eventRegistration.createdAt));

  return rows.map((row) => ({
    name: row.name,
    email: row.email,
    company: row.company,
    role: row.role,
    status: row.status,
    registeredAt: row.createdAt.toISOString(),
  }));
}

export async function analyticsFor(eventId: string): Promise<EventAnalyticsSummary> {
  const empty: EventAnalyticsSummary = {
    eventId,
    pageViews: 0,
    cardViews: 0,
    registrations: 0,
    cancellations: 0,
    saves: 0,
    externalClicks: 0,
    conversion: 0,
  };

  if (!isDatabaseConfigured()) return empty;

  try {
    const rows = await db
      .select()
      .from(schema.eventMetric)
      .where(eq(schema.eventMetric.eventId, eventId));

    const total = (metric: string) =>
      rows.filter((row) => row.metric === metric).reduce((sum, row) => sum + row.count, 0);

    const pageViews = total('page_view');
    const registrations = total('registration');

    return {
      eventId,
      pageViews,
      cardViews: total('card_view'),
      registrations,
      cancellations: total('cancellation'),
      saves: total('save'),
      externalClicks: total('external_click'),
      conversion: pageViews ? Math.round((registrations / pageViews) * 1000) / 10 : 0,
    };
  } catch {
    return empty;
  }
}
