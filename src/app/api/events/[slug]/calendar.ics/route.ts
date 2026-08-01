import { NextResponse, type NextRequest } from 'next/server';
import { getEvent } from '@/lib/data/events';
import { buildIcs, calendarLocation, icsFilename } from '@/lib/events/calendar';
import { SITE_URL } from '@/lib/metadata';

/**
 * The calendar file.
 *
 * A route rather than a blob assembled in the browser, for one reason: the
 * server decides what goes in it. The joining link for an online event is on the
 * record and must not be in the file, and the only way to guarantee that is for
 * the file never to be built anywhere the link is available.
 */

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const event = await getEvent(slug, new Date());

  if (!event || event.status === 'draft' || event.status === 'pending_review') {
    return new NextResponse('Not found', { status: 404 });
  }

  const url = `${SITE_URL}/en/events/${event.slug}`;

  const ics = buildIcs(
    {
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
        url,
      }),
      url,
      uid: `${event.id}@tradingnew.space`,
      status: event.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED',
    },
    new Date()
  );

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${icsFilename(event.slug)}"`,
      // Public data, but the file names an event whose details can change.
      'Cache-Control': 'public, max-age=300',
    },
  });
}
