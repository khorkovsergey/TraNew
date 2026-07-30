import type { Ticker } from '@/lib/symbolSearch';
import type { Localized, TrustLabel } from './types';

export type NewsItem = {
  id: string;
  label: Extract<TrustLabel, 'fact' | 'analysis' | 'communityOpinion' | 'sponsored'>;
  source: string;
  time: Localized;
  title: Localized;
  summary: Localized;
  /** The line that separates this portal from a wire feed. */
  whyItMatters: Localized;
  related: Ticker[];
};

export const NEWS_TABS = [
  { id: 'foryou', label: { en: 'For you' } },
  { id: 'top', label: { en: 'Top stories' } },
  { id: 'markets', label: { en: 'Markets' } },
  { id: 'economy', label: { en: 'Economy' } },
  { id: 'stocks', label: { en: 'Stocks' } },
  { id: 'crypto', label: { en: 'Crypto' } },
  { id: 'earnings', label: { en: 'Earnings' } },
  { id: 'watchlist', label: { en: 'My watchlist' } },
];

export const NEWS: NewsItem[] = [
  {
    id: 'cpi',
    label: 'fact',
    source: 'Reuters',
    time: { en: '09:12' },
    title: {
      en: 'US inflation cools to 2.6% ahead of Thursday release',
    },
    summary: {
      en: 'Consensus now sits at 2.6% year on year, down from 2.9% in the previous print. Core services remain the stickiest component.',
    },
    whyItMatters: {
      en: 'Rate expectations drive almost everything else this week. A softer number supports long-duration bonds and rate-sensitive equities; a hotter one does the opposite.',
    },
    related: ['SPX', 'GOLD'],
  },
  {
    id: 'tesla',
    label: 'fact',
    source: 'Reuters',
    time: { en: '09:12' },
    title: {
      en: 'Tesla Q2 deliveries beat estimates at 462,000 vehicles',
    },
    summary: {
      en: 'Deliveries came in 4% above consensus. Management confirmed the launch window for the next mass-market model.',
    },
    whyItMatters: {
      en: 'Deliveries are the number the market prices Tesla on. A beat resets near-term expectations, but the next model matters more for the multi-year case.',
    },
    related: ['TSLA'],
  },
  {
    id: 'chips',
    label: 'analysis',
    source: 'Semafor',
    time: { en: '08:15' },
    title: {
      en: 'How long can AI infrastructure spending grow?',
    },
    summary: {
      en: 'Cloud capex guidance keeps rising, but the customer base behind it is narrow — a handful of buyers account for most accelerator demand.',
    },
    whyItMatters: {
      en: 'Concentration cuts both ways. The same handful of buyers that drove the rally can pause it, and their capex plans are published quarterly.',
    },
    related: ['NVDA', 'SPX'],
  },
  {
    id: 'btc',
    label: 'fact',
    source: 'CoinDesk',
    time: { en: '09:30' },
    title: {
      en: 'Bitcoin slips as ETF inflows cool',
    },
    summary: {
      en: 'A third consecutive day of slower inflows, plus a large wallet transfer to an exchange, pushed the price to the lower half of its two-week range.',
    },
    whyItMatters: {
      en: 'ETF flows have become the clearest read on institutional demand. The move stayed inside the existing range, so nothing structural has changed yet.',
    },
    related: ['BTC', 'GOLD'],
  },
  {
    id: 'gold',
    label: 'analysis',
    source: 'WSJ',
    time: { en: '08:35' },
    title: {
      en: 'Central-bank buying: the quiet driver of the gold bid',
    },
    summary: {
      en: 'Two more central banks reported adding to reserves in June, continuing a pattern that has run for several years.',
    },
    whyItMatters: {
      en: 'Official-sector demand is slower and less price-sensitive than investor demand, which changes how gold behaves around inflation releases.',
    },
    related: ['GOLD'],
  },
  {
    id: 'etfs',
    label: 'sponsored',
    source: 'Partner',
    time: { en: '08:00' },
    title: {
      en: 'Five ETFs for broad US exposure',
    },
    summary: {
      en: 'A partner overview of low-cost funds tracking the largest US indices.',
    },
    whyItMatters: {
      en: 'Marked as sponsored because it is paid placement. Compare cost, domicile and tracking difference yourself before acting on any list.',
    },
    related: ['SPX'],
  },
];

export const IDEA_TABS = [
  { id: 'editors', label: { en: "Editors' picks" } },
  { id: 'foryou', label: { en: 'For you' } },
  { id: 'following', label: { en: 'Following' } },
  { id: 'popular', label: { en: 'Popular' } },
  { id: 'newest', label: { en: 'Newest' } },
  { id: 'all', label: { en: 'All' } },
];

export type Idea = {
  id: string;
  author: string;
  time: Localized;
  ticker: Ticker;
  horizon: Localized;
  status: 'active' | 'invalidated';
  thesis: Localized;
  since: string;
  sinceUp: boolean;
  discloses: boolean;
};

export const IDEAS: Idea[] = [
  {
    id: 'tsla-breakout',
    author: 'm_ivanova',
    time: { en: '2h ago' },
    ticker: 'TSLA',
    horizon: { en: 'Medium term' },
    status: 'active',
    thesis: {
      en: 'The two-month range is resolving upward on rising volume. Invalidation is a close back below the range midpoint.',
    },
    since: '+4.2%',
    sinceUp: true,
    discloses: true,
  },
  {
    id: 'btc-range',
    author: 'range_trader',
    time: { en: '5h ago' },
    ticker: 'BTC',
    horizon: { en: 'Short term' },
    status: 'active',
    thesis: {
      en: 'Waiting for a decisive break of the two-week consolidation before committing either way. Support at $114k has held twice.',
    },
    since: '−1.1%',
    sinceUp: false,
    discloses: false,
  },
  {
    id: 'gold-hedge',
    author: 'macro_notes',
    time: { en: '1d ago' },
    ticker: 'GOLD',
    horizon: { en: 'Long term' },
    status: 'active',
    thesis: {
      en: 'Central-bank demand plus falling real yields keeps the structural case intact regardless of the next CPI print.',
    },
    since: '+2.8%',
    sinceUp: true,
    discloses: true,
  },
  {
    id: 'nvda-trend',
    author: 'trend_follow',
    time: { en: '2d ago' },
    ticker: 'NVDA',
    horizon: { en: 'Medium term' },
    status: 'invalidated',
    thesis: {
      en: 'Trend-following entry above the 20-day average. The stop level was hit intraday, so the idea is closed.',
    },
    since: '−3.4%',
    sinceUp: false,
    discloses: false,
  },
];

export type MarketMove = {
  ticker: Ticker;
  reason: Localized;
  source: string;
  time: Localized;
};

export const TOP_MOVES: MarketMove[] = [
  {
    ticker: 'TSLA',
    reason: {
      en: 'Q2 deliveries beat consensus by 4%; two banks raised price targets.',
    },
    source: 'Reuters',
    time: { en: '09:12' },
  },
  {
    ticker: 'NVDA',
    reason: {
      en: 'A major cloud provider raised capex guidance, extending demand visibility.',
    },
    source: 'Reuters',
    time: { en: '09:00' },
  },
  {
    ticker: 'BTC',
    reason: {
      en: 'ETF inflows slowed for a third day and a large wallet moved 8,000 BTC to an exchange.',
    },
    source: 'CoinDesk',
    time: { en: '09:30' },
  },
];

export const MARKET_EVENTS: Array<{ title: Localized; when: Localized }> = [
  {
    title: { en: 'US CPI release' },
    when: { en: 'Thursday 12:30 UTC' },
  },
  {
    title: { en: 'ECB rate decision' },
    when: { en: 'Friday 12:15 UTC' },
  },
  {
    title: { en: 'Apple earnings' },
    when: { en: 'Thursday, after close' },
  },
  {
    title: { en: 'NVIDIA earnings' },
    when: { en: 'Aug 27, after close' },
  },
];

export const WATCH_NEXT: Localized[] = [
  { en: 'Core services inflation' },
  { en: 'Cloud capex guidance' },
  { en: 'ETF flow reports' },
  { en: 'Real yields' },
  { en: 'Index breadth' },
];

export const ASSET_CLASSES: Localized[] = [
  { en: 'Indices' },
  { en: 'Stocks' },
  { en: 'Crypto' },
  { en: 'Forex' },
  { en: 'Bonds' },
  { en: 'ETFs' },
  { en: 'Commodities' },
  { en: 'Futures' },
];

export const EXPLORE_GOALS: Localized[] = [
  { en: 'Beat inflation' },
  { en: 'Generate income' },
  { en: 'Grow long term' },
  { en: 'Reduce risk' },
  { en: 'Diversify' },
  { en: 'Follow a theme' },
];
