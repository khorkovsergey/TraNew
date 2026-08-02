import type { ChartContext } from '../context';
import { buildPlan, type CommandPlan } from './index';

/**
 * A request turned into a plan.
 *
 * Scripted, like the answers in `context/answers.ts`, and for the same reasons:
 * the product demonstrates without an API key, and the commands a model
 * proposes have to pass through `parseCommand` regardless. When the model layer
 * lands it produces the candidate list and everything downstream is unchanged —
 * which is the point of validating at the bus rather than trusting the source.
 *
 * The planner is deliberately narrow. It recognises what the chart can actually
 * do and says plainly when a request names something it cannot, rather than
 * finding the nearest study and quietly substituting it. Being handed a simple
 * moving average when you asked for an exponential one, with nothing said, is
 * worse than being told no.
 */

export type PlanRequest = { question: string; context: ChartContext };

/** Numbers in a request, in the order they appear. */
function numbersIn(text: string): number[] {
  return (text.match(/\d+/g) ?? []).map(Number).filter((value) => value > 0);
}

export function planFor({ question, context }: PlanRequest): CommandPlan | null {
  const q = question.toLowerCase();
  const id = `plan_${q.length}_${context.visibleRange.toIndex}`;

  /* ------------------------------------------------------ Moving averages */

  if (/\b(ema|sma|moving average|ma)\b/.test(q) && /\badd\b|\bshow\b|\bmark\b|\bput\b/.test(q)) {
    const exponential = /\bema\b|\bexponential\b/.test(q);
    const lengths = numbersIn(q);

    // Two lengths given, one, or none — the defaults fill in the rest, and the
    // plan states what they are rather than leaving them implicit.
    const fast = lengths[0] ?? 20;
    const slow = lengths[1] ?? (lengths[0] ? lengths[0] * 2 : 50);

    const wantsCrossovers = /\bcross/.test(q);

    return buildPlan({
      id,
      question,
      title: exponential ? `Add EMA ${fast} and EMA ${slow}` : `Add MA ${fast} and MA ${slow}`,
      because: wantsCrossovers && exponential
        ? 'you asked for two averages and their crossovers, which this study computes together'
        : 'you asked for moving averages on the price pane',
      proposed: [
        {
          kind: 'add_study',
          definitionId: exponential ? 'ema' : 'sma',
          params: { fast, slow },
        },
      ],
    });
  }

  /* --------------------------------------------------------- Volume study */

  if (/\bvolume\b/.test(q) && /\badd\b|\bshow\b|\baverage\b/.test(q)) {
    const lengths = numbersIn(q);
    return buildPlan({
      id,
      question,
      title: 'Add a volume moving average',
      because: 'you asked for volume with an average to compare it against',
      proposed: [
        { kind: 'add_study', definitionId: 'volume-ma', params: { length: lengths[0] ?? 20 } },
      ],
    });
  }

  /* --------------------------------------------- Marking the outlier bars */

  if (/\bmark\b|\bhighlight\b/.test(q) && /\bspike|\banomal|\boutlier|\bunusual/.test(q)) {
    const anomalies = context.visibleBarsSummary?.volumeAnomalies ?? [];

    if (!anomalies.length) {
      return buildPlan({
        id,
        question,
        title: 'Mark the unusual bars',
        because: 'you asked for the outliers to be marked',
        proposed: [],
      });
    }

    /*
     * A vertical line on each outlier, positioned from the arithmetic in the
     * context rather than from a bar index a model chose. The price is carried
     * so the drawing survives in data space like every other object.
     */
    return buildPlan({
      id,
      question,
      title: `Mark ${anomalies.length} unusual bar${anomalies.length === 1 ? '' : 's'}`,
      because: 'these are the bars the volume test flagged in the visible window',
      proposed: anomalies.map((bar) => ({
        kind: 'add_drawing',
        tool: 'verticalLine',
        points: [{ barIndex: context.visibleRange.fromIndex + bar.index, price: bar.close }],
      })),
    });
  }

  /* ------------------------------------------------------------- Interval */

  const intervalMatch = q.match(/\b(?:switch|change|show).{0,20}?\b(1m|5m|15m|1h|4h|1d|1w|1mo)\b/);
  if (intervalMatch) {
    /*
     * Mapped explicitly rather than upper-cased.
     *
     * The intervals are not consistently cased — minutes are lower, everything
     * else upper, and `1M` is a month while `1m` is a minute. Any rule clever
     * enough to derive that from the text is a rule that will one day turn
     * "5m" into "5M" and ask the datafeed for five months.
     */
    const INTERVAL_WORDS: Record<string, string> = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '1h': '1H',
      '4h': '4H',
      '1d': '1D',
      '1w': '1W',
      '1mo': '1M',
    };
    const interval = INTERVAL_WORDS[intervalMatch[1]];

    return buildPlan({
      id,
      question,
      title: `Switch to the ${interval} interval`,
      because: 'you named an interval',
      proposed: [{ kind: 'set_interval', interval }],
    });
  }

  /* ------------------------------------------------ Things it cannot do yet */

  if (/\bbacktest\b|\bstrategy\b|\balert\b|\bbuy\b|\bsell\b|\border\b/.test(q)) {
    return buildPlan({
      id,
      question,
      title: 'Not something this chart does',
      because: 'the request names an action the workspace does not have',
      // Refused by the bus by name, so the panel can say which part it was.
      proposed: [{ kind: /\balert\b/.test(q) ? 'create_alert' : 'place_order' }],
    });
  }

  return null;
}
