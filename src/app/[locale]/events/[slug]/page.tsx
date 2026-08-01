import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { EventActions } from '@/components/events/EventActions';
import { badgeFor, Chip, FormatChip, PriceChip, TrustBadge } from '@/components/events/EventBadges';
import { EventCta } from '@/components/events/EventCta';
import { EventSection } from '@/components/events/EventSection';
import {
  bookmarkedIds,
  forViewer,
  getEvent,
  getOrganizer,
  registrationFor,
  summaries,
} from '@/lib/data/events';
import { availabilityLabel, priceLabel } from '@/lib/events/cta';
import { calendarLocation } from '@/lib/events/calendar';
import { paragraphs } from '@/lib/events/sanitize';
import { formatEventTimes } from '@/lib/events/time';
import {
  EVENT_KIND_LABEL,
  EXPERIENCE_LABEL,
  type ExperienceLevel,
  type TradingEvent,
} from '@/lib/events/types';
import { SITE_URL, pageMetadata } from '@/lib/metadata';
import { getSession } from '@/lib/session';
import { relatedLessons } from '@/lib/events/related';
import styles from '@/components/events/Events.module.css';

/**
 * One event.
 *
 * Public and indexable when published, invisible otherwise — a draft or a
 * rejected event returns a 404 rather than a login wall, because confirming that
 * a URL exists is itself a leak.
 */

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: Locale; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const event = await getEvent(slug, new Date());

  if (!event || event.status === 'draft' || event.status === 'pending_review') {
    return { title: 'Event not found', robots: { index: false, follow: false } };
  }

  const base = pageMetadata({
    href: { pathname: '/events/[slug]', params: { slug } },
    locale,
    title: event.title,
    description: event.shortDescription,
  });

  return {
    ...base,
    // Only a published event is offered to a search engine. Cancelled and
    // completed ones stay reachable by link but are not advertised.
    robots:
      event.status === 'published'
        ? { index: true, follow: true }
        : { index: false, follow: true },
  };
}

export default async function EventPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const now = new Date();
  const raw = await getEvent(slug, now);
  if (!raw) notFound();

  const session = await getSession();
  const userId = session?.user?.id ?? null;

  const registration = userId ? await registrationFor(userId, raw.id) : null;
  const organizer = await getOrganizer(
    (await getOrganizerSlug(raw)) ?? ''
  );
  const isOrganizer = Boolean(userId && raw.createdBy === userId);

  // Drafts and rejected events are not findable by URL.
  if (!['published', 'cancelled', 'completed'].includes(raw.status) && !isOrganizer) {
    notFound();
  }

  const event = forViewer(raw, { registration, isOrganizer }, now);
  const times = formatEventTimes({
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timezone: event.timezone,
  });

  const saved = userId ? await bookmarkedIds(userId) : new Set<string>();
  const all = await summaries(now);

  const related = all
    .filter(
      (candidate) =>
        candidate.id !== event.id &&
        candidate.status === 'published' &&
        Date.parse(candidate.endsAt) >= now.getTime() &&
        candidate.topics.some((topic) => event.topics.includes(topic))
    )
    .slice(0, 3);

  const lessons = relatedLessons(event.topics);
  const badge = badgeFor(event);
  const availability = availabilityLabel(event);

  return (
    <div className={styles.wrap}>
      <Link className={styles.backHome} href="/events">
        ← All events
      </Link>

      <div
        className={styles.detailCover}
        style={{ background: event.coverGradient ?? 'var(--tn-chip-bg)' }}
      >
        <div className={styles.detailCoverTop}>
          <TrustBadge kind={badge} />
        </div>
      </div>

      <div className={styles.detailChips}>
        <FormatChip format={event.format} city={event.city} />
        {event.topics.map((topic) => (
          <Chip key={topic}>{topic}</Chip>
        ))}
        <Chip>{EXPERIENCE_LABEL[event.experienceLevel]}</Chip>
        <Chip>{event.language.join(' · ')}</Chip>
        <Chip>{EVENT_KIND_LABEL[event.eventType]}</Chip>
      </div>

      <h1 className={styles.detailTitle}>{event.title}</h1>

      {event.status === 'cancelled' && (
        <div className={`${styles.notice} ${styles.noticeStop}`} style={{ marginTop: 16 }}>
          <p style={{ margin: 0 }}>
            <strong>This event has been cancelled.</strong>{' '}
            {event.cancellationReason ?? 'The organizer withdrew it.'}
          </p>
        </div>
      )}

      <EventActions
        eventId={event.id}
        slug={event.slug}
        title={event.title}
        saved={saved.has(event.id)}
        calendar={{
          title: event.title,
          description: event.shortDescription,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          timezone: event.timezone,
          location: calendarLocation({
            format: event.format,
            venueName: event.venueName,
            venueAddress: event.venueAddress,
            city: event.city,
            url: `${SITE_URL}/en/events/${event.slug}`,
          }),
          url: `${SITE_URL}/en/events/${event.slug}`,
          uid: `${event.id}@tradingnew.space`,
          status: event.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED',
        }}
      />

      <div className={styles.detailGrid}>
        <div>
          <section className={styles.panelCard}>
            <h2 className={styles.panelTitle}>About this event</h2>
            <div className={styles.prose}>
              {paragraphs(event.description).map((block, index) => (
                <p key={index}>{block}</p>
              ))}
            </div>
          </section>

          {event.learningOutcomes.length > 0 && (
            <section className={styles.panelCard}>
              <h2 className={styles.panelTitle}>What you will take away</h2>
              <ul className={styles.bullets}>
                {event.learningOutcomes.map((outcome) => (
                  <li key={outcome}>{outcome}</li>
                ))}
              </ul>
            </section>
          )}

          {event.intendedAudience && (
            <section className={styles.panelCard}>
              <h2 className={styles.panelTitle}>Who this is for</h2>
              <div className={styles.prose}>
                <p>{event.intendedAudience}</p>
              </div>
            </section>
          )}

          {event.agenda.length > 0 && (
            <section className={styles.panelCard}>
              <h2 className={styles.panelTitle}>Agenda</h2>
              {event.agenda.map((item) => (
                <div className={styles.agendaRow} key={item.id}>
                  <span className={styles.agendaTime}>{item.time}</span>
                  <div>
                    <div className={styles.agendaTitle}>{item.title}</div>
                    {(item.speaker || item.kind) && (
                      <div className={styles.agendaWho}>
                        {[item.speaker, item.kind].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </section>
          )}

          {event.speakers.length > 0 && (
            <section className={styles.panelCard}>
              <h2 className={styles.panelTitle}>Speakers</h2>
              {event.speakers.map((speaker) => (
                <div className={styles.speakerRow} key={speaker.id}>
                  <span className={styles.speakerAvatar} aria-hidden="true">
                    {speaker.initials}
                  </span>
                  <div>
                    <div className={styles.speakerName}>{speaker.name}</div>
                    <div className={styles.speakerRole}>
                      {[speaker.role, speaker.company].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}

          {event.format !== 'online' && event.venueName && (
            <section className={styles.panelCard}>
              <h2 className={styles.panelTitle}>Venue</h2>
              <div className={styles.prose}>
                <p>
                  <strong>{event.venueName}</strong>
                  <br />
                  {event.venueAddress}
                </p>
              </div>
              <div className={styles.venueMap} aria-hidden="true">
                {event.city ?? 'Venue location'}
              </div>
            </section>
          )}

          {event.importantNotice && (
            <div className={`${styles.notice} ${styles.noticeInfo}`} style={{ marginTop: 18 }}>
              <p style={{ margin: 0 }}>{event.importantNotice}</p>
            </div>
          )}
        </div>

        <aside>
          <div className={styles.panelCard}>
            <div className={styles.factRow}>
              <span className={styles.factKey}>Date</span>
              <span className={styles.factValue}>{times.dayLabel}</span>
            </div>
            <div className={styles.factRow}>
              <span className={styles.factKey}>Time</span>
              <span className={styles.factValue}>
                {times.local}
                <span className={styles.factSub}>Shown in the event&rsquo;s timezone</span>
              </span>
            </div>
            <div className={styles.factRow}>
              <span className={styles.factKey}>Format</span>
              <span className={styles.factValue}>
                {event.format === 'online' ? 'Online' : (event.city ?? 'In person')}
              </span>
            </div>
            <div className={styles.factRow}>
              <span className={styles.factKey}>Price</span>
              <span className={styles.factValue}>
                <PriceChip label={priceLabel(event)} />
              </span>
            </div>
            {availability && (
              <div className={styles.factRow}>
                <span className={styles.factKey}>Places</span>
                <span className={styles.factValue}>{availability}</span>
              </div>
            )}
            <div className={styles.factRow}>
              <span className={styles.factKey}>Organizer</span>
              <span className={styles.factValue}>
                {organizer ? (
                  <Link
                    href={{ pathname: '/organizers/[slug]', params: { slug: organizer.slug } }}
                  >
                    {organizer.name}
                  </Link>
                ) : (
                  'Unknown'
                )}
              </span>
            </div>

            <div style={{ marginTop: 18 }}>
              <EventCta
                eventId={event.id}
                slug={event.slug}
                title={event.title}
                status={event.status}
                priceType={event.priceType}
                sourceType={event.sourceType}
                startsAt={event.startsAt}
                endsAt={event.endsAt}
                registrationDeadline={event.registrationDeadline}
                capacity={event.capacity}
                registrationCount={event.registrationCount}
                waitlistEnabled={event.waitlistEnabled}
                format={event.format}
                externalUrl={event.externalUrl}
                externalDomain={event.externalDomain}
                externalTrusted={event.externalTrusted}
                onlineMeetingUrl={event.onlineMeetingUrl}
                registration={registration}
                viewer={
                  session?.user
                    ? {
                        name: session.user.name,
                        email: session.user.email,
                        level: null as ExperienceLevel | null,
                      }
                    : null
                }
              />
            </div>
          </div>

          {lessons.length > 0 && (
            <div className={styles.panelCard}>
              <h2 className={styles.panelTitle}>Learn this first</h2>
              <ul className={styles.bullets}>
                {lessons.map((lesson) => (
                  <li key={lesson.slug}>
                    <Link
                      href={{ pathname: '/academy/lesson/[slug]', params: { slug: lesson.slug } }}
                    >
                      {lesson.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      <EventSection title="Related events" items={related} savedIds={[...saved]} />

      {/* schema.org Event, so a search result carries the date, place and
          status rather than only a title. Emitted only for published events. */}
      {event.status !== 'draft' && event.status !== 'pending_review' && (
        <script
          type="application/ld+json"
          // The payload is built here from typed fields, never from user HTML.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData(event, organizer?.name)) }}
        />
      )}
    </div>
  );
}

async function getOrganizerSlug(event: TradingEvent): Promise<string | null> {
  const { SEED_ORGANIZERS } = await import('@/lib/events/seed');
  return SEED_ORGANIZERS.find((organizer) => organizer.id === event.organizerId)?.slug ?? null;
}

function structuredData(event: TradingEvent, organizerName?: string) {
  const url = `${SITE_URL}/en/events/${event.slug}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.shortDescription,
    startDate: event.startsAt,
    endDate: event.endsAt,
    eventAttendanceMode:
      event.format === 'online'
        ? 'https://schema.org/OnlineEventAttendanceMode'
        : event.format === 'hybrid'
          ? 'https://schema.org/MixedEventAttendanceMode'
          : 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus:
      event.status === 'cancelled'
        ? 'https://schema.org/EventCancelled'
        : 'https://schema.org/EventScheduled',
    url,
    image: event.coverImageUrl ?? undefined,
    organizer: organizerName ? { '@type': 'Organization', name: organizerName } : undefined,
    location:
      event.format === 'online'
        ? { '@type': 'VirtualLocation', url }
        : {
            '@type': 'Place',
            name: event.venueName ?? event.city ?? 'Venue',
            address: event.venueAddress ?? event.city ?? undefined,
          },
    offers:
      event.priceType === 'free'
        ? {
            '@type': 'Offer',
            price: 0,
            priceCurrency: 'EUR',
            availability: 'https://schema.org/InStock',
            url,
          }
        : event.priceAmount !== null
          ? {
              '@type': 'Offer',
              price: event.priceAmount,
              priceCurrency: event.currency ?? 'EUR',
              url: event.externalUrl ?? url,
            }
          : undefined,
  };
}
