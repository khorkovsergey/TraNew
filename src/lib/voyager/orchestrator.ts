import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { analyze } from '@/lib/investment/graph';
import { summarise } from '@/lib/investment/summary';
import { clampSpec } from '@/lib/studies/registry';
import { ANSWER_SCHEMA, CONTENT_TYPES } from './answerSchema';
import { MAX_SEARCHES, wantsSearch } from './research';
import { scriptedAnswer } from './scenarios';
import {
  VOYAGER_ACTIONS,
  type VoyagerAction,
  type VoyagerActionId,
  type VoyagerAnswer,
  type VoyagerContentType,
  type VoyagerContext,
  type VoyagerSource,
  type VoyagerTier,
} from './types';

/**
 * The model orchestrator.
 *
 * Three constraints shape this file:
 *
 * - **The model never writes a link.** It picks an action id from a list this
 *   request allows, and the widget resolves that to a route. A model that could
 *   emit its own URL could send someone anywhere, including off the site.
 * - **The allowed list is narrowed per request**, so a Basic visitor's answer
 *   cannot offer to open a wealth screen they have no access to. Entitlement is
 *   enforced by what the model can choose from, not by asking it nicely.
 * - **A failed call falls back to the scripted layer**, marked `simulated`. A
 *   widget that goes silent or throws teaches people not to rely on it; an honest
 *   general answer is a better failure.
 *
 * The upgrade card is added by the policy layer afterwards. Whether to sell
 * someone a plan is not a decision to hand to a language model mid-sentence.
 */

const MODEL = 'claude-opus-5';

/**
 * Interactive widget: the answer is short, and latency is visible to the person
 * waiting. `medium` is the starting point rather than a conclusion — worth
 * re-testing against real questions before settling.
 */
const EFFORT = 'medium';

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export function isModelConfigured(): boolean {
  return client !== null;
}



/**
 * The stable half of the system prompt.
 *
 * Kept byte-identical across requests so it can be cached: the per-request part
 * (tier, page, sources) goes in a second block after the cache breakpoint.
 */
const RULES = `You are Voyager, the assistant built into the TradingNew investment research platform.

You explain, analyse, navigate and help people act. You are talking to someone who is researching investments — often a beginner. Your job is to leave them better informed and more capable of deciding for themselves.

## Pine Script: you write it, you never run it

You can write, explain, modify and debug Pine Script. You cannot execute it, and there is no version of this platform where you can — running it needs TradingView's own engine, which this product does not reimplement.

So whenever you produce or discuss Pine, say plainly that it has not been run. Word it as a permanent limit, never as a feature that has not arrived: not "not yet supported", but "I cannot run it here". Tell the person the code is a draft to review and test on a chart themselves, and never describe it as verified, backtested or checked against live data. Somebody who believes it was tested is somebody who will trade on an untested script.

If they ask you to run, backtest or execute a script, say that you cannot and offer what you can do instead: write it, walk through what each line does, or explain what to look for when they test it.

## How you talk about markets

Write probabilistically. Markets are uncertain and you must never imply otherwise.

- Good: "may indicate", "tends to", "reporting points to", "this does not confirm"
- Never: "will rise", "is guaranteed to", "you should buy", "you need to sell", "this is a safe bet"

Never give personalised investment advice, never tell someone what to buy or sell, and never predict a price. You may describe what happened, what typically drives that kind of move, what the risks are, and what someone might look at next. If a question asks you to predict or to recommend a trade, answer the useful part — the mechanics, the risks, what to watch — and say plainly that the decision is theirs.

Describe signals as behaviour, not instruction: "RSI approaching overbought describes momentum, not a recommendation."

## Honesty about what you know

The sources line must reflect what you actually used. If you are reasoning from general knowledge rather than the page context, say so and set confidence to low. Never invent a figure, a timestamp, a headline or a news source. If a specific number would be needed to answer well and you do not have it, say which number is missing.

Set confidence honestly: high when the answer is definitional or procedural, medium when you are interpreting market behaviour, low when you are generalising without the specific data.

## Answer shape

Keep the main text to two or three sentences. Put observations in bullets — at most four, each one line. Prefer being useful to being complete.

Choose the content type label honestly:
- "AI explanation" — explaining a concept, an event, or a move
- "AI analysis" — interpreting data, including the person's own context
- "AI summary" — condensing news or a document
- "AI structured" — producing a structured artefact such as a brief or a checklist
- "Academy context" — anything on a lesson page

## Academy rule

On a lesson page you may re-explain the material differently, give another example, or check understanding with a question of your own. You must not give the answer to the lesson's quiz, even if asked directly — say that the answer is theirs to find and offer another explanation instead.

## Actions

Offer two to four actions. Choose them from the allowed list given below and use the exact id. Write a short label in the person's language of the question. Put the most useful one first — it renders as the primary button. If nothing in the list fits, use "none" with a label that continues the conversation.

Never offer an action that executes a financial transaction; nothing in the list does, and you must not describe an action as placing an order.

**Never describe a control in prose. If you mean a button, emit the action.** Sentences like "the button below opens the chart" or "use the link underneath" are how somebody ends up looking for something that is not on their screen — the only buttons that exist are the ones you put in the actions array. If somebody asks to see a chart, a symbol, the news or the screener, put the matching action in that array and say what it does; do not narrate a button instead of offering one, and do not refer to your own answer's layout at all.

When you cannot do the thing itself, say what you cannot do and then offer the action that gets closest, rather than implying the thing happened somewhere else on the page.

## Chart studies

On the chart screen you may attach one study to your answer using the "study" field: sma (moving averages), rsi, bbands (Bollinger Bands) or macd. Attach a study only when the person asks to see, add or apply an indicator, or asks a question that a specific indicator directly illustrates. Explain in the text what the study describes and what its limits are. A study describes behaviour, never a recommendation: never present overbought, oversold, a crossover or a band touch as a signal to buy or sell.

If the person asks for an indicator that is not in the list, say which studies are available here and that the full library lives in the professional layout.

## Follow-ups

Suggest exactly three short follow-up questions the person might ask next, phrased as they would type them.`;



/**
 * Which actions this request may offer.
 *
 * Narrowing here is the enforcement point: an answer physically cannot contain a
 * wealth action for someone whose tier or consent does not reach the wealth
 * record, because the model was never shown that option.
 */
function allowedActions(context: VoyagerContext, tier: VoyagerTier): VoyagerActionId[] {
  const common: VoyagerActionId[] = [
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
    'open_screener',
    // Events are public, so finding one is offered at every tier. "My events"
    // is too — an anonymous visitor lands on the sign-in prompt, which is the
    // intended path.
    'open_events',
    'open_my_events',
    // Only where there is a chart to reveal the code on. Everywhere else the
    // action would resolve to nothing and the button would be a dead end.
    ...(context.screen === 'chart' ? (['view_pine'] as VoyagerActionId[]) : []),
    // Offered at every tier: an anonymous visitor lands on the sign-in prompt,
    // which is the intended path. This list exists to stop the model inventing a
    // destination, not to re-implement route protection the server already does.
    'create_alert',
    'open_watchlist',
    'none',
  ];

  if (tier === 'private') {
    common.push('open_wealth', 'open_wealth_assets', 'open_wealth_scenarios', 'open_wealth_insights');
  }

  // On a lesson page, keep the person in the lesson rather than routing them away.
  if (context.screen === 'academy') {
    return ['open_academy', 'open_explore', 'none'];
  }

  return common;
}

function requestBrief(
  context: VoyagerContext,
  tier: VoyagerTier,
  sources: VoyagerSource[],
  actions: VoyagerActionId[]
): string {
  const factLines = context.facts
    ? Object.entries(context.facts).map(([key, value]) => `- ${key}: ${value}`)
    : [];

  const tierNote = {
    basic:
      'Voyager Basic — an anonymous visitor. You know the page and public market data. You do not know who they are, what they hold, or what they have asked before. Do not imply otherwise.',
    personal:
      'Voyager Personal — signed in. You may use their stated interests and watchlist where the sources below allow it. You do not have their portfolio.',
    private:
      'Voyager Private — signed in with the full context tier. Where the sources below include the wealth record, you may reason with their own figures and say so.',
  }[tier];

  return [
    `## This request`,
    ``,
    `Tier: ${tierNote}`,
    ``,
    `Page: ${context.screen} — ${context.subject}`,
    ...(factLines.length ? [``, `Known about what is on screen:`, ...factLines] : []),
    ``,
    `Context sources available to you (anything not listed here you do not have; the person switched the rest off):`,
    ...sources.map((source) => `- ${source.label}`),
    ...(sources.length === 0 ? ['- none — the person switched every source off; answer generally and say so'] : []),
    ``,
    `Allowed action ids for this answer:`,
    ...actions.map((id) => `- ${id}: ${VOYAGER_ACTIONS[id]}`),
  ].join('\n');
}

/** Keeps a model response inside the contract even if it drifts from the schema. */
function coerce(raw: unknown, allowed: VoyagerActionId[], studiesAllowed: boolean): VoyagerAnswer | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as Record<string, unknown>;

  if (typeof value.text !== 'string' || value.text.trim() === '') return null;

  const contentType = CONTENT_TYPES.includes(value.contentType as VoyagerContentType)
    ? (value.contentType as VoyagerContentType)
    : 'AI explanation';

  const confidence =
    value.confidence === 'low' || value.confidence === 'high' ? value.confidence : 'medium';

  const strings = (input: unknown): string[] =>
    Array.isArray(input) ? input.filter((x): x is string => typeof x === 'string') : [];

  const actions: VoyagerAction[] = (Array.isArray(value.actions) ? value.actions : [])
    .map((entry): VoyagerAction | null => {
      if (typeof entry !== 'object' || entry === null) return null;
      const item = entry as Record<string, unknown>;
      const id = item.action;
      if (typeof item.label !== 'string' || typeof id !== 'string') return null;
      // Dropped rather than remapped: an action outside the allowlist is one this
      // person is not entitled to, and quietly substituting another would be worse.
      if (!allowed.includes(id as VoyagerActionId)) return null;
      return { label: item.label, action: id as VoyagerActionId };
    })
    .filter((entry): entry is VoyagerAction => entry !== null)
    .slice(0, 4);

  if (actions.length > 0) actions[0].primary = true;

  /*
   * Two gates, both of which have to pass. The screen decides whether a study is
   * allowed at all — a study attached from the wealth page is dropped without
   * comment — and `clampSpec` decides whether this particular one exists and
   * whether its numbers are usable. An unknown id yields no study rather than a
   * substitute, and the answer around it renders exactly as it would have.
   */
  const study = studiesAllowed
    ? (clampSpec(value.study as { id?: unknown; params?: unknown }) ?? undefined)
    : undefined;

  return {
    contentType,
    text: value.text,
    bullets: strings(value.bullets).slice(0, 4),
    sources: typeof value.sources === 'string' ? value.sources : 'General knowledge',
    confidence,
    actions,
    followUps: strings(value.followUps).slice(0, 3),
    ...(study ? { study } : {}),
  };
}

/**
 * Applies the allowlist to any answer, whichever layer produced it.
 *
 * The scripted layer goes through this too, so the guarantee holds uniformly: no
 * answer from any source can offer an action this request does not permit.
 */
function withAllowedActions(
  answer: VoyagerAnswer,
  allowed: VoyagerActionId[],
  studiesAllowed: boolean
): VoyagerAnswer {
  const actions = answer.actions
    .filter((action) => allowed.includes(action.action))
    .slice(0, 4)
    .map((action, index) => ({ ...action, primary: index === 0 }));

  // The screen gate applies to every layer, not only the model's. A scripted
  // answer is structurally safe today because studies only appear in the chart
  // case, but "safe by how it happens to be written" is not the guarantee this
  // function exists to make.
  const study = studiesAllowed ? answer.study : undefined;

  return { ...answer, actions, ...(study ? { study } : { study: undefined }) };
}

/**
 * The hosts a web search actually returned, in the order they came back.
 *
 * Read off the response rather than off the model's prose: the sources line is
 * written by the model and can be wrong, while these blocks are the record of
 * what was fetched. Deduplicated by host, because five pages from one site is
 * one source with five pages.
 */
function searchCitations(content: unknown[]): { label: string; detail?: string }[] {
  const seen = new Set<string>();
  const found: { label: string; detail?: string }[] = [];

  for (const block of content) {
    const entry = block as { type?: string; content?: unknown };
    if (entry?.type !== 'web_search_tool_result' || !Array.isArray(entry.content)) continue;

    for (const item of entry.content) {
      const result = item as { url?: unknown; page_age?: unknown };
      if (typeof result.url !== 'string') continue;

      let host: string;
      try {
        host = new URL(result.url).hostname.replace(/^www\./, '');
      } catch {
        continue;
      }

      if (seen.has(host)) continue;
      seen.add(host);
      found.push({
        label: host,
        detail: typeof result.page_age === 'string' ? result.page_age : undefined,
      });
    }
  }

  return found;
}

/** How many searches ran, so the tool chip can say so rather than imply one. */
function searchCount(content: unknown[]): number {
  return content.filter((block) => (block as { type?: string }).type === 'server_tool_use').length;
}

export async function askVoyager(options: {
  question: string;
  context: VoyagerContext;
  tier: VoyagerTier;
  sources: VoyagerSource[];
  history: { role: 'user' | 'assistant'; text: string }[];
}): Promise<VoyagerAnswer> {
  const { question, context, tier, sources, history } = options;
  const allowed = allowedActions(context, tier);
  const scripted = () =>
    withAllowedActions(scriptedAnswer(question, context, tier), allowed, context.screen === 'chart');

  /*
   * An investment question runs the engine rather than the model.
   *
   * The engine computes every figure, cites every claim and refuses the ones it
   * cannot support — none of which a chat answer does. So when someone asks
   * whether something is worth holding, the answer is the assessment, and the
   * model is not asked to produce a second, less careful one alongside it.
   */
  if (wantsInvestmentAnalysis(question, context)) {
    const assessment = await runInvestmentAnalysis(question, context);
    if (assessment) {
      return withAllowedActions(
        {
          ...assessment,
          tools: [`investment-analysis(${context.subject || 'this instrument'})`],
        },
        allowed,
        context.screen === 'chart'
      );
    }
  }

  if (!client) {
    return scripted();
  }

  /*
   * Whether this question is worth going to look something up for.
   *
   * Search runs on Anthropic's infrastructure — nothing is fetched from the
   * browser, which is what §11 of the brief asks for — and it is billed per
   * search on top of tokens. So it opens for questions that turn on something
   * that happened and stays shut for questions about how things work, which do
   * not change and are already answered from this repository.
   *
   * `VOYAGER_WEB_SEARCH=off` stops it without a deploy. A feature that spends
   * money per use needs a switch that is not a git push.
   */
  const searching = wantsSearch(question, process.env.VOYAGER_WEB_SEARCH !== 'off');

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      ...(searching
        ? {
            tools: [
              {
                type: 'web_search_20260209' as const,
                name: 'web_search' as const,
                max_uses: MAX_SEARCHES,
              },
            ],
          }
        : {}),
      system: [
        // Stable across every request, so it caches; the volatile brief follows it.
        { type: 'text', text: RULES, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: requestBrief(context, tier, sources, allowed) },
        ...(searching
          ? [
              {
                type: 'text' as const,
                text: `You may search the web for this question. Use it for facts that changed — prices, filings, forecasts, dates — and not for definitions. Every claim that came from a search must name where it came from in the sources field. Do not present a searched claim as more certain than the source made it, and if the searches do not answer the question, say what is missing rather than filling the gap.`,
              },
            ]
          : []),
      ],
      output_config: {
        effort: EFFORT,
        format: { type: 'json_schema', schema: ANSWER_SCHEMA },
      },
      messages: [
        ...history.slice(-8).map((turn) => ({
          role: turn.role,
          content: turn.text,
        })),
        { role: 'user' as const, content: question },
      ],
    });

    if (response.stop_reason === 'refusal') {
      return {
        contentType: 'AI explanation',
        text: 'I can’t help with that one. If you rephrase it as a question about how something works or what the risks are, I can take another look.',
        bullets: [],
        sources: 'Declined by safety policy',
        confidence: 'high',
        actions: [],
        followUps: [],
      };
    }

    /*
     * The last text block, not the first.
     *
     * Without tools there is exactly one and the distinction is academic. With
     * web search the content array also carries the search calls and their
     * results, and any text the model wrote on the way — so `find` would return
     * a sentence about what it was about to look up, and the answer would be
     * dropped for failing to parse as JSON.
     */
    const texts = response.content.filter((entry) => entry.type === 'text');
    const block = texts[texts.length - 1];
    if (!block || block.type !== 'text') {
      return scripted();
    }

    const coerced = coerce(JSON.parse(block.text), allowed, context.screen === 'chart');
    if (!coerced) return scripted();

    /*
     * What ran, named from the response rather than from the intent.
     *
     * `searching` only says search was *offered*; a question the model answered
     * without looking anything up must not show a search chip, or the chip
     * stops meaning anything.
     */
    const searches = searchCount(response.content);
    const tools = [
      ...(searches > 0 ? [`web-search(${searches})`] : []),
      ...(coerced.study ? [`study(${coerced.study.id})`] : []),
    ];

    return {
      ...coerced,
      ...(tools.length ? { tools } : {}),
      ...(searches > 0 ? { citations: searchCitations(response.content) } : {}),
    };
  } catch (error) {
    // Surfaced in the server log rather than to the person: the scripted answer
    // below is honest about being general, and an error toast is not more useful.
    console.error('[voyager] model call failed, falling back to scripted answer', error);
    return scripted();
  }
}

/* ------------------------------------------------ Investment analysis */

/**
 * Whether this question wants an assessment rather than an explanation.
 *
 * Substring matching, and deliberately narrow: an assessment is a heavier,
 * slower and more committing answer than a chat reply, so the bar for producing
 * one unasked is high. "Explain this chart" is not an investment question;
 * "is this worth holding" is.
 */
function wantsInvestmentAnalysis(question: string, context: VoyagerContext): boolean {
  if (context.screen !== 'symbol' && context.screen !== 'chart') return false;

  const q = question.toLowerCase();
  const asks = [
    'worth holding',
    'worth buying',
    'worth considering',
    'good investment',
    'should i invest',
    'long-term portfolio',
    'long term portfolio',
    'analyse this company',
    'analyze this company',
    'investment analysis',
    'is it overvalued',
    'is it undervalued',
    'fundamentals',
  ];

  return asks.some((phrase) => q.includes(phrase));
}

async function runInvestmentAnalysis(
  question: string,
  context: VoyagerContext
): Promise<VoyagerAnswer | null> {
  try {
    const assessment = await analyze({
      runId: `voyager_${Date.now().toString(36)}`,
      mode: 'standard',
      asOf: new Date().toISOString().slice(0, 10),
      pageContext: {
        pageType: context.screen,
        pageUrl: null,
        locale: 'en',
        country: null,
        selectedMarket: null,
        selectedInstrument: context.subject,
        visibleModules: [],
        userQuestion: question,
      },
      chartContext: null,
      // No portfolio is passed here: the widget has no consent to share one, so
      // the assessment says what it cannot judge rather than guessing.
      user: null,
    });

    const summary = summarise(assessment);

    return {
      contentType: 'AI analysis',
      text: `${summary.instrumentName}: the evidence available leans ${summary.stance.replace(/_/g, ' ')} over ${summary.horizon.replace(/_/g, ' ')}. Every figure below was computed rather than written, and each is traceable to a dated source.`,
      bullets: [],
      sources: `${summary.evidence.length} sources · analysis dated ${summary.analysisAsOf}`,
      confidence: summary.confidenceLabel,
      actions: [],
      followUps: [
        'What would change this assessment?',
        'Show me the arithmetic',
        'Mark these levels on the chart',
      ],
      investment: summary,
    };
  } catch (error) {
    // A failed analysis falls back to an ordinary answer rather than an error:
    // the person asked a question, and "the engine broke" is not a reply to it.
    console.error('[voyager] investment analysis failed', error);
    return null;
  }
}
