import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { CreateEventButton } from '@/components/events/CreateEventButton';
import { OrganizerEventRow } from '@/components/events/OrganizerEventRow';
import { organizerEvents } from '@/lib/data/organizerEvents';
import { requireActor } from '@/lib/events/actor';
import { pageMetadata } from '@/lib/metadata';
import { requireUser } from '@/lib/session';
import styles from '@/components/events/Events.module.css';

/**
 * The organizer dashboard.
 *
 * Shows only what this actor owns — the query is scoped by organizer membership
 * rather than filtered after the fact, so there is no version of this page that
 * fetches everyone's events and then hides most of them.
 */

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ status?: string; q?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return {
    ...pageMetadata({
      href: '/events/manage',
      locale,
      title: 'Organizer dashboard',
      description: 'Manage the events you organize.',
    }),
    robots: { index: false, follow: false },
  };
}

export default async function ManageEventsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireUser('/events/manage');
  const actor = await requireActor();
  const { status, q } = await searchParams;

  const now = Date.parse(new Date().toISOString());
  const all = await organizerEvents(actor);
  const needle = (q ?? '').trim().toLowerCase();

  const events = all.filter((event) => {
    if (status && status !== 'all' && event.status !== status) return false;
    if (needle && !event.title.toLowerCase().includes(needle)) return false;
    return true;
  });

  const published = all.filter((event) => event.status === 'published');
  const registrations = all.reduce((sum, event) => sum + event.registrationCount, 0);
  const upcoming = published.filter((event) => Date.parse(event.startsAt) > now).length;

  return (
    <div className={styles.wrap}>
      <Link className={styles.backHome} href="/events">
        ← All events
      </Link>

      <h1 className={styles.h1} style={{ fontSize: 34 }}>
        Organizer dashboard
      </h1>

      <div className={styles.heroActions}>
        <CreateEventButton />
        <Link className={styles.secondary} href="/events/my">
          My registrations
        </Link>
      </div>

      <div className={styles.statRow}>
        <Stat value={String(published.length)} label="Published events" />
        <Stat value={String(upcoming)} label="Upcoming" />
        <Stat value={String(registrations)} label="Registrations" />
        <Stat value={String(all.filter((event) => event.status === 'pending_review').length)} label="Awaiting review" />
      </div>

      <form className={styles.searchRow} style={{ marginTop: 20 }} role="search">
        <div className={styles.search}>
          <input
            className={styles.searchInput}
            type="search"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Search your events"
            aria-label="Search your events"
          />
        </div>
        <select className={styles.control} name="status" defaultValue={status ?? 'all'} aria-label="Status">
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="pending_review">Pending review</option>
          <option value="changes_requested">Changes requested</option>
          <option value="published">Published</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
        </select>
        <button type="submit" className={styles.secondary}>
          Filter
        </button>
      </form>

      <div className={styles.section}>
        {events.length ? (
          events.map((event) => <OrganizerEventRow key={event.id} event={event} />)
        ) : (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>
              {all.length ? 'Nothing matches that filter' : 'You have not created an event yet'}
            </p>
            <p className={styles.emptyText}>
              {all.length
                ? 'Try a different status or clear the search.'
                : 'Events you create appear here with their moderation status, registrations and analytics.'}
            </p>
          </div>
        )}
      </div>
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
