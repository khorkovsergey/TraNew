import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { EventSection } from '@/components/events/EventSection';
import { FollowButton } from '@/components/events/FollowButton';
import { getOrganizer, summaries } from '@/lib/data/events';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/events/Events.module.css';

/**
 * An organizer's public page.
 *
 * Public, and therefore carefully limited to what an organizer chose to publish:
 * who they are, what they have run, what is coming. No attendee counts they did
 * not advertise, no contact details they did not give.
 */

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: Locale; slug: string }> };

const VERIFICATION_LABEL: Record<string, string> = {
  verified: 'Verified organizer',
  unverified: 'Community organizer',
  pending: 'Verification in progress',
  suspended: 'Suspended',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const organizer = await getOrganizer(slug);

  if (!organizer) return { title: 'Organizer not found', robots: { index: false } };

  return pageMetadata({
    href: { pathname: '/organizers/[slug]', params: { slug } },
    locale,
    title: `${organizer.name} — events`,
    description: organizer.description ?? `Financial events organized by ${organizer.name}.`,
  });
}

export default async function OrganizerPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const organizer = await getOrganizer(slug);
  if (!organizer) notFound();

  const now = new Date();
  const all = await summaries(now);
  const theirs = all.filter((event) => event.organizerSlug === organizer.slug);

  const upcoming = theirs.filter(
    (event) => event.status === 'published' && Date.parse(event.endsAt) >= now.getTime()
  );
  const past = theirs
    .filter((event) => Date.parse(event.endsAt) < now.getTime())
    .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));

  return (
    <div className={styles.wrap}>
      <Link className={styles.backHome} href="/events">
        ← All events
      </Link>

      <div className={styles.orgHead}>
        <span className={styles.orgAvatar} aria-hidden="true">
          {organizer.initials}
        </span>

        <div style={{ flex: 1 }}>
          <h1 className={styles.orgName}>{organizer.name}</h1>
          <p className={styles.orgMeta}>
            {VERIFICATION_LABEL[organizer.verificationStatus] ?? 'Organizer'}
            {organizer.country && ` · ${organizer.country}`}
            {` · ${organizer.followerCount.toLocaleString('en-GB')} followers`}
          </p>
        </div>

        <FollowButton organizerId={organizer.id} name={organizer.name} />
      </div>

      {organizer.description && (
        <div className={styles.panelCard} style={{ marginTop: 20 }}>
          <div className={styles.prose}>
            <p>{organizer.description}</p>
          </div>
        </div>
      )}

      {organizer.verificationStatus !== 'verified' && (
        <div className={`${styles.notice} ${styles.noticeWarn}`} style={{ marginTop: 16 }}>
          <p style={{ margin: 0 }}>
            TradingNew has not verified this organizer. Their events are moderated for content, but
            we do not vouch for the organizer themselves.
          </p>
        </div>
      )}

      <EventSection title="Upcoming events" items={upcoming} />
      <EventSection title="Past events" items={past.slice(0, 6)} />
    </div>
  );
}
