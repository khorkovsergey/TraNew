import type { EventSummary } from './types';

/**
 * Why an event is where it is in the list.
 *
 * There is no recommendation engine behind this, so the ordering is a small set
 * of rules with visible weights rather than a model. That is the honest version
 * for a first release, and it has a property a model would not: every position
 * can be explained to the person looking at it, which is what `explain()` below
 * returns and what the UI shows on request.
 *
 * Kept out of the components on purpose. Ranking that lives in a render function
 * is ranking nobody can test or change without touching the page.
 */

export type RecommendationSignals = {
  city: string | null;
  country: string | null;
  /** Topics from the Academy path, saved objects and stated interests. */
  topics: string[];
  /** Symbols and markets the person follows, mapped to event markets. */
  markets: string[];
  level: 'beginner' | 'intermediate' | 'advanced' | 'all_levels' | null;
  languages: string[];
  /** Lessons completed — a proxy for how far along someone is. */
  academyLessons: number;
};

export const NO_SIGNALS: RecommendationSignals = {
  city: null,
  country: null,
  topics: [],
  markets: [],
  level: null,
  languages: [],
  academyLessons: 0,
};

type Weight = { key: string; points: number; reason: string };

const WEIGHTS = {
  sameCity: 30,
  sameCountry: 12,
  online: 8,
  topicMatch: 22,
  marketMatch: 10,
  levelMatch: 12,
  levelAllLevels: 5,
  languageMatch: 8,
  official: 10,
  verified: 6,
  popularity: 12,
  soon: 14,
  freshness: 6,
  free: 4,
  promoted: 3,
} as const;

/**
 * Scores one event. Returns the weights that fired, not just the total, so the
 * explanation and the number can never drift apart.
 */
export function scoreEvent(
  event: EventSummary,
  signals: RecommendationSignals,
  now: Date
): { score: number; weights: Weight[] } {
  const weights: Weight[] = [];
  const add = (key: keyof typeof WEIGHTS, reason: string, factor = 1) => {
    const points = Math.round(WEIGHTS[key] * factor);
    if (points > 0) weights.push({ key, points, reason });
  };

  if (signals.city && event.city && event.city.toLowerCase() === signals.city.toLowerCase()) {
    add('sameCity', `In ${event.city}`);
  } else if (
    signals.country &&
    event.country &&
    event.country.toLowerCase() === signals.country.toLowerCase()
  ) {
    add('sameCountry', `In ${event.country}`);
  } else if (event.format === 'online') {
    add('online', 'Online, so location does not matter');
  }

  const topicHits = event.topics.filter((topic) =>
    signals.topics.some((interest) => interest.toLowerCase() === topic.toLowerCase())
  );
  if (topicHits.length) {
    // Diminishing: three matching topics is not three times as relevant as one.
    add('topicMatch', `Matches your interest in ${topicHits[0]}`, Math.min(1, topicHits.length / 2));
  }

  if (signals.markets.length && event.topics.some((topic) => signals.markets.includes(topic))) {
    add('marketMatch', 'Covers a market you follow');
  }

  if (signals.level && event.experienceLevel === signals.level) {
    add('levelMatch', `Pitched at ${signals.level.replace('_', ' ')}`);
  } else if (event.experienceLevel === 'all_levels') {
    add('levelAllLevels', 'Open to all levels');
  }

  if (signals.languages.length && event.language.some((lang) => signals.languages.includes(lang))) {
    add('languageMatch', 'In a language you read');
  }

  if (event.sourceType === 'tradingnew') add('official', 'Run by TradingNew');
  else if (event.verificationStatus === 'verified') add('verified', 'Verified organizer');

  if (event.registrationCount > 0) {
    // log10 so a 4,000-person webinar does not bury everything local.
    add('popularity', 'Popular with other members', Math.min(1, Math.log10(event.registrationCount + 1) / 3));
  }

  const days = (Date.parse(event.startsAt) - now.getTime()) / 86_400_000;
  if (days >= 0 && days <= 14) {
    add('soon', days < 1 ? 'Happening today' : `In ${Math.round(days)} days`, 1 - days / 20);
  }

  if (event.priceType === 'free') add('free', 'Free to attend');
  if (event.isPromoted) add('promoted', 'Promoted');

  // A beginner who has done nothing in Academy is nudged toward beginner events.
  if (signals.academyLessons === 0 && event.experienceLevel === 'beginner') {
    add('freshness', 'A good starting point');
  }

  return { score: weights.reduce((total, weight) => total + weight.points, 0), weights };
}

export type RankedEvent = { event: EventSummary; score: number; reasons: string[] };

export function rankEvents(
  events: EventSummary[],
  signals: RecommendationSignals,
  now: Date
): RankedEvent[] {
  return events
    .map((event) => {
      const { score, weights } = scoreEvent(event, signals, now);
      return {
        event,
        score,
        reasons: weights
          .sort((a, b) => b.points - a.points)
          .slice(0, 2)
          .map((weight) => weight.reason),
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // A stable second key, so equal scores do not shuffle between renders.
      return Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt);
    });
}

/** One sentence for the "Why am I seeing this?" affordance on a card. */
export function explain(ranked: RankedEvent): string {
  if (!ranked.reasons.length) return 'Shown because it is coming up soon.';
  return `Shown because: ${ranked.reasons.join(' · ').toLowerCase()}.`;
}

export type SortOrder = 'recommended' | 'soonest' | 'nearest' | 'popular' | 'newest';

/** The other four orders, so every sort option goes through one place. */
export function sortEvents(
  events: EventSummary[],
  order: SortOrder,
  signals: RecommendationSignals,
  now: Date
): EventSummary[] {
  const copy = [...events];

  switch (order) {
    case 'soonest':
      return copy.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    case 'popular':
      return copy.sort((a, b) => b.registrationCount - a.registrationCount);
    case 'newest':
      return copy.sort((a, b) => b.id.localeCompare(a.id));
    case 'nearest':
      // Without coordinates for the viewer, "nearest" means their own city, then
      // their country, then online, then everything else — which is the ordering
      // people actually mean when they pick it.
      return copy.sort((a, b) => proximity(a, signals) - proximity(b, signals));
    default:
      return rankEvents(copy, signals, now).map((ranked) => ranked.event);
  }
}

function proximity(event: EventSummary, signals: RecommendationSignals): number {
  if (signals.city && event.city?.toLowerCase() === signals.city.toLowerCase()) return 0;
  if (signals.country && event.country?.toLowerCase() === signals.country.toLowerCase()) return 1;
  if (event.format === 'online') return 2;
  return 3;
}

/** Great-circle distance in kilometres, for the distance filter. */
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6371;

  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}
