import type { ChartInterval } from '@/lib/superchart/chart-engine/types';
import type { StudyChoice } from '@/lib/superchart/layouts/schema';

/**
 * The Superchart catalogue.
 *
 * Six starting points for the workspace that already exists. Nothing here is a
 * second chart: a card is a symbol, an interval and a set of studies, and
 * "Open chart" hands those to `/supercharts` as a preset. The workspace is
 * unchanged behind it, which is the whole point — a catalogue that reimplements
 * the chart is a second chart to keep in step with the first.
 *
 * Every symbol is one the chart can actually resolve (`datafeed/demoAdapter`),
 * and every study id is one the indicator registry actually has. A workspace
 * promising Bitcoin funding rates on a feed that has never heard of Bitcoin is
 * a card that looks like a product and behaves like a 404.
 */

export type AssetClass = 'Stocks' | 'ETFs' | 'Indices';
export type UseCase = 'Trend' | 'Momentum' | 'Volatility' | 'Volume' | 'Macro';
export type Complexity = 'Beginner' | 'Intermediate' | 'Advanced';

export type SuperchartPreset = {
  id: string;
  title: string;
  description: string;
  /** The datafeed's id, exchange prefix included. */
  symbolId: string;
  /** What the card shows, and what the chart's header will show. */
  ticker: string;
  interval: ChartInterval;
  studies: StudyChoice[];
  asset: AssetClass;
  use: UseCase;
  level: Complexity;
  tags: string[];
  accent: string;
  seed: number;
};

export const SUPERCHART_PRESETS: SuperchartPreset[] = [
  {
    id: 'us-market-overview',
    title: 'US Market Overview',
    description:
      'The S&P 500 against its fast and slow averages, with volume beside it — the daily state of the US market in one screen.',
    symbolId: 'INDEX:SPX',
    ticker: 'SPX',
    interval: '1D',
    studies: [
      { definitionId: 'ema', params: { fast: 50, slow: 200 } },
      { definitionId: 'volume-ma', params: { length: 20 } },
    ],
    asset: 'Indices',
    use: 'Trend',
    level: 'Beginner',
    tags: ['Indices', 'Daily'],
    accent: '--tn-blue',
    seed: 17,
  },
  {
    id: 'spy-momentum',
    title: 'S&P 500 ETF Momentum',
    description:
      'The tradable index proxy at four hours, with a fast pair of averages for reading momentum inside the day.',
    symbolId: 'AMEX:SPY',
    ticker: 'SPY',
    interval: '4H',
    studies: [
      { definitionId: 'ema', params: { fast: 9, slow: 21 } },
      { definitionId: 'volume-anomaly', params: { lookback: 20, multiple: 2 } },
    ],
    asset: 'ETFs',
    use: 'Momentum',
    level: 'Intermediate',
    tags: ['ETFs', 'Intraday'],
    accent: '--tn-mint',
    seed: 43,
  },
  {
    id: 'tesla-volatility',
    title: 'Tesla Volatility Workspace',
    description:
      'A high-beta single stock with wide averages and an anomalous-volume flag, for reading moves that are not routine.',
    symbolId: 'NASDAQ:TSLA',
    ticker: 'TSLA',
    interval: '1D',
    studies: [
      { definitionId: 'sma', params: { fast: 20, slow: 100 } },
      { definitionId: 'volume-anomaly', params: { lookback: 30, multiple: 2.5 } },
    ],
    asset: 'Stocks',
    use: 'Volatility',
    level: 'Advanced',
    tags: ['Stocks', 'High beta'],
    accent: '--tn-purple',
    seed: 71,
  },
  {
    id: 'nvidia-trend-volume',
    title: 'NVIDIA Trend & Volume',
    description:
      'Trend and participation side by side: where price sits against its averages, and whether volume agrees.',
    symbolId: 'NASDAQ:NVDA',
    ticker: 'NVDA',
    interval: '1D',
    studies: [
      { definitionId: 'ema', params: { fast: 20, slow: 50 } },
      { definitionId: 'volume-ma', params: { length: 20 } },
    ],
    asset: 'Stocks',
    use: 'Volume',
    level: 'Beginner',
    tags: ['Stocks', 'Volume'],
    accent: '--tn-teal',
    seed: 97,
  },
  {
    id: 'bank-cycle-weekly',
    title: 'Bank Cycle, Weekly',
    description:
      'A large bank on the weekly interval with long averages — the slow view, for questions about the cycle rather than the week.',
    symbolId: 'NYSE:JPM',
    ticker: 'JPM',
    interval: '1W',
    studies: [{ definitionId: 'sma', params: { fast: 30, slow: 200 } }],
    asset: 'Stocks',
    use: 'Macro',
    level: 'Intermediate',
    tags: ['Stocks', 'Weekly'],
    accent: '--tn-orange-star',
    seed: 123,
  },
  {
    id: 'tokyo-session',
    title: 'Tokyo Session Workspace',
    description:
      'A Tokyo-listed name on the hourly interval, in its own session and timezone rather than translated into New York hours.',
    symbolId: 'TSE:7203',
    ticker: '7203',
    interval: '1H',
    studies: [
      { definitionId: 'ema', params: { fast: 12, slow: 48 } },
      { definitionId: 'volume-ma', params: { length: 24 } },
    ],
    asset: 'Stocks',
    use: 'Trend',
    level: 'Advanced',
    tags: ['Stocks', 'Asia'],
    accent: '--tn-purple-hover',
    seed: 149,
  },
];

export const ASSET_CLASSES: AssetClass[] = ['Stocks', 'ETFs', 'Indices'];
export const USE_CASES: UseCase[] = ['Trend', 'Momentum', 'Volatility', 'Volume', 'Macro'];
export const COMPLEXITIES: Complexity[] = ['Beginner', 'Intermediate', 'Advanced'];

/** The prompts the Voyager panel offers. Questions about the chart, not predictions. */
export const VOYAGER_PROMPTS = [
  'What is this chart showing me?',
  'Add an EMA 20/50 crossover',
  'Why did volume jump here?',
];

export function findPreset(id: string | null | undefined): SuperchartPreset | null {
  if (!id) return null;
  return SUPERCHART_PRESETS.find((preset) => preset.id === id) ?? null;
}

/**
 * The query that opens the workspace on this preset.
 *
 * Studies are `id:param=value` pairs rather than JSON, so the address stays
 * readable and a person can see what a link is about to put on their chart.
 * Everything in it is re-checked by `parsePreset` on arrival — this is a
 * proposal, not an instruction.
 */
export function presetQuery(preset: SuperchartPreset): Record<string, string> {
  const studies = preset.studies
    .map((study) => {
      const params = Object.entries(study.params)
        .map(([key, value]) => `${key}=${value}`)
        .join(',');
      return params ? `${study.definitionId}:${params}` : study.definitionId;
    })
    .join(';');

  const query: Record<string, string> = {
    symbol: preset.symbolId,
    interval: preset.interval,
    preset: preset.id,
  };
  if (studies) query.studies = studies;

  return query;
}
