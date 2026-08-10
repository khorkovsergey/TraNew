/**
 * The date ranges a dashboard query may ask for.
 *
 * Import-free, so the harness can check the boundaries.
 *
 * A closed set rather than a start and an end taken from the query string. Two
 * reasons, and the second is the one that matters: an open range is an
 * unbounded scan somebody can point at a growing table, and a fixed vocabulary
 * means every card in a screenshot is over the same window. A dashboard where
 * two panels quietly disagree about what "this week" meant is worse than one
 * with fewer choices.
 */

export const RANGES = {
  today: 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
} as const;

export type RangeKey = keyof typeof RANGES;

export const DEFAULT_RANGE: RangeKey = '7d';

/** The furthest back anything may look, whatever it asks for. */
export const MAX_LOOKBACK_MS = RANGES['90d'];

export function isRangeKey(value: string): value is RangeKey {
  return value in RANGES;
}

export function rangeFrom(raw: string | null, now = new Date()): { key: RangeKey; since: Date } | null {
  const key = raw ?? DEFAULT_RANGE;
  if (!isRangeKey(key)) return null;

  const span = Math.min(RANGES[key], MAX_LOOKBACK_MS);
  return { key, since: new Date(now.getTime() - span) };
}
