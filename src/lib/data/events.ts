import 'server-only';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db, isDatabaseConfigured, schema } from '@/db';
import { ctaFor, isFull } from '@/lib/events/cta';
import { dateRange, type EventFilters } from '@/lib/events/filters';
import { distanceKm, sortEvents, type RecommendationSignals } from '@/lib/events/recommend';
import { seedEvents, SEED_ORGANIZERS } from '@/lib/events/seed';
import type {
  EventStatus,
  EventSummary,
  Organizer,
  RegistrationStatus,
  TradingEvent,
} from '@/lib/events/types';

/**
 * Reading events.
 *
 * The catalogue is seeded — there is no events backend yet — while everything
 * personal (registrations, bookmarks, drafts) is real rows in Postgres. That
 * split is deliberate and visible: `catalogue()` never touches the database, so
 * the public pages render for an anonymous visitor with no connection at all,
 * and every function that does read the database says so by requiring a user id.
 *
 * Events created through the wizard are real rows too, and are merged into the
 * catalogue once published. So the seam is "who wrote it", not "which page".
 */

/** Cover the whole catalogue in one place so the swap to a real backend is here. */
export async function catalogue(now: Date): Promise<TradingEvent[]> {
  const seeded = seedEvents(now);
  if (!isDatabaseConfigured()) return seeded;

  try {
    const rows = await db
      .select()
      .from(schema.event)
      .where(inArray(schema.event.status, ['published', 'cancelled', 'completed']));

    const organizers = await organizerMap(rows.map((row) => row.organizerId));
    return [...seeded, ...rows.map((row) => toEvent(row, organizers))];
  } catch {
    // A catalogue that fails closed is a blank page. The seeded set is public
    // data with nothing personal in it, so serving it alone is the safe fallback.
    return seeded;
  }
}

export async function getEvent(slug: string, now: Date): Promise<TradingEvent | null> {
  const seeded = seedEvents(now).find((event) => event.slug === slug);
  if (seeded) return seeded;
  if (!isDatabaseConfigured()) return null;

  try {
    const [row] = await db.select().from(schema.event).where(eq(schema.event.slug, slug)).limit(1);
    if (!row) return null;

    const organizers = await organizerMap([row.organizerId]);
    return toEvent(row, organizers);
  } catch {
    return null;
  }
}

/** For the organizer's own view, which may legitimately see drafts. */
export async function getEventById(id: string, now: Date): Promise<TradingEvent | null> {
  const seeded = seedEvents(now).find((event) => event.id === id);
  if (seeded) return seeded;
  if (!isDatabaseConfigured()) return null;

  const [row] = await db.select().from(schema.event).where(eq(schema.event.id, id)).limit(1);
  if (!row) return null;

  const organizers = await organizerMap([row.organizerId]);
  return toEvent(row, organizers);
}

export async function getOrganizer(slug: string): Promise<Organizer | null> {
  const seeded = SEED_ORGANIZERS.find((organizer) => organizer.slug === slug);
  if (seeded) return seeded;
  if (!isDatabaseConfigured()) return null;

  try {
    const [row] = await db
      .select()
      .from(schema.organizer)
      .where(eq(schema.organizer.slug, slug))
      .limit(1);
    return row ? toOrganizer(row) : null;
  } catch {
    return null;
  }
}

async function organizerMap(ids: string[]): Promise<Map<string, Organizer>> {
  const map = new Map<string, Organizer>();
  for (const organizer of SEED_ORGANIZERS) map.set(organizer.id, organizer);

  const missing = [...new Set(ids)].filter((id) => !map.has(id));
  if (!missing.length || !isDatabaseConfigured()) return map;

  const rows = await db
    .select()
    .from(schema.organizer)
    .where(inArray(schema.organizer.id, missing));

  for (const row of rows) map.set(row.id, toOrganizer(row));
  return map;
}

/* ------------------------------------------------------------- Projections */

/**
 * The card projection. Note what is absent: description, agenda, speakers and
 * `onlineMeetingUrl`. A list of forty cards has no use for forty descriptions,
 * and the meeting link has no business leaving the server for a list at all.
 */
export function toSummary(event: TradingEvent, organizer: Organizer | null): EventSummary {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    shortDescription: event.shortDescription,
    coverImageUrl: event.coverImageUrl,
    coverGradient: event.coverGradient,
    status: event.status,
    format: event.format,
    eventType: event.eventType,
    sourceType: event.sourceType,
    organizerType: event.organizerType,
    verificationStatus: event.verificationStatus,
    externalDomain: event.externalDomain,
    externalTrusted: event.externalTrusted,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timezone: event.timezone,
    language: event.language,
    country: event.country,
    city: event.city,
    venueName: event.venueName,
    latitude: event.latitude,
    longitude: event.longitude,
    capacity: event.capacity,
    registrationCount: event.registrationCount,
    waitlistEnabled: event.waitlistEnabled,
    priceType: event.priceType,
    priceAmount: event.priceAmount,
    currency: event.currency,
    experienceLevel: event.experienceLevel,
    topics: event.topics,
    isPromoted: event.isPromoted,
    organizerName: organizer?.name ?? 'Unknown organizer',
    organizerSlug: organizer?.slug ?? '',
    organizerInitials: organizer?.initials ?? '??',
  };
}

/**
 * Strips what an anonymous or unregistered viewer must not receive. Done on the
 * server, at the boundary — a component deciding not to render the join link
 * still shipped it to the browser.
 */
export function forViewer(
  event: TradingEvent,
  viewer: { registration: RegistrationStatus | null; isOrganizer: boolean },
  now: Date
): TradingEvent {
  const cta = ctaFor({
    status: event.status,
    priceType: event.priceType,
    sourceType: event.sourceType,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    registrationDeadline: event.registrationDeadline,
    capacity: event.capacity,
    registrationCount: event.registrationCount,
    waitlistEnabled: event.waitlistEnabled,
    format: event.format,
    externalDomain: event.externalDomain,
    registration: viewer.registration,
    now,
  });

  // The room link travels only when the room is actually open to this person.
  const mayJoin = viewer.isOrganizer || cta.kind === 'join';

  return { ...event, onlineMeetingUrl: mayJoin ? event.onlineMeetingUrl : null };
}

export async function summaries(now: Date): Promise<EventSummary[]> {
  const events = await catalogue(now);
  const organizers = await organizerMap(events.map((event) => event.organizerId));
  return events.map((event) => toSummary(event, organizers.get(event.organizerId) ?? null));
}

/* ----------------------------------------------------------------- Queries */

export type CatalogueResult = {
  items: EventSummary[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export const PAGE_SIZE = 12;

/**
 * The catalogue query. Filtering happens here rather than in the page so that a
 * URL, a section on the hub and a test all get the same answer for the same
 * filters.
 */
export async function findEvents(
  filters: EventFilters,
  signals: RecommendationSignals,
  now: Date,
  options: { pageSize?: number; origin?: { latitude: number; longitude: number } | null } = {}
): Promise<CatalogueResult> {
  const pageSize = options.pageSize ?? PAGE_SIZE;
  const all = await summaries(now);
  const range = dateRange(filters, now);
  const needle = filters.q.trim().toLowerCase();

  const matched = all.filter((event) => {
    // Past events never appear in discovery, whatever else is selected.
    if (Date.parse(event.endsAt) < now.getTime()) return false;
    if (event.status !== 'published' && event.status !== 'cancelled') return false;

    if (range.from && Date.parse(event.startsAt) < range.from.getTime()) return false;
    if (range.to && Date.parse(event.startsAt) >= range.to.getTime()) return false;

    if (filters.onlineOnly && event.format === 'in_person') return false;
    if (filters.formats.length && !filters.formats.includes(event.format)) return false;
    if (filters.levels.length && !filters.levels.includes(event.experienceLevel)) return false;
    if (filters.types.length && !filters.types.includes(event.eventType)) return false;
    if (filters.sources.length && !filters.sources.includes(event.sourceType)) return false;

    if (filters.price === 'free' && event.priceType !== 'free') return false;
    if (filters.price === 'paid' && event.priceType === 'free') return false;
    if (filters.price === 'external' && event.priceType !== 'external') return false;

    if (filters.topics.length && !filters.topics.some((topic) => event.topics.includes(topic))) {
      return false;
    }

    if (
      filters.languages.length &&
      !filters.languages.some((language) => event.language.includes(language))
    ) {
      return false;
    }

    // A location filter must not hide online events — they are available from
    // anywhere, which is the whole point of the format.
    const placeless = event.format === 'online';
    if (filters.country && !placeless && event.country !== filters.country) return false;
    if (filters.city && !placeless && event.city !== filters.city) return false;

    if (filters.distance && options.origin && !placeless) {
      if (event.latitude === null || event.longitude === null) return false;
      const away = distanceKm(options.origin, {
        latitude: event.latitude,
        longitude: event.longitude,
      });
      if (away > filters.distance) return false;
    }

    if (needle) {
      const haystack = [
        event.title,
        event.shortDescription,
        event.organizerName,
        event.city,
        ...event.topics,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    return true;
  });

  const sorted = sortEvents(matched, filters.sort, signals, now);
  const start = (filters.page - 1) * pageSize;

  return {
    items: sorted.slice(0, start + pageSize),
    total: sorted.length,
    page: filters.page,
    pageSize,
    hasMore: sorted.length > start + pageSize,
  };
}

/* ------------------------------------------------- Personal state (real DB) */

export async function registrationsFor(
  userId: string,
  eventIds: string[]
): Promise<Map<string, RegistrationStatus>> {
  const map = new Map<string, RegistrationStatus>();
  if (!isDatabaseConfigured() || !eventIds.length) return map;

  try {
    const rows = await db
      .select()
      .from(schema.eventRegistration)
      .where(
        and(
          eq(schema.eventRegistration.userId, userId),
          inArray(schema.eventRegistration.eventId, eventIds)
        )
      );

    for (const row of rows) map.set(row.eventId, row.status as RegistrationStatus);
  } catch {
    /* Reading someone's registrations is not worth failing the page for. */
  }

  return map;
}

export async function registrationFor(
  userId: string,
  eventId: string
): Promise<RegistrationStatus | null> {
  const map = await registrationsFor(userId, [eventId]);
  return map.get(eventId) ?? null;
}

export async function bookmarkedIds(userId: string): Promise<Set<string>> {
  if (!isDatabaseConfigured()) return new Set();

  try {
    const rows = await db
      .select({ eventId: schema.eventBookmark.eventId })
      .from(schema.eventBookmark)
      .where(eq(schema.eventBookmark.userId, userId))
      .orderBy(desc(schema.eventBookmark.createdAt));

    return new Set(rows.map((row) => row.eventId));
  } catch {
    return new Set();
  }
}

/** Upcoming, saved and past for the My events page. */
export async function myEvents(userId: string, now: Date) {
  const all = await summaries(now);
  const byId = new Map(all.map((event) => [event.id, event]));

  const registrations = isDatabaseConfigured()
    ? await db
        .select()
        .from(schema.eventRegistration)
        .where(eq(schema.eventRegistration.userId, userId))
    : [];

  const saved = await bookmarkedIds(userId);
  const nowMs = now.getTime();

  const upcoming = registrations
    .filter((row) => row.status === 'registered' || row.status === 'waitlisted')
    .map((row) => ({ event: byId.get(row.eventId), status: row.status as RegistrationStatus }))
    .filter((entry): entry is { event: EventSummary; status: RegistrationStatus } =>
      Boolean(entry.event) && Date.parse(entry.event!.endsAt) >= nowMs
    )
    .sort((a, b) => Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt));

  const past = registrations
    .map((row) => ({ event: byId.get(row.eventId), status: row.status as RegistrationStatus }))
    .filter((entry): entry is { event: EventSummary; status: RegistrationStatus } =>
      Boolean(entry.event) && Date.parse(entry.event!.endsAt) < nowMs
    )
    .sort((a, b) => Date.parse(b.event.startsAt) - Date.parse(a.event.startsAt));

  return {
    upcoming,
    saved: [...saved].map((id) => byId.get(id)).filter((event): event is EventSummary => Boolean(event)),
    past,
  };
}

/* ------------------------------------------------------------------ Mapping */

type EventRow = typeof schema.event.$inferSelect;
type OrganizerRow = typeof schema.organizer.$inferSelect;

function toOrganizer(row: OrganizerRow): Organizer {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    initials: row.initials,
    type: row.type as Organizer['type'],
    verificationStatus: row.verificationStatus as Organizer['verificationStatus'],
    description: row.description,
    website: row.website,
    country: row.country,
    followerCount: row.followerCount,
    createdAt: row.createdAt.toISOString(),
  };
}

function toEvent(row: EventRow, organizers: Map<string, Organizer>): TradingEvent {
  const organizer = organizers.get(row.organizerId);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortDescription: row.shortDescription,
    description: row.description,
    coverImageUrl: row.coverImageUrl,
    coverGradient: row.coverGradient,
    status: row.status as EventStatus,
    visibility: row.visibility as TradingEvent['visibility'],
    format: row.format as TradingEvent['format'],
    eventType: row.eventType as TradingEvent['eventType'],
    organizerId: row.organizerId,
    organizerType: organizer?.type ?? 'community',
    verificationStatus: organizer?.verificationStatus ?? 'unverified',
    sourceType: row.sourceType as TradingEvent['sourceType'],
    externalUrl: row.externalUrl,
    externalDomain: row.externalDomain,
    externalTrusted: row.externalTrusted,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    timezone: row.timezone,
    registrationDeadline: row.registrationDeadline?.toISOString() ?? null,
    language: row.language ?? ['EN'],
    country: row.country,
    city: row.city,
    venueName: row.venueName,
    venueAddress: row.venueAddress,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    onlineMeetingUrl: row.onlineMeetingUrl,
    capacity: row.capacity,
    registrationCount: row.registrationCount,
    waitlistCount: row.waitlistCount,
    waitlistEnabled: row.waitlistEnabled,
    priceType: row.priceType as TradingEvent['priceType'],
    priceAmount: row.priceAmount,
    currency: row.currency,
    experienceLevel: row.experienceLevel as TradingEvent['experienceLevel'],
    topics: row.topics ?? [],
    markets: row.markets ?? [],
    tags: row.tags ?? [],
    learningOutcomes: row.learningOutcomes ?? [],
    intendedAudience: row.intendedAudience,
    importantNotice: row.importantNotice,
    agenda: row.agenda ?? [],
    speakers: row.speakers ?? [],
    isFeatured: row.isFeatured,
    isPromoted: row.isPromoted,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    moderationReason: row.moderationReason,
    cancellationReason: row.cancellationReason,
  };
}

/** Re-exported so pages do not have to reach into two modules for one decision. */
export { isFull };
