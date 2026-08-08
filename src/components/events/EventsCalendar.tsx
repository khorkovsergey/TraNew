'use client';

import { Link } from '@/i18n/navigation';
import { formatEventTimes, groupByDay } from '@/lib/events/time';
import { FORMAT_LABEL, type EventSummary } from '@/lib/events/types';
import styles from './Events.module.css';

/**
 * The calendar view: a month grid, and the same events listed under it.
 *
 * Grouped in the venue's own zone rather than the reader's. An evening event in
 * Tokyo is on Tuesday in Tokyo, and filing it under Monday because that is what
 * it says in London helps nobody trying to decide whether to attend.
 *
 * The grid is a shape, not a substitute for the list: a cell is four lines tall
 * and cannot hold a time, a venue and a link, so it shows which days are busy
 * and the list below it answers the rest. One set of results builds both.
 */

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export function EventsCalendar({
  items,
  viewerTimeZone,
}: {
  items: EventSummary[];
  viewerTimeZone: string | null;
}) {
  const days = groupByDay(items);
  const months = monthsOf(days);

  return (
    <div>
      {months.map((month) => (
        <section className={styles.calMonth} key={month.key}>
          <h3 className={styles.calMonthName}>{month.name}</h3>

          <div className={styles.calWeekdays} aria-hidden="true">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className={styles.calGrid}>
            {month.cells.map((cell, index) => (
              <div
                key={cell?.key ?? `pad-${index}`}
                className={`${styles.calCell} ${cell ? '' : styles.calCellOut} ${
                  cell?.items.length ? styles.calCellOn : ''
                }`}
              >
                {cell && (
                  <>
                    <span className={styles.calCellNum}>{cell.day}</span>

                    {cell.items[0] && (
                      <span className={styles.calCellEvent}>{cell.items[0].title}</span>
                    )}

                    {cell.items.length > 1 && (
                      <span className={styles.calCellMore}>+{cell.items.length - 1} more</span>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

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

type DayGroup = { key: string; items: EventSummary[] };
type Cell = { key: string; day: number; items: EventSummary[] } | null;

/**
 * One grid per month that has something in it — usually one, occasionally two
 * around a month boundary. A single grid pinned to the first month would leave
 * next month's events in the list with nowhere to sit above it.
 *
 * The arithmetic is all in UTC. The keys are already calendar dates in the
 * venue's zone, and re-reading them in the runtime's zone is how a date lands a
 * day out on a server that happens to be west of the reader.
 */
function monthsOf(days: DayGroup[]) {
  const byMonth = new Map<string, DayGroup[]>();

  for (const day of days) {
    const month = day.key.slice(0, 7);
    const bucket = byMonth.get(month);
    if (bucket) bucket.push(day);
    else byMonth.set(month, [day]);
  }

  return [...byMonth.entries()].map(([key, group]) => {
    const [year, month] = key.split('-').map(Number);
    const first = new Date(Date.UTC(year, month - 1, 1));
    // Monday-first: Sunday is 0 in JS and last in this grid.
    const lead = (first.getUTCDay() + 6) % 7;
    const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const events = new Map(group.map((day) => [day.key, day.items]));

    const cells: Cell[] = [];
    // Whole weeks only, and no more of them than the month needs.
    for (let index = 0; index < Math.ceil((lead + length) / 7) * 7; index += 1) {
      const day = index - lead + 1;
      if (day < 1 || day > length) {
        cells.push(null);
        continue;
      }

      const dayKey = `${key}-${String(day).padStart(2, '0')}`;
      cells.push({ key: dayKey, day, items: events.get(dayKey) ?? [] });
    }

    return {
      key,
      name: new Intl.DateTimeFormat('en-GB', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(first),
      cells,
    };
  });
}
