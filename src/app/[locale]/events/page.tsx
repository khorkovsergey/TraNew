import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { EventsBrowser } from '@/components/events/EventsBrowser';
import { EventsHubHeader } from '@/components/events/EventsHubHeader';
import { EventSection } from '@/components/events/EventSection';
import { bookmarkedIds, findEvents, registrationsFor, summaries } from '@/lib/data/events';
import { parseFilters } from '@/lib/events/filters';
import { explain, rankEvents } from '@/lib/events/recommend';
import { signalsForViewer } from '@/lib/events/signals';
import { getSession } from '@/lib/session';
import { pageMetadata } from '@/lib/metadata';
import type { Locale } from '@/i18n/routing';
import styles from '@/components/events/Events.module.css';

/**
 * Events discovery.
 *
 * Dynamic because everything on it depends on the query string and on who is
 * looking: filters live in the URL, and the saved and registered states are the
 * viewer's own. Prerendering it would serve one person's answer to everyone.
 *
 * The curated sections appear only when nothing is being filtered. Once someone
 * has stated what they want, showing "Recommended for you" above their own
 * results is the page arguing with them.
 */

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    href: '/events',
    locale,
    title: 'Financial events, meetups and webinars',
    description:
      'Find investing and trading events near you or online — hosted by TradingNew, verified organizers and the community.',
  });
}

export default async function EventsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const filters = parseFilters(await searchParams);
  const now = new Date();

  const signals = await signalsForViewer({ city: filters.city, country: filters.country });
  const [result, all] = await Promise.all([
    findEvents(filters, signals, now),
    summaries(now),
  ]);

  const session = await getSession();
  const userId = session?.user?.id ?? null;

  const registrations = userId
    ? await registrationsFor(
        userId,
        result.items.map((event) => event.id)
      )
    : new Map();
  const saved = userId ? await bookmarkedIds(userId) : new Set<string>();

  const upcoming = all.filter(
    (event) => event.status === 'published' && Date.parse(event.endsAt) >= now.getTime()
  );

  const ranked = rankEvents(upcoming, signals, now);
  const reasons = Object.fromEntries(
    ranked.slice(0, 6).map((entry) => [entry.event.id, explain(entry)])
  );

  const cities = [...new Set(upcoming.map((event) => event.city).filter(Boolean))] as string[];
  const untouched =
    filters.q === '' &&
    filters.dateWindow === 'any' &&
    !filters.formats.length &&
    !filters.topics.length &&
    !filters.levels.length &&
    !filters.languages.length &&
    !filters.types.length &&
    !filters.sources.length &&
    !filters.price &&
    !filters.onlineOnly &&
    filters.view === 'cards';

  const near = filters.city
    ? upcoming.filter((event) => event.city === filters.city)
    : [];

  const sections = untouched
    ? [
        { title: 'Recommended for you', items: ranked.slice(0, 3).map((entry) => entry.event) },
        { title: `Near you · ${filters.city ?? ''}`, items: near.slice(0, 3), when: Boolean(filters.city) },
        {
          title: 'Online events',
          items: upcoming.filter((event) => event.format !== 'in_person').slice(0, 3),
        },
        {
          title: 'This week',
          items: upcoming
            .filter((event) => Date.parse(event.startsAt) < now.getTime() + 7 * 86_400_000)
            .slice(0, 3),
        },
        {
          title: 'Official TradingNew events',
          items: upcoming.filter((event) => event.sourceType === 'tradingnew').slice(0, 3),
        },
        {
          title: 'Community events',
          items: upcoming
            .filter((event) => event.sourceType === 'community' && event.verificationStatus !== 'verified')
            .slice(0, 3),
        },
      ]
    : [];

  return (
    <div className={styles.wrap}>
      <EventsHubHeader active="events" />

      <div className={styles.board}>
        <EventsBrowser
          filters={filters}
          items={result.items}
          total={result.total}
          hasMore={result.hasMore}
          savedIds={[...saved]}
          registeredIds={[...registrations.entries()]
            .filter(([, status]) => status === 'registered' || status === 'attended')
            .map(([id]) => id)}
          waitlistedIds={[...registrations.entries()]
            .filter(([, status]) => status === 'waitlisted')
            .map(([id]) => id)}
          reasons={reasons}
          viewerTimeZone={null}
          knownCities={cities}
        />
      </div>

      {/* Only sections with something in them are rendered — an empty rail
          labelled "Near you" tells someone the product is broken, not that
          their city is quiet. */}
      {sections
        .filter((section) => section.items.length > 0 && section.when !== false)
        .map((section) => (
          <EventSection
            key={section.title}
            title={section.title}
            items={section.items}
            savedIds={[...saved]}
            reasons={section.title === 'Recommended for you' ? reasons : {}}
          />
        ))}
    </div>
  );
}
