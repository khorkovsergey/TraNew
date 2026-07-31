import type { VoyagerAnswer, VoyagerContext, VoyagerTier } from './types';

/**
 * Scripted answers — the handoff's response scenarios.
 *
 * This layer exists for two reasons. It is the demo behaviour when no model is
 * configured, and it is the fallback when a model call fails: a widget that goes
 * silent teaches people not to trust it, so an honest scripted answer marked
 * `simulated` is better than an error toast.
 *
 * Answers here follow the same rules the model is held to — probabilistic
 * language, a content-type label, and a sources line — so the UI never has to
 * care which layer produced the response.
 */

export function scriptedAnswer(
  question: string,
  context: VoyagerContext,
  tier: VoyagerTier
): VoyagerAnswer {
  const base = byScreen(question, context, tier);
  return { ...base, simulated: true };
}

function byScreen(
  question: string,
  context: VoyagerContext,
  tier: VoyagerTier
): VoyagerAnswer {
  const subject = context.subject;

  switch (context.screen) {
    case 'chart':
    case 'symbol':
      return tier === 'private'
        ? {
            contentType: 'AI analysis',
            text: `${subject} is trading above its 50-day moving average. In the visible period the move is accompanied by volume around 32% above the 30-day average.`,
            bullets: [
              'Momentum remains positive; RSI is approaching overbought',
              context.facts?.position
                ? `You hold ${context.facts.position} — position context applied`
                : 'You hold no position in this asset',
              'Main risk: single-company concentration',
            ],
            sources: 'market data 09:45 UTC · 6 news items',
            confidence: 'medium',
            actions: [
              { label: 'Create alert', action: 'create_alert', primary: true },
              { label: 'Compare with sector', action: 'open_screener' },
              { label: 'Find related news', action: 'open_news' },
            ],
            followUps: ['What are the key risks?', 'Compare with sector', 'Show key levels'],
          }
        : {
            contentType: 'AI explanation',
            text: `In the visible period ${subject} moved on higher-than-usual volume. Reporting points to results and guidance as the likely driver, though a single day's move may reflect broader market flows as well.`,
            bullets: [
              'Volume is elevated versus the 30-day average',
              'Signals describe behaviour — not a recommendation',
            ],
            sources: 'market data 09:45 UTC · Reuters 09:12',
            confidence: 'medium',
            actions: [
              { label: 'Create an alert', action: 'create_alert', primary: true },
              { label: 'Find related news', action: 'open_news' },
              { label: 'Explain in simple terms', action: 'none' },
            ],
            followUps: ['What are the key risks?', 'Compare with sector', 'Create an alert'],
          };

    case 'wealth':
      return {
        contentType: 'AI analysis',
        text: 'Three things look worth attention: the apartment valuation is nine months old, a term deposit matures in 47 days, and around 60% of capital is tied to one jurisdiction.',
        bullets: [
          'Liquid within 30 days: a minority of total wealth',
          'Concentration: a single business is roughly a third of the record',
          'Rental cash flow is positive but small relative to the asset',
        ],
        sources: 'Wealth Profile · market data 09:45 UTC',
        confidence: 'medium',
        actions: [
          { label: 'Update valuation', action: 'open_wealth_assets', primary: true },
          { label: 'Run deposit scenario', action: 'open_wealth_scenarios' },
          { label: 'See Wealth Health', action: 'open_wealth_insights' },
        ],
        followUps: [
          'How liquid is my capital?',
          'Check my concentration risks',
          'What if I sell the apartment?',
        ],
      };

    case 'experts':
      return {
        contentType: 'AI structured',
        text: 'For a portfolio review you most likely need a regulated adviser or a financial planner. I can prepare your request so the consultation is productive from the first minute.',
        bullets: [
          'Match by asset types, jurisdiction and language',
          'Prepare a brief and a question list',
          'You approve every piece of shared data separately',
        ],
        sources: 'Expert Marketplace directory',
        confidence: 'high',
        actions: [
          { label: 'Structure my request', action: 'open_experts_intake', primary: true },
          { label: 'Show matching experts', action: 'open_experts' },
        ],
        followUps: [
          'Which expert type do I need?',
          'Prepare questions for a consultation',
          'What will they see about me?',
        ],
      };

    case 'academy':
      return {
        contentType: 'Academy context',
        text: "Put simply: investing is exchanging money you don't need today for assets that may grow or pay income — accepting short-term swings in exchange for long-term potential.",
        bullets: ['This rephrases the current lesson — the quiz answer stays yours to find'],
        sources: 'Current lesson',
        confidence: 'high',
        actions: [
          { label: 'Continue lesson', action: 'open_academy', primary: true },
          { label: 'Another example', action: 'none' },
          { label: 'Quiz me', action: 'none' },
        ],
        followUps: ['Give me another example', 'Explain this more simply', 'Quiz me'],
      };

    case 'economy':
    case 'indicator':
      return {
        contentType: 'AI explanation',
        text: 'US inflation came in above expectations, with services prices falling more slowly than goods. That tends to keep policy rates restrictive for longer, though one release rarely settles the direction on its own.',
        bullets: [
          'Rate-cut odds for the next meeting moved lower after the release',
          'Long-duration bonds and growth stocks are usually most sensitive',
        ],
        sources: 'BLS release · market pricing 09:45 UTC',
        confidence: 'medium',
        actions: [
          { label: 'Open US CPI', action: 'open_indicator', primary: true },
          { label: 'Affected assets', action: 'open_explore' },
          {
            label: tier === 'private' ? 'Impact on my wealth' : 'Learn how this works',
            action: tier === 'private' ? 'open_wealth' : 'open_academy',
          },
        ],
        followUps: [
          'How do rates affect bonds?',
          'What should I watch this week?',
          'Compare US and Eurozone',
        ],
      };

    case 'news':
      return {
        contentType: 'AI summary',
        text: "Today's flow is dominated by rate expectations and earnings guidance. Individual headlines matter less than whether they change the expected path of policy.",
        bullets: [
          'Macro releases are driving more of the move than company news',
          'A single headline rarely explains a whole session',
        ],
        sources: 'news feed 09:45 UTC',
        confidence: 'low',
        actions: [
          { label: 'Open the economy overview', action: 'open_economy', primary: true },
          { label: 'Explore markets', action: 'open_explore' },
        ],
        followUps: [
          'How does this affect my watchlist?',
          'Explain why markets reacted',
          'Summarize what matters today',
        ],
      };

    default:
      return {
        contentType: 'AI explanation',
        text: `I can help with that. The fastest path: tell me your goal, and I'll open the right tool with your context already filled in — search, the strategy builder, Academy or an expert.${question.length > 120 ? '' : ''}`,
        bullets: [],
        sources: 'Current page',
        confidence: 'high',
        actions: [
          { label: 'Build my strategy', action: 'open_strategy', primary: true },
          { label: 'Explore markets', action: 'open_explore' },
          { label: 'Start learning', action: 'open_academy' },
          { label: 'Find an expert', action: 'open_experts' },
        ],
        followUps: [
          'How do I start investing?',
          'Find a tool for me',
          'What can I do on this page?',
        ],
      };
  }
}

/** Shown when the daily limit is reached — the value explanation, not a wall. */
export function quotaAnswer(): VoyagerAnswer {
  return {
    contentType: 'AI explanation',
    text: 'I can keep going with general explanations, but saving history, working with your portfolio and personalised answers need an account.',
    bullets: [],
    sources: 'Account status',
    confidence: 'high',
    actions: [],
    followUps: [],
    simulated: true,
  };
}
