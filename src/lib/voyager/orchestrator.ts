import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { InvestmentSummary } from '@/lib/investment/summary';
import { clampSpec } from '@/lib/studies/registry';
import { ANSWER_SCHEMA, CONTENT_TYPES } from './answerSchema';
import { MAX_SEARCHES } from './research';
import { scriptedAnswer } from './scenarios';
import { allowedActions, briefFor, isVoyagerActionId } from './actions';
import {
  resultForModel,
  runToolCalls,
  toolSpecsFor,
  type ToolCall,
  type VoyagerToolContext,
} from './tools/registry';
import {
  MAX_TOOL_STEPS,
  traceChips,
  type ToolTraceEntry,
  type VoyagerToolResult,
} from './tools/types';
import { chartFromComparison, chartFromHistory } from './chart/build';
import type { ComparisonResult } from './tools/comparison';
import type { HistoryResult } from './tools/marketData';
import {
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
 * The list is `actions.ts`, so the widget, the chat and the model are narrowed
 * by one function. Narrowing is the enforcement point: an answer physically
 * cannot contain a wealth action for someone whose tier does not reach the
 * wealth record, because the model was never shown that option — and it cannot
 * offer to add something to a watchlist on a page with no instrument on it,
 * which is how the fixed action row used to read.
 */
function actionsFor(context: VoyagerContext, tier: VoyagerTier): VoyagerActionId[] {
  return allowedActions({
    screen: context.screen,
    tier,
    hasTicker: Boolean(context.facts?.ticker),
  });
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
    ...actions.map((id) => `- ${id}: ${briefFor(id)}`),
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
      if (typeof item.label !== 'string' || !isVoyagerActionId(id)) return null;
      // Dropped rather than remapped: an action outside the allowlist is one this
      // person is not entitled to, and quietly substituting another would be worse.
      if (!allowed.includes(id)) return null;
      return { label: item.label, action: id };
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
  const allowed = actionsFor(context, tier);

  /*
   * The demo layer, and only for the case it was written for.
   *
   * With no key configured every answer on this deployment is written rather
   * than generated, which is what the scripted layer is for and what its label
   * says. It is *not* what to serve when a model call fails — see `incomplete`.
   */
  const scripted = () =>
    withAllowedActions(scriptedAnswer(question, context, tier), allowed, context.screen === 'chart');

  if (!client) {
    return scripted();
  }

  const toolContext: VoyagerToolContext = {
    screen: context.screen,
    subject: context.subject,
    question,
    tier,
    allowedActions: allowed,
  };

  const customTools = toolSpecsFor(toolContext);

  /*
   * Search is offered; the planner decides whether to use it.
   *
   * It used to be gated by a list of English words — "today", "earnings",
   * "why did" — checked against the question before the model saw it. That
   * spent nothing on definitions, which was the point, and it also meant
   * "почему сегодня упала Tesla" was answered from memory while its English
   * twin was researched. A gate that works in one language is not a gate, it is
   * a bias.
   *
   * The spend is still bounded, in three ways that do not depend on language:
   * billing is per search actually run rather than per offer, `max_uses` caps
   * one answer, and `VOYAGER_WEB_SEARCH=off` stops it without a deploy. The
   * instruction not to search definitions moves into the prompt, where the
   * model can apply it to any language.
   */
  const searching = process.env.VOYAGER_WEB_SEARCH !== 'off';

  const tools = [
    ...customTools,
    ...(searching
      ? [
          {
            type: 'web_search_20260209' as const,
            name: 'web_search' as const,
            max_uses: MAX_SEARCHES,
          },
        ]
      : []),
  ];

  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-8).map((turn) => ({
      role: turn.role,
      content: turn.text,
    })),
    { role: 'user' as const, content: question },
  ];

  /* What actually ran, accumulated across the rounds. */
  const trace: ToolTraceEntry[] = [];
  const seen = new Map<string, VoyagerToolResult>();
  const citations: { label: string; detail?: string }[] = [];
  let searches = 0;
  let investment: InvestmentSummary | undefined;
  let lastHistory: HistoryResult | undefined;
  let lastComparison: ComparisonResult | undefined;

  try {
    /*
     * The bounded agent loop.
     *
     * One extra pass beyond the cap, with tools switched off, so the last thing
     * that happens is always an answer. A loop that runs out of steps mid-tool
     * would otherwise return the scripted layer to somebody whose question was
     * being worked on correctly.
     */
    for (let step = 0; step <= MAX_TOOL_STEPS; step += 1) {
      const last = step === MAX_TOOL_STEPS;

      const response = await client.messages.create({
        model: MODEL,
        /*
         * Headroom, because this model thinks by default and `max_tokens`
         * bounds the thinking and the reply together. Eight thousand was
         * comfortable for a single-shot answer and is not for one that has read
         * several tool results first — and the reply it truncates is JSON, so
         * the failure arrives as a parse error rather than as a short answer.
         */
        max_tokens: 16000,
        ...(tools.length ? { tools } : {}),
        // On the final pass the tools stay declared — the history contains
        // their calls and results — but nothing new may be started.
        ...(last && tools.length ? { tool_choice: { type: 'none' as const } } : {}),
        system: [
          // Stable across every request, so it caches; the volatile brief follows it.
          { type: 'text', text: RULES, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: requestBrief(context, tier, sources, allowed) },
          { type: 'text', text: toolBrief(searching, customTools.length > 0) },
        ],
        output_config: {
          effort: EFFORT,
          format: { type: 'json_schema', schema: ANSWER_SCHEMA },
        },
        messages,
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

      searches += searchCount(response.content);
      citations.push(...searchCitations(response.content));

      /*
       * The server ran its own tool loop to its limit and stopped mid-turn.
       * Re-sending the assistant turn resumes it where it left off; adding a
       * "continue" message would be read as a new instruction.
       */
      if (response.stop_reason === 'pause_turn') {
        messages.push({ role: 'assistant', content: response.content });
        continue;
      }

      if (response.stop_reason === 'tool_use') {
        const calls: ToolCall[] = response.content
          .filter((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use')
          .map((block) => ({
            id: block.id,
            name: block.name,
            input: (block.input ?? {}) as Record<string, unknown>,
          }));

        const executed = await runToolCalls(calls, toolContext, seen);

        messages.push({ role: 'assistant', content: response.content });
        messages.push({
          role: 'user',
          content: executed.map((call) => ({
            type: 'tool_result' as const,
            tool_use_id: call.toolUseId,
            content: resultForModel(call.result),
            is_error: !call.result.ok,
          })),
        });

        for (const call of executed) {
          trace.push(call.trace);
          /*
           * The assessment travels as itself, not as prose the model wrote
           * about it. Every figure in that card was computed and is traceable;
           * a paraphrase of it would be neither.
           */
          if (call.trace.id === 'investment_analysis' && call.result.ok) {
            investment = call.result.data as InvestmentSummary;
          }
          /*
           * The last market result is kept so a chart can be drawn from it.
           * Kept rather than drawn now: the model has not yet said which view
           * it wants, and a chart built before that choice would be a second
           * chart to reconcile with the one that ends up on screen.
           */
          if (call.trace.id === 'get_history' && call.result.ok) {
            lastHistory = call.result.data as HistoryResult;
          }
          if (call.trace.id === 'compare_assets' && call.result.ok) {
            lastComparison = call.result.data as ComparisonResult;
          }
        }
        continue;
      }

      /*
       * The last text block, not the first.
       *
       * With tools the content array also carries the calls, their results and
       * any text the model wrote on the way — so `find` would return a sentence
       * about what it was about to look up, and the answer would be dropped for
       * failing to parse as JSON.
       */
      /*
       * Cut off mid-answer.
       *
       * `max_tokens` bounds thinking and response text together on this model,
       * and a truncated reply is truncated JSON: parsing it throws, the throw
       * is caught below, and what the person used to get was this platform's
       * written navigation blurb presented as the answer to their market
       * question. Recognised here so it is reported as what it is.
       *
       * It is also the likeliest thing to bite a question asked in a language
       * that tokenises longer than English, on a run that also spent its budget
       * on several tool results — which is the shape of the failure that was
       * reported from production.
       */
      if (response.stop_reason === 'max_tokens') {
        return incomplete('the answer ran past its length budget');
      }

      const texts = response.content.filter((entry) => entry.type === 'text');
      const block = texts[texts.length - 1];
      if (!block || block.type !== 'text') {
        return incomplete('the model returned no answer text');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(block.text);
      } catch {
        return incomplete('the answer did not come back as a complete structure');
      }

      const coerced = coerce(parsed, allowed, context.screen === 'chart');
      if (!coerced) return incomplete('the answer came back without any text in it');

      /*
       * The chips are read off what returned, never off what was offered. A
       * question the model answered without looking anything up shows no search
       * chip, or the chip stops meaning anything.
       */
      /*
       * The chart, built from the data that was fetched and the view the model
       * asked for — in that order, and never the other way round. A comparison
       * outranks a single history because somebody who asked for both wanted
       * the comparison; the single fetch was a step towards it.
       */
      const chart = lastComparison
        ? chartFromComparison(lastComparison)
        : lastHistory
          ? chartFromHistory(lastHistory, requestedChart(block.text))
          : null;

      const chips = [
        ...(searches > 0 ? [`web-search(${searches})`] : []),
        ...traceChips(trace),
        ...(chart ? [`chart(${chart.spec.kind})`] : []),
        ...(coerced.study ? [`study(${coerced.study.id})`] : []),
      ];

      return {
        ...coerced,
        ...(investment ? { investment } : {}),
        ...(chart ? { chart } : {}),
        ...(chips.length ? { tools: chips } : {}),
        ...(trace.length ? { trace } : {}),
        ...(citations.length ? { citations: dedupeCitations(citations) } : {}),
      };
    }

    // Every pass produced a tool call and none produced an answer. Structurally
    // unreachable — the final pass cannot call tools — and handled anyway.
    return incomplete('the answer never settled');
  } catch (error) {
    console.error('[voyager] model call failed', error);
    return incomplete('the model could not be reached');
  }
}

/**
 * A model failure, said as one.
 *
 * This replaces serving the scripted layer whenever the model did not answer,
 * which was how «Почему сегодня упала Tesla?» came back as *"I can help with
 * that. The fastest path: tell me your goal…"* — a navigation blurb, written
 * for somebody who asked what to do next, handed to somebody who asked why a
 * stock moved. It carried an honest label saying it was written rather than
 * generated, and it was still the wrong answer to the question, which is worse
 * than no answer: it looks like Voyager understood and had nothing better.
 *
 * The scripted layer keeps its real job — the demo deployment with no key
 * configured, where every answer is written and says so. What it stops doing is
 * standing in for an outage.
 *
 * The failure is named, not blamed on the question. A person whose Russian went
 * unanswered must not be left thinking the language was the problem: the tools,
 * the sources and the planner are identical whatever it was asked in, and the
 * unit suite asserts that.
 */
function incomplete(reason: string): VoyagerAnswer {
  console.warn(`[voyager] no answer produced — ${reason}`);

  return {
    contentType: 'AI explanation',
    text: `I could not finish that one — ${reason}. Nothing is wrong with the question, and nothing about it was answered from memory: asking again usually goes straight through.`,
    bullets: [],
    sources: 'Voyager — no answer produced',
    confidence: 'low',
    actions: [],
    followUps: [],
    /*
     * Not model-generated, so the interface still labels it as written by this
     * platform. The difference from the scripted layer is what it says: that
     * the answer failed, rather than a paragraph about something else.
     */
    simulated: true,
  };
}

/**
 * The chart view the answer asked for, if it asked for one.
 *
 * Read back out of the JSON rather than off `coerce`, because `coerce` is the
 * answer contract and a chart is a request about data the contract knows
 * nothing about. Unparseable is not an error: no view stated means the builder
 * picks the sensible default for the period.
 */
function requestedChart(text: string): { kind?: unknown; studies?: unknown } | undefined {
  try {
    const parsed = JSON.parse(text) as { chart?: { kind?: unknown; studies?: unknown } };
    return parsed.chart;
  } catch {
    return undefined;
  }
}

/** One entry per host, keeping the first mention — five pages from one site is one source. */
function dedupeCitations(found: { label: string; detail?: string }[]) {
  const seen = new Set<string>();
  return found.filter((citation) => {
    const key = citation.label.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * What the model is told about the tools it has.
 *
 * Kept out of `RULES` because it varies with the request — a page with no
 * instrument on it has no assessment tool — and `RULES` is the block that
 * caches.
 */
function toolBrief(searching: boolean, hasTools: boolean): string {
  const lines: string[] = ['## Tools'];

  if (hasTools) {
    lines.push(
      '',
      'Use a tool when the answer depends on something you would otherwise be guessing at — where a feature lives, what an assessment concludes. Never state a tool result you did not receive, and never work around a failed tool by supplying the answer yourself: say what could not be checked.',
      'A tool that failed with "Do not retry this call" will fail the same way again. Answer without it and say what is missing.'
    );
  }

  if (searching) {
    lines.push(
      '',
      'You may search the web. Use it for facts that changed — prices, filings, forecasts, dates, what happened — whatever language the question is in. Do not search for definitions or for how something works: those do not change, and this platform already answers them. Every claim that came from a search must name where it came from in the sources field, must not be presented as more certain than its source made it, and if the searches do not answer the question, say what is missing rather than filling the gap.'
    );
  }

  return lines.join('\n');
}
