'use client';

import { track } from '@/lib/events/analytics';
import type { ContextKind } from '@/lib/voyager/session';

/**
 * What every "Ask Voyager" box on the portal does when it is used.
 *
 * There are several of them — the home hero, the Explore column, and more to
 * come — and they all have to behave identically: keep the question, say where
 * it came from, and open the workspace. One function, so the fourth one cannot
 * quietly forget the context and leave the status strip saying "this
 * conversation only" on a page about Tesla.
 *
 * The draft goes through storage rather than only through the URL. A question
 * in a query string is in the browser history, in the referrer of the next
 * request and in any log along the way; the URL carries the *context*, which is
 * a page name, and storage carries the *question*, which is the person's.
 */

const DRAFT_KEY = 'tn.voyager.draft.v1';

/** Where the question was typed. Shown in the status strip as what Voyager sees. */
export type AskSource = { kind: ContextKind; subject?: string };

export function contextParam(source: AskSource): string {
  return source.subject ? `${source.kind}:${source.subject}` : source.kind;
}

/** Keep a question for the workspace to pick up, and say where it came from. */
export function stashDraft(question: string, source: AskSource): void {
  const trimmed = question.trim().slice(0, 2000);
  if (!trimmed) return;

  try {
    window.sessionStorage.setItem(DRAFT_KEY, trimmed);
  } catch {
    /*
     * Storage refused — private mode, a full quota. The navigation still
     * happens and the composer opens empty, which is a worse experience and
     * not a broken one. Losing the question is better than not opening.
     */
  }

  track({ name: 'voyager_opened', source: source.kind, hasQuestion: true });
}

/**
 * The question waiting to be asked, consumed on read.
 *
 * Consumed rather than left in place: a draft that survived being sent would be
 * re-sent on the next visit, and a question asked twice is a question the person
 * did not ask.
 */
export function takeDraft(): string | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(DRAFT_KEY);
    return raw.trim().slice(0, 2000) || null;
  } catch {
    return null;
  }
}

/**
 * The line under every entry input.
 *
 * Four facts, in the order somebody hesitating needs them: what pressing this
 * does, that it costs nothing, what the limit is, and where the history goes.
 * The last one changes with the session because the answer changes.
 */
export function clarityLine(authed: boolean): string {
  return authed
    ? 'Opens the full chat with this page as context · free, no sign-up · 10 questions/day · history saved to your account'
    : 'Opens the full chat with this page as context · free, no sign-up · 10 questions/day · history stays in this browser';
}
