/**
 * Event time.
 *
 * Instants are stored in UTC and the organizer's IANA zone is stored beside them.
 * A fixed offset would be wrong twice a year: an event created in January for a
 * date in July would drift by an hour, and nothing in the record would show why.
 * `Intl` resolves the zone against the actual instant, so daylight saving is
 * handled by the platform rather than by arithmetic here.
 */

export type EventTimes = {
  /** As the organizer scheduled it, in the venue's own zone. */
  local: string;
  localZone: string;
  /** The same instant where the reader is, present only when it differs. */
  viewer: string | null;
  viewerZone: string | null;
  dayLabel: string;
  isoStart: string;
  isoEnd: string;
};

function parts(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone }).format(date);
}

/** "EET", "GMT+3" — whatever the zone actually calls itself on that date. */
export function zoneAbbreviation(date: Date, timeZone: string): string {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    timeZoneName: 'short',
  }).formatToParts(date);

  return formatted.find((part) => part.type === 'timeZoneName')?.value ?? timeZone;
}

/** Same wall-clock time in both zones means there is nothing to disambiguate. */
export function sameWallClock(date: Date, a: string, b: string): boolean {
  const shape: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
  return parts(date, a, shape) === parts(date, b, shape);
}

export function formatEventTimes(input: {
  startsAt: string;
  endsAt: string;
  timezone: string;
  viewerTimeZone?: string | null;
}): EventTimes {
  const start = new Date(input.startsAt);
  const end = new Date(input.endsAt);
  const zone = input.timezone;

  const day = parts(start, zone, { weekday: 'short', day: 'numeric', month: 'short' });
  const startTime = parts(start, zone, { hour: '2-digit', minute: '2-digit', hour12: false });
  const endTime = parts(end, zone, { hour: '2-digit', minute: '2-digit', hour12: false });
  const abbreviation = zoneAbbreviation(start, zone);

  const viewerZone = input.viewerTimeZone ?? null;
  const differs = viewerZone !== null && viewerZone !== zone && !sameWallClock(start, zone, viewerZone);

  return {
    local: `${startTime}–${endTime} ${abbreviation}`,
    localZone: zone,
    viewer: differs
      ? `${parts(start, viewerZone, { hour: '2-digit', minute: '2-digit', hour12: false })}–` +
        `${parts(end, viewerZone, { hour: '2-digit', minute: '2-digit', hour12: false })} ` +
        `${zoneAbbreviation(start, viewerZone)}`
      : null,
    viewerZone: differs ? viewerZone : null,
    dayLabel: day,
    isoStart: start.toISOString(),
    isoEnd: end.toISOString(),
  };
}

/** "Wednesday, 6 August" — the heading a calendar day gets. */
export function formatDayHeading(iso: string, timeZone: string): string {
  return parts(new Date(iso), timeZone, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** Groups events into days in the venue's zone, so nothing lands on the wrong date. */
export function groupByDay<T extends { startsAt: string; timezone: string }>(
  items: T[]
): Array<{ key: string; heading: string; items: T[] }> {
  const days = new Map<string, { heading: string; items: T[] }>();

  for (const item of items) {
    const date = new Date(item.startsAt);
    const key = new Intl.DateTimeFormat('en-CA', {
      timeZone: item.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);

    const bucket = days.get(key);
    if (bucket) bucket.items.push(item);
    else days.set(key, { heading: formatDayHeading(item.startsAt, item.timezone), items: [item] });
  }

  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({ key, ...value }));
}

/** "in 3 days", "tomorrow", "started 20 minutes ago". */
export function relativeTo(iso: string, now: Date): string {
  const diff = Date.parse(iso) - now.getTime();
  const minutes = Math.round(diff / 60_000);
  const format = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' });

  if (Math.abs(minutes) < 60) return format.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return format.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return format.format(days, 'day');
  return format.format(Math.round(days / 30), 'month');
}

/** The list of zones the create wizard offers, common ones first. */
export const COMMON_TIMEZONES = [
  'Europe/Nicosia',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Athens',
  'Europe/Lisbon',
  'Europe/Zurich',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Australia/Sydney',
  'UTC',
] as const;

export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
