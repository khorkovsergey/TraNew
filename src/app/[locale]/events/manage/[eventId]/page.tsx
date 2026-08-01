import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { OrganizerTools } from '@/components/events/OrganizerTools';
import { getEventById } from '@/lib/data/events';
import { analyticsFor, attendeesFor } from '@/lib/data/organizerEvents';
import { canCancel, canEdit, canExportRegistrations, canViewAnalytics } from '@/lib/events/access';
import { requireActor } from '@/lib/events/actor';
import { formatEventTimes } from '@/lib/events/time';
import { requireUser } from '@/lib/session';
import styles from '@/components/events/Events.module.css';

/**
 * Managing one event.
 *
 * Every capability on this page is resolved on the server before anything is
 * rendered, and the same functions are re-checked inside each action. What the
 * page draws is a reflection of the permission, never the source of it.
 */

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: Locale; eventId: string }> };

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ManageEventPage({ params }: Props) {
  const { locale, eventId } = await params;
  setRequestLocale(locale);

  await requireUser('/events/manage');
  const actor = await requireActor();

  const event = await getEventById(eventId, new Date());
  if (!event) notFound();

  const permissions = {
    edit: canEdit(actor, event),
    cancel: canCancel(actor, event),
    analytics: canViewAnalytics(actor, event),
    export: canExportRegistrations(actor, event),
  };

  // No permission at all means this event is not theirs to look at.
  if (!permissions.edit && !permissions.analytics) notFound();

  const attendees = await attendeesFor(actor, event);
  const analytics = permissions.analytics ? await analyticsFor(event.id) : null;

  const times = formatEventTimes({
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timezone: event.timezone,
  });

  return (
    <div className={styles.wrap}>
      <Link className={styles.backHome} href="/events/manage">
        ← Dashboard
      </Link>

      <h1 className={styles.h1} style={{ fontSize: 30 }}>
        {event.title}
      </h1>
      <p className={styles.lede}>
        {times.dayLabel} · {times.local}
      </p>

      {event.moderationReason && (
        <div className={`${styles.notice} ${styles.noticeWarn}`} style={{ marginTop: 16 }}>
          <p style={{ margin: 0 }}>{event.moderationReason}</p>
        </div>
      )}

      {analytics && (
        <div className={styles.statRow}>
          <Stat value={String(analytics.pageViews)} label="Page views" />
          <Stat value={`${analytics.conversion}%`} label="Registration conversion" />
          <Stat value={String(event.registrationCount)} label="Registrations" />
          <Stat value={String(event.waitlistCount)} label="On the waitlist" />
          <Stat value={String(analytics.saves)} label="Saves" />
          <Stat value={String(analytics.externalClicks)} label="External clicks" />
        </div>
      )}

      <OrganizerTools
        eventId={event.id}
        slug={event.slug}
        status={event.status}
        permissions={permissions}
        attendees={attendees ?? []}
      />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className={styles.stat}>
      <div className={`${styles.statValue} tn-num`}>{value}</div>
      <div className={styles.statKey}>{label}</div>
    </div>
  );
}
