import { Link } from '@/i18n/navigation';
import { formatEventTimes } from '@/lib/events/time';
import type { EventStatus } from '@/lib/events/types';
import type { OrganizerEvent } from '@/lib/data/organizerEvents';
import styles from './Events.module.css';

/**
 * One row of the organizer dashboard.
 *
 * The status is the point of the row, so it gets a word and a colour rather than
 * a colour alone — and a rejection carries its reason inline. Telling someone
 * their event was rejected without saying why guarantees they resubmit the same
 * thing.
 */

const STATUS_LABEL: Record<EventStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending review',
  changes_requested: 'Changes requested',
  published: 'Published',
  rejected: 'Rejected',
  suspended: 'Suspended',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

const STATUS_CLASS: Record<EventStatus, string> = {
  draft: styles.statusDraft,
  pending_review: styles.statusPending,
  changes_requested: styles.statusDraft,
  published: styles.statusPublished,
  rejected: styles.statusBad,
  suspended: styles.statusBad,
  cancelled: styles.statusBad,
  completed: styles.statusDone,
};

export function OrganizerEventRow({ event }: { event: OrganizerEvent }) {
  const times = formatEventTimes({
    startsAt: event.startsAt,
    endsAt: event.startsAt,
    timezone: 'UTC',
  });

  const places =
    event.capacity === null
      ? `${event.registrationCount} registered`
      : `${event.registrationCount} of ${event.capacity}`;

  return (
    <article className={styles.manageRow}>
      <div className={styles.manageMain}>
        <div className={styles.manageTitle}>{event.title}</div>
        <div className={styles.manageMeta}>
          {times.dayLabel} · {places}
          {event.waitlistCount > 0 && ` · ${event.waitlistCount} waiting`}
        </div>
      </div>

      <span className={`${styles.status} ${STATUS_CLASS[event.status]}`}>
        {STATUS_LABEL[event.status]}
      </span>

      <Link
        className={styles.secondary}
        href={{ pathname: '/events/manage/[eventId]', params: { eventId: event.id } }}
      >
        Manage
      </Link>

      {event.status === 'published' && (
        <Link
          className={styles.linkButton}
          href={{ pathname: '/events/[slug]', params: { slug: event.slug } }}
        >
          View
        </Link>
      )}

      {event.moderationReason && <p className={styles.manageReason}>{event.moderationReason}</p>}
    </article>
  );
}
