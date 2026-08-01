import type { StudySpec } from '@/lib/studies/registry';

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
 */

/** Which page the person is on. Drives prompts, quick actions and the answer shape. */
export type VoyagerScreen =
  | 'chart'
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

/**
 * Every action Voyager may offer. The model picks an id; the widget maps it to a
 * route. Adding a capability means adding a row here — not letting the model
 * invent a destination.
 */
export const VOYAGER_ACTIONS = {
  open_symbol: 'Open the symbol page',
  open_chart: 'Open the chart',
  open_news: 'Find related news',
  open_economy: 'Open the economy overview',
  open_indicator: 'Open the US CPI indicator page',
  open_academy: 'Continue in Academy',
  open_events: 'Find financial events',
  view_pine: 'Show the Pine Script for the applied study',
  open_my_events: 'See the events I signed up for',
  open_experts: 'Browse the expert marketplace',
  open_experts_intake: 'Structure my request for an expert',
  open_strategy: 'Build my strategy',
  open_explore: 'Explore markets',
  open_screener: 'Open the screener',
  open_wealth: 'Open the Wealth Hub',
  open_wealth_assets: 'Update a valuation in the Wealth Hub',
  open_wealth_scenarios: 'Run a Wealth scenario',
  open_wealth_insights: 'See Wealth Health',
  open_watchlist: 'Open my watchlist',
  create_alert: 'Draft an alert',
  none: 'No navigation — this action only continues the conversation',
} as const;

export type VoyagerActionId = keyof typeof VOYAGER_ACTIONS;

export type VoyagerAction = {
  label: string;
  action: VoyagerActionId;
  /** The first action renders as the primary button. */
  primary?: boolean;
};

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
   * A chart study to apply, on the chart screen only.
   *
   * The model chooses an id and numbers; it never writes the calculation or the
   * Pine. `clampSpec` is the gate, in the same place and for the same reason the
   * action allowlist is — see `lib/studies/registry.ts`.
   */
  study?: StudySpec;
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
  /** Remaining questions today, or null when the tier is not metered. */
  remaining: number | null;
};
