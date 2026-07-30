import type { Ticker } from '@/lib/symbolSearch';
import type { Localized, MaybeLocalized, TrustLabel } from './types';

export type SymbolNews = {
  label: Extract<TrustLabel, 'fact' | 'analysis' | 'communityOpinion' | 'sponsored'>;
  source: string;
  time: string;
  title: Localized;
};

export type SymbolData = {
  ticker: Ticker;
  type: Localized;
  name: Localized;
  price: string;
  change: string;
  up: boolean;
  why: Localized;
  tech: Localized;
  event: Localized;
  facts: Array<{ k: Localized; v: MaybeLocalized }>;
  news: SymbolNews[];
  related: Ticker[];
};

/**
 * Plain-language copy for Beginner Mode, where an asset is explained before it is
 * priced and its risks are stated up front rather than buried.
 */
export const SIMPLE_VIEW: Record<Ticker, { what: Localized; risks: Localized }> = {
  TSLA: {
    what: {
      en: 'Tesla is a company that designs and sells electric vehicles and energy products. Buying its stock means owning a small share of the business.',
    },
    risks: {
      en: 'High price volatility; results depend on deliveries, margins and competition in electric vehicles. You can lose part of your investment.',
    },
  },
  SPX: {
    what: {
      en: 'The S&P 500 is an index that tracks 500 large US companies at once. You cannot buy an index directly — funds that follow it give you exposure to all of them together.',
    },
    risks: {
      en: 'Falls when the broad US market falls; concentrated in the largest companies. Diversification reduces single-company risk but not market risk.',
    },
  },
  BTC: {
    what: {
      en: 'Bitcoin is a digital asset that runs on a public network without a central issuer. Its price is set entirely by what buyers and sellers agree on.',
    },
    risks: {
      en: 'Very high volatility, no cash flow behind it, and regulation differs by country. Losses can be large and fast.',
    },
  },
  GOLD: {
    what: {
      en: 'Gold is a physical commodity traded worldwide and often held as a store of value. It pays no interest or dividend — the return comes only from the price.',
    },
    risks: {
      en: 'Price can stagnate for years and is sensitive to real interest rates and the dollar. It produces no income while you hold it.',
    },
  },
  NVDA: {
    what: {
      en: 'NVIDIA designs the chips that power graphics and artificial-intelligence computing. Buying its stock means owning a small share of that business.',
    },
    risks: {
      en: 'Valuation depends on continued AI infrastructure spending; a slowdown among a few large customers would hit results hard.',
    },
  },
};

/**
 * Demo market data from the design prototype. Figures are illustrative and frozen —
 * they exist to show the shape of the screen, not to be traded on.
 */
export const SYMBOLS: Record<Ticker, SymbolData> = {
  TSLA: {
    ticker: 'TSLA',
    type: { en: 'Stock · NASDAQ' },
    name: { en: 'Tesla' },
    price: '$317.42',
    change: '+2.9%',
    up: true,
    why: {
      en: 'Shares climbed after Q2 deliveries beat consensus by 4% and management confirmed the launch window for the next mass-market model. Analysts at two banks raised price targets this morning.',
    },
    tech: {
      en: 'Trading above its 50-day average with rising volume. RSI at 63 — momentum is positive but not yet overheated. Nearest resistance around $330.',
    },
    event: {
      en: 'Q2 earnings call — Tuesday, Aug 4, after US market close. Consensus EPS $0.92.',
    },
    facts: [
      { k: { en: 'Market cap' }, v: '$1.01T' },
      { k: { en: 'P/E (TTM)' }, v: '68.4' },
      { k: { en: '52-week range' }, v: '$182–$389' },
      {
        k: { en: 'Sector' },
        v: { en: 'Consumer discretionary' },
      },
    ],
    news: [
      {
        label: 'fact',
        source: 'Reuters',
        time: '09:12',
        title: {
          en: 'Tesla Q2 deliveries beat estimates at 462,000 vehicles',
        },
      },
      {
        label: 'analysis',
        source: 'Barron’s',
        time: '08:40',
        title: {
          en: 'Why the next model matters more than this quarter',
        },
      },
      {
        label: 'communityOpinion',
        source: 'TradingNew Ideas',
        time: '07:55',
        title: {
          en: 'TSLA breakout thesis: the range is resolving upward',
        },
      },
    ],
    related: ['NVDA', 'SPX', 'BTC'],
  },

  SPX: {
    ticker: 'SPX',
    type: { en: 'Index' },
    name: { en: 'S&P 500' },
    price: '6,412.8',
    change: '+0.4%',
    up: true,
    why: {
      en: 'The index edges higher as mega-cap earnings continue to beat and traders position ahead of Thursday’s CPI release. Breadth is narrow — 6 stocks account for most of the gain.',
    },
    tech: {
      en: 'Grinding along all-time highs. 14-day volatility is near its yearly low, which historically precedes larger moves.',
    },
    event: {
      en: 'US CPI release — Thursday 12:30 UTC. Consensus 2.6% YoY.',
    },
    facts: [
      { k: { en: 'YTD return' }, v: '+11.2%' },
      { k: { en: 'P/E (fwd)' }, v: '22.1' },
      { k: { en: 'Dividend yield' }, v: '1.3%' },
      { k: { en: 'Constituents' }, v: '503' },
    ],
    news: [
      {
        label: 'fact',
        source: 'Bloomberg',
        time: '09:05',
        title: {
          en: 'S&P 500 futures rise ahead of inflation data',
        },
      },
      {
        label: 'analysis',
        source: 'FT',
        time: '08:20',
        title: {
          en: 'Narrow breadth: should index investors worry?',
        },
      },
      {
        label: 'sponsored',
        source: 'Partner',
        time: '08:00',
        title: {
          en: 'Five ETFs for broad US exposure',
        },
      },
    ],
    related: ['NVDA', 'TSLA', 'GOLD'],
  },

  BTC: {
    ticker: 'BTC',
    type: { en: 'Crypto' },
    name: { en: 'Bitcoin' },
    price: '$118,240',
    change: '−1.2%',
    up: false,
    why: {
      en: 'Bitcoin pulls back as ETF inflows slowed for a third day and a large wallet moved 8,000 BTC to an exchange. The move stays inside the two-week consolidation range.',
    },
    tech: {
      en: 'Holding above the 100-day average. Support at $114k has been tested twice this month and held both times.',
    },
    event: {
      en: 'US spot-ETF monthly flow report — Friday.',
    },
    facts: [
      { k: { en: 'Market cap' }, v: '$2.33T' },
      { k: { en: '24h volume' }, v: '$41B' },
      { k: { en: 'Circulating supply' }, v: '19.9M BTC' },
      { k: { en: 'All-time high' }, v: '$126,900' },
    ],
    news: [
      {
        label: 'fact',
        source: 'CoinDesk',
        time: '09:30',
        title: {
          en: 'Bitcoin slips as ETF inflows cool',
        },
      },
      {
        label: 'analysis',
        source: 'The Block',
        time: '08:10',
        title: {
          en: 'What on-chain data says about the current range',
        },
      },
      {
        label: 'communityOpinion',
        source: 'TradingNew Ideas',
        time: '07:20',
        title: {
          en: 'BTC: waiting for the range break',
        },
      },
    ],
    related: ['GOLD', 'SPX', 'NVDA'],
  },

  GOLD: {
    ticker: 'GOLD',
    type: { en: 'Commodity' },
    name: { en: 'Gold' },
    price: '$2,986',
    change: '+0.8%',
    up: true,
    why: {
      en: 'Gold rises as real yields drift lower ahead of the CPI print and two central banks reported adding to reserves in June. A weaker dollar adds support.',
    },
    tech: {
      en: 'Third consecutive week above $2,900. Momentum steady; the metal tends to move sharply around inflation releases.',
    },
    event: {
      en: 'US CPI release — Thursday 12:30 UTC.',
    },
    facts: [
      { k: { en: 'YTD return' }, v: '+13.6%' },
      { k: { en: '52-week range' }, v: '$2,310–$3,041' },
      { k: { en: 'Correlation to SPX' }, v: '−0.12' },
      { k: { en: 'Unit' }, v: 'USD / troy oz' },
    ],
    news: [
      {
        label: 'fact',
        source: 'Reuters',
        time: '09:20',
        title: {
          en: 'Gold gains as yields ease before CPI',
        },
      },
      {
        label: 'analysis',
        source: 'WSJ',
        time: '08:35',
        title: {
          en: 'Central-bank buying: the quiet driver of the gold bid',
        },
      },
      {
        label: 'communityOpinion',
        source: 'TradingNew Ideas',
        time: '07:40',
        title: {
          en: 'Gold vs bonds as an inflation hedge',
        },
      },
    ],
    related: ['SPX', 'BTC', 'TSLA'],
  },

  NVDA: {
    ticker: 'NVDA',
    type: { en: 'Stock · NASDAQ' },
    name: { en: 'NVIDIA' },
    price: '$172.10',
    change: '+1.6%',
    up: true,
    why: {
      en: 'NVIDIA advances after a major cloud provider raised its capex guidance, reinforcing demand visibility for AI accelerators into 2027.',
    },
    tech: {
      en: 'Uptrend intact above the 20-day average. RSI 68 — approaching overbought territory.',
    },
    event: {
      en: 'Q2 earnings — Wednesday, Aug 27, after close.',
    },
    facts: [
      { k: { en: 'Market cap' }, v: '$4.2T' },
      { k: { en: 'P/E (TTM)' }, v: '54.2' },
      { k: { en: '52-week range' }, v: '$98–$181' },
      {
        k: { en: 'Sector' },
        v: { en: 'Information technology' },
      },
    ],
    news: [
      {
        label: 'fact',
        source: 'Reuters',
        time: '09:00',
        title: {
          en: 'Cloud capex guidance lifts chip stocks',
        },
      },
      {
        label: 'analysis',
        source: 'Semafor',
        time: '08:15',
        title: {
          en: 'How long can AI infrastructure spending grow?',
        },
      },
      {
        label: 'communityOpinion',
        source: 'TradingNew Ideas',
        time: '07:30',
        title: {
          en: 'NVDA: riding the trend with a defined invalidation',
        },
      },
    ],
    related: ['TSLA', 'SPX', 'BTC'],
  },
};
