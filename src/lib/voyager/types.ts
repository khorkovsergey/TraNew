import type { InvestmentSummary } from '../investment/summary';
import type { StudySpec } from '../studies/registry';

/**
 * Voyager — the shared vocabulary between the widget, the policy layer and the
 * model orchestrator.
 *
 * Two rules shape everything here:
 *
 * 1. The widget sends a *structured context package*, never a screenshot and never
 *    a raw URL. What the assistant is allowed to see is therefore reviewable, and
 *    a source the person switched off is genuinely absent from the request.
 * 2. Actions are chosen from a fixed list, not written by the model. A model that
 *    could emit its own link could send someone anywhere; picking from an
 *    allowlist means an answer can only ever point into a real part of the app.
 *
 * The screen vocabulary and the action registry both used to be written out
 * here and again elsewhere. They are now `screens.ts` and `actions.ts`, which
 * this file re-exports so that every caller keeps one import — a second copy of
 * a closed set is a copy that drifts, and both of these already had.
 */

export type { VoyagerScreen } from './screens';
export {
  VOYAGER_ACTION_IDS,
  VOYAGER_ACTION_SPECS,
  allowedActions,
  briefFor,
  isVoyagerActionId,
  mutates,
  requiresAccount,
  requiresConfirmation,
  specFor,
  type ActionExecution,
  type VoyagerAction,
  type VoyagerActionId,
  type VoyagerActionSpec,
} from './actions';

import type { VoyagerAction } from './actions';
import type { VoyagerScreen } from './screens';

/**
 * Entitlement level. Derived on the server from the session — never sent by the
 * client, which could simply claim to be `private`.
 */
export type VoyagerTier = 'basic' | 'personal' | 'private';

/** One switchable context source, as shown in the "Using: … · manage" row. */
export type VoyagerSource = {
  id: string;
  label: string;
  /** Sources the person cannot enable without a consent record or a higher plan. */
  requiresConsent?: boolean;
};

/**
 * What the page tells Voyager about itself. Assembled client-side by the page and
 * posted with each question; the server decides what it is allowed to act on.
 */
export type VoyagerContext = {
  screen: VoyagerScreen;
  /** Human name of the thing on screen — "Tesla", "US CPI", "My Wealth". */
  subject: string;
  /** Collapsed-pill text: "Ask about Tesla". */
  prompt: string;
  /** 2–4 quick actions shown in Peek. */
  quick: string[];
  /** Extra structured facts, e.g. ticker, timeframe, whether the person owns it. */
  facts?: Record<string, string>;
};

/** Content-type label. Describes what kind of content this is, not who made it. */
export type VoyagerContentType =
  | 'AI explanation'
  | 'AI analysis'
  | 'AI summary'
  | 'AI structured'
  | 'Academy context';

/** A contextual upgrade card. Decided by the policy layer, never by the model. */
export type VoyagerUpgrade = {
  text: string;
  cta: string;
  /** What the CTA does: create an account, or turn on Voyager Private. */
  intent: 'sign_up' | 'unlock_private';
};

/** The structured answer the widget renders. */
export type VoyagerAnswer = {
  contentType: VoyagerContentType;
  text: string;
  bullets: string[];
  /** "market data 09:45 UTC · Reuters 09:12" — what the answer rests on. */
  sources: string;
  confidence: 'low' | 'medium' | 'high';
  actions: VoyagerAction[];
  followUps: string[];
  upgrade?: VoyagerUpgrade;
  /** Set when the scripted layer answered because no model was configured. */
  simulated?: boolean;
  /**
   * The tools that actually ran for this answer, as short call signatures —
   * `web-search(3)`, `investment-analysis(TSLA)`, `study(rsi)`.
   *
   * Reported rather than decorative: the chat renders one chip per entry, and a
   * chip claiming a tool ran when none did is the same lie as an invented
   * source. An answer the model wrote from what it already knew carries none.
   */
  tools?: string[];
  /**
   * What the answer rests on, as chips rather than the one prose line.
   *
   * `sources` stays because the widget renders it and the model writes it; this
   * is the structured form the chat shows — the context sources the request was
   * actually given, plus any host a web search returned.
   */
  citations?: { label: string; detail?: string }[];
  /**
   * A chart study to apply, on the chart screen only.
   *
   * The model chooses an id and numbers; it never writes the calculation or the
   * Pine. `clampSpec` is the gate, in the same place and for the same reason the
   * action allowlist is — see `lib/studies/registry.ts`.
   */
  study?: StudySpec;
  /**
   * A full investment assessment, on the symbol and chart screens only.
   *
   * Gated the same way `study` is: the engine reads filings and produces an
   * opinion about an instrument, which is meaningless on a screen that is not
   * about one.
   */
  investment?: InvestmentSummary;
};

export type VoyagerRequest = {
  question: string;
  context: VoyagerContext;
  /** Ids of sources the person switched off in "manage". */
  disabledSources: string[];
  /** Prior turns, oldest first, so follow-ups make sense. */
  history: { role: 'user' | 'assistant'; text: string }[];
};

export type VoyagerResponse = {
  answer: VoyagerAnswer;
  tier: VoyagerTier;
  /** Remaining questions today, or null when the plan is not metered. */
  remaining: number | null;
  /** Spent today, and the ceiling — the counter the chat shows, from the server. */
  used: number;
  total: number | null;
  /** True when this reply is the limit notice rather than an answer. */
  quotaReached: boolean;
};
