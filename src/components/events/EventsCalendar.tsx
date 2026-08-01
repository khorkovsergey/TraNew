'use client';

import { Link } from '@/i18n/navigation';
import { formatEventTimes, groupByDay } from '@/lib/events/time';
import { FORMAT_LABEL, type EventSummary } from '@/lib/events/types';
import styles from './Events.module.css';

/**
 * The calendar view: the same events, grouped by the day they happen on.
 *
 * Grouped in the venue's own zone rather than the reader's. An evening event in
 * Tokyo is on Tuesday in Tokyo, and filing it under Monday because that is what
 * it says in London helps nobody trying to decide whether to attend.
 */

export function EventsCalendar({
  items,
  viewerTimeZone,
}: {
  items: EventSummary[];
  viewerTimeZone: string | null;
}) {
  const days = groupByDay(items);

  return (
    <div>
      {days.map((day) => (
        <section className={styles.calDay} key={day.key}>
          <h3 className={styles.calDayHead}>{day.heading}</h3>

          <div className={styles.calList}>
            {day.items.map((event) => {
              const times = formatEventTimes({
                startsAt: event.startsAt,
                endsAt: event.endsAt,
                timezone: event.timezone,
                viewerTimeZone,
              });

              return (
                <div className={styles.calRow} key={event.id}>
                  <span className={styles.calTime}>{times.local}</span>

                  <Link
                    className={styles.calTitle}
                    href={{ pathname: '/events/[slug]', params: { slug: event.slug } }}
                  >
                    {event.title}
                  </Link>

                  <span className={styles.calMeta}>
                    {FORMAT_LABEL[event.format]}
                    {event.city && event.format !== 'online' ? ` · ${event.city}` : ''}
                  </span>

                  {/* Shown only when it differs, so the common case stays quiet. */}
                  {times.viewer && <span className={styles.calMeta}>Your time: {times.viewer}</span>}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
