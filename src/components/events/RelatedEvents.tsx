import { summaries } from '@/lib/data/events';
import type { EventSummary } from '@/lib/events/types';
import { EventSection } from './EventSection';

/**
 * Events that belong beside something else — a symbol page, a finished lesson,
 * the account workspace.
 *
 * This is the component that makes Events part of the product rather than a
 * separate noticeboard. It is a server component that fetches for itself, so a
 * page adds one line and does not have to learn the events data model to do it.
 *
 * Renders nothing when there is nothing relevant. A section that appears empty
 * on a symbol page is worse than one that is absent.
 */

export async function RelatedEvents({
  topics,
  title = 'Events on this topic',
  limit = 3,
  exclude,
}: {
  topics: string[];
  title?: string;
  limit?: number;
  exclude?: string;
}) {
  if (!topics.length) return null;

  const now = new Date();
  const all = await summaries(now);

  const matching: EventSummary[] = all
    .filter(
      (event) =>
        event.id !== exclude &&
        event.status === 'published' &&
        Date.parse(event.startsAt) >= now.getTime() &&
        event.topics.some((topic) => topics.includes(topic))
    )
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, limit);

  return <EventSection title={title} items={matching} />;
}
