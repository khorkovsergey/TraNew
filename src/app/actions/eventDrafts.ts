'use server';

import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, isDatabaseConfigured, schema } from '@/db';
import { canCreateOfficialEvent, canSubmitForReview } from '@/lib/events/access';
import { currentActor } from '@/lib/events/actor';
import { checkRate, RATE_LIMITS } from '@/lib/events/rateLimit';
import { checkExternalUrl } from '@/lib/events/externalUrl';
import { cleanLine, cleanList, cleanText, LIMITS, slugify } from '@/lib/events/sanitize';
import { isValidTimeZone } from '@/lib/events/time';
import { ORGANIZER_DECLARATIONS } from '@/lib/events/types';
import type { ActionResult } from './events';

/**
 * Creating an event.
 *
 * The wizard autosaves a draft on every step, which means most of what arrives
 * here is incomplete on purpose — `saveDraft` therefore validates nothing beyond
 * length and shape. `submitForReview` is where the rules live, because that is
 * the moment the content becomes something other people will see.
 *
 * Community organizers cannot publish. They submit; a moderator decides. That is
 * the whole reason the queue exists, so it is enforced here rather than by which
 * button the interface happens to render.
 */

export type DraftPayload = {
  title: string;
  shortDescription: string;
  description: string;
  topics: string[];
  experienceLevel: string;
  language: string[];
  eventType: string;
  format: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  country: string;
  city: string;
  venueName: string;
  venueAddress: string;
  onlineMeetingUrl: string;
  learningOutcomes: string[];
  intendedAudience: string;
  agenda: Array<{ time: string; title: string; speaker: string; kind: string }>;
  speakers: Array<{ name: string; role: string; company: string }>;
  registrationModel: 'tradingnew' | 'external';
  externalUrl: string;
  capacity: string;
  waitlistEnabled: boolean;
  priceType: 'free' | 'paid';
  priceAmount: string;
  currency: string;
  coverGradient: string;
  declarations: boolean[];
};

const TRUSTED_DOMAINS = (process.env.EVENTS_TRUSTED_DOMAINS ?? '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

/** Everything the wizard sends, cut to length and stripped of the invisible. */
function clean(payload: Partial<DraftPayload>): DraftPayload {
  return {
    title: cleanLine(payload.title, LIMITS.title),
    shortDescription: cleanLine(payload.shortDescription, LIMITS.shortDescription),
    description: cleanText(payload.description, LIMITS.description),
    topics: cleanList(payload.topics, 60, 5),
    experienceLevel: cleanLine(payload.experienceLevel, 20) || 'all_levels',
    language: cleanList(payload.language, 4, 4),
    eventType: cleanLine(payload.eventType, 30) || 'meetup',
    format: cleanLine(payload.format, 20) || 'online',
    startsAt: cleanLine(payload.startsAt, 40),
    endsAt: cleanLine(payload.endsAt, 40),
    timezone: cleanLine(payload.timezone, 60) || 'UTC',
    country: cleanLine(payload.country, 60),
    city: cleanLine(payload.city, 60),
    venueName: cleanLine(payload.venueName, LIMITS.venueName),
    venueAddress: cleanLine(payload.venueAddress, LIMITS.venueAddress),
    onlineMeetingUrl: cleanLine(payload.onlineMeetingUrl, 500),
    learningOutcomes: cleanList(payload.learningOutcomes, LIMITS.outcome, 6),
    intendedAudience: cleanText(payload.intendedAudience, 600),
    agenda: (Array.isArray(payload.agenda) ? payload.agenda : []).slice(0, 20).map((item) => ({
      time: cleanLine(item?.time, 20),
      title: cleanLine(item?.title, LIMITS.agendaTitle),
      speaker: cleanLine(item?.speaker, LIMITS.speakerName),
      kind: cleanLine(item?.kind, 40),
    })),
    speakers: (Array.isArray(payload.speakers) ? payload.speakers : []).slice(0, 12).map((item) => ({
      name: cleanLine(item?.name, LIMITS.speakerName),
      role: cleanLine(item?.role, LIMITS.speakerName),
      company: cleanLine(item?.company, LIMITS.speakerName),
    })),
    registrationModel: payload.registrationModel === 'external' ? 'external' : 'tradingnew',
    externalUrl: cleanLine(payload.externalUrl, 2048),
    capacity: cleanLine(payload.capacity, 8),
    waitlistEnabled: Boolean(payload.waitlistEnabled),
    priceType: payload.priceType === 'paid' ? 'paid' : 'free',
    priceAmount: cleanLine(payload.priceAmount, 12),
    currency: cleanLine(payload.currency, 3) || 'EUR',
    coverGradient: cleanLine(payload.coverGradient, 200),
    declarations: Array.isArray(payload.declarations)
      ? ORGANIZER_DECLARATIONS.map((_, index) => Boolean(payload.declarations?.[index]))
      : ORGANIZER_DECLARATIONS.map(() => false),
  };
}

export async function saveDraftAction(input: {
  draftId: string | null;
  step: number;
  payload: Partial<DraftPayload>;
}): Promise<ActionResult<{ draftId: string; savedAt: string }>> {
  const actor = await currentActor();
  if (!actor) return { status: 'sign_in_required' };
  if (!isDatabaseConfigured()) {
    return { status: 'unavailable', message: 'Drafts need a database, which is not connected here.' };
  }

  const payload = clean(input.payload);
  const step = Math.min(4, Math.max(0, Math.trunc(input.step)));
  const now = new Date();

  if (input.draftId) {
    const [existing] = await db
      .select()
      .from(schema.eventDraft)
      .where(and(eq(schema.eventDraft.id, input.draftId), eq(schema.eventDraft.userId, actor.id)))
      .limit(1);

    if (existing) {
      await db
        .update(schema.eventDraft)
        .set({ payload, step, updatedAt: now })
        .where(eq(schema.eventDraft.id, existing.id));

      return { status: 'ok', data: { draftId: existing.id, savedAt: now.toISOString() } };
    }
  }

  const id = randomUUID();
  await db.insert(schema.eventDraft).values({
    id,
    userId: actor.id,
    payload,
    step,
    updatedAt: now,
  });

  return { status: 'ok', data: { draftId: id, savedAt: now.toISOString() } };
}

export async function loadDraftAction(): Promise<DraftPayload & { draftId: string; step: number } | null> {
  const actor = await currentActor();
  if (!actor || !isDatabaseConfigured()) return null;

  try {
    const [row] = await db
      .select()
      .from(schema.eventDraft)
      .where(eq(schema.eventDraft.userId, actor.id))
      .orderBy(desc(schema.eventDraft.updatedAt))
      .limit(1);

    if (!row) return null;
    return { ...(row.payload as DraftPayload), draftId: row.id, step: row.step };
  } catch {
    return null;
  }
}

export type SubmitProblem = { field: string; message: string };

/**
 * Turns a draft into a pending event, or explains why it cannot be one.
 *
 * Every problem is returned at once rather than one at a time: sending someone
 * back through five steps to be told about a second missing field is a way of
 * making them give up.
 */
export async function submitEventAction(input: {
  draftId: string;
}): Promise<ActionResult<{ slug: string; status: string }> & { problems?: SubmitProblem[] }> {
  const actor = await currentActor();
  if (!actor) return { status: 'sign_in_required' };
  if (!isDatabaseConfigured()) {
    return { status: 'unavailable', message: 'Publishing needs a database, which is not connected here.' };
  }

  const limited = await checkRate(
    `event-create:${actor.id}`,
    RATE_LIMITS.eventCreate.limit,
    RATE_LIMITS.eventCreate.windowMs
  );
  if (!limited.allowed) {
    return { status: 'error', message: 'You have submitted several events today. Try again tomorrow.' };
  }

  const [draft] = await db
    .select()
    .from(schema.eventDraft)
    .where(and(eq(schema.eventDraft.id, input.draftId), eq(schema.eventDraft.userId, actor.id)))
    .limit(1);

  if (!draft) return { status: 'error', message: 'That draft no longer exists.' };

  const payload = clean(draft.payload as Partial<DraftPayload>);
  const problems = validate(payload);

  if (problems.length) {
    return { status: 'error', message: 'Some details still need fixing.', problems };
  }

  const organizerId = await ensureOrganizer(actor.id);
  const slug = slugify(payload.title, randomUUID().slice(0, 6));
  const eventId = randomUUID();
  const now = new Date();

  const external = payload.registrationModel === 'external';
  const check = external ? checkExternalUrl(payload.externalUrl, TRUSTED_DOMAINS) : null;

  await db.insert(schema.event).values({
    id: eventId,
    slug,
    title: payload.title,
    shortDescription: payload.shortDescription,
    description: payload.description,
    coverGradient: payload.coverGradient || 'linear-gradient(135deg,#2962ff,#8b5cf6)',
    // Never `published`, whatever the client sent. Only a moderator moves it.
    status: 'pending_review',
    visibility: 'public',
    format: payload.format,
    eventType: payload.eventType,
    organizerId,
    sourceType: external ? 'external' : 'community',
    externalUrl: check?.ok ? check.url : null,
    externalDomain: check?.ok ? check.domain : null,
    externalTrusted: check?.ok ? check.trusted : false,
    startsAt: new Date(payload.startsAt),
    endsAt: new Date(payload.endsAt),
    timezone: payload.timezone,
    language: payload.language.length ? payload.language : ['EN'],
    country: payload.country || null,
    city: payload.city || null,
    venueName: payload.venueName || null,
    venueAddress: payload.venueAddress || null,
    onlineMeetingUrl: payload.onlineMeetingUrl || null,
    capacity: payload.capacity ? Number.parseInt(payload.capacity, 10) : null,
    registrationCount: 0,
    waitlistCount: 0,
    waitlistEnabled: payload.waitlistEnabled,
    priceType: external ? 'external' : payload.priceType,
    priceAmount: payload.priceAmount ? Number.parseInt(payload.priceAmount, 10) : null,
    currency: payload.currency,
    experienceLevel: payload.experienceLevel,
    topics: payload.topics,
    learningOutcomes: payload.learningOutcomes,
    intendedAudience: payload.intendedAudience || null,
    agenda: payload.agenda.map((item, position) => ({
      id: `ag_${position}`,
      time: item.time,
      title: item.title,
      speaker: item.speaker || null,
      kind: item.kind || null,
      position,
    })),
    speakers: payload.speakers.map((item, position) => ({
      id: `sp_${position}`,
      name: item.name,
      role: item.role,
      company: item.company || null,
      initials: initialsOf(item.name),
      avatarUrl: null,
      position,
    })),
    createdBy: actor.id,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.eventModeration).values({
    id: randomUUID(),
    eventId,
    actorId: actor.id,
    action: 'submitted',
    reason: null,
    createdAt: now,
  });

  await db.delete(schema.eventDraft).where(eq(schema.eventDraft.id, draft.id));

  revalidatePath('/en/events/manage');
  return { status: 'ok', data: { slug, status: 'pending_review' } };
}

function validate(payload: DraftPayload): SubmitProblem[] {
  const problems: SubmitProblem[] = [];
  const need = (field: string, value: string, message: string) => {
    if (!value.trim()) problems.push({ field, message });
  };

  need('title', payload.title, 'Give the event a title.');
  need('shortDescription', payload.shortDescription, 'Write a one-line summary.');
  need('description', payload.description, 'Describe what happens at the event.');

  if (payload.description.length < 80) {
    problems.push({
      field: 'description',
      message: 'The description is too short to tell anyone what to expect.',
    });
  }

  if (!payload.topics.length) problems.push({ field: 'topics', message: 'Choose at least one topic.' });

  const start = Date.parse(payload.startsAt);
  const end = Date.parse(payload.endsAt);

  if (!Number.isFinite(start)) problems.push({ field: 'startsAt', message: 'Set a start date and time.' });
  if (!Number.isFinite(end)) problems.push({ field: 'endsAt', message: 'Set an end date and time.' });
  if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
    problems.push({ field: 'endsAt', message: 'The event has to end after it starts.' });
  }
  if (Number.isFinite(start) && start < Date.now()) {
    problems.push({ field: 'startsAt', message: 'The start is in the past.' });
  }
  if (!isValidTimeZone(payload.timezone)) {
    problems.push({ field: 'timezone', message: 'Choose the timezone the event runs in.' });
  }

  if (payload.format !== 'online') {
    need('city', payload.city, 'Say which city it is in.');
    need('venueName', payload.venueName, 'Name the venue.');
  }

  if (payload.registrationModel === 'external') {
    const check = checkExternalUrl(payload.externalUrl, TRUSTED_DOMAINS);
    if (!check.ok) {
      problems.push({ field: 'externalUrl', message: externalMessage(check.reason) });
    }
  }

  if (payload.priceType === 'paid') {
    const amount = Number.parseInt(payload.priceAmount, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      problems.push({ field: 'priceAmount', message: 'Enter the ticket price.' });
    }
  }

  if (payload.capacity) {
    const capacity = Number.parseInt(payload.capacity, 10);
    if (!Number.isFinite(capacity) || capacity <= 0) {
      problems.push({ field: 'capacity', message: 'Capacity has to be a positive number.' });
    }
  }

  if (!payload.declarations.every(Boolean)) {
    problems.push({
      field: 'declarations',
      message: 'All five declarations have to be confirmed before an event can be submitted.',
    });
  }

  return problems;
}

function externalMessage(reason: string): string {
  const messages: Record<string, string> = {
    empty: 'Enter the address of the event page.',
    malformed: 'That does not look like a web address.',
    unsupported_protocol: 'Only https:// links are accepted.',
    credentials_in_url: 'Remove the username and password from the address.',
    not_a_public_host: 'That address does not point at a public website.',
    too_long: 'That address is too long.',
  };
  return messages[reason] ?? 'That address cannot be used.';
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '??';
}

/** Every organizer is a record, so an event always has something to point at. */
async function ensureOrganizer(userId: string): Promise<string> {
  const [existing] = await db
    .select()
    .from(schema.organizer)
    .where(eq(schema.organizer.userId, userId))
    .limit(1);

  if (existing) return existing.id;

  const [account] = await db
    .select({ name: schema.user.name })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);

  const name = account?.name ?? 'Organizer';
  const id = randomUUID();

  await db.insert(schema.organizer).values({
    id,
    slug: slugify(name, id.slice(0, 6)),
    userId,
    name,
    initials: initialsOf(name),
    type: 'individual',
    // Verification is granted by a person after review, never on sign-up.
    verificationStatus: 'unverified',
    followerCount: 0,
  });

  return id;
}

/** Re-exported for the review step, which shows what will be checked. */
export async function declarationsAction(): Promise<readonly string[]> {
  return ORGANIZER_DECLARATIONS;
}

/** Used by the dashboard's guard, so the rule is not duplicated in the page. */
export async function canSubmitAction(status: string): Promise<boolean> {
  const actor = await currentActor();
  return canSubmitForReview(actor, { status: status as never, createdBy: actor?.id ?? null, organizerId: '' });
}

export async function canCreateOfficialAction(): Promise<boolean> {
  return canCreateOfficialEvent(await currentActor());
}
