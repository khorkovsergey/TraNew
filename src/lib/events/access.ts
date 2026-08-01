import type { EventStatus, TradingEvent } from './types';

/**
 * Who may do what.
 *
 * Every one of these is checked on the server before the action runs, not only
 * before the button is drawn. A hidden control is a courtesy to the person using
 * the interface; it is not a permission check, because the action can be called
 * without ever loading the page that hides it.
 *
 * Pure, so the rules can be tested against every role and status combination.
 */

export type Role = 'user' | 'moderator' | 'admin';

export type Actor = {
  id: string;
  role: Role;
  /** Organizer records this person owns or is a team member of. */
  organizerIds: string[];
};

export const ANONYMOUS = null;

function ownsEvent(actor: Actor, event: Pick<TradingEvent, 'createdBy' | 'organizerId'>): boolean {
  return event.createdBy === actor.id || actor.organizerIds.includes(event.organizerId);
}

export function canView(
  actor: Actor | null,
  event: Pick<TradingEvent, 'status' | 'createdBy' | 'organizerId' | 'visibility'>
): boolean {
  if (event.status === 'published' || event.status === 'cancelled' || event.status === 'completed') {
    return true;
  }
  if (!actor) return false;
  return actor.role !== 'user' || ownsEvent(actor, event);
}

export function canEdit(
  actor: Actor | null,
  event: Pick<TradingEvent, 'status' | 'createdBy' | 'organizerId'>
): boolean {
  if (!actor) return false;
  if (actor.role === 'admin') return true;
  if (!ownsEvent(actor, event)) return false;

  // Once it is out in the world, editing goes back through moderation; a
  // published event cannot be quietly rewritten into a different one.
  return ['draft', 'changes_requested', 'rejected', 'pending_review', 'published'].includes(
    event.status
  );
}

export function canCancel(
  actor: Actor | null,
  event: Pick<TradingEvent, 'status' | 'createdBy' | 'organizerId'>
): boolean {
  if (!actor) return false;
  if (actor.role === 'admin' || actor.role === 'moderator') return true;
  return ownsEvent(actor, event) && ['published', 'pending_review'].includes(event.status);
}

/** The attendee list is other people's contact details. */
export function canViewRegistrations(
  actor: Actor | null,
  event: Pick<TradingEvent, 'createdBy' | 'organizerId'>
): boolean {
  if (!actor) return false;
  return actor.role === 'admin' || ownsEvent(actor, event);
}

/**
 * Export is narrower than viewing on purpose. Reading the list on screen leaves
 * the data here; downloading it does not, and cannot be taken back.
 */
export function canExportRegistrations(
  actor: Actor | null,
  event: Pick<TradingEvent, 'createdBy' | 'organizerId'>
): boolean {
  if (!actor) return false;
  return actor.role === 'admin' || ownsEvent(actor, event);
}

export function canMessageAttendees(
  actor: Actor | null,
  event: Pick<TradingEvent, 'createdBy' | 'organizerId'>
): boolean {
  return canViewRegistrations(actor, event);
}

export function canViewAnalytics(
  actor: Actor | null,
  event: Pick<TradingEvent, 'createdBy' | 'organizerId'>
): boolean {
  if (!actor) return false;
  return actor.role !== 'user' || ownsEvent(actor, event);
}

export function canModerate(actor: Actor | null): boolean {
  return actor?.role === 'moderator' || actor?.role === 'admin';
}

/** Only staff may put the platform's own name on an event. */
export function canCreateOfficialEvent(actor: Actor | null): boolean {
  return actor?.role === 'admin';
}

/** And only staff may publish without review. */
export function canPublishDirectly(actor: Actor | null): boolean {
  return actor?.role === 'admin';
}

export function canSubmitForReview(
  actor: Actor | null,
  event: Pick<TradingEvent, 'status' | 'createdBy' | 'organizerId'>
): boolean {
  if (!actor) return false;
  if (!ownsEvent(actor, event) && actor.role === 'user') return false;
  return ['draft', 'changes_requested', 'rejected'].includes(event.status);
}

/** The moves a moderator is allowed to make from each state. */
export const MODERATION_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  draft: ['pending_review'],
  pending_review: ['published', 'rejected', 'changes_requested'],
  changes_requested: ['pending_review'],
  published: ['suspended', 'cancelled', 'completed'],
  rejected: ['pending_review'],
  suspended: ['published', 'rejected'],
  cancelled: [],
  completed: [],
};

export function canTransition(from: EventStatus, to: EventStatus): boolean {
  return MODERATION_TRANSITIONS[from].includes(to);
}
