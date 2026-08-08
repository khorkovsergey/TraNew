'use client';

import { useMemo } from 'react';
import { Link } from '@/i18n/navigation';
import { formatEventTimes } from '@/lib/events/time';
import type { EventSummary } from '@/lib/events/types';
import { EventCard } from './EventCard';
import styles from './Events.module.css';

/**
 * The map view.
 *
 * No mapping library. That is a deliberate choice for this release rather than a
 * gap: a tile provider is a third-party request on every pan, a key to manage and
 * roughly 150KB of JavaScript, and what this view actually has to answer is
 * "which of these are near each other and near me". A projection of the venue
 * coordinates onto the pane answers that, and the list beside it answers the rest.
 *
 * When a provider is added, only this component changes — and it is already the
 * only thing that loads when Map is selected, so nothing else pays for it.
 */

export function EventsMap({
  items,
  viewerTimeZone,
}: {
  items: EventSummary[];
  viewerTimeZone: string | null;
}) {
  const placed = useMemo(
    () => items.filter((event) => event.latitude !== null && event.longitude !== null),
    [items]
  );

  const online = items.length - placed.length;

  const bounds = useMemo(() => {
    if (!placed.length) return null;

    const lats = placed.map((event) => event.latitude!);
    const lons = placed.map((event) => event.longitude!);

    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons),
    };
  }, [placed]);

  /** Percentages inside the pane, with a margin so pins never touch the edge. */
  const position = (event: EventSummary) => {
    if (!bounds) return { left: '50%', top: '50%' };

    const spanLat = Math.max(0.0001, bounds.maxLat - bounds.minLat);
    const spanLon = Math.max(0.0001, bounds.maxLon - bounds.minLon);

    const x = 10 + ((event.longitude! - bounds.minLon) / spanLon) * 80;
    // Latitude increases northward; the pane's y increases downward.
    const y = 10 + ((bounds.maxLat - event.latitude!) / spanLat) * 78;

    return { left: `${x}%`, top: `${y}%` };
  };

  return (
    <div className={styles.mapWrap}>
      <div className={styles.mapCanvas} role="group" aria-label="Event locations">
        <Contours />

        {placed.map((event) => {
          const times = formatEventTimes({
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            timezone: event.timezone,
            viewerTimeZone,
          });

          return (
            <Link
              key={event.id}
              className={styles.mapPin}
              style={position(event)}
              href={{ pathname: '/events/[slug]', params: { slug: event.slug } }}
              title={`${event.title} · ${times.dayLabel}`}
            >
              <span className={styles.mapPinDot} aria-hidden="true" />
              <span className={styles.mapPinLabel}>{event.city ?? event.title}</span>
            </Link>
          );
        })}

        <p className={styles.mapNote}>
          {placed.length
            ? `${placed.length} venue${placed.length === 1 ? '' : 's'} shown by relative position.`
            : 'None of these events has a venue to place.'}
          {online > 0 && ` ${online} online event${online === 1 ? '' : 's'} can be joined anywhere.`}
        </p>
      </div>

      <div className={styles.mapList}>
        {items.map((event) => (
          <EventCard key={event.id} event={event} viewerTimeZone={viewerTimeZone} />
        ))}
      </div>
    </div>
  );
}

/*
 * Contours, not coastlines.
 *
 * Deliberately abstract: a shape that looked like a real map would be read as
 * one, and the pins are placed by relative position rather than by projection —
 * the note under them says so.
 */
function Contours() {
  return (
    <svg className={styles.mapLines} viewBox="0 0 1200 420" aria-hidden="true">
      <path
        d="M0 300 Q 200 260 380 290 T 760 270 T 1200 300"
        fill="none"
        stroke="var(--tn-border-card)"
        strokeWidth={2}
      />
      <path
        d="M0 180 Q 260 140 520 170 T 1200 150"
        fill="none"
        stroke="var(--tn-border-card)"
        strokeWidth={2}
      />
      <circle
        cx={340}
        cy={205}
        r={130}
        fill="none"
        stroke="var(--tn-border-hairline)"
        strokeWidth={1.5}
        strokeDasharray="4 8"
      />
    </svg>
  );
}
