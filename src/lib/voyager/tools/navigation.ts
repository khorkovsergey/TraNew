/**
 * Where in TradingNew a need is met.
 *
 * The model classifies what somebody wants into one of the topics below; this
 * resolves that topic to actions that exist. It never takes a route from the
 * model and never matches on English keywords — which is what makes it work
 * when the question arrives in Russian, and what makes it impossible for the
 * answer to point at a screen this portal does not have.
 *
 * That division is the whole design. Classifying "мне нужен налоговый
 * консультант" as `expert_help` is a language judgement, which is the model's
 * job; knowing that Expert Services lives at `/marketplace/experts` is a fact
 * about this repository, which is not.
 *
 * Import-free, so the unit harness compiles it alone.
 */

import { specFor, type VoyagerActionId } from '../actions';
import { toolFailure, type VoyagerToolResult } from './types';

/**
 * What somebody is trying to do, as a closed set.
 *
 * Deliberately about intent rather than about screens: a person does not want
 * "the marketplace", they want to find a course. Naming the intent is what the
 * model can do reliably in any language.
 */
export const NAV_TOPICS = [
  'learn_free',
  'learn_paid',
  'expert_help',
  'practice',
  'charts',
  'market_data',
  'news',
  'economy',
  'events',
  'my_events',
  'compare_assets',
  'watchlist',
  'alerts',
  'research_workspace',
  'screener',
  'strategy',
  'wealth',
  'symbol',
] as const;

export type NavTopic = (typeof NAV_TOPICS)[number];

/**
 * Each topic's destinations, best first.
 *
 * Several topics resolve to more than one action because the portal genuinely
 * offers more than one door — "learn" is free Academy lessons *and* the paid
 * catalogue in the marketplace, and which one somebody wants depends on what
 * they said. Listing both and letting the answer choose beats picking for them.
 */
const DESTINATIONS: Record<NavTopic, VoyagerActionId[]> = {
  learn_free: ['open_academy'],
  // The paid catalogue lives inside Academy's marketplace section; the action
  // that opens Academy is the honest door until that catalogue has one of its own.
  learn_paid: ['open_academy'],
  expert_help: ['open_experts', 'open_experts_intake'],
  practice: ['open_practice'],
  charts: ['open_chart'],
  market_data: ['open_explore', 'open_symbol'],
  news: ['open_news'],
  economy: ['open_economy', 'open_indicator'],
  events: ['open_events'],
  my_events: ['open_my_events'],
  compare_assets: ['open_explore', 'open_screener'],
  watchlist: ['open_watchlist', 'add_to_watchlist'],
  alerts: ['create_alert'],
  research_workspace: ['open_research'],
  screener: ['open_screener'],
  strategy: ['open_strategy'],
  wealth: ['open_wealth', 'open_wealth_insights'],
  symbol: ['open_symbol', 'open_chart'],
};

export function isNavTopic(value: unknown): value is NavTopic {
  return typeof value === 'string' && (NAV_TOPICS as readonly string[]).includes(value);
}

export type NavDestination = {
  action: VoyagerActionId;
  label: string;
  where: string;
  /** True when pressing it changes something and will be confirmed first. */
  writes: boolean;
};

/**
 * The destinations for a topic, narrowed to what this request may offer.
 *
 * The narrowing matters: a Basic visitor asking about their portfolio must not
 * be told the Wealth Hub is where to go, because the action that opens it was
 * never on this request's list. An empty result is a real answer — it means the
 * portal has nothing for that need at this tier, and saying so is better than
 * naming a screen that will refuse them.
 */
export function findDestinations(
  topic: unknown,
  allowed: VoyagerActionId[]
): VoyagerToolResult<{ topic: NavTopic; destinations: NavDestination[] }> {
  if (!isNavTopic(topic)) {
    return toolFailure(
      'bad_arguments',
      'That is not a kind of destination this portal knows about.',
      false
    );
  }

  const destinations = DESTINATIONS[topic]
    .filter((action) => allowed.includes(action))
    .map((action): NavDestination => {
      const spec = specFor(action);
      return {
        action,
        label: spec.label,
        where: spec.where,
        writes: spec.execution === 'mutate' || spec.execution === 'prepare',
      };
    });

  if (destinations.length === 0) {
    return toolFailure(
      'not_permitted',
      'There is somewhere for that, but not on this plan or this page.',
      false
    );
  }

  return {
    ok: true,
    data: { topic, destinations },
    summary: `${topic}: ${destinations.map((d) => `${d.action} (${d.where})`).join('; ')}`,
  };
}
