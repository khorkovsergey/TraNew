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

/**
 * What an answer offers to do next, and which of those change something.
 *
 * A closed record rather than a flag on each call site. The question "does this
 * need a confirmation" has to have one answer per action, in one place, or the
 * sixth caller will be the one that forgets.
 */
export type VoyagerActionId =
  | 'research'
  | 'open_chart'
  | 'watchlist'
  | 'save_workspace'
  | 'portfolio_scenario'
  | 'create_alert';

type ActionSpec = {
  label: string;
  /** Changes something the person owns. Everything true here is confirmed first. */
  mutates: boolean;
  /** Needs an account, so a guest is gated and the action queued. */
  needsAccount: boolean;
};

export const VOYAGER_ACTIONS: Record<VoyagerActionId, ActionSpec> = {
  research: { label: 'Turn this answer into research', mutates: false, needsAccount: false },
  open_chart: { label: 'Open on chart', mutates: false, needsAccount: false },
  watchlist: { label: 'Add to watchlist', mutates: true, needsAccount: true },
  save_workspace: { label: 'Save to workspace', mutates: true, needsAccount: true },
  portfolio_scenario: { label: 'Add to portfolio scenario', mutates: true, needsAccount: false },
  create_alert: { label: 'Create alert', mutates: true, needsAccount: true },
};

/**
 * Whether this action must be confirmed before it runs.
 *
 * Defaults to true for anything unrecognised. A new action that somebody forgot
 * to describe should ask before it acts, not act because nobody said otherwise —
 * the failure of a wrong `true` is one extra click, and the failure of a wrong
 * `false` is something changing in an account without permission.
 */
export function requiresConfirmation(id: string): boolean {
  const spec = VOYAGER_ACTIONS[id as VoyagerActionId];
  return spec ? spec.mutates : true;
}

export function requiresAccount(id: string): boolean {
  const spec = VOYAGER_ACTIONS[id as VoyagerActionId];
  return spec ? spec.needsAccount : true;
}

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
  if (value.kind === 'action' && typeof value.id === 'string' && value.id in VOYAGER_ACTIONS) {
    return { kind: 'action', id: value.id as VoyagerActionId };
  }
  return null;
}

/* ------------------------------------------------------------- page context */

/**
 * Where a question came from.
 *
 * A closed set, because it is read from a URL and shown to the person as "what
 * Voyager can see". An unrecognised value is dropped rather than displayed:
 * a status strip that echoes whatever a link put in it is a status strip that
 * can be made to lie.
 */
export type ContextKind =
  | 'home'
  | 'symbol'
  | 'chart'
  | 'comparison'
  | 'article'
  | 'event'
  | 'portfolio'
  | 'plan'
  | 'explore'
  | 'learn';

const CONTEXT_LABEL: Record<ContextKind, string> = {
  home: 'Home',
  symbol: 'This asset',
  chart: 'This chart',
  comparison: 'This comparison',
  article: 'This article',
  event: 'This event',
  portfolio: 'Your practice portfolio',
  plan: 'Your plan',
  explore: 'Explore',
  learn: 'A lesson',
};

export type PageContext = { kind: ContextKind; subject: string | null };

/** `symbol:TSLA`, `comparison:etfs,bonds`, `home`. Anything else is nothing. */
export function parseContext(raw: unknown): PageContext | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;

  const [kind, ...rest] = raw.trim().toLowerCase().split(':');
  if (!(kind in CONTEXT_LABEL)) return null;

  const subject = rest.join(':').trim();
  return {
    kind: kind as ContextKind,
    // Bounded and stripped of anything that is not a plain identifier — this is
    // rendered in the status strip.
    subject: subject ? subject.replace(/[^a-z0-9,.\-\s]/gi, '').slice(0, 48) || null : null,
  };
}

export function contextLabel(context: PageContext | null): string {
  if (!context) return 'This conversation only';
  const base = CONTEXT_LABEL[context.kind];
  return context.subject ? `${base} · ${context.subject.toUpperCase()}` : base;
}
