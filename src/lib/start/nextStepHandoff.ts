'use client';

import type {
  NextStepAnswers,
  NextStepClarification,
  NextStepIntent,
  NextStepLevel,
} from '@/content/nextStep';

/**
 * What the router already knows, carried to the screen it hands somebody to.
 *
 * Expert Services asks what you are trying to solve, and it should keep asking —
 * that is the one thing this router never collected. What it should not do is
 * ask again for the two answers already given thirty seconds earlier. So the
 * level and the intent travel; the actual problem does not, because it was never
 * here.
 *
 * Four rules, and all four are the reason this is a module rather than three
 * lines at a call site:
 *
 *   Session scope. It dies with the tab. This is a handoff between two screens
 *   in one visit, not a profile, and nothing here is written to the database.
 *
 *   Validated on read against closed enums. Storage is writable by anything on
 *   the page, so what comes back out is checked before it is believed — an
 *   unrecognised value is dropped rather than passed on.
 *
 *   Free text never enters a URL. A sentence about somebody's money in a query
 *   string is in the history, in the next referrer and in any log in between.
 *
 *   None of it goes to analytics. Not the level, not the intent, not a hash of
 *   either.
 */

const KEY = 'tn.nextStep.handoff.v1';

const LEVELS: readonly NextStepLevel[] = ['new', 'basics', 'investor', 'active', 'pro', 'unsure'];

const INTENTS: readonly NextStepIntent[] = [
  'learn',
  'explore',
  'improve',
  'organize',
  'expert',
  'courses',
  'tools',
  'unsure',
];

const CLARIFICATIONS: readonly NextStepClarification[] = [
  'steps',
  'try',
  'course',
  'unsure',
  'understand',
  'ideas',
  'research',
  'self',
  'ai',
  'full',
  'person',
  'pace',
  'online',
  'near',
  'meet',
  'anyway',
  'ground',
];

export type NextStepHandoff = NextStepAnswers & { freeText: string | null };

/** Keep the router's answers for the next screen in this visit. */
export function stashHandoff(answers: NextStepAnswers, freeText?: string | null): void {
  const payload: NextStepHandoff = {
    level: answers.level,
    intent: answers.intent,
    clarification: answers.clarification,
    freeText: freeText?.trim().slice(0, 2000) || null,
  };

  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /*
     * Storage refused — private mode, a full quota. The navigation still
     * happens and the next screen asks its own questions, which is the
     * behaviour somebody arriving from anywhere else already gets.
     */
  }
}

/**
 * The answers waiting for the next screen, consumed on read.
 *
 * Consumed rather than left in place: a handoff that survived being used would
 * still be sitting there when the same person opened Expert Services from the
 * menu an hour later, and context they did not bring is context they did not
 * agree to.
 */
export function takeHandoff(): NextStepHandoff | null {
  let raw: string | null = null;

  try {
    raw = window.sessionStorage.getItem(KEY);
    if (raw) window.sessionStorage.removeItem(KEY);
  } catch {
    return null;
  }

  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const value = parsed as Record<string, unknown>;

  const handoff: NextStepHandoff = {
    level: pick(value.level, LEVELS),
    intent: pick(value.intent, INTENTS),
    clarification: pick(value.clarification, CLARIFICATIONS),
    freeText: typeof value.freeText === 'string' ? value.freeText.slice(0, 2000) || null : null,
  };

  // Nothing recognised means nothing to hand over. Returning an object of nulls
  // would have the next screen announce a context it does not have.
  return handoff.level || handoff.intent || handoff.freeText ? handoff : null;
}

function pick<T extends string>(raw: unknown, allowed: readonly T[]): T | null {
  return typeof raw === 'string' && (allowed as readonly string[]).includes(raw) ? (raw as T) : null;
}

export function clearHandoff(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* Nothing to do — it was never readable in the first place. */
  }
}
