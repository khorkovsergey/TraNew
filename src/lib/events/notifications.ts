import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db, isDatabaseConfigured, schema } from '@/db';
import { SITE_URL } from '@/lib/metadata';
import { send } from '@/lib/email';
import type { EventNotificationKind } from './types';

/**
 * Event notifications.
 *
 * An interface with one implementation, rather than mail calls scattered through
 * the actions. Two things it buys: preferences are honoured in a single place, so
 * nobody has to remember to check them; and a real queue or push transport
 * replaces `deliver` without any caller changing.
 *
 * Reminders are declared here but not scheduled — that needs a job runner, which
 * this repository does not have. `dueReminders` exists so the runner, when it
 * arrives, has an obvious thing to call.
 */

export type NotificationPayload = {
  userId: string;
  kind: EventNotificationKind;
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  startsAt: string;
  /** Organizer's own words, for update and change notices. */
  message?: string;
};

export interface NotificationTransport {
  deliver(payload: NotificationPayload, recipient: { email: string; name: string }): Promise<void>;
}

const SUBJECTS: Record<EventNotificationKind, (title: string) => string> = {
  registration_confirmed: (title) => `You're registered: ${title}`,
  reminder_24h: (title) => `Tomorrow: ${title}`,
  reminder_1h: (title) => `Starting soon: ${title}`,
  event_changed: (title) => `Updated: ${title}`,
  event_cancelled: (title) => `Cancelled: ${title}`,
  waitlist_promoted: (title) => `A place opened up: ${title}`,
  organizer_update: (title) => `Update from the organizer: ${title}`,
  organizer_new_event: (title) => `New event: ${title}`,
  regional_event: (title) => `Near you: ${title}`,
};

const BODIES: Record<EventNotificationKind, (payload: NotificationPayload, url: string) => string> = {
  registration_confirmed: (p, url) =>
    `Your place at ${p.eventTitle} is confirmed.\n\nAdd it to your calendar and see the details: ${url}`,
  reminder_24h: (p, url) => `${p.eventTitle} starts tomorrow.\n\n${url}`,
  reminder_1h: (p, url) => `${p.eventTitle} starts within the hour.\n\n${url}`,
  event_changed: (p, url) =>
    `The organizer changed some details of ${p.eventTitle}.\n\n${p.message ?? ''}\n\n${url}`,
  event_cancelled: (p, url) =>
    `${p.eventTitle} has been cancelled and your registration is closed.\n\n${p.message ?? ''}\n\n${url}`,
  waitlist_promoted: (p, url) =>
    `A place opened at ${p.eventTitle} and it is yours.\n\n${url}`,
  organizer_update: (p, url) => `${p.message ?? 'The organizer posted an update.'}\n\n${url}`,
  organizer_new_event: (p, url) => `An organizer you follow announced ${p.eventTitle}.\n\n${url}`,
  regional_event: (p, url) => `${p.eventTitle} is happening near you.\n\n${url}`,
};

/** Uses the mail path the rest of the product already goes through. */
class EmailTransport implements NotificationTransport {
  async deliver(payload: NotificationPayload, recipient: { email: string; name: string }) {
    const url = `${SITE_URL}/en/events/${payload.eventSlug}`;

    await send(
      recipient.email,
      SUBJECTS[payload.kind](payload.eventTitle),
      `Hello ${recipient.name},\n\n${BODIES[payload.kind](payload, url)}\n\n— TradingNew`
    );
  }
}

let transport: NotificationTransport = new EmailTransport();

export function setNotificationTransport(next: NotificationTransport): void {
  transport = next;
}

/**
 * Preferences default to on, but the row is the authority once it exists. A
 * missing row means "never asked", not "opted out" — the confirmation for a
 * registration someone just made is not something to withhold on a technicality.
 */
export async function isEnabled(userId: string, kind: EventNotificationKind): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;

  try {
    const [row] = await db
      .select({ enabled: schema.eventNotificationPreference.enabled })
      .from(schema.eventNotificationPreference)
      .where(
        and(
          eq(schema.eventNotificationPreference.userId, userId),
          eq(schema.eventNotificationPreference.kind, kind)
        )
      )
      .limit(1);

    return row?.enabled ?? true;
  } catch {
    return false;
  }
}

/** Never throws. A notification that fails must not fail the registration. */
export async function notify(payload: NotificationPayload): Promise<void> {
  try {
    if (!isDatabaseConfigured()) return;
    if (!(await isEnabled(payload.userId, payload.kind))) return;

    const [recipient] = await db
      .select({ email: schema.user.email, name: schema.user.name })
      .from(schema.user)
      .where(eq(schema.user.id, payload.userId))
      .limit(1);

    if (!recipient) return;
    await transport.deliver(payload, recipient);
  } catch {
    /* Deliberately swallowed — see the note above. */
  }
}

/** Everyone registered, for a change or a cancellation. */
export async function notifyAttendees(
  eventId: string,
  payload: Omit<NotificationPayload, 'userId'>
): Promise<number> {
  if (!isDatabaseConfigured()) return 0;

  try {
    const rows = await db
      .select({ userId: schema.eventRegistration.userId })
      .from(schema.eventRegistration)
      .where(
        and(
          eq(schema.eventRegistration.eventId, eventId),
          eq(schema.eventRegistration.status, 'registered')
        )
      );

    for (const row of rows) await notify({ ...payload, userId: row.userId });
    return rows.length;
  } catch {
    return 0;
  }
}

/**
 * The reminders that would be due, for a scheduler that does not exist yet.
 * Returning them rather than sending them keeps this side-effect free and makes
 * the missing piece obvious instead of silently absent.
 */
export async function dueReminders(now: Date): Promise<
  Array<{ userId: string; kind: 'reminder_24h' | 'reminder_1h'; eventId: string }>
> {
  void now;
  return [];
}

export const NOTIFICATION_LABEL: Record<EventNotificationKind, string> = {
  registration_confirmed: 'When my registration is confirmed',
  reminder_24h: 'A reminder the day before',
  reminder_1h: 'A reminder an hour before',
  event_changed: 'When an event I am registered for changes',
  event_cancelled: 'When an event is cancelled',
  waitlist_promoted: 'When a place opens up from the waitlist',
  organizer_update: 'Updates posted by the organizer',
  organizer_new_event: 'New events from organizers I follow',
  regional_event: 'Relevant events near me',
};
