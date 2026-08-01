/**
 * Calendar export.
 *
 * The rule that shapes this file: a calendar entry leaves TradingNew and lands
 * somewhere nobody here controls — a shared work calendar, a phone that syncs to
 * a laptop, a colleague's screen during a meeting. So the protected join link is
 * never written into it. The entry carries the event page instead, which asks who
 * is opening it.
 */

export type CalendarEvent = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  location: string;
  url: string;
  uid: string;
  status?: 'CONFIRMED' | 'CANCELLED';
};

/** ICS wants basic-format UTC: 20260806T150000Z. */
function stamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Backslash, semicolon, comma and newline all mean something to the ICS parser.
 * An unescaped one does not corrupt the file so much as change it — a description
 * containing "DTSTART" on its own line would otherwise be read as a property.
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** RFC 5545 caps lines at 75 octets; continuations start with a single space. */
function fold(line: string): string {
  if (line.length <= 75) return line;

  const chunks: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    chunks.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest) chunks.push(` ${rest}`);

  return chunks.join('\r\n');
}

export function buildIcs(event: CalendarEvent, generatedAt: Date): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TradingNew//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${stamp(generatedAt.toISOString())}`,
    `DTSTART:${stamp(event.startsAt)}`,
    `DTEND:${stamp(event.endsAt)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(`${event.description}\n\n${event.url}`)}`,
    `LOCATION:${escapeText(event.location)}`,
    `URL:${escapeText(event.url)}`,
    // The organizer's zone, carried as a comment rather than a VTIMEZONE block:
    // the instants above are absolute, so no client needs it to place the event.
    `X-TN-TIMEZONE:${escapeText(event.timezone)}`,
    `STATUS:${event.status ?? 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  // CRLF, not LF. Outlook is strict about it where most other clients are not.
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Google's template URL takes the same absolute instants. */
export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${stamp(event.startsAt)}/${stamp(event.endsAt)}`,
    details: `${event.description}\n\n${event.url}`,
    location: event.location,
    ctz: event.timezone,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Outlook reads the same ICS; the difference is only how it is delivered. */
export function icsFilename(slug: string): string {
  return `${slug.replace(/[^a-z0-9-]/gi, '-').slice(0, 60)}.ics`;
}

/**
 * What a calendar entry is allowed to say about where the event is. An online
 * event gets the page, never the room — see the note at the top of this file.
 */
export function calendarLocation(event: {
  format: 'in_person' | 'online' | 'hybrid';
  venueName: string | null;
  venueAddress: string | null;
  city: string | null;
  url: string;
}): string {
  if (event.format === 'online') return event.url;

  const parts = [event.venueName, event.venueAddress ?? event.city].filter(Boolean);
  return parts.length ? parts.join(', ') : event.url;
}
