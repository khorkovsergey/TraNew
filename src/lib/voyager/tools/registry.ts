import 'server-only';
import type { VoyagerActionId } from '../actions';
import type { VoyagerScreen } from '../screens';
import type { VoyagerTier } from '../types';
import { findDestinations, NAV_TOPICS } from './navigation';
import { INVESTMENT_SCREENS, runInvestmentAnalysis } from './investmentAnalysis';
import { compareAssets } from './comparison';
import { getHistoryFor, getQuoteFor, MAX_COMPARE_ASSETS, resolveVerified } from './marketData';
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
    execute: async (input) => compareAssets(input),
    call: (input) => {
      const list = Array.isArray(input.queries)
        ? input.queries.filter((item): item is string => typeof item === 'string')
        : [];
      return `compare(${list.slice(0, MAX_COMPARE_ASSETS).join(',').slice(0, 40) || '?'})`;
    },
  },
};

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
export async function runToolCalls(
  calls: ToolCall[],
  context: VoyagerToolContext,
  seen: Map<string, VoyagerToolResult>
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
      return {
        toolUseId: call.id,
        result,
        trace: {
          id: tool.id,
          ok: result.ok,
          code: result.ok ? undefined : result.code,
          call: signature,
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
