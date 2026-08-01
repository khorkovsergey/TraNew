'use client';

import { useState, useTransition } from 'react';
import { cancelRegistrationAction } from '@/app/actions/events';
import { Link } from '@/i18n/navigation';
import { track } from '@/lib/events/analytics';
import { formatEventTimes } from '@/lib/events/time';
import type { EventSummary, RegistrationStatus } from '@/lib/events/types';
import { EventCard } from './EventCard';
import styles from './Events.module.css';

/**
 * Upcoming, Saved and Past.
 *
 * Each has its own empty state saying what to do next, because "nothing here"
 * is the state most people see first and a blank panel is the product declining
 * to help at the exact moment it could.
 */

type Entry = { event: EventSummary; status: RegistrationStatus };

export function MyEventsTabs({
  active,
  upcoming,
  saved,
  past,
}: {
  active: 'upcoming' | 'saved' | 'past';
  upcoming: Entry[];
  saved: EventSummary[];
  past: Entry[];
}) {
  const [tab, setTab] = useState(active);
  const [rows, setRows] = useState(upcoming);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const cancel = (eventId: string) => {
    startTransition(async () => {
      const result = await cancelRegistrationAction({ eventId });
      if (result.status === 'ok') {
        setRows((current) => current.filter((entry) => entry.event.id !== eventId));
        setMessage('Registration cancelled.');
        track({ name: 'event_registration_cancelled', eventId });
      } else if (result.status !== 'sign_in_required') {
        setMessage(result.message);
      }
    });
  };

  return (
    <>
      <div className={styles.hubTabs} role="tablist" aria-label="My events">
        {(['upcoming', 'saved', 'past'] as const).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={`${styles.hubTab} ${tab === key ? styles.hubTabActive : ''}`}
            onClick={() => setTab(key)}
          >
            {key === 'upcoming' ? 'Upcoming' : key === 'saved' ? 'Saved' : 'Past'}
          </button>
        ))}
      </div>

      <p className={styles.ctaStatus} role="status" aria-live="polite">
        {message ?? ''}
      </p>

      {tab === 'upcoming' &&
        (rows.length ? (
          <div className={styles.section}>
            {rows.map((entry) => {
              const times = formatEventTimes({
                startsAt: entry.event.startsAt,
                endsAt: entry.event.endsAt,
                timezone: entry.event.timezone,
              });

              return (
                <div className={styles.calRow} key={entry.event.id} style={{ marginBottom: 10 }}>
                  <span className={styles.calTime}>
                    {times.dayLabel} · {times.local}
                  </span>

                  <Link
                    className={styles.calTitle}
                    href={{ pathname: '/events/[slug]', params: { slug: entry.event.slug } }}
                  >
                    {entry.event.title}
                  </Link>

                  <span
                    className={
                      entry.status === 'waitlisted' ? styles.cardStateWait : styles.cardStateOk
                    }
                  >
                    {entry.status === 'waitlisted' ? 'Waitlist' : 'Registered'}
                  </span>

                  <a
                    className={styles.calMeta}
                    href={`/api/events/${entry.event.slug}/calendar.ics`}
                    download
                  >
                    Add to calendar
                  </a>

                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => cancel(entry.event.id)}
                    disabled={pending}
                  >
                    Cancel
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty
            title="No upcoming events"
            text="When you register for something, it will appear here with a link to add it to your calendar."
            action={{ label: 'Browse events', href: '/events' }}
          />
        ))}

      {tab === 'saved' &&
        (saved.length ? (
          <div className={`${styles.grid} ${styles.gridWide}`} style={{ marginTop: 24 }}>
            {saved.map((event) => (
              <EventCard key={event.id} event={event} saved />
            ))}
          </div>
        ) : (
          <Empty
            title="Nothing saved yet"
            text="Save an event to come back to it. Saved events stay here across your devices."
            action={{ label: 'Find events', href: '/events' }}
          />
        ))}

      {tab === 'past' &&
        (past.length ? (
          <div className={`${styles.grid} ${styles.gridWide}`} style={{ marginTop: 24 }}>
            {past.map((entry) => (
              <EventCard key={entry.event.id} event={entry.event} variant="compact" />
            ))}
          </div>
        ) : (
          <Empty
            title="Nothing here yet"
            text="Events you attended will be listed here once they have finished."
          />
        ))}
    </>
  );
}

function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: { label: string; href: '/events' };
}) {
  return (
    <div className={styles.empty} style={{ marginTop: 24 }}>
      <p className={styles.emptyTitle}>{title}</p>
      <p className={styles.emptyText}>{text}</p>
      {action && (
        <div className={styles.emptyActions}>
          <Link className={styles.primary} href={action.href}>
            {action.label}
          </Link>
        </div>
      )}
    </div>
  );
}
