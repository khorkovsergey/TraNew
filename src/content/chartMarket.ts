/**
 * The Chart Market catalogue.
 *
 * A demonstration set, and the screens say so rather than leaving it to be
 * discovered: nobody has published a script to TradingNew yet, so these nine
 * products, their creators and their reviews are sample content of the same
 * kind as the expert catalogue in `experts.ts`. Presenting them as real
 * listings would be the interface lying about what the marketplace contains.
 *
 * What is deliberately *not* here is the Pine Script source. It lives in
 * `lib/chartMarket/source.ts`, which is server-only, because a product page has
 * to be able to render for somebody who has not bought the script — and if the
 * source were part of this record it would travel to the browser with it. The
 * lock on the source panel is then a lock rather than a blur over the answer.
 */

export type ScriptType = 'Indicator' | 'Strategy' | 'Overlay' | 'Signal' | 'Utility';

/** What the Price filter offers. Derived from `amountCents`, never stored twice. */
export type PriceBand = 'Free' | 'Paid';

export type ScriptReview = {
  rating: 1 | 2 | 3 | 4 | 5;
  name: string;
  when: string;
  text: string;
};

export type ChartMarketProduct = {
  /** Also the slug in `?script=` — readable, stable, and safe in a URL. */
  id: string;
  title: string;
  short: string;
  overview: string;
  features: string[];

  creator: string;
  /** Reserved for a creator whose identity has actually been checked. */
  creatorVerified: boolean;
  creatorMeta: string;

  type: ScriptType;
  pine: '5' | '6';
  /** Cents, EUR. Zero means free, and the price filter reads this rather than a label. */
  amountCents: number;

  rating: number;
  reviews: number;
  installs: number;
  tag?: 'Bestseller' | 'Trending' | 'New';

  /** A design token name, not a colour — the preview resolves it. */
  accent: string;
  /** Seed for the illustrative preview, so the same product always draws the same shape. */
  seed: number;

  /** ISO dates. `Newest` sorts on the first; the product page shows the second. */
  publishedAt: string;
  updatedAt: string;

  reviewList: ScriptReview[];
};

export const CHART_MARKET_PRODUCTS: ChartMarketProduct[] = [
  {
    id: 'trend-strength-pro',
    title: 'Trend Strength Pro',
    short: 'Trend strength scoring with momentum confirmation and clean entry markers.',
    overview:
      'Trend Strength Pro scores how strongly price is trending and confirms it with momentum before marking anything. It is built to sit on a main chart without crowding it: one line, one score, and markers only where trend and momentum agree. Signals describe what the series has done — they are not instructions, and the decision stays yours.',
    features: [
      'Adaptive length with EMA or SMA smoothing',
      'Momentum confirmation filter',
      'Non-repainting signal logic',
      'Configurable alerts for entries and exits',
      'Multi-timeframe confirmation option',
      'Works on every symbol Supercharts resolves',
    ],
    creator: 'John Carter',
    creatorVerified: true,
    creatorMeta: '12 scripts · 4.9 average rating',
    type: 'Indicator',
    pine: '6',
    amountCents: 2900,
    rating: 4.9,
    reviews: 128,
    installs: 4120,
    tag: 'Bestseller',
    accent: '--tn-purple',
    seed: 11,
    publishedAt: '2025-03-18',
    updatedAt: '2026-06-02',
    reviewList: [
      {
        rating: 5,
        name: 'Marcus D.',
        when: '3 weeks ago',
        text: 'Replaced three indicators on my chart with this one. The momentum filter cuts most of the noise I used to trade through.',
      },
      {
        rating: 4,
        name: 'Ines V.',
        when: 'last month',
        text: 'Clear code and sensible defaults. Took some tuning for crypto, but the creator answered my question within a day.',
      },
    ],
  },
  {
    id: 'rsi-divergence-scanner',
    title: 'RSI Divergence Scanner',
    short: 'Detects regular and hidden divergences across up to four timeframes.',
    overview:
      'Compares price pivots against RSI pivots and marks the four divergence classes separately, so a hidden divergence is never drawn as a regular one. Higher timeframes are read from the same series rather than requested again, which is why the marks do not move when the chart reloads.',
    features: [
      'Regular and hidden divergence, marked apart',
      'Up to four timeframes at once',
      'Pivot lookback configurable on both sides',
      'Alert per divergence class',
      'Optional RSI band shading',
      'No repainting after the pivot confirms',
    ],
    creator: 'Marta Lind',
    creatorVerified: true,
    creatorMeta: '7 scripts · 4.8 average rating',
    type: 'Indicator',
    pine: '6',
    amountCents: 1900,
    rating: 4.8,
    reviews: 96,
    installs: 2870,
    accent: '--tn-teal',
    seed: 23,
    publishedAt: '2025-07-09',
    updatedAt: '2026-05-21',
    reviewList: [
      {
        rating: 5,
        name: 'Pavel R.',
        when: '2 months ago',
        text: 'The split between regular and hidden divergence is the part I actually wanted. Most scripts draw both and let you guess.',
      },
    ],
  },
  {
    id: 'order-blocks-liquidity',
    title: 'Order Blocks & Liquidity',
    short: 'Institutional order blocks, fair value gaps and liquidity sweeps.',
    overview:
      'Marks unmitigated order blocks, fair value gaps and the sweeps that take out a prior high or low. Every zone carries the bar it was formed on, so a block can be checked against the move that made it instead of being taken on trust.',
    features: [
      'Unmitigated order blocks only, by default',
      'Fair value gaps with fill tracking',
      'Liquidity sweeps above and below',
      'Session filter for each zone type',
      'Zones expire rather than accumulate',
      'Alerts on mitigation',
    ],
    creator: 'Dmitri Volkov',
    creatorVerified: false,
    creatorMeta: '4 scripts · 4.6 average rating',
    type: 'Overlay',
    pine: '6',
    amountCents: 3900,
    rating: 4.7,
    reviews: 211,
    installs: 6340,
    tag: 'Trending',
    accent: '--tn-orange-star',
    seed: 41,
    publishedAt: '2025-11-27',
    updatedAt: '2026-07-14',
    reviewList: [
      {
        rating: 5,
        name: 'Yara N.',
        when: 'last week',
        text: 'Zones expiring instead of piling up is the difference between a readable chart and a wall of boxes.',
      },
      {
        rating: 4,
        name: 'Tom B.',
        when: '2 months ago',
        text: 'Good on indices. On thin symbols it finds more than I would call a sweep, so I raised the lookback.',
      },
    ],
  },
  {
    id: 'mean-reversion-strategy',
    title: 'Mean Reversion Strategy',
    short: 'Backtestable strategy with adaptive bands, stop logic and position sizing.',
    overview:
      'A complete strategy script: adaptive bands set the entry, an ATR stop sets the exit, and position size follows from the account risk you declare rather than a fixed quantity. Backtest results depend on the data behind them and are a description of the past, not an expected return.',
    features: [
      'Adaptive band width from realised volatility',
      'ATR stop and trailing option',
      'Risk-based position sizing',
      'Long, short or both',
      'Session and day-of-week filters',
      'Strategy alerts with the whole order in the message',
    ],
    creator: 'QuantLab',
    creatorVerified: true,
    creatorMeta: '19 scripts · 4.7 average rating',
    type: 'Strategy',
    pine: '6',
    amountCents: 5900,
    rating: 4.6,
    reviews: 74,
    installs: 1490,
    accent: '--tn-green',
    seed: 67,
    publishedAt: '2025-01-22',
    updatedAt: '2026-04-08',
    reviewList: [
      {
        rating: 5,
        name: 'Sofia L.',
        when: 'last month',
        text: 'Sizing from declared risk rather than a fixed lot is what made this usable for me.',
      },
    ],
  },
  {
    id: 'vwap-suite',
    title: 'VWAP Suite',
    short: 'Session, anchored and rolling VWAP with standard deviation bands.',
    overview:
      'Three VWAP behaviours in one script, each with its own anchor and its own bands. The anchored variant takes a bar you pick rather than a date, so it survives an interval change instead of jumping to a different point on the chart.',
    features: [
      'Session, anchored and rolling VWAP',
      'Up to three standard-deviation bands',
      'Anchor by bar, not by date',
      'Previous-session VWAP retained',
      'Band touch alerts',
      'Works below the daily interval',
    ],
    creator: 'Nora Chen',
    creatorVerified: true,
    creatorMeta: '9 scripts · 4.9 average rating',
    type: 'Indicator',
    pine: '6',
    amountCents: 2400,
    rating: 4.9,
    reviews: 158,
    installs: 5210,
    accent: '--tn-blue',
    seed: 89,
    publishedAt: '2024-10-15',
    updatedAt: '2026-06-19',
    reviewList: [
      {
        rating: 5,
        name: 'Andreas K.',
        when: '3 weeks ago',
        text: 'Anchoring to a bar instead of a timestamp is a small decision that saves a lot of re-anchoring.',
      },
    ],
  },
  {
    id: 'session-highs-lows',
    title: 'Session Highs & Lows',
    short: 'Marks Asia, London and New York session ranges with alerts.',
    overview:
      'Draws the three main session ranges and keeps the previous day visible behind them. Everything is derived from the chart timezone the symbol resolves with, so a session box does not drift when the same script is put on a symbol quoted somewhere else.',
    features: [
      'Asia, London and New York ranges',
      'Previous session kept, faded',
      'Range extension into the next session',
      'Break alerts on either side',
      'Timezone taken from the symbol',
      'Pine v5, for older charts',
    ],
    creator: 'Tom Reyes',
    creatorVerified: false,
    creatorMeta: '3 scripts · 4.5 average rating',
    type: 'Overlay',
    pine: '5',
    amountCents: 0,
    rating: 4.5,
    reviews: 412,
    installs: 18900,
    accent: '--tn-text-nav',
    seed: 103,
    publishedAt: '2024-06-30',
    updatedAt: '2025-12-03',
    reviewList: [
      {
        rating: 4,
        name: 'Grace O.',
        when: 'last month',
        text: 'Free, does one thing, and does not draw anything I did not ask for.',
      },
    ],
  },
  {
    id: 'breakout-signal-engine',
    title: 'Breakout Signal Engine',
    short: 'Volatility-filtered breakout signals with retest confirmation.',
    overview:
      'Marks a breakout only when the range that preceded it was quiet enough to qualify, and can wait for a retest before it says anything. Both filters are visible on the chart, so a signal that did not appear can be explained rather than guessed at.',
    features: [
      'Volatility compression filter',
      'Optional retest confirmation',
      'Range drawn while it forms',
      'Separate alerts for break and retest',
      'Higher-timeframe trend filter',
      'Signal count shown per session',
    ],
    creator: 'Alpha Forge',
    creatorVerified: true,
    creatorMeta: '15 scripts · 4.8 average rating',
    type: 'Signal',
    pine: '6',
    amountCents: 3400,
    rating: 4.8,
    reviews: 89,
    installs: 2130,
    accent: '--tn-red',
    seed: 131,
    publishedAt: '2026-01-16',
    updatedAt: '2026-07-01',
    reviewList: [
      {
        rating: 5,
        name: 'Liam H.',
        when: '2 weeks ago',
        text: 'Being able to see why a break was rejected is worth more than the signals themselves.',
      },
    ],
  },
  {
    id: 'position-size-calculator',
    title: 'Position Size Calculator',
    short: 'On-chart risk calculator: account size, stop distance and R multiples.',
    overview:
      'A table on the chart that turns an account size, a risk percentage and a stop level into a position size and the R multiples of the targets above it. It calculates and displays; it places nothing and recommends nothing.',
    features: [
      'Size from declared account risk',
      'Stop taken from a chart line',
      'R multiples for up to three targets',
      'Currency and contract modes',
      'Fees included in the R figure',
      'Table position configurable',
    ],
    creator: 'RiskDesk',
    creatorVerified: false,
    creatorMeta: '6 scripts · 4.7 average rating',
    type: 'Utility',
    pine: '6',
    amountCents: 900,
    rating: 4.7,
    reviews: 63,
    installs: 1720,
    accent: '--tn-mint',
    seed: 157,
    publishedAt: '2025-09-05',
    updatedAt: '2026-03-27',
    reviewList: [
      {
        rating: 5,
        name: 'Ravi S.',
        when: 'last month',
        text: 'Nine euros to stop doing this arithmetic in a spreadsheet.',
      },
    ],
  },
  {
    id: 'multi-timeframe-dashboard',
    title: 'Multi-Timeframe Dashboard',
    short: 'One table with trend, momentum and volume state across six timeframes.',
    overview:
      'Six timeframes in one table, each reporting trend, momentum and volume state as a word rather than a colour alone. The states are descriptions of what the series is doing; they are not signals to act on and the table does not rank them.',
    features: [
      'Six configurable timeframes',
      'Trend, momentum and volume per row',
      'State named in text, not colour only',
      'Row alerts when a state flips',
      'Compact and full layouts',
      'Reads the chart symbol automatically',
    ],
    creator: 'QuantLab',
    creatorVerified: true,
    creatorMeta: '19 scripts · 4.7 average rating',
    type: 'Utility',
    pine: '6',
    amountCents: 2700,
    rating: 4.8,
    reviews: 145,
    installs: 3880,
    tag: 'New',
    accent: '--tn-purple-hover',
    seed: 181,
    publishedAt: '2026-05-12',
    updatedAt: '2026-07-22',
    reviewList: [
      {
        rating: 5,
        name: 'Elena M.',
        when: '3 weeks ago',
        text: 'States written as words means I can read it without remembering what each shade meant.',
      },
    ],
  },
];

export function findProduct(id: string | null | undefined): ChartMarketProduct | null {
  if (!id) return null;
  return CHART_MARKET_PRODUCTS.find((product) => product.id === id) ?? null;
}

export function priceBand(product: ChartMarketProduct): PriceBand {
  return product.amountCents === 0 ? 'Free' : 'Paid';
}

/**
 * The price as it is shown.
 *
 * Whole euros, because every price in the catalogue is one and a trailing `.00`
 * on a nine-euro utility is noise. A price with cents would need the fractional
 * digits back, which is why this reads the value rather than assuming.
 */
export function formatPrice(amountCents: number): string {
  if (amountCents === 0) return 'Free';
  const whole = amountCents % 100 === 0;
  return `€${(amountCents / 100).toFixed(whole ? 0 : 2)}`;
}
