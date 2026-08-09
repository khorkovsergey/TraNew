/**
 * The rules a Voyager conversation obeys.
 *
 * Nine states are designed for this screen and most of them are failure states:
 * the daily limit, the guest gate, the API being down, an action waiting for a
 * confirmation. Those are exactly the ones that are hard to reach by hand and
 * easy to get subtly wrong, so the decisions live here — dependency-free and
 * tested — rather than inside a component nobody can drive to state seven.
 *
 * Three rules earn their place by what they refuse:
 *
 *   Nothing that changes state runs without an explicit confirmation. Not
 *   "usually", not "unless the user seems sure" — `requiresConfirmation` is
 *   consulted for every action and defaults to true for anything it does not
 *   recognise.
 *
 *   A question is never lost. When the limit is hit, the gate appears or the
 *   API is down, the text is queued rather than discarded, because the thing a
 *   person typed is the one thing they cannot get back.
 *
 *   The free counter is honest about which day it belongs to. A count without a
 *   date resets when the browser feels like it, which is either a limit that
 *   never fires or one that fires twice.
 */

import { isVoyagerActionId, type VoyagerActionId } from './actions';

export type ConversationState =
  | 'empty'
  | 'processing'
  | 'streaming'
  | 'tool'
  | 'answered'
  | 'error'
  | 'limit'
  | 'auth'
  | 'confirm';

/** Free questions a day, and the point a guest is asked to sign in. */
export const FREE_DAILY_LIMIT = 10;
export const GUEST_GATE_AFTER = 3;

export type Allowance = {
  /** Questions used today. */
  used: number;
  /** The day they were used on, as YYYY-MM-DD. */
  day: string;
};

export const EMPTY_ALLOWANCE: Allowance = { used: 0, day: '' };

/** The day part of an ISO timestamp, in UTC — the day the limit resets on. */
export function dayOf(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/**
 * The allowance as it stands today.
 *
 * A stored count from yesterday is not "9 used"; it is a new day. Rolling it
 * forward is what makes the limit reset without anything having to run at
 * midnight.
 */
export function allowanceToday(stored: Allowance, at: Date): Allowance {
  const today = dayOf(at);
  return stored.day === today ? stored : { used: 0, day: today };
}

export function remaining(stored: Allowance, at: Date): number {
  return Math.max(0, FREE_DAILY_LIMIT - allowanceToday(stored, at).used);
}

export function spend(stored: Allowance, at: Date): Allowance {
  const today = allowanceToday(stored, at);
  return { used: today.used + 1, day: today.day };
}

/**
 * Whether a question can be sent, and if not, why.
 *
 * Order matters and it is the order of who is asked to do what. The daily limit
 * applies to everybody, so it is checked first; the sign-in gate only applies to
 * a guest, and asking somebody to register for a message the limit would have
 * refused anyway is asking them to pay for nothing.
 */
export type SendVerdict =
  | { allowed: true }
  | { allowed: false; reason: 'limit' | 'auth' | 'empty' };

export function canSend(options: {
  text: string;
  allowance: Allowance;
  at: Date;
  authed: boolean;
  /** How many questions this guest has already asked in this conversation. */
  askedInDialog: number;
}): SendVerdict {
  if (!options.text.trim()) return { allowed: false, reason: 'empty' };
  if (remaining(options.allowance, options.at) <= 0) return { allowed: false, reason: 'limit' };
  if (!options.authed && options.askedInDialog >= GUEST_GATE_AFTER) {
    return { allowed: false, reason: 'auth' };
  }
  return { allowed: true };
}

/* --------------------------------------------------------------- actions */

/*
 * The action registry moved to `actions.ts`, and this is the re-export so the
 * chat keeps one import.
 *
 * There were two registries — one the model chose from, one the chat printed —
 * and the chat's was a fixed row of six under every answer regardless of what
 * had been asked. Merging them is what makes "the model decides which actions
 * are relevant" a fact about the code rather than a sentence in a brief.
 */
export {
  VOYAGER_ACTION_IDS,
  VOYAGER_ACTION_SPECS,
  isVoyagerActionId,
  mutates,
  requiresAccount,
  requiresConfirmation,
  specFor,
  type VoyagerAction,
  type VoyagerActionId,
  type VoyagerActionSpec,
} from './actions';

/* ------------------------------------------------------------- the queue */

/**
 * What is waiting to happen: a question that could not be sent, or an action
 * that could not run.
 *
 * One slot, not a list. Two pending questions would arrive out of order after a
 * reconnection, and a person who typed twice while the connection was down meant
 * the second one.
 */
export type Pending =
  | { kind: 'question'; text: string }
  | { kind: 'action'; id: VoyagerActionId }
  | null;

export function parsePending(raw: unknown): Pending {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as Record<string, unknown>;

  if (value.kind === 'question' && typeof value.text === 'string' && value.text.trim()) {
    // Bounded: this comes back out of storage, and storage is writable by
    // anything on the page.
    return { kind: 'question', text: value.text.slice(0, 2000) };
  }
  /*
   * An id that is no longer in the registry is dropped rather than restored.
   * Storage outlives a deploy, so a queue written before the two action lists
   * were merged can still hold `watchlist` or `portfolio_scenario`; running one
   * of those now would mean acting on a description nothing has any more.
   */
  if (value.kind === 'action' && isVoyagerActionId(value.id)) {
    return { kind: 'action', id: value.id };
  }
  return null;
}

/* ------------------------------------------------------------- page context */

/*
 * The context vocabulary moved to `screens.ts`, beside the screens it maps to.
 *
 * It was here, the screen list was in `types.ts`, the map between them was in
 * `chat/transcript.ts` and the API kept a fourth copy of what it would accept —
 * so `market` and `events` were screens three of the four knew about, and every
 * question asked from a comparison or an event page was answered with a 400.
 */
export {
  CONTEXT_KINDS,
  CONTEXT_LABEL,
  contextLabel,
  parseContext,
  screenFor,
  SCREEN_OF,
  type ContextKind,
  type PageContext,
} from './screens';
