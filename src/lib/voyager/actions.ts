/**
 * Every action Voyager may offer, in one registry.
 *
 * There were two. The model picked ids from a list in `types.ts` and the widget
 * resolved them to routes; the full-page chat ignored all of that and printed
 * the same six buttons from a second list in `session.ts` under every answer it
 * did not consider a failure. So "What is an ETF?" was answered and then
 * offered *Add to watchlist* — add what? — and the two lists could not be
 * reconciled because neither knew the other existed.
 *
 * One registry, and both surfaces read it. The model chooses ids from the
 * subset this request allows; the chat renders exactly what came back and
 * nothing else.
 *
 * Two rules the shape of this file enforces:
 *
 * **The model never writes a destination.** It picks an id. A model that could
 * emit its own URL could send somebody anywhere, including off the site.
 *
 * **An action says what it actually does, and the report is built from that.**
 * `done` is the past tense of `about`, written here rather than at the call
 * site, so a button cannot describe itself more kindly than it behaves. An
 * action that only prepares a draft says *prepared a draft* — the difference
 * between "Created the alert" and "Prepared an alert draft" is the difference
 * between something that will interrupt you and something that will not.
 *
 * Import-free, so the unit harness compiles it alone.
 */

import type { VoyagerScreen } from './screens';

export type VoyagerActionId =
  /* Navigation — nothing changes. */
  | 'open_symbol'
  | 'open_chart'
  | 'open_news'
  | 'open_economy'
  | 'open_indicator'
  | 'open_academy'
  | 'open_events'
  | 'open_my_events'
  | 'open_experts'
  | 'open_experts_intake'
  | 'open_strategy'
  | 'open_explore'
  | 'open_market_compare'
  | 'open_screener'
  | 'open_wealth'
  | 'open_wealth_assets'
  | 'open_wealth_scenarios'
  | 'open_wealth_insights'
  | 'open_watchlist'
  | 'open_practice'
  | 'open_research'
  /* In place — the answer changes, the page does not. */
  | 'view_pine'
  | 'none'
  /* Real changes to the person's account. */
  | 'add_to_watchlist'
  | 'save_conversation'
  | 'create_alert';

/**
 * What pressing it actually does.
 *
 * `prepare` exists as a category of its own rather than as a footnote on
 * `mutate`, because the honest sentence afterwards is different and the
 * difference is the whole point: a draft is not the thing itself.
 */
export type ActionExecution =
  /** Resolves to a route. Nothing is written. */
  | 'navigate'
  /** Stays in the conversation — reveals something, or asks a follow-up. */
  | 'in_place'
  /** A server handler changes something the person owns. */
  | 'mutate'
  /** A server handler creates a draft. Never reported as the finished thing. */
  | 'prepare';

export type VoyagerActionSpec = {
  id: VoyagerActionId;
  /** The button, and what the model is told this id does. */
  label: string;
  execution: ActionExecution;
  /** Needs an account, so a guest is gated and the action queued. */
  requiresAccount: boolean;
  /** Without an instrument this action has nothing to act on and is not offered. */
  needsTicker?: boolean;
  /** What the confirmation card says is about to happen, in the first person. */
  about: string;
  /**
   * The same act reported after the handler returned, so the reply is neither
   * in the future tense nor larger than what happened.
   */
  done: string;
  /** Where the change lands, so nobody has to guess which part of the portal moved. */
  where: string;
  /** How to undo it, in words. Everything that changes something has one. */
  undo: string;
  /** The tool signature the answer shows once it has actually run. */
  call: string;
};

export const VOYAGER_ACTION_SPECS: Record<VoyagerActionId, VoyagerActionSpec> = {
  /* ------------------------------------------------------------ navigation */

  open_symbol: {
    id: 'open_symbol',
    label: 'Open the symbol page',
    execution: 'navigate',
    requiresAccount: false,
    about: 'open the symbol page',
    done: 'opened the symbol page',
    where: 'The symbol page',
    undo: 'Nothing to undo — this only navigates.',
    call: 'symbol.open',
  },
  open_chart: {
    id: 'open_chart',
    label: 'Open on chart',
    execution: 'navigate',
    requiresAccount: false,
    about: 'open this on the advanced chart',
    done: 'opened this on the advanced chart',
    where: 'Supercharts',
    undo: 'Nothing to undo — this only navigates.',
    call: 'chart.open',
  },
  open_news: {
    id: 'open_news',
    label: 'Find related news',
    execution: 'navigate',
    requiresAccount: false,
    about: 'open the news screen',
    done: 'opened the news screen',
    where: 'News',
    undo: 'Nothing to undo — this only navigates.',
    call: 'news.open',
  },
  open_economy: {
    id: 'open_economy',
    label: 'Open the economy overview',
    execution: 'navigate',
    requiresAccount: false,
    about: 'open the economy overview',
    done: 'opened the economy overview',
    where: 'Economy',
    undo: 'Nothing to undo — this only navigates.',
    call: 'economy.open',
  },
  open_indicator: {
    id: 'open_indicator',
    label: 'Open the indicator page',
    execution: 'navigate',
    requiresAccount: false,
    about: 'open the indicator page',
    done: 'opened the indicator page',
    where: 'Economy',
    undo: 'Nothing to undo — this only navigates.',
    call: 'indicator.open',
  },
  open_academy: {
    id: 'open_academy',
    label: 'Continue in Academy',
    execution: 'navigate',
    requiresAccount: false,
    about: 'open Academy',
    done: 'opened Academy',
    where: 'Academy',
    undo: 'Nothing to undo — this only navigates.',
    call: 'academy.open',
  },
  open_events: {
    id: 'open_events',
    label: 'Find financial events',
    execution: 'navigate',
    requiresAccount: false,
    about: 'open the events screen',
    done: 'opened the events screen',
    where: 'Events',
    undo: 'Nothing to undo — this only navigates.',
    call: 'events.open',
  },
  open_my_events: {
    id: 'open_my_events',
    label: 'See the events I signed up for',
    execution: 'navigate',
    requiresAccount: false,
    about: 'open the events you registered for',
    done: 'opened the events you registered for',
    where: 'Events — my registrations',
    undo: 'Nothing to undo — this only navigates.',
    call: 'events.mine',
  },
  open_experts: {
    id: 'open_experts',
    label: 'Browse the expert marketplace',
    execution: 'navigate',
    requiresAccount: false,
    about: 'open Expert Services',
    done: 'opened Expert Services',
    where: 'Expert Services',
    undo: 'Nothing to undo — this only navigates.',
    call: 'experts.open',
  },
  open_experts_intake: {
    id: 'open_experts_intake',
    label: 'Structure my request for an expert',
    execution: 'navigate',
    requiresAccount: false,
    about: 'open Expert Services, where the request is structured',
    done: 'opened Expert Services, where the request is structured',
    where: 'Expert Services',
    undo: 'Nothing to undo — this only navigates.',
    call: 'experts.intake',
  },
  open_strategy: {
    id: 'open_strategy',
    label: 'Build my strategy',
    execution: 'navigate',
    requiresAccount: false,
    about: 'open the strategy builder',
    done: 'opened the strategy builder',
    where: 'Strategy',
    undo: 'Nothing to undo — this only navigates.',
    call: 'strategy.open',
  },
  open_explore: {
    id: 'open_explore',
    label: 'Explore markets',
    execution: 'navigate',
    requiresAccount: false,
    about: 'open Explore',
    done: 'opened Explore',
    where: 'Explore',
    undo: 'Nothing to undo — this only navigates.',
    call: 'explore.open',
  },
  /*
   * Comparing instruments, which is not the same act as exploring categories.
   *
   * "Where can I compare assets?" was answered with Explore, because Explore
   * was the nearest thing on the list. Explore is where somebody learns what a
   * bond is and how asset classes differ; the screen that puts two tickers side
   * by side is `/markets/compare`, and sending people to the first when they
   * asked for the second is the kind of near-miss that reads as the assistant
   * not knowing its own product.
   */
  open_market_compare: {
    id: 'open_market_compare',
    label: 'Compare these on the market screen',
    execution: 'navigate',
    requiresAccount: false,
    about: 'open the comparison screen',
    done: 'opened the comparison screen',
    where: 'Market comparison',
    undo: 'Nothing to undo — this only navigates.',
    call: 'compare.open',
  },
  open_screener: {
    id: 'open_screener',
    label: 'Open the screener',
    execution: 'navigate',
    requiresAccount: false,
    about: 'open the screener',
    done: 'opened the screener',
    where: 'Research',
    undo: 'Nothing to undo — this only navigates.',
    call: 'screener.open',
  },
  open_wealth: {
    id: 'open_wealth',
    label: 'Open the Wealth Hub',
    execution: 'navigate',
    requiresAccount: true,
    about: 'open your Wealth Hub',
    done: 'opened your Wealth Hub',
    where: 'Wealth Hub',
    undo: 'Nothing to undo — this only navigates.',
    call: 'wealth.open',
  },
  open_wealth_assets: {
    id: 'open_wealth_assets',
    label: 'Update a valuation in the Wealth Hub',
    execution: 'navigate',
    requiresAccount: true,
    about: 'open your assets in the Wealth Hub',
    done: 'opened your assets in the Wealth Hub',
    where: 'Wealth Hub — assets',
    undo: 'Nothing to undo — this only navigates.',
    call: 'wealth.assets',
  },
  open_wealth_scenarios: {
    id: 'open_wealth_scenarios',
    label: 'Run a Wealth scenario',
    execution: 'navigate',
    requiresAccount: true,
    about: 'open scenarios in the Wealth Hub',
    done: 'opened scenarios in the Wealth Hub',
    where: 'Wealth Hub — scenarios',
    undo: 'Nothing to undo — this only navigates.',
    call: 'wealth.scenarios',
  },
  open_wealth_insights: {
    id: 'open_wealth_insights',
    label: 'See Wealth Health',
    execution: 'navigate',
    requiresAccount: true,
    about: 'open Wealth Health',
    done: 'opened Wealth Health',
    where: 'Wealth Hub — health',
    undo: 'Nothing to undo — this only navigates.',
    call: 'wealth.insights',
  },
  open_watchlist: {
    id: 'open_watchlist',
    label: 'Open my watchlist',
    execution: 'navigate',
    requiresAccount: true,
    about: 'open your workspace, where the watchlist lives',
    done: 'opened your workspace, where the watchlist lives',
    where: 'Your workspace',
    undo: 'Nothing to undo — this only navigates.',
    call: 'watchlist.open',
  },
  /*
   * Navigation, not a mutation, and that is the honest description rather than
   * a smaller promise.
   *
   * It was "Add to portfolio scenario", it reported adding a virtual position,
   * and there is no practice-portfolio table in this database for it to have
   * been added to. Nothing was ever written. Until something can be, the
   * action opens the screen and says only that.
   */
  open_practice: {
    id: 'open_practice',
    label: 'Open the practice portfolio',
    execution: 'navigate',
    requiresAccount: false,
    about: 'open the practice portfolio, where positions are simulated',
    done: 'opened the practice portfolio',
    where: 'Practice portfolio — simulated money only',
    undo: 'Nothing to undo — this only navigates.',
    call: 'practice.open',
  },
  open_research: {
    id: 'open_research',
    label: 'Turn this answer into research',
    execution: 'navigate',
    requiresAccount: false,
    about: 'open a research session seeded with this question',
    done: 'opened a research session seeded with this question',
    where: 'The research workspace',
    undo: 'Nothing to undo — this only opens a session.',
    call: 'research.open',
  },

  /* -------------------------------------------------------------- in place */

  view_pine: {
    id: 'view_pine',
    label: 'Show the Pine Script for the applied study',
    execution: 'in_place',
    requiresAccount: false,
    about: 'show the Pine Script behind the study on the chart',
    done: 'showed the Pine Script behind the study on the chart',
    where: 'The chart you already have open',
    undo: 'Nothing to undo — this only reveals code.',
    call: 'pine.view',
  },
  none: {
    id: 'none',
    label: 'Continue',
    execution: 'in_place',
    requiresAccount: false,
    about: 'continue the conversation',
    done: 'continued the conversation',
    where: 'Here',
    undo: 'Nothing to undo — this only asks a question.',
    call: 'chat.continue',
  },

  /* ----------------------------------------------- changes to the account */

  add_to_watchlist: {
    id: 'add_to_watchlist',
    label: 'Add to watchlist',
    execution: 'mutate',
    requiresAccount: true,
    needsTicker: true,
    about: 'add this to your watchlist',
    done: 'added this to your watchlist',
    where: 'Your workspace, under saved symbols',
    undo: 'Removing it from the list undoes this; nothing else changes.',
    call: 'watchlist.add',
  },
  save_conversation: {
    id: 'save_conversation',
    label: 'Save this conversation',
    execution: 'mutate',
    requiresAccount: true,
    about: 'save this conversation to your workspace',
    done: 'saved this conversation to your workspace',
    where: 'Your workspace, under saved research',
    undo: 'Deleting the saved copy removes it; what is on screen stays.',
    call: 'workspace.save',
  },
  /*
   * A draft, and the wording never grows past that.
   *
   * `draftAlert` writes a row with status `draft`. It does not watch anything
   * and it will not interrupt anybody until it is activated on the screen where
   * the condition is visible — so "Created the alert" would be a claim about a
   * thing that is not yet running.
   */
  create_alert: {
    id: 'create_alert',
    label: 'Prepare an alert',
    execution: 'prepare',
    requiresAccount: true,
    needsTicker: true,
    about: 'prepare an alert draft for this',
    done: 'prepared an alert draft — it is not watching anything until you switch it on',
    where: 'Your workspace, under alerts',
    undo: 'Deleting the draft removes it; nothing was ever activated.',
    call: 'alert.draft',
  },
};

export const VOYAGER_ACTION_IDS = Object.keys(VOYAGER_ACTION_SPECS) as VoyagerActionId[];

/** One action on an answer. The model supplies the id and its own label for it. */
export type VoyagerAction = {
  label: string;
  action: VoyagerActionId;
  /** The first action renders as the primary button. */
  primary?: boolean;
};

export function isVoyagerActionId(value: unknown): value is VoyagerActionId {
  return typeof value === 'string' && value in VOYAGER_ACTION_SPECS;
}

export function specFor(id: VoyagerActionId): VoyagerActionSpec {
  return VOYAGER_ACTION_SPECS[id];
}

/** Anything that writes — a change or a draft. Both are confirmed first. */
export function mutates(id: string): boolean {
  const spec = VOYAGER_ACTION_SPECS[id as VoyagerActionId];
  if (!spec) return true;
  return spec.execution === 'mutate' || spec.execution === 'prepare';
}

/**
 * Whether this action must be confirmed before it runs.
 *
 * Defaults to true for anything unrecognised. A new action that somebody forgot
 * to describe should ask before it acts, not act because nobody said otherwise —
 * the failure of a wrong `true` is one extra click, and the failure of a wrong
 * `false` is something changing in an account without permission.
 */
export function requiresConfirmation(id: string): boolean {
  return mutates(id);
}

export function requiresAccount(id: string): boolean {
  const spec = VOYAGER_ACTION_SPECS[id as VoyagerActionId];
  return spec ? spec.requiresAccount : true;
}

/**
 * Which actions this request may offer.
 *
 * Narrowing here is the enforcement point: an answer physically cannot contain
 * a wealth action for somebody whose tier does not reach the wealth record,
 * because the model was never shown that option. Account-only actions *are*
 * offered to a guest — they land on the sign-in gate, which is the intended
 * path, and this list exists to stop the model inventing a destination rather
 * than to re-implement route protection the server already does.
 */
export function allowedActions(options: {
  screen: VoyagerScreen;
  tier: 'basic' | 'personal' | 'private';
  /** True when the request knows which instrument it is about. */
  hasTicker: boolean;
}): VoyagerActionId[] {
  const { screen, tier, hasTicker } = options;

  // On a lesson page, keep the person in the lesson rather than routing them
  // away from the thing they are in the middle of.
  if (screen === 'academy') {
    return ['open_academy', 'open_explore', 'save_conversation', 'none'];
  }

  const ids: VoyagerActionId[] = [
    'open_symbol',
    'open_chart',
    'open_news',
    'open_economy',
    'open_indicator',
    'open_academy',
    'open_experts',
    'open_experts_intake',
    'open_strategy',
    'open_explore',
    'open_market_compare',
    'open_screener',
    // Events are public, so finding one is offered at every tier.
    'open_events',
    'open_my_events',
    'open_practice',
    'open_research',
    'open_watchlist',
    'save_conversation',
    'none',
  ];

  // Only where there is a chart to reveal the code on. Everywhere else the
  // action would resolve to nothing and the button would be a dead end.
  if (screen === 'chart') ids.push('view_pine');

  // Both need something to act on. Offered without an instrument they resolve
  // to "add what?", which is the generic action row this registry replaced.
  if (hasTicker) ids.push('add_to_watchlist', 'create_alert');

  if (tier === 'private') {
    ids.push('open_wealth', 'open_wealth_assets', 'open_wealth_scenarios', 'open_wealth_insights');
  }

  return ids;
}

/**
 * The description the model is given for an id.
 *
 * The label alone reads as a button; the model is choosing behaviour, so it is
 * told what happens and, where it matters, what does not.
 */
export function briefFor(id: VoyagerActionId): string {
  const spec = VOYAGER_ACTION_SPECS[id];
  const kind =
    spec.execution === 'navigate'
      ? 'navigates'
      : spec.execution === 'in_place'
        ? 'stays here'
        : spec.execution === 'prepare'
          ? 'prepares a draft, asks first'
          : 'changes their account, asks first';
  return `${spec.label} — ${kind}`;
}
