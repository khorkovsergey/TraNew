import type {
  EventFormat,
  EventSourceType,
  OrganizerType,
  VerificationStatus,
} from '@/lib/events/types';
import styles from './Events.module.css';

/**
 * Trust badges.
 *
 * These are the only thing on a card that tells someone whether TradingNew stands
 * behind an event, so they are computed from the record rather than passed in as
 * a label: a component that accepts `badge="official"` as a prop is one careless
 * call away from a community event wearing the platform's own name.
 */

export type BadgeKind = 'official' | 'verified' | 'community' | 'external';

export function badgeFor(event: {
  sourceType: EventSourceType;
  organizerType: OrganizerType;
  verificationStatus: VerificationStatus;
}): BadgeKind {
  if (event.sourceType === 'external') return 'external';
  if (event.sourceType === 'tradingnew' || event.organizerType === 'tradingnew') return 'official';
  if (event.verificationStatus === 'verified') return 'verified';
  return 'community';
}

const BADGE_LABEL: Record<BadgeKind, string> = {
  official: 'TradingNew official',
  verified: 'Verified organizer',
  community: 'Community event',
  external: 'External event',
};

const BADGE_CLASS: Record<BadgeKind, string> = {
  official: styles.badgeOfficial,
  verified: styles.badgeVerified,
  community: styles.badgeCommunity,
  external: styles.badgeExternal,
};

export function TrustBadge({ kind }: { kind: BadgeKind }) {
  return <span className={`${styles.badge} ${BADGE_CLASS[kind]}`}>{BADGE_LABEL[kind]}</span>;
}

const FORMAT_CLASS: Record<EventFormat, string> = {
  in_person: styles.formatInPerson,
  online: styles.formatOnline,
  hybrid: styles.formatHybrid,
};

const FORMAT_TEXT: Record<EventFormat, string> = {
  in_person: 'In person',
  online: 'Online',
  hybrid: 'Hybrid',
};

/**
 * An online event has no place, so it does not get one printed twice. A hybrid
 * one names its city because "Hybrid" alone does not tell you whether you could
 * turn up.
 */
export function FormatChip({ format, city }: { format: EventFormat; city: string | null }) {
  const label =
    format === 'online' || !city
      ? FORMAT_TEXT[format]
      : `${FORMAT_TEXT[format]} · ${city}${format === 'hybrid' ? ' + Online' : ''}`;

  return <span className={`${styles.chip} ${FORMAT_CLASS[format]}`}>{label}</span>;
}

export function PriceChip({ label }: { label: string }) {
  const free = label === 'Free';
  return <span className={`${styles.chip} ${free ? styles.chipFree : ''}`}>{label}</span>;
}

export function Chip({ children }: { children: React.ReactNode }) {
  return <span className={styles.chip}>{children}</span>;
}

/** Paid placement, labelled as such. An unlabelled one is an advertisement. */
export function PromotedLabel() {
  return <span className={styles.promoted}>Promoted</span>;
}
