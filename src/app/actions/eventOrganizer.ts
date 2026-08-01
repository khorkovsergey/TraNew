'use server';

import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, isDatabaseConfigured, schema } from '@/db';
import { recordAccess } from '@/lib/audit';
import { getEventById } from '@/lib/data/events';
import { attendeesFor } from '@/lib/data/organizerEvents';
import { canCancel, canExportRegistrations, canMessageAttendees } from '@/lib/events/access';
import { currentActor } from '@/lib/events/actor';
import { notifyAttendees } from '@/lib/events/notifications';
import { checkRate, RATE_LIMITS } from '@/lib/events/rateLimit';
import { cleanText, LIMITS, singleLineSafe } from '@/lib/events/sanitize';
import type { ActionResult } from './events';

/**
 * What an organizer can do to their own event.
 *
 * Every one of these re-checks the permission. The page already hid the button,
 * and that is not the same thing: these are exported functions reachable by a
 * POST from anywhere, so the check that counts is the one in here.
 */

const DENIED = {
  status: 'error' as const,
  message: 'You do not have permission to do that.',
};

export async function cancelEventAction(input: {
  eventId: string;
  reason: string;
}): Promise<ActionResult<{ notified: number }>> {
  const actor = await currentActor();
  if (!actor) return { status: 'sign_in_required' };
  if (!isDatabaseConfigured()) {
    return { status: 'unavailable', message: 'This needs a database, which is not connected here.' };
  }

  const event = await getEventById(input.eventId, new Date());
  if (!event) return { status: 'error', message: 'That event no longer exists.' };
  if (!canCancel(actor, event)) return DENIED;

  const reason = cleanText(input.reason, 500);
  if (reason.length < 10) {
    return { status: 'error', message: 'Give attendees a reason — at least a sentence.' };
  }

  const now = new Date();

  await db
    .update(schema.event)
    .set({ status: 'cancelled', cancellationReason: reason, updatedAt: now })
    .where(eq(schema.event.id, input.eventId));

  await db.insert(schema.eventModeration).values({
    id: randomUUID(),
    eventId: input.eventId,
    actorId: actor.id,
    action: 'cancelled',
    reason,
    createdAt: now,
  });

  const notified = await notifyAttendees(input.eventId, {
    kind: 'event_cancelled',
    eventId: event.id,
    eventTitle: event.title,
    eventSlug: event.slug,
    startsAt: event.startsAt,
    message: reason,
  });

  revalidatePath('/en/events/manage');
  revalidatePath(`/en/events/${event.slug}`);

  return { status: 'ok', data: { notified } };
}

export async function messageAttendeesAction(input: {
  eventId: string;
  message: string;
}): Promise<ActionResult<{ sent: number }>> {
  const actor = await currentActor();
  if (!actor) return { status: 'sign_in_required' };
  if (!isDatabaseConfigured()) {
    return { status: 'unavailable', message: 'This needs a database, which is not connected here.' };
  }

  const event = await getEventById(input.eventId, new Date());
  if (!event) return { status: 'error', message: 'That event no longer exists.' };
  if (!canMessageAttendees(actor, event)) return DENIED;

  const limited = await checkRate(
    `organizer-message:${actor.id}`,
    RATE_LIMITS.organizerMessage.limit,
    RATE_LIMITS.organizerMessage.windowMs
  );
  if (!limited.allowed) {
    return { status: 'error', message: 'You have sent several updates today. Try again tomorrow.' };
  }

  const message = cleanText(input.message, LIMITS.organizerMessage);
  if (message.length < 10) return { status: 'error', message: 'Write the update first.' };

  // Sent through the platform, so the organizer never receives the address list
  // as a side effect of contacting people.
  const sent = await notifyAttendees(input.eventId, {
    kind: 'organizer_update',
    eventId: event.id,
    eventTitle: event.title,
    eventSlug: event.slug,
    startsAt: event.startsAt,
    message,
  });

  return { status: 'ok', data: { sent } };
}

/**
 * The attendee export.
 *
 * Logged in the access record, because this is the one action that takes other
 * people's contact details out of the platform and the log is what makes that
 * answerable later.
 */
export async function exportAttendeesAction(input: {
  eventId: string;
}): Promise<ActionResult<{ csv: string }>> {
  const actor = await currentActor();
  if (!actor) return { status: 'sign_in_required' };

  const event = await getEventById(input.eventId, new Date());
  if (!event) return { status: 'error', message: 'That event no longer exists.' };
  if (!canExportRegistrations(actor, event)) return DENIED;

  const attendees = (await attendeesFor(actor, event)) ?? [];

  const header = ['Name', 'Email', 'Company', 'Role', 'Status', 'Registered'];
  const rows = attendees.map((attendee) => [
    attendee.name,
    attendee.email,
    attendee.company ?? '',
    attendee.role ?? '',
    attendee.status,
    attendee.registeredAt,
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');

  await recordAccess({
    userId: actor.id,
    action: 'export',
    resource: 'session',
    resourceId: event.id,
    actor: 'user',
    context: { kind: 'event_attendees', count: attendees.length },
  });

  return { status: 'ok', data: { csv } };
}

/**
 * Quotes every field and strips a leading =, +, - or @.
 *
 * A cell beginning with one of those is executed as a formula by Excel and
 * Sheets when the file is opened — a name field is a script delivery mechanism
 * unless something takes it away, and that something has to be here.
 */
function csvCell(value: string): string {
  const safe = singleLineSafe(value, 300).replace(/^[=+\-@\t\r]+/, '');
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * Following an organizer.
 *
 * A row rather than a counter increment, so unfollowing is possible and so the
 * "new event from an organizer you follow" notification has a list to send to.
 */
export async function toggleFollowAction(input: {
  organizerId: string;
}): Promise<ActionResult<{ following: boolean }>> {
  const actor = await currentActor();
  if (!actor) return { status: 'sign_in_required' };
  if (!isDatabaseConfigured()) {
    return { status: 'unavailable', message: 'Following needs a database, which is not connected here.' };
  }

  const [existing] = await db
    .select()
    .from(schema.organizerFollow)
    .where(
      and(
        eq(schema.organizerFollow.organizerId, input.organizerId),
        eq(schema.organizerFollow.userId, actor.id)
      )
    )
    .limit(1);

  if (existing) {
    await db.delete(schema.organizerFollow).where(eq(schema.organizerFollow.id, existing.id));
    return { status: 'ok', data: { following: false } };
  }

  await db.insert(schema.organizerFollow).values({
    id: randomUUID(),
    organizerId: input.organizerId,
    userId: actor.id,
    createdAt: new Date(),
  });

  return { status: 'ok', data: { following: true } };
}
