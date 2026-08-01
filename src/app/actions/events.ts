'use server';

import { randomUUID } from 'node:crypto';
import { and, asc, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, isDatabaseConfigured, schema } from '@/db';
import { recordActivity } from '@/lib/data/activity';
import { getEventById, registrationFor } from '@/lib/data/events';
import { ctaFor } from '@/lib/events/cta';
import { notify } from '@/lib/events/notifications';
import { checkRate } from '@/lib/events/rateLimit';
import { cleanLine, LIMITS } from '@/lib/events/sanitize';
import type { EventReportReason, ExperienceLevel } from '@/lib/events/types';
import { getSession } from '@/lib/session';

/**
 * Everything that changes an event's state from the browser.
 *
 * The shape follows the rest of the repository: server actions rather than REST
 * handlers, session read on the server, and the client passing what to do, never
 * who is doing it.
 *
 * The rules that matter are enforced here rather than in the components that call
 * them. A registration that only checks capacity in the button's `disabled`
 * attribute is a registration that oversells the room.
 */

/**
 * Every action answers in the same four shapes, so a caller handles the same set
 * each time. `sign_in_required` is a status rather than a redirect because these
 * are pressed from inside a page that should stay where it is and open the login
 * dialogue in place.
 */
export type ActionResult<T = void> =
  | { status: 'ok'; data: T }
  | { status: 'sign_in_required' }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string };

const NO_DB = {
  status: 'unavailable' as const,
  message: 'This needs an account database, which is not connected here.',
};

/* ---------------------------------------------------------------- Bookmarks */

export async function toggleEventBookmarkAction(input: {
  eventId: string;
  title: string;
}): Promise<ActionResult<{ saved: boolean }>> {
  const session = await getSession();
  if (!session?.user) return { status: 'sign_in_required' };
  if (!isDatabaseConfigured()) return NO_DB;

  const userId = session.user.id;

  const [existing] = await db
    .select()
    .from(schema.eventBookmark)
    .where(
      and(eq(schema.eventBookmark.userId, userId), eq(schema.eventBookmark.eventId, input.eventId))
    )
    .limit(1);

  if (existing) {
    await db.delete(schema.eventBookmark).where(eq(schema.eventBookmark.id, existing.id));
    revalidatePath('/en/events/my');
    return { status: 'ok', data: { saved: false } };
  }

  await db.insert(schema.eventBookmark).values({
    id: randomUUID(),
    userId,
    eventId: input.eventId,
    createdAt: new Date(),
  });

  await recordActivity({
    userId,
    type: 'saved',
    title: cleanLine(input.title, LIMITS.title),
    kind: 'event',
    ref: input.eventId,
  });

  revalidatePath('/en/events/my');
  return { status: 'ok', data: { saved: true } };
}

/* ------------------------------------------------------------- Registration */

export type RegistrationInput = {
  eventId: string;
  name: string;
  email: string;
  company?: string;
  role?: string;
  experienceLevel?: ExperienceLevel;
  eventUpdatesConsent: boolean;
  termsAccepted: boolean;
};

export type RegistrationOutcome = {
  status: 'registered' | 'waitlisted';
  waitlistPosition: number | null;
};

/**
 * Registering.
 *
 * Idempotent by construction: one row per person per event, enforced by a unique
 * index, so a double submit or a retried request finds the existing row and
 * returns the same answer rather than taking a second seat.
 *
 * Capacity is read and the counter incremented inside one transaction with the
 * row locked. Checking capacity and then inserting as two separate statements is
 * the classic way to sell the last place twice.
 */
export async function registerForEventAction(
  input: RegistrationInput
): Promise<ActionResult<RegistrationOutcome>> {
  const session = await getSession();
  if (!session?.user) return { status: 'sign_in_required' };
  if (!isDatabaseConfigured()) return NO_DB;

  const userId = session.user.id;

  const limited = await checkRate(`register:${userId}`, 20, 60_000);
  if (!limited.allowed) {
    return { status: 'error', message: 'Too many attempts. Try again in a minute.' };
  }

  const name = cleanLine(input.name, LIMITS.speakerName);
  const email = cleanLine(input.email, 160);

  if (!name) return { status: 'error', message: 'Enter the name to register under.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 'error', message: 'Enter a valid email address.' };
  }
  if (!input.termsAccepted) {
    return { status: 'error', message: 'Accepting the event terms is required to register.' };
  }

  const now = new Date();
  const event = await getEventById(input.eventId, now);
  if (!event) return { status: 'error', message: 'That event no longer exists.' };

  // The same decision the button rendered from, recomputed here where it counts.
  const cta = ctaFor({
    status: event.status,
    priceType: event.priceType,
    sourceType: event.sourceType,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    registrationDeadline: event.registrationDeadline,
    capacity: event.capacity,
    registrationCount: event.registrationCount,
    waitlistEnabled: event.waitlistEnabled,
    format: event.format,
    externalDomain: event.externalDomain,
    registration: null,
    now,
  });

  if (cta.kind !== 'register' && cta.kind !== 'waitlist') {
    return { status: 'error', message: cta.note ?? 'Registration is not open for this event.' };
  }

  try {
    const outcome = await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(schema.eventRegistration)
        .where(
          and(
            eq(schema.eventRegistration.eventId, input.eventId),
            eq(schema.eventRegistration.userId, userId)
          )
        )
        .limit(1);

      const current = existing[0];
      if (current && current.status !== 'cancelled') {
        return {
          status: current.status as 'registered' | 'waitlisted',
          waitlistPosition: current.waitlistPosition,
        };
      }

      // FOR UPDATE: the capacity read and the counter write have to be one step.
      const [locked] = await tx
        .select({
          capacity: schema.event.capacity,
          registrationCount: schema.event.registrationCount,
          waitlistCount: schema.event.waitlistCount,
          waitlistEnabled: schema.event.waitlistEnabled,
        })
        .from(schema.event)
        .where(eq(schema.event.id, input.eventId))
        .for('update')
        .limit(1);

      // A seeded event has no row to lock; the catalogue is read-only until the
      // events backend exists, so there is nothing to oversell.
      const capacity = locked?.capacity ?? event.capacity;
      const taken = locked?.registrationCount ?? event.registrationCount;
      const full = capacity !== null && taken >= capacity;

      const waitlisted = full && (locked?.waitlistEnabled ?? event.waitlistEnabled);
      if (full && !waitlisted) throw new Error('full');

      const position = waitlisted ? (locked?.waitlistCount ?? event.waitlistCount) + 1 : null;

      const values = {
        status: waitlisted ? ('waitlisted' as const) : ('registered' as const),
        name,
        email,
        company: input.company ? cleanLine(input.company, LIMITS.speakerName) : null,
        role: input.role ? cleanLine(input.role, LIMITS.speakerName) : null,
        experienceLevel: input.experienceLevel ?? null,
        eventUpdatesConsent: Boolean(input.eventUpdatesConsent),
        termsAccepted: true,
        waitlistPosition: position,
        updatedAt: new Date(),
      };

      if (current) {
        await tx
          .update(schema.eventRegistration)
          .set(values)
          .where(eq(schema.eventRegistration.id, current.id));
      } else {
        await tx.insert(schema.eventRegistration).values({
          id: randomUUID(),
          eventId: input.eventId,
          userId,
          createdAt: new Date(),
          ...values,
        });
      }

      if (locked) {
        await tx
          .update(schema.event)
          .set(
            waitlisted
              ? { waitlistCount: sql`${schema.event.waitlistCount} + 1` }
              : { registrationCount: sql`${schema.event.registrationCount} + 1` }
          )
          .where(eq(schema.event.id, input.eventId));
      }

      return { status: values.status, waitlistPosition: position };
    });

    await notify({
      userId,
      kind: outcome.status === 'waitlisted' ? 'waitlist_promoted' : 'registration_confirmed',
      eventId: event.id,
      eventTitle: event.title,
      eventSlug: event.slug,
      startsAt: event.startsAt,
    });

    await recordActivity({
      userId,
      type: 'booking',
      title: `Registered for ${cleanLine(event.title, LIMITS.title)}`,
      kind: 'event',
      ref: event.id,
    });

    revalidatePath('/en/events/my');
    revalidatePath(`/en/events/${event.slug}`);

    return { status: 'ok', data: outcome };
  } catch (error) {
    if (error instanceof Error && error.message === 'full') {
      return { status: 'error', message: 'The last place went while you were filling this in.' };
    }
    return { status: 'error', message: 'Registration could not be completed. Try again.' };
  }
}

/**
 * Cancelling.
 *
 * Frees the place and offers it to the first person waiting, in queue order —
 * the point of a waitlist is that leaving one does something for someone else.
 */
export async function cancelRegistrationAction(input: {
  eventId: string;
}): Promise<ActionResult<{ promoted: boolean }>> {
  const session = await getSession();
  if (!session?.user) return { status: 'sign_in_required' };
  if (!isDatabaseConfigured()) return NO_DB;

  const userId = session.user.id;
  const now = new Date();
  const event = await getEventById(input.eventId, now);

  try {
    const promoted = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(schema.eventRegistration)
        .where(
          and(
            eq(schema.eventRegistration.eventId, input.eventId),
            eq(schema.eventRegistration.userId, userId)
          )
        )
        .limit(1);

      if (!current || current.status === 'cancelled') return null;

      await tx
        .update(schema.eventRegistration)
        .set({ status: 'cancelled', waitlistPosition: null, updatedAt: new Date() })
        .where(eq(schema.eventRegistration.id, current.id));

      const wasWaitlisted = current.status === 'waitlisted';

      await tx
        .update(schema.event)
        .set(
          wasWaitlisted
            ? { waitlistCount: sql`greatest(${schema.event.waitlistCount} - 1, 0)` }
            : { registrationCount: sql`greatest(${schema.event.registrationCount} - 1, 0)` }
        )
        .where(eq(schema.event.id, input.eventId));

      if (wasWaitlisted) return null;

      // A place opened. The queue decides who gets it, not who happens to look.
      const [next] = await tx
        .select()
        .from(schema.eventRegistration)
        .where(
          and(
            eq(schema.eventRegistration.eventId, input.eventId),
            eq(schema.eventRegistration.status, 'waitlisted')
          )
        )
        .orderBy(asc(schema.eventRegistration.waitlistPosition))
        .limit(1);

      if (!next) return null;

      await tx
        .update(schema.eventRegistration)
        .set({ status: 'registered', waitlistPosition: null, updatedAt: new Date() })
        .where(eq(schema.eventRegistration.id, next.id));

      await tx
        .update(schema.event)
        .set({
          registrationCount: sql`${schema.event.registrationCount} + 1`,
          waitlistCount: sql`greatest(${schema.event.waitlistCount} - 1, 0)`,
        })
        .where(eq(schema.event.id, input.eventId));

      return next.userId;
    });

    if (promoted && event) {
      await notify({
        userId: promoted,
        kind: 'waitlist_promoted',
        eventId: event.id,
        eventTitle: event.title,
        eventSlug: event.slug,
        startsAt: event.startsAt,
      });
    }

    revalidatePath('/en/events/my');
    if (event) revalidatePath(`/en/events/${event.slug}`);

    return { status: 'ok', data: { promoted: Boolean(promoted) } };
  } catch {
    return { status: 'error', message: 'Could not cancel that registration. Try again.' };
  }
}

/* ----------------------------------------------------------------- Reports */

export async function reportEventAction(input: {
  eventId: string;
  reason: EventReportReason;
  detail?: string;
}): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!isDatabaseConfigured()) return NO_DB;

  const reporterId = session?.user?.id ?? null;

  const limited = await checkRate(`report:${reporterId ?? 'anon'}`, 5, 60 * 60_000);
  if (!limited.allowed) {
    return { status: 'error', message: 'You have sent several reports recently. Try again later.' };
  }

  await db.insert(schema.eventReport).values({
    id: randomUUID(),
    eventId: input.eventId,
    reporterId,
    reason: input.reason,
    detail: input.detail ? cleanLine(input.detail, LIMITS.reportDetail) : null,
    resolved: false,
    createdAt: new Date(),
  });

  return { status: 'ok', data: undefined };
}

/* --------------------------------------------------------- External clicks */

/** Counted for the organizer's dashboard. No identity is recorded with it. */
export async function recordExternalClickAction(input: { eventId: string }): Promise<void> {
  if (!isDatabaseConfigured()) return;

  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);

  try {
    await db
      .insert(schema.eventMetric)
      .values({
        id: randomUUID(),
        eventId: input.eventId,
        metric: 'external_click',
        day,
        count: 1,
      })
      .onConflictDoUpdate({
        target: [schema.eventMetric.eventId, schema.eventMetric.metric, schema.eventMetric.day],
        set: { count: sql`${schema.eventMetric.count} + 1` },
      });
  } catch {
    /* A missed count is not worth an error in front of someone leaving. */
  }
}

/** Read back by the details page to decide which state the button starts in. */
export async function myRegistrationAction(eventId: string) {
  const session = await getSession();
  if (!session?.user) return null;
  return registrationFor(session.user.id, eventId);
}
