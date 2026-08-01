import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { MyEventsTabs } from '@/components/events/MyEventsTabs';
import { myEvents } from '@/lib/data/events';
import { pageMetadata } from '@/lib/metadata';
import { requireUser } from '@/lib/session';
import styles from '@/components/events/Events.module.css';

/**
 * My events — the attendee's own page, deliberately separate from the organizer
 * dashboard. Registering for six events and running one are different jobs, and
 * one screen doing both serves neither.
 */

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ tab?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return {
    ...pageMetadata({
      href: '/events/my',
      locale,
      title: 'My events',
      description: 'The events you are registered for, saved and have attended.',
    }),
    robots: { index: false, follow: false },
  };
}

export default async function MyEventsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireUser('/events/my');
  const { tab } = await searchParams;
  const now = new Date();
  const mine = await myEvents(user.id, now);

  return (
    <div className={styles.wrap}>
      <Link className={styles.backHome} href="/events">
        ← All events
      </Link>

      <h1 className={styles.h1} style={{ fontSize: 34 }}>
        My events
      </h1>

      <MyEventsTabs
        active={tab === 'saved' || tab === 'past' ? tab : 'upcoming'}
        upcoming={mine.upcoming}
        saved={mine.saved}
        past={mine.past}
      />
    </div>
  );
}
