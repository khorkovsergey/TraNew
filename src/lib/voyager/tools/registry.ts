import 'server-only';
import type { VoyagerActionId } from '../actions';
import type { VoyagerScreen } from '../screens';
import type { VoyagerTier } from '../types';
import { findDestinations, NAV_TOPICS } from './navigation';
import { INVESTMENT_SCREENS, runInvestmentAnalysis } from './investmentAnalysis';
import { compareAssets } from './comparison';
import { getHistoryFor, getQuoteFor, MAX_COMPARE_ASSETS, resolveVerified } from './marketData';
import { pineReview, pineTemplate } from './pine';
import {
  CHART_FEATURE_IDS,
  chartHandoff,
  handoffIsUnnecessary,
  isChartFeature,
  nativeFeatures,
  pineHandoff,
  type TradingViewHandoff,
} from './tradingView';
import { trackServerEvent } from '@/lib/analytics/server';
import { STUDY_IDS } from '@/lib/studies/registry';
import { planChartEdit, type ChartArtifact } from '../chart/artifact';
import { CHART_KINDS, isVoyagerStudyId, VOYAGER_STUDY_IDS, type ChartKind } from '../chart/spec';
import { describePage } from '../pages';
import {
  describeSections,
  PORTAL_SECTION_IDS,
  portalSection,
  portalSections,
} from '../portal';
import { headerMenuRows } from '../portalMenu';
import {
  argString,
  callKey,
  isVoyagerToolId,
  MAX_CALLS_PER_STEP,
  toolFailure,
  type ToolTraceEntry,
  type VoyagerToolId,
  type VoyagerToolResult,
} from './types';

/**
 * The tool registry — one place that says what Voyager can actually do.
 *
 * Everything the model may reach for is here, with a schema the API validates
 * against and a function that runs on the server. There is no other path: the
 * model cannot fetch a URL, run code, read a file or navigate anywhere, because
 * the only verbs it has are the ones in this record.
 *
 * Adding a capability means adding a row. That is the point — a registry you
 * have to edit is a registry somebody reviews.
 */

export type VoyagerToolContext = {
  screen: VoyagerScreen;
  /** What the page is about — "Tesla", "US CPI". */
  subject: string;
  question: string;
  tier: VoyagerTier;
  /** The actions this request may offer, so navigation cannot exceed them. */
  allowedActions: VoyagerActionId[];
  /**
   * The chart this conversation is already looking at, if it still has one.
   *
   * Recalled on the server from an identifier the answer issued — never sent by
   * the browser as data. See `lib/voyager/artifacts.ts` for why that direction
   * is the only safe one.
   */
  artifact?: ChartArtifact;
};

export type VoyagerToolDefinition = {
  id: VoyagerToolId;
  /** What the model is told the tool does, and when to reach for it. */
  description: string;
  /**
   * JSON Schema for the arguments. Validated by the API, then again here.
   *
   * `additionalProperties: false` and a complete `required` list are what
   * `strict: true` needs to guarantee the arguments match — the same rule the
   * answer schema learned the hard way, for the same reason: an open map is a
   * place for a key nobody planned for.
   */
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties: false;
  };
  /** True if running it changes something the person owns. Nothing here does. */
  mutates: boolean;
  requiresAccount: boolean;
  requiresConfirmation: boolean;
  /** Whether this request may use it at all. Checked before the model is told it exists. */
  available: (context: VoyagerToolContext) => boolean;
  execute: (input: Record<string, unknown>, context: VoyagerToolContext) => Promise<VoyagerToolResult>;
  /** The chip signature, once it has run. */
  call: (input: Record<string, unknown>, context: VoyagerToolContext) => string;
};

export const VOYAGER_TOOLS: Record<VoyagerToolId, VoyagerToolDefinition> = {
  portal_navigation: {
    id: 'portal_navigation',
    description:
      'Resolve what somebody is trying to do into the places in TradingNew that actually do it. ' +
      'Call this before telling anyone where to go — it returns real destinations for this ' +
      'visitor, and it is the only way to know which ones exist. Classify the need into one of ' +
      'the listed topics; the topics are about intent, not about screen names, and the question ' +
      'may be in any language.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          enum: NAV_TOPICS as unknown as string[],
          description: 'What the person is trying to do.',
        },
      },
      required: ['topic'],
      additionalProperties: false,
    },
    mutates: false,
    requiresAccount: false,
    requiresConfirmation: false,
    available: () => true,
    execute: async (input, context) =>
      findDestinations(input.topic, context.allowedActions),
    call: (input) => `portal-navigation(${argString(input.topic, 32) ?? 'unknown'})`,
  },

  investment_analysis: {
    id: 'investment_analysis',
    description:
      'Run the deterministic investment assessment for one instrument. It computes every figure ' +
      'and cites every claim to a dated source, and refuses what it cannot support. Use it when ' +
      'somebody asks whether an instrument is worth holding or buying, whether it is over- or ' +
      'undervalued, or asks about its fundamentals — in any language. Do not use it for ' +
      'explaining a concept, and never restate a figure it did not return.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'The ticker to assess, e.g. TSLA. Use the one on screen when there is one.',
        },
      },
      required: ['symbol'],
      additionalProperties: false,
    },
    mutates: false,
    requiresAccount: false,
    requiresConfirmation: false,
    available: (context) => INVESTMENT_SCREENS.includes(context.screen),
    execute: async (input, context) => runInvestmentAnalysis(input, context),
    call: (input, context) =>
      `investment-analysis(${argString(input.symbol, 16) ?? (context.subject || 'this instrument')})`,
  },

  resolve_asset: {
    id: 'resolve_asset',
    description:
      'Turn a name or ticker into the instrument it means, verified against the market data ' +
      'provider when this portal does not already know it. Call it before any other market tool ' +
      'when you are not certain which instrument is meant, and never assume a ticker yourself — ' +
      'if this returns a clarification, ask it rather than picking one.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'What the person called it — "Tesla", "TSLA", "биткоин", "the S&P".',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    mutates: false,
    requiresAccount: false,
    requiresConfirmation: false,
    available: () => true,
    execute: async (input) => resolveVerified(input.query),
    call: (input) => `resolve-asset(${argString(input.query, 24) ?? '?'})`,
  },

  get_quote: {
    id: 'get_quote',
    description:
      'The current price of one instrument, delayed, from the market data provider. Use it ' +
      'whenever the answer turns on what something is trading at. Never state a price this did ' +
      'not return, and never round or adjust the one it did.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The instrument, by name or ticker.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    mutates: false,
    requiresAccount: false,
    requiresConfirmation: false,
    available: () => true,
    execute: async (input) => getQuoteFor(input),
    call: (input) => `quote(${argString(input.query, 16) ?? '?'})`,
  },

  get_history: {
    id: 'get_history',
    description:
      'Price history for one instrument over a period you specify, with the metrics computed ' +
      'from it: return, high, low, max drawdown, annualised volatility, CAGR and average volume. ' +
      'Source data is daily; 1W and 1M are folded from it and there is no intraday. Use this ' +
      'rather than reasoning about prices yourself — every figure it returns was computed, and ' +
      'a figure it did not return is one you do not have. It reports the dates it actually ' +
      'covered, which differ from the ones you asked for because markets are shut some days.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The instrument, by name or ticker.' },
        start: {
          type: 'string',
          description: 'First day of the period, YYYY-MM-DD. Defaults to a year before the end.',
        },
        end: {
          type: 'string',
          description: 'Last day of the period, YYYY-MM-DD. Defaults to today.',
        },
        interval: { type: 'string', enum: ['1D', '1W', '1M'] },
      },
      required: ['query', 'start', 'end', 'interval'],
      additionalProperties: false,
    },
    mutates: false,
    requiresAccount: false,
    requiresConfirmation: false,
    available: () => true,
    execute: async (input) => getHistoryFor(input),
    call: (input) =>
      `history(${argString(input.query, 16) ?? '?'} ${argString(input.interval, 4) ?? '1D'})`,
  },

  compare_assets: {
    id: 'compare_assets',
    description:
      'Compare two to five instruments over a period. Aligns them to the trading days they all ' +
      'share, rebases each to 100 at the first of those days, and computes return, volatility, ' +
      'max drawdown and pairwise correlation. Use it for any "which did better" question — ' +
      'normalised performance is what that question means, because raw prices on different ' +
      'scales cannot be read against each other.',
    inputSchema: {
      type: 'object',
      properties: {
        queries: {
          type: 'array',
          items: { type: 'string' },
          description: 'Two to five instruments, by name or ticker.',
        },
        start: { type: 'string', description: 'First day, YYYY-MM-DD.' },
        end: { type: 'string', description: 'Last day, YYYY-MM-DD.' },
        interval: { type: 'string', enum: ['1D', '1W', '1M'] },
      },
      required: ['queries', 'start', 'end', 'interval'],
      additionalProperties: false,
    },
    mutates: false,
    requiresAccount: false,
    requiresConfirmation: false,
    available: () => true,
    /*
     * The chart already on screen, when there is one. It is what lets a
     * comparison that grew by one instrument cost one request instead of three
     * — and the reuse rules live in the comparison tool, which is where the
     * period and the interval are known.
     */
    execute: async (input, context) =>
      compareAssets(input, context.artifact ? { artifact: context.artifact } : undefined),
    call: (input) => {
      const list = Array.isArray(input.queries)
        ? input.queries.filter((item): item is string => typeof item === 'string')
        : [];
      return `compare(${list.slice(0, MAX_COMPARE_ASSETS).join(',').slice(0, 40) || '?'})`;
    },
  },

  chart_edit: {
    id: 'chart_edit',
    description:
      'Change the chart that is already on screen, using the data already fetched for it. No ' +
      'market request is made. Use it whenever a follow-up is about how the existing chart is ' +
      'drawn rather than about data it does not have: a different chart type, adding or removing ' +
      'a study, narrowing to a shorter period inside the one shown, or dropping an instrument ' +
      'from a comparison. The question may be in any language; what decides is whether the ' +
      'change needs data, not which words were used. If the change needs history that is not ' +
      'held — an earlier start, another interval, an instrument that is not on the chart — this ' +
      'says so and names what it does have, and you should then fetch instead.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: [...CHART_KINDS, 'unchanged'] as unknown as string[],
          description: 'How to draw it, or "unchanged" to leave the type alone.',
        },
        add_studies: {
          type: 'array',
          items: { type: 'string', enum: VOYAGER_STUDY_IDS as unknown as string[] },
          description: 'Studies to put on the chart, at their standard settings. Empty for none.',
        },
        remove_studies: {
          type: 'array',
          items: { type: 'string', enum: VOYAGER_STUDY_IDS as unknown as string[] },
          description: 'Studies to take off. Empty for none.',
        },
        start: {
          type: 'string',
          description:
            'First day of a narrower period, YYYY-MM-DD, or "" to keep the period. It must be ' +
            'inside what the chart already covers; an earlier start needs a fetch.',
        },
        end: { type: 'string', description: 'Last day, YYYY-MM-DD, or "" to keep the period.' },
        remove_symbols: {
          type: 'array',
          items: { type: 'string' },
          description: 'Instruments to drop from a comparison. Empty for none.',
        },
      },
      required: ['kind', 'add_studies', 'remove_studies', 'start', 'end', 'remove_symbols'],
      additionalProperties: false,
    },
    mutates: false,
    requiresAccount: false,
    requiresConfirmation: false,
    // Offered only when there is something to edit, so the planner is never
    // told about a capability that would fail on arrival.
    available: (context) => Boolean(context.artifact),
    execute: async (input, context) => {
      const artifact = context.artifact;
      if (!artifact) {
        return toolFailure(
          'not_found',
          'There is no chart on screen to edit. Fetch the data and draw one first.',
          false
        );
      }

      const strings = (value: unknown): string[] =>
        Array.isArray(value)
          ? value.filter((item): item is string => typeof item === 'string').slice(0, 8)
          : [];

      const start = argString(input.start, 10);
      const end = argString(input.end, 10);

      const edit = {
        ...(typeof input.kind === 'string' && input.kind !== 'unchanged'
          ? { kind: input.kind as ChartKind }
          : {}),
        /* Standard settings: this tool composes a chart, and a request to
           change an indicator's length is a different question that goes
           through the chart field on a fresh answer. */
        addStudies: strings(input.add_studies)
          .filter(isVoyagerStudyId)
          .map((id) => ({ id, params: {} })),
        removeStudies: strings(input.remove_studies),
        ...(start && end ? { range: { start, end } } : {}),
        removeSymbols: strings(input.remove_symbols),
      };

      const planned = planChartEdit(artifact, edit);
      if (!planned.ok) return toolFailure(planned.code, planned.message, true);

      return {
        ok: true,
        data: planned,
        summary: planned.summary,
        /*
         * Two chips, both true: what changed, and that the bars behind it were
         * the ones already held. Nothing here claims a fetch, because none
         * happened — that is the whole observable difference this tool exists
         * to make.
         */
        chips: [
          `chart-edit(${planned.changes.join(' ').slice(0, 32)})`,
          `reuse-history(${planned.reused.join(' ').slice(0, 32)})`,
        ],
      };
    },
    call: (input) =>
      `chart-edit(${argString(input.kind, 12) ?? 'edit'})`,
  },

  page_capabilities: {
    id: 'page_capabilities',
    description:
      'What the screen the person is on actually is, what can be done from it and what it knows ' +
      'about its subject. Call it for "what can I do here?" and before assuming what is on screen — ' +
      'the answer should be about this page, not a tour of the portal.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    mutates: false,
    requiresAccount: false,
    requiresConfirmation: false,
    available: () => true,
    execute: async (_input, context) => {
      const page = describePage(context.screen, context.subject);
      return {
        ok: true,
        data: page,
        summary:
          `This is the ${page.screen} screen — ${page.purpose} Subject: ${page.subject}. ` +
          `It can state: ${page.knows.length ? page.knows.join(', ') : 'nothing beyond the screen name'}. ` +
          `Openings offered here: ${page.canDo.join('; ')}.`,
      };
    },
    call: (_input, context) => `page-capabilities(${context.screen})`,
    },

  portal_knowledge: {
    id: 'portal_knowledge',
    description:
      'What TradingNew contains: sections, what each is for, whether it is built, and how to open ' +
      'it. Call it for any question about this product — where courses are, where to find an ' +
      'expert, how two sections differ, whether something exists. Never answer those from memory: ' +
      'this portal changes, and a section marked coming soon must never be offered as somewhere to ' +
      'go today.',
    inputSchema: {
      type: 'object',
      properties: {
        section: {
          type: 'string',
          enum: PORTAL_SECTION_IDS,
          description: 'One section, when the question is about a specific one.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    mutates: false,
    requiresAccount: false,
    requiresConfirmation: false,
    available: () => true,
    execute: async (input) => {
      const menu = headerMenuRows();
    const one = portalSection(input.section, menu);
      if (input.section && !one) {
        return toolFailure('not_found', 'There is no section here by that name.', true);
      }

      const sections = one ? [one] : portalSections(menu);
      return {
        ok: true,
        data: { sections },
        summary: `${describeSections(sections)}${
          one?.notToBeConfusedWith ? `\nDistinction: ${one.notToBeConfusedWith}` : ''
        }`,
      };
    },
    call: (input) => `portal-knowledge(${argString(input.section, 24) ?? 'all'})`,
    },

  tradingview_handoff: {
    id: 'tradingview_handoff',
    description:
      'Hand a request to TradingView and get the destination back. Call it when somebody wants ' +
      'something these charts do not do — Renko, Kagi, Point & Figure, range bars, session volume ' +
      'or TPO profiles, drawing workflows, bar replay, a strategy backtest, or running Pine. This ' +
      'is a feature, not a failure: say plainly what this surface does and that the professional ' +
      'chart does the rest. It returns the destination, what the link actually carries and what ' +
      'has to be set on arrival — state those, and never invent a URL or claim state travelled ' +
      'that this did not list as carried. Do not call it for RSI, MACD, a volume pane or several ' +
      'panes at once: those are drawn here, and asking for one is a chart request, not a handoff.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['chart', 'pine'],
          description: 'chart for a charting request, pine for the script editor.',
        },
        symbol: { type: 'string', description: 'Ticker, for a chart handoff.' },
        exchange: { type: 'string', description: 'Exchange, when it is known.' },
        interval: { type: 'string', enum: ['1D', '1W', '1M'] },
        features: {
          type: 'array',
          items: { type: 'string', enum: CHART_FEATURE_IDS as unknown as string[] },
          description: 'What was asked for that this surface does not do.',
        },
      },
      required: ['kind'],
      additionalProperties: false,
    },
    mutates: false,
    requiresAccount: false,
    requiresConfirmation: false,
    available: () => true,
    execute: async (input, context) => {
      if (input.kind === 'pine') {
        const handoff = pineHandoff({ hasCode: input.hasCode !== false });
        return { ok: true, data: handoff, summary: summariseHandoff(handoff) };
      }

      const symbol = argString(input.symbol, 16) ?? context.subject;
      const features = (Array.isArray(input.features) ? input.features : []).filter(isChartFeature);

      /*
       * A handoff nobody needs is refused rather than built.
       *
       * The planner is told which capabilities are native, and this is the same
       * fact enforced instead of described — the table is the authority, so a
       * capability moving between the two sides changes what this refuses
       * without a line here being edited. Only a request whose every named
       * feature is drawn here is turned back; naming nothing still goes
       * through, because "open it on TradingView" is a request in itself.
       */
      if (handoffIsUnnecessary(features)) {
        return toolFailure(
          'bad_arguments',
          `${nativeFeatures(features)
            .map((feature) => feature.replace(/_/g, ' '))
            .join(', ')} is drawn on the chart here. Put it on the chart instead of handing this over.`,
          false
        );
      }

      const handoff = chartHandoff({
        symbol,
        exchange: argString(input.exchange, 12) ?? undefined,
        interval: argString(input.interval, 4) ?? undefined,
        features,
      });

      if (!handoff) {
        return toolFailure(
          'bad_arguments',
          'I need an instrument before I can open the professional chart on it.',
          true
        );
      }

      return { ok: true, data: handoff, summary: summariseHandoff(handoff) };
    },
    call: (input) => `tradingview-handoff(${argString(input.kind, 8) ?? 'chart'})`,
  },

  pine_script: {
    id: 'pine_script',
    description:
      'Pine Script, written or checked here and never run. Use mode "template" for the exact Pine ' +
      'behind a study this platform draws — it comes from the same registry that computes the ' +
      'line, so the code and the chart are one calculation. Use mode "review" to check Pine ' +
      'somebody supplied: it reports syntax and known built-ins only. Whatever comes back has not ' +
      'been compiled, executed, backtested or checked against live data, and you must not say or ' +
      'imply otherwise. If somebody asks to run or backtest a script, say that this platform ' +
      'cannot and hand off to TradingView.',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['template', 'review'] },
        study: {
          type: 'string',
          enum: STUDY_IDS,
          description: 'Which built-in study, for mode "template".',
        },
        source: { type: 'string', description: 'The script to check, for mode "review".' },
      },
      required: ['mode'],
      additionalProperties: false,
    },
    mutates: false,
    requiresAccount: false,
    requiresConfirmation: false,
    available: () => true,
    execute: async (input) =>
      input.mode === 'review' ? pineReview(input.source) : pineTemplate(input.study, input.params),
    call: (input) =>
      `pine(${argString(input.mode, 10) ?? 'template'}${
        input.study ? ` ${argString(input.study, 10)}` : ''
      })`,
  },
};

/** The handoff as one line for the planner: destination, what travels, what does not. */
function summariseHandoff(handoff: TradingViewHandoff): string {
  return [
    `TradingView ${handoff.kind} handoff prepared.`,
    handoff.carried.length
      ? `Carries: ${handoff.carried.map((item) => `${item.label} ${item.value}`).join(', ')}.`
      : 'Carries nothing — the editor URL has no fields.',
    handoff.manual.length ? `Set on arrival: ${handoff.manual.join('; ')}.` : '',
    handoff.because.length ? `Because: ${handoff.because.join(' ')}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** The tools this request may use, in the shape the Messages API takes. */
export function toolSpecsFor(context: VoyagerToolContext) {
  return Object.values(VOYAGER_TOOLS)
    .filter((tool) => tool.available(context))
    .map((tool) => ({
      name: tool.id,
      description: tool.description,
      input_schema: tool.inputSchema,
      /*
       * Strict, so arguments are guaranteed to match the schema rather than
       * merely usually matching it. Every tool below re-checks its own
       * arguments anyway — a gate that only holds when the API is having a good
       * day is not a gate — but this stops a malformed call from costing a
       * round trip.
       */
      strict: true as const,
    }));
}

export type ToolCall = { id: string; name: string; input: Record<string, unknown> };

export type ExecutedCall = {
  toolUseId: string;
  trace: ToolTraceEntry;
  result: VoyagerToolResult;
};

/**
 * One round of tool calls, executed.
 *
 * Concurrently, because the calls in a round are independent by construction —
 * the model asked for all of them before seeing any answer — and a person
 * waiting on three sequential lookups is waiting for no reason.
 *
 * A call identical to one that already failed is not made again. §17's
 * guardrail, and the cheapest one: a planner that retries the same failing
 * argument will retry it until the step cap, and the person pays for that in
 * seconds.
 */
/**
 * One operational row per tool that actually ran.
 *
 * Executions only, and the boundary is deliberate: a name that is not a tool, a
 * tool this request may not use, and a repeat already answered this turn are
 * all outcomes of the planning loop rather than of a tool. Reporting them here
 * would put three kinds of non-event into the same figure the Observatory reads
 * as execution count, success rate and latency — and a "0 ms failure" that
 * never reached a tool would drag every one of those numbers somewhere untrue.
 *
 * They keep their trace entry, so the answer still shows what the planner did.
 * They simply are not executions.
 *
 * What this carries is the shape of the call and nothing about its subject:
 * which tool, whether it worked, the failure code from the closed set, how long
 * it took and which round it was.
 *
 * **The signature never goes in.** `trace.call` reads `history(TSLA 1D)` — it
 * is what the chip under an answer says, and it names the instrument somebody
 * asked about. A latency metric is not worth telling the telemetry table what a
 * person is interested in, and the shortest way to be sure is for the value to
 * have no path into this function at all.
 *
 * Fire-and-forget, like every other tracker: a telemetry write that could delay
 * or fail a tool call would be a worse bug than the one it was measuring.
 */
function reportExecution(input: {
  tool: string;
  ok: boolean;
  code?: string;
  /** Measured across the call itself, on a monotonic clock. */
  durationMs: number;
  step: number;
}): void {
  trackServerEvent({
    name: 'voyager_tool_completed',
    properties: {
      tool: input.tool,
      outcome: input.ok ? 'success' : 'failure',
      /* A token rather than an empty string: the registry declares this
         property as required and refuses a blank one, so every successful row
         would have been dropped after integration. `ok` is metadata about the
         call, not anything a person or a model wrote. */
      code: input.code ?? 'ok',
      durationMs: input.durationMs,
      step: input.step,
    },
    surface: 'voyager',
  });
}

export async function runToolCalls(
  calls: ToolCall[],
  context: VoyagerToolContext,
  seen: Map<string, VoyagerToolResult>,
  /* Which round of the agent loop this is, for the operational event. Optional
     so the signature stays usable from a test that does not care. */
  step = 0
): Promise<ExecutedCall[]> {
  return Promise.all(
    calls.slice(0, MAX_CALLS_PER_STEP).map(async (call): Promise<ExecutedCall> => {
      if (!isVoyagerToolId(call.name)) {
        const result = toolFailure('unknown_tool', `There is no tool called ${call.name}.`, false);
        return {
          toolUseId: call.id,
          result,
          trace: { id: call.name, ok: false, code: result.code, call: `${call.name}(?)` },
        };
      }

      const tool = VOYAGER_TOOLS[call.name];
      const signature = tool.call(call.input, context);

      if (!tool.available(context)) {
        const result = toolFailure(
          'not_permitted',
          'That is not something this page or this plan can do.',
          false
        );
        return {
          toolUseId: call.id,
          result,
          trace: { id: tool.id, ok: false, code: result.code, call: signature },
        };
      }

      const key = callKey(tool.id, call.input);
      const repeated = seen.get(key);
      if (repeated) {
        return {
          toolUseId: call.id,
          result: repeated,
          trace: {
            id: tool.id,
            ok: repeated.ok,
            code: repeated.ok ? undefined : repeated.code,
            call: signature,
          },
        };
      }

      let result: VoyagerToolResult;
      const ranAt = performance.now();
      try {
        result = await tool.execute(call.input, context);
      } catch (error) {
        /*
         * The last resort, and it should stay unreachable: a tool that throws
         * has skipped its own error handling. Caught here so one broken tool
         * costs its own result and not the whole answer.
         */
        console.error(`[voyager] tool ${tool.id} threw`, error);
        result = toolFailure('unavailable', 'That lookup did not complete.', true);
      }

      seen.set(key, result);

      /*
       * The one branch that reached a tool. A result that came back failed and
       * an exception the catch above turned into a failure are both real
       * execution attempts, and both are reported as failures here.
       */
      reportExecution({
        tool: tool.id,
        ok: result.ok,
        code: result.ok ? undefined : result.code,
        durationMs: Math.round(performance.now() - ranAt),
        step,
      });

      return {
        toolUseId: call.id,
        result,
        trace: {
          id: tool.id,
          ok: result.ok,
          code: result.ok ? undefined : result.code,
          call: signature,
          /* What it did, when that differs from what it was asked to do. A
             comparison that reused two of three instruments says so here; the
             signature alone would report three fetches that did not happen. */
          ...(result.ok && result.chips?.length ? { chips: result.chips } : {}),
        },
      };
    })
  );
}

/** What goes back to the model as the result of a call. */
export function resultForModel(result: VoyagerToolResult): string {
  return result.ok
    ? result.summary
    : `FAILED (${result.code}): ${result.message}${
        result.recoverable ? ' You may try different arguments.' : ' Do not retry this call.'
      }`;
}
