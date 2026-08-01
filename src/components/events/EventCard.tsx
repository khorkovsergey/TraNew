'use client';

import { Link } from '@/i18n/navigation';
import { availabilityLabel, priceLabel } from '@/lib/events/cta';
import { formatEventTimes } from '@/lib/events/time';
import { EXPERIENCE_LABEL, type EventSummary } from '@/lib/events/types';
import { badgeFor, Chip, FormatChip, PriceChip, PromotedLabel, TrustBadge } from './EventBadges';
import { SaveButton } from './SaveButton';
import styles from './Events.module.css';

/**
 * One event, as a card.
 *
 * It renders what it is given and owns nothing else. No fetching, no filter
 * state, no knowledge of which section it is in — the reason being that this
 * component appears on the hub, in search results, in My events, on an organizer
 * profile and beside an Academy lesson, and any business logic living here would
 * have to be true on all six.
 */

export type EventCardProps = {
  event: EventSummary;
  variant?: 'full' | 'compact';
  /** Undefined means "not known yet" and renders the neutral state. */
  saved?: boolean;
  registered?: boolean;
  waitlisted?: boolean;
  /** Why the recommender put it here, shown on the hub's first section. */
  reason?: string | null;
  viewerTimeZone?: string | null;
  onOpen?: (event: EventSummary) => void;
};

export function EventCard({
  event,
  variant = 'full',
  saved,
  registered,
  waitlisted,
  reason,
  viewerTimeZone,
  onOpen,
}: EventCardProps) {
  const times = formatEventTimes({
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timezone: event.timezone,
    viewerTimeZone,
  });

  const availability = availabilityLabel({
    capacity: event.capacity,
    registrationCount: event.registrationCount,
    status: event.status,
    waitlistEnabled: event.waitlistEnabled,
  });

  const price = priceLabel(event);
  const cancelled = event.status === 'cancelled';

  return (
    <article className={`${styles.card} ${variant === 'compact' ? styles.cardCompact : ''}`}>
      <div
        className={styles.cardCover}
        style={{ background: event.coverGradient ?? 'var(--tn-chip-bg)' }}
      >
        {event.coverImageUrl && (
          // Cards are below the fold on every screen that shows them.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.cardImage}
            src={event.coverImageUrl}
            alt=""
            loading="lazy"
            decoding="async"
          />
        )}

        <div className={styles.cardCoverTop}>
          <TrustBadge kind={badgeFor(event)} />
          {event.isPromoted && <PromotedLabel />}
        </div>

        <SaveButton eventId={event.id} slug={event.slug} title={event.title} saved={saved} />
      </div>

      <div className={styles.cardBody}>
        <div className={styles.cardWhen}>
          <span>{times.dayLabel}</span>
          <span className={styles.cardDot}>·</span>
          <span>{times.local}</span>
        </div>

        <h3 className={styles.cardTitle}>
          <Link
            className={styles.cardLink}
            href={{ pathname: '/events/[slug]', params: { slug: event.slug } }}
            onClick={() => onOpen?.(event)}
          >
            {event.title}
          </Link>
        </h3>

        {variant === 'full' && <p className={styles.cardSummary}>{event.shortDescription}</p>}

        <div className={styles.cardChips}>
          <FormatChip format={event.format} city={event.city} />
          {event.topics[0] && <Chip>{event.topics[0]}</Chip>}
          <Chip>{EXPERIENCE_LABEL[event.experienceLevel]}</Chip>
          <PriceChip label={price} />
        </div>

        {reason && <p className={styles.cardReason}>{reason}</p>}

        <div className={styles.cardFoot}>
          <span className={styles.cardOrganizer}>
            <span className={styles.cardAvatar} aria-hidden="true">
              {event.organizerInitials}
            </span>
            {event.organizerName}
          </span>

          {/* Status the viewer holds beats capacity: being registered is more
              useful to them than knowing how many places are left. */}
          {registered ? (
            <span className={styles.cardStateOk}>Registered</span>
          ) : waitlisted ? (
            <span className={styles.cardStateWait}>Waitlisted</span>
          ) : cancelled ? (
            <span className={styles.cardStateOff}>Cancelled</span>
          ) : (
            availability && <span className={styles.cardAvailability}>{availability}</span>
          )}
        </div>
      </div>
    </article>
  );
}

/** Same box, no content — so a loading list does not resize when it fills. */
export function EventCardSkeleton({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  return (
    <div
      className={`${styles.card} ${variant === 'compact' ? styles.cardCompact : ''} ${styles.skeleton}`}
      aria-hidden="true"
    >
      <div className={styles.cardCover} />
      <div className={styles.cardBody}>
        <span className={`${styles.skeletonLine} ${styles.skeletonShort}`} />
        <span className={styles.skeletonLine} />
        <span className={`${styles.skeletonLine} ${styles.skeletonShort}`} />
        <div className={styles.cardChips}>
          <span className={styles.skeletonChip} />
          <span className={styles.skeletonChip} />
        </div>
      </div>
    </div>
  );
}
