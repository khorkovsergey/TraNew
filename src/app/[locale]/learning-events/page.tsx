import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { EventSection } from '@/components/events/EventSection';
import { summaries } from '@/lib/data/events';
import { rankEvents } from '@/lib/events/recommend';
import { NO_SIGNALS } from '@/lib/events/recommend';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/events/Events.module.css';

/**
 * The Learning & Events hub.
 *
 * A landing page for both halves rather than a redirect to one of them. Someone
 * arriving from the Marketplace menu has not yet decided whether they want a
 * course or an evening out, and choosing for them is how one half of a section
 * becomes invisible.
 */

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    href: '/learning-events',
    locale,
    title: 'Learning and events',
    description:
      'Courses, webinars, meetups and conferences — practical financial education from TradingNew and the community.',
  });
}

export default async function LearningEventsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const now = new Date();
  const all = await summaries(now);
  const upcoming = all.filter(
    (event) => event.status === 'published' && Date.parse(event.endsAt) >= now.getTime()
  );

  const featured = rankEvents(upcoming, NO_SIGNALS, now)
    .slice(0, 3)
    .map((entry) => entry.event);

  return (
    <div className={styles.wrap}>
      {/*
        * Its own header, not the Events one.
        *
        * This page is the only place that really is both halves at once, so it
        * says so. The Events header stopped describing learning when the tab
        * strip came off, and borrowing it here would have put "Create an event"
        * above a section about lessons.
        */}
      <header>
        <Link className={styles.backHome} href="/">
          ← Home
        </Link>

        <p className={styles.eyebrow}>LEARNING &amp; EVENTS</p>
        <h1 className={styles.h1}>
          Learn, connect and navigate the markets{' '}
          <span className={styles.h1Accent}>with confidence</span>
        </h1>
        <p className={styles.lede}>
          Build your knowledge with practical courses or join financial events hosted by TradingNew
          and the community.
        </p>
      </header>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Learning</h2>
          <Link className={styles.sectionLink} href="/academy">
            Open Learn →
          </Link>
        </div>

        <div className={styles.panelCard}>
          <div className={styles.prose}>
            <p>
              A personal learning path tied to what you actually do on the platform — start with
              the basics or jump to the topic you are stuck on. Free, and free permanently.
            </p>
            {/* The two halves of learning are named apart here, because they
                are priced apart: Learn is free, Academy is bought. */}
            <p>
              Academy is the other half: structured paid programmes from TradingNew and outside
              providers, with certificates and live cohorts.
            </p>
          </div>
          <div className={styles.heroActions} style={{ marginTop: 16 }}>
            <Link className={styles.primary} href="/academy">
              Start learning
            </Link>
          </div>
        </div>
      </section>

      <EventSection
        title="Events"
        items={featured}
        action={
          <Link className={styles.sectionLink} href="/events">
            All events →
          </Link>
        }
      />
    </div>
  );
}
