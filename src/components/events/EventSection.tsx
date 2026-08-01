import type { EventSummary } from '@/lib/events/types';
import { EventCard } from './EventCard';
import styles from './Events.module.css';

/**
 * A titled row of events. Renders nothing at all when it has nothing to show —
 * a heading over an empty space reads as a failure rather than as an absence.
 */
export function EventSection({
  title,
  items,
  savedIds = [],
  reasons = {},
  action,
}: {
  title: string;
  items: EventSummary[];
  savedIds?: string[];
  reasons?: Record<string, string>;
  action?: React.ReactNode;
}) {
  if (!items.length) return null;

  const saved = new Set(savedIds);

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {action}
      </div>

      <div className={styles.grid}>
        {items.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            saved={saved.has(event.id)}
            reason={reasons[event.id] ?? null}
          />
        ))}
      </div>
    </section>
  );
}
