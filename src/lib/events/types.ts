/**
 * The Events domain.
 *
 * Deliberately free of imports so the pure logic that sits on top of it — filter
 * serialisation, CTA state, URL validation, timezone formatting — can be compiled
 * and tested on its own, without a database, a session or a browser.
 *
 * Status and format are string unions rather than Postgres enums, matching the
 * rest of the schema: a `text` column with a documented set is what every other
 * table here uses, and it does not need a migration to gain a value.
 */

export type EventStatus =
  | 'draft'
  | 'pending_review'
  | 'changes_requested'
  | 'published'
  | 'rejected'
  | 'suspended'
  | 'cancelled'
  | 'completed';

/** Only `published` is ever served to the public catalogue or indexed. */
export const PUBLIC_STATUSES: EventStatus[] = ['published', 'cancelled', 'completed'];

export type EventVisibility = 'public' | 'unlisted';

export type EventFormat = 'in_person' | 'online' | 'hybrid';

export type EventSourceType = 'tradingnew' | 'community' | 'external';

export type OrganizerType = 'tradingnew' | 'individual' | 'company' | 'institution' | 'community';

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'suspended';

export type PriceType = 'free' | 'paid' | 'external';

export type RegistrationStatus = 'registered' | 'waitlisted' | 'cancelled' | 'attended' | 'no_show';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'all_levels';

export type EventKind =
  | 'conference'
  | 'meetup'
  | 'webinar'
  | 'workshop'
  | 'masterclass'
  | 'panel'
  | 'networking'
  | 'live_market_session';

export type EventSpeaker = {
  id: string;
  name: string;
  role: string;
  company: string | null;
  initials: string;
  avatarUrl: string | null;
  position: number;
};

export type EventAgendaItem = {
  id: string;
  /** Displayed as written by the organizer — "18:00", "+15 min", "Start". */
  time: string;
  title: string;
  speaker: string | null;
  kind: string | null;
  position: number;
};

export type Organizer = {
  id: string;
  slug: string;
  name: string;
  initials: string;
  type: OrganizerType;
  verificationStatus: VerificationStatus;
  description: string | null;
  website: string | null;
  country: string | null;
  followerCount: number;
  createdAt: string;
};

export type TradingEvent = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  /** A brand gradient in the demo; a real URL once uploads exist. */
  coverImageUrl: string | null;
  coverGradient: string | null;

  status: EventStatus;
  visibility: EventVisibility;
  format: EventFormat;
  eventType: EventKind;

  organizerId: string;
  organizerType: OrganizerType;
  verificationStatus: VerificationStatus;

  sourceType: EventSourceType;
  externalUrl: string | null;
  externalDomain: string | null;
  /** Whether an administrator has vetted the destination. */
  externalTrusted: boolean;

  /** UTC instants. The organizer's IANA zone is stored beside them, never folded in. */
  startsAt: string;
  endsAt: string;
  timezone: string;
  registrationDeadline: string | null;

  language: string[];
  country: string | null;
  city: string | null;
  venueName: string | null;
  venueAddress: string | null;
  /** Venue coordinates only. Attendee locations are never stored on an event. */
  latitude: number | null;
  longitude: number | null;
  /** Never serialised to an anonymous client or a public calendar export. */
  onlineMeetingUrl: string | null;

  capacity: number | null;
  registrationCount: number;
  waitlistCount: number;
  waitlistEnabled: boolean;

  priceType: PriceType;
  priceAmount: number | null;
  currency: string | null;

  experienceLevel: ExperienceLevel;
  topics: string[];
  markets: string[];
  tags: string[];

  learningOutcomes: string[];
  intendedAudience: string | null;
  importantNotice: string | null;

  agenda: EventAgendaItem[];
  speakers: EventSpeaker[];

  isFeatured: boolean;
  isPromoted: boolean;

  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  moderationReason: string | null;
  cancellationReason: string | null;
};

/** What a card needs. Descriptions and agendas are not fetched for a list. */
export type EventSummary = Pick<
  TradingEvent,
  | 'id'
  | 'slug'
  | 'title'
  | 'shortDescription'
  | 'coverImageUrl'
  | 'coverGradient'
  | 'status'
  | 'format'
  | 'eventType'
  | 'sourceType'
  | 'organizerType'
  | 'verificationStatus'
  | 'externalDomain'
  | 'externalTrusted'
  | 'startsAt'
  | 'endsAt'
  | 'timezone'
  | 'language'
  | 'country'
  | 'city'
  | 'venueName'
  | 'latitude'
  | 'longitude'
  | 'capacity'
  | 'registrationCount'
  | 'waitlistEnabled'
  | 'priceType'
  | 'priceAmount'
  | 'currency'
  | 'experienceLevel'
  | 'topics'
  | 'isPromoted'
> & {
  organizerName: string;
  organizerSlug: string;
  organizerInitials: string;
};

export type EventRegistration = {
  id: string;
  eventId: string;
  userId: string;
  status: RegistrationStatus;
  name: string;
  email: string;
  company: string | null;
  role: string | null;
  experienceLevel: ExperienceLevel | null;
  eventUpdatesConsent: boolean;
  termsAccepted: boolean;
  /** Position in the queue; null once promoted or if never waitlisted. */
  waitlistPosition: number | null;
  createdAt: string;
  updatedAt: string;
};

export type EventBookmark = {
  id: string;
  eventId: string;
  userId: string;
  createdAt: string;
};

export type EventReportReason =
  | 'fraud'
  | 'guaranteed_returns'
  | 'misleading_claims'
  | 'unlicensed_solicitation'
  | 'pump_and_dump'
  | 'pyramid_scheme'
  | 'illegal_activity'
  | 'incorrect_information'
  | 'unrelated_content'
  | 'abuse'
  | 'other';

export type EventReport = {
  id: string;
  eventId: string;
  reporterId: string | null;
  reason: EventReportReason;
  detail: string | null;
  resolved: boolean;
  createdAt: string;
};

export type ModerationAction =
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'changes_requested'
  | 'suspended'
  | 'restored'
  | 'cancelled';

/** Append-only. A moderation trail that can be edited is not a trail. */
export type EventModerationRecord = {
  id: string;
  eventId: string;
  actorId: string | null;
  action: ModerationAction;
  reason: string | null;
  createdAt: string;
};

export type EventNotificationKind =
  | 'registration_confirmed'
  | 'reminder_24h'
  | 'reminder_1h'
  | 'event_changed'
  | 'event_cancelled'
  | 'waitlist_promoted'
  | 'organizer_update'
  | 'organizer_new_event'
  | 'regional_event';

export type EventNotificationPreference = {
  userId: string;
  kind: EventNotificationKind;
  enabled: boolean;
};

export type EventAnalyticsSummary = {
  eventId: string;
  pageViews: number;
  cardViews: number;
  registrations: number;
  cancellations: number;
  saves: number;
  externalClicks: number;
  /** registrations ÷ page views, as a percentage. */
  conversion: number;
};

/* ------------------------------------------------------------ Vocabularies */

export const TOPICS = [
  'Investing basics',
  'Trading',
  'Technical analysis',
  'Macroeconomics',
  'Personal finance',
  'Wealth management',
  'Portfolio construction',
  'Risk management',
  'Stocks',
  'ETFs',
  'Options and derivatives',
  'Crypto and digital assets',
  'Fintech',
  'Regulation and taxation',
] as const;

export const LANGUAGES = ['EN', 'RU', 'EL', 'DE', 'FR', 'ES', 'JA'] as const;

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  conference: 'Conference',
  meetup: 'Meetup',
  webinar: 'Webinar',
  workshop: 'Workshop',
  masterclass: 'Masterclass',
  panel: 'Panel discussion',
  networking: 'Networking',
  live_market_session: 'Live market session',
};

export const EXPERIENCE_LABEL: Record<ExperienceLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  all_levels: 'All levels',
};

export const FORMAT_LABEL: Record<EventFormat, string> = {
  in_person: 'In person',
  online: 'Online',
  hybrid: 'Hybrid',
};

export const REPORT_REASON_LABEL: Record<EventReportReason, string> = {
  fraud: 'Fraud or scam',
  guaranteed_returns: 'Promises guaranteed returns',
  misleading_claims: 'Misleading financial claims',
  unlicensed_solicitation: 'Unlicensed investment solicitation',
  pump_and_dump: 'Pump-and-dump',
  pyramid_scheme: 'Pyramid or referral scheme',
  illegal_activity: 'Illegal financial activity',
  incorrect_information: 'Incorrect event information',
  unrelated_content: 'Unrelated to finance',
  abuse: 'Hate, abuse or harassment',
  other: 'Something else',
};

/**
 * The five things an organizer must affirm before an event can be submitted.
 * They exist because the moderation queue cannot catch what was never claimed.
 */
export const ORGANIZER_DECLARATIONS = [
  'The event is related to finance, investing or financial education',
  'All information provided is accurate',
  'The event does not promise guaranteed investment returns',
  'It is not a pump-and-dump, pyramid, referral or fraudulent scheme',
  'I have permission to use all uploaded images and speaker details',
] as const;
