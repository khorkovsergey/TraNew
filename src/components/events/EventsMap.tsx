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
      <div className={styles.mapList}>
        {items.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            variant="compact"
            viewerTimeZone={viewerTimeZone}
          />
        ))}
      </div>

      <div className={styles.mapCanvas} role="group" aria-label="Event locations">
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
              <Dot />
              {event.city ?? event.title}
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
    </div>
  );
}

function Dot() {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: 'var(--tn-purple)',
        flexShrink: 0,
      }}
    />
  );
}
