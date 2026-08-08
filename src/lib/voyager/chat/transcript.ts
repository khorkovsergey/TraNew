/**
 * The Voyager dialogue, as data.
 *
 * The chat screen has nine designed states and six of them are failures — the
 * daily limit, the guest gate, the API being down, an action waiting on a
 * confirmation. Those are the ones that are hard to reach by hand and easy to
 * get subtly wrong, so the decisions live here rather than inside a component
 * nobody can drive to state seven.
 *
 * `session.ts` next door owns the rules that say *whether* something may happen
 * (may this be sent, must this be confirmed, how many are left today). This
 * file owns what the transcript then looks like, and how the browser's copy of
 * the counter is read back safely. Neither imports anything, so both compile
 * under the unit harness alone.
 */

import {
  allowanceToday,
  EMPTY_ALLOWANCE,
  FREE_DAILY_LIMIT,
  type Allowance,
  type ContextKind,
} from '../session';

/* --------------------------------------------------------------- The turns */

export type TurnRole = 'user' | 'assistant';

/**
 * One bubble.
 *
 * An assistant turn carries the evidence with it rather than beside it: the
 * tools that ran, the sources it was given, and whether the action row applies.
 * Holding them on the turn is what lets an old answer keep its own citations
 * when a newer one arrives with different ones.
 */
export type Turn = {
  id: string;
  role: TurnRole;
  text: string;
  at: string;
  /** Assistant only — the tool calls that actually ran, as short signatures. */
  tools?: string[];
  /** Assistant only — what the answer rests on. */
  sources?: { label: string; detail?: string }[];
  /** Assistant only — three follow-ups the person might ask next. */
  followUps?: string[];
  /**
   * Assistant only — a validated structured plan, when the answer produced one.
   *
   * Held as `unknown`: this module owns the shape of a conversation, not the
   * shape of an answer, and `contract.parsePlan` is the gate at the edge.
   */
  output?: unknown;
  /** Assistant only — the answer is a failure notice, so no action row. */
  failed?: boolean;
  /**
   * Assistant only — the platform speaking rather than an answer.
   *
   * The reply that says the daily limit is spent is a notice about the account,
   * not a reply about markets. It renders as plain text with nothing under it:
   * offering "Add to watchlist" beneath "you have run out of questions" is
   * offering to act on an answer that was never given.
   */
  notice?: boolean;
  /** Assistant only — written by the platform, not by a model. */
  scripted?: boolean;
};

export function userTurn(id: string, text: string, at: string): Turn {
  return { id, role: 'user', text, at };
}

/**
 * Whether an answer may offer the action row.
 *
 * Only a settled, non-failed assistant turn. Offering "Add to watchlist" under
 * "Voyager is temporarily unavailable" is offering to act on an answer that
 * does not exist.
 */
export function offersActions(turn: Turn): boolean {
  return (
    turn.role === 'assistant' && !turn.failed && !turn.notice && turn.text.trim().length > 0
  );
}

/** The last thing the person asked, for a retry that does not need re-typing. */
export function lastQuestion(turns: Turn[]): string | null {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    if (turns[index].role === 'user') return turns[index].text;
  }
  return null;
}

/** How many questions the person has asked in this dialogue — the guest gate counts these. */
export function askedInDialog(turns: Turn[]): number {
  return turns.filter((turn) => turn.role === 'user').length;
}

/**
 * The turns sent to the model as prior context, oldest first.
 *
 * Capped at eight because the API caps it at eight, and trimmed to whole turns
 * so a follow-up never arrives with an answer whose question was dropped.
 * Failure notices are left out: "Voyager is temporarily unavailable" is not
 * something Voyager said about the markets, and feeding it back teaches the
 * next answer to talk about the outage.
 */
export function historyFor(turns: Turn[]): { role: TurnRole; text: string }[] {
  return turns
    .filter((turn) => !turn.failed && turn.text.trim())
    .slice(-8)
    .map((turn) => ({ role: turn.role, text: turn.text }));
}

/* -------------------------------------------------------- The page context */

/**
 * Which server-side screen a page context maps to.
 *
 * The chat's context vocabulary is the one a link may carry — `symbol:TSLA`,
 * `learn` — and the orchestrator's is the one the policy layer keys sources
 * off. They are deliberately different lists, and this is the single place they
 * meet: a page that starts sending its own screen name would be choosing which
 * sources the server offers it.
 */
export type VoyagerScreenName =
  | 'chart'
  | 'market'
  | 'symbol'
  | 'economy'
  | 'indicator'
  | 'wealth'
  | 'academy'
  | 'experts'
  | 'news'
  | 'portfolio'
  | 'strategy'
  | 'events'
  | 'generic';

const SCREEN_OF: Record<ContextKind, VoyagerScreenName> = {
  home: 'generic',
  symbol: 'symbol',
  chart: 'chart',
  comparison: 'market',
  article: 'news',
  event: 'events',
  portfolio: 'portfolio',
  plan: 'strategy',
  explore: 'market',
  learn: 'academy',
};

export function screenFor(kind: ContextKind | null): VoyagerScreenName {
  return kind ? SCREEN_OF[kind] : 'generic';
}

/* ------------------------------------------------------------- The counter */

/**
 * Where the browser keeps the day's count.
 *
 * A guest has no account to count against, so the pre-flight number the
 * composer shows comes from here. It is a display, not an enforcement: the
 * server counts the same questions against a hashed subject and its number wins
 * the moment an answer comes back. Somebody clearing this key gains a nicer
 * label and not one extra question.
 */
export const ALLOWANCE_KEY = 'tn.voyager.allowance.v1';

export function parseAllowance(raw: unknown): Allowance {
  if (!raw || typeof raw !== 'object') return EMPTY_ALLOWANCE;
  const value = raw as Record<string, unknown>;

  const used = typeof value.used === 'number' && Number.isFinite(value.used) ? value.used : 0;
  const day = typeof value.day === 'string' ? value.day.slice(0, 10) : '';

  // Clamped rather than trusted: this comes back out of storage, and storage is
  // writable by anything on the origin.
  return { used: Math.max(0, Math.min(Math.floor(used), FREE_DAILY_LIMIT)), day };
}

/** The counter line: "Free: 3 of 10 questions used today", or the unmetered one. */
export function limitLabel(allowance: Allowance, at: Date, unlimited: boolean): string {
  if (unlimited) return 'Unlimited questions on your plan';
  const used = allowanceToday(allowance, at).used;
  return `Free: ${Math.min(used, FREE_DAILY_LIMIT)} of ${FREE_DAILY_LIMIT} questions used today`;
}

/**
 * The server's count, adopted.
 *
 * Called with what a reply reported, so the browser's optimistic increment is
 * corrected rather than allowed to drift — two tabs asking on the same day used
 * to each show their own half of the total.
 */
export function adoptServerCount(
  used: number | undefined,
  total: number | null | undefined,
  at: Date
): Allowance | null {
  if (typeof used !== 'number' || !Number.isFinite(used)) return null;
  // An unmetered plan has nothing to display and nothing to correct.
  if (total === null) return null;
  return { used: Math.max(0, Math.floor(used)), day: at.toISOString().slice(0, 10) };
}

/* ------------------------------------------------------------ The openings */

/** The five starters in the left column. Each one is a question, not a topic page. */
export const TOPICS: { title: string; question: string }[] = [
  { title: "Markets today — what's moving", question: 'What is moving markets today?' },
  { title: 'What is an ETF?', question: 'What is an ETF?' },
  { title: 'How much risk should I take?', question: 'How much risk should I take?' },
  { title: 'Build an emergency fund', question: 'How do I build an emergency fund?' },
  { title: 'Inflation, explained', question: 'Explain inflation simply' },
];

/** The three chips under the empty composer. */
export const SUGGESTIONS = [
  'I have savings. What should I do first?',
  'ETFs or stocks for a beginner?',
  'Why are markets falling?',
];

/**
 * The four mode chips.
 *
 * A mode is a framing rather than a different engine: it prefixes the question
 * with what kind of answer is wanted. Naming that here keeps the chips honest —
 * each one visibly changes what is asked instead of setting a hidden flag.
 */
export type ChatMode = 'explain' | 'guide' | 'compare' | 'simulate';

export const MODES: { id: ChatMode; label: string }[] = [
  { id: 'explain', label: 'Explain' },
  { id: 'guide', label: 'Guide me' },
  { id: 'compare', label: 'Compare' },
  { id: 'simulate', label: 'Simulate' },
];

const MODE_FRAME: Record<ChatMode, string> = {
  explain: '',
  guide: 'Guide me step by step: ',
  compare: 'Compare the options for this: ',
  simulate: 'Run a what-if simulation for this: ',
};

/** The question as the mode asks it. Explain is the plain question. */
export function framed(question: string, mode: ChatMode): string {
  const trimmed = question.trim();
  if (!trimmed) return trimmed;
  return `${MODE_FRAME[mode]}${trimmed}`;
}
