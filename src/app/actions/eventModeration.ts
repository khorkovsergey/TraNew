'use server';

import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, isDatabaseConfigured, schema } from '@/db';
import { getEventById } from '@/lib/data/events';
import { canModerate, canTransition } from '@/lib/events/access';
import { currentActor } from '@/lib/events/actor';
import { notifyAttendees } from '@/lib/events/notifications';
import { cleanText } from '@/lib/events/sanitize';
import type { EventModerationRecord, EventStatus, ModerationAction } from '@/lib/events/types';
import type { ActionResult } from './events';

/**
 * Moderation.
 *
 * Two rules hold this together. The transition has to be legal — `canTransition`
 * is the state machine, so a rejected event cannot be quietly flipped to
 * published without passing back through review. And every decision writes a row
 * to an append-only history: nothing here updates or deletes one, because the
 * only question anyone will ever ask of a moderation log is "what happened, and
 * who did it", and a log that can be edited cannot answer it.
 */

const DENIED = {
  status: 'error' as const,
  message: 'You do not have permission to moderate events.',
};

async function decide(
  eventId: string,
  to: EventStatus,
  action: ModerationAction,
  rawReason: string | undefined,
  requireReason: boolean
): Promise<ActionResult<{ status: EventStatus }>> {
  const actor = await currentActor();
  if (!actor) return { status: 'sign_in_required' };
  if (!canModerate(actor)) return DENIED;
  if (!isDatabaseConfigured()) {
    return { status: 'unavailable', message: 'Moderation needs a database, which is not connected here.' };
  }

  const event = await getEventById(eventId, new Date());
  if (!event) return { status: 'error', message: 'That event no longer exists.' };

  if (!canTransition(event.status, to)) {
    return {
      status: 'error',
      message: `An event that is ${event.status.replace('_', ' ')} cannot be moved to ${to.replace('_', ' ')}.`,
    };
  }

  const reason = cleanText(rawReason ?? '', 800);
  if (requireReason && reason.length < 10) {
    return {
      status: 'error',
      message: 'Say why. The organizer sees this, and a decision with no reason gets resubmitted unchanged.',
    };
  }

  const now = new Date();

  await db
    .update(schema.event)
    .set({
      status: to,
      moderationReason: reason || null,
      publishedAt: to === 'published' ? now : undefined,
      updatedAt: now,
    })
    .where(eq(schema.event.id, eventId));

  await db.insert(schema.eventModeration).values({
    id: randomUUID(),
    eventId,
    actorId: actor.id,
    action,
    reason: reason || null,
    createdAt: now,
  });

  if (to === 'suspended' || to === 'cancelled') {
    await notifyAttendees(eventId, {
      kind: 'event_cancelled',
      eventId: event.id,
      eventTitle: event.title,
      eventSlug: event.slug,
      startsAt: event.startsAt,
      message: reason,
    });
  }

  revalidatePath('/en/events');
  revalidatePath(`/en/events/${event.slug}`);
  revalidatePath('/en/events/manage');

  return { status: 'ok', data: { status: to } };
}

export async function approveEventAction(input: { eventId: string }) {
  return decide(input.eventId, 'published', 'approved', undefined, false);
}

export async function rejectEventAction(input: { eventId: string; reason: string }) {
  return decide(input.eventId, 'rejected', 'rejected', input.reason, true);
}

export async function requestChangesAction(input: { eventId: string; reason: string }) {
  return decide(input.eventId, 'changes_requested', 'changes_requested', input.reason, true);
}

export async function suspendEventAction(input: { eventId: string; reason: string }) {
  return decide(input.eventId, 'suspended', 'suspended', input.reason, true);
}

export async function restoreEventAction(input: { eventId: string }) {
  return decide(input.eventId, 'published', 'restored', undefined, false);
}

/** The queue. Ordered oldest first, because the oldest submission is waiting longest. */
export async function pendingEventsAction() {
  const actor = await currentActor();
  if (!canModerate(actor) || !isDatabaseConfigured()) return [];

  const rows = await db
    .select()
    .from(schema.event)
    .where(eq(schema.event.status, 'pending_review'))
    .orderBy(schema.event.createdAt);

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortDescription: row.shortDescription,
    startsAt: row.startsAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function moderationHistoryAction(
  eventId: string
): Promise<EventModerationRecord[]> {
  const actor = await currentActor();
  if (!canModerate(actor) || !isDatabaseConfigured()) return [];

  const rows = await db
    .select()
    .from(schema.eventModeration)
    .where(eq(schema.eventModeration.eventId, eventId))
    .orderBy(desc(schema.eventModeration.createdAt));

  return rows.map((row) => ({
    id: row.id,
    eventId: row.eventId,
    actorId: row.actorId,
    action: row.action as ModerationAction,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function openReportsAction() {
  const actor = await currentActor();
  if (!canModerate(actor) || !isDatabaseConfigured()) return [];

  const rows = await db
    .select()
    .from(schema.eventReport)
    .where(eq(schema.eventReport.resolved, false))
    .orderBy(desc(schema.eventReport.createdAt));

  return rows.map((row) => ({
    id: row.id,
    eventId: row.eventId,
    reason: row.reason,
    detail: row.detail,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function resolveReportAction(input: { reportId: string }): Promise<ActionResult<void>> {
  const actor = await currentActor();
  if (!actor) return { status: 'sign_in_required' };
  if (!canModerate(actor)) return DENIED;
  if (!isDatabaseConfigured()) {
    return { status: 'unavailable', message: 'Moderation needs a database, which is not connected here.' };
  }

  await db
    .update(schema.eventReport)
    .set({ resolved: true })
    .where(eq(schema.eventReport.id, input.reportId));

  return { status: 'ok', data: undefined };
}
