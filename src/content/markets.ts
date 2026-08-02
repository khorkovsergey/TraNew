/**
 * The market registry.
 *
 * Adding a market is meant to be an entry here, not a new set of components —
 * that is the whole point of the configuration layer. What it deliberately is
 * not is a switch that publishes pages: `sections` says which screens a market
 * can show and `indexability` says which of those a search engine may have, and
 * the second is set by hand after someone has read the content.
 *
 * So a market can exist, be reachable, and still be `noindex` — which is the
 * state most of them are in. The alternative is thirteen near-identical country
 * pages with the name swapped, which the brief forbids and which would be a
 * worse product besides.
 */

export type MarketType = 'global' | 'region' | 'country';

export type MarketSection =
  | 'overview'
  | 'news'
  | 'assets'
  | 'stocks'
  | 'indices'
  | 'etfs'
  | 'bonds'
  | 'forex'
  | 'commodities'
  | 'exchanges'
  | 'marketHours'
  | 'trends'
  | 'community'
  | 'events'
  | 'learn';

/**
 * DISABLED — the route is not exposed and the nav entry is hidden.
 * NOINDEX  — reachable for people, kept out of the index and the sitemap.
 * INDEX    — a search engine may have it, and it is in the sitemap.
 */
export type Indexability = 'disabled' | 'noindex' | 'index';

export type MarketExchange = {
  id: string;
  name: string;
  city: string;
  timeZone: string;
  currency: string;
  /**
   * Trading segments in exchange-local time, in order.
   *
   * A list rather than one open/close pair because Tokyo and Hong Kong break for
   * lunch: a single pair would report those exchanges as open for an hour when
   * nothing is trading. Being right about this is most of the value of the page
   * it feeds.
   */
  segments: Array<{ open: string; close: string }>;
  preMarket?: { open: string; close: string };
  afterHours?: { open: string; close: string };
  /** What this exchange is for, in one sentence. Not marketing. */
  role: string;
  officialUrl?: string;
};

export type MarketIndexRef = {
  symbol: string;
  name: string;
  /** What the index actually measures — the reason it is worth naming. */
  describes: string;
};

export type MarketConfig = {
  id: string;
  slug: string;
  type: MarketType;
  name: string;
  /** "US", "Japanese" — used in headings, where the noun form reads badly. */
  adjective: string;
  /** One line for cards and menus. Says what is inside, not that it is important. */
  summary: string;
  countryCode?: string;
  region?: string;
  currency?: string;
  languages?: string[];
  exchanges: MarketExchange[];
  indices: MarketIndexRef[];
  /** Markets a reader might reasonably go to next, and why. */
  related: Array<{ slug: string; because: string }>;
  sections: Partial<Record<MarketSection, boolean>>;
  indexability: Partial<Record<MarketSection, Indexability>>;
  seo: {
    title: string;
    description: string;
    h1: string;
    /**
     * The market's own explanation. Written per market, never templated — a
     * paragraph with the country name swapped is the thing the brief calls a
     * forbidden approach, and it is also the reason such pages do not rank.
     */
    intro: string[];
  };
};

const NYSE: MarketExchange = {
  id: 'nyse',
  name: 'New York Stock Exchange',
  city: 'New York',
  timeZone: 'America/New_York',
  currency: 'USD',
  segments: [{ open: '09:30', close: '16:00' }],
  preMarket: { open: '04:00', close: '09:30' },
  afterHours: { open: '16:00', close: '20:00' },
  role: 'The larger of the two US venues by listed company value, and the home of most long-established American industrial and financial names.',
  officialUrl: 'https://www.nyse.com',
};

const NASDAQ: MarketExchange = {
  id: 'nasdaq',
  name: 'Nasdaq',
  city: 'New York',
  timeZone: 'America/New_York',
  currency: 'USD',
  segments: [{ open: '09:30', close: '16:00' }],
  preMarket: { open: '04:00', close: '09:30' },
  afterHours: { open: '16:00', close: '20:00' },
  role: 'All-electronic since it opened in 1971, and where most of the large American technology companies are listed.',
  officialUrl: 'https://www.nasdaq.com',
};

const TSE: MarketExchange = {
  id: 'tse',
  name: 'Tokyo Stock Exchange',
  city: 'Tokyo',
  timeZone: 'Asia/Tokyo',
  currency: 'JPY',
  // Two segments, not one: Tokyo closes for lunch, and a single pair would
  // report the exchange as trading through it.
  segments: [
    { open: '09:00', close: '11:30' },
    { open: '12:30', close: '15:30' },
  ],
  role: 'Japan’s primary venue, reorganised in 2022 into Prime, Standard and Growth segments with different listing requirements.',
  officialUrl: 'https://www.jpx.co.jp/english/',
};

export const MARKETS: MarketConfig[] = [
  {
    id: 'global',
    slug: 'global',
    type: 'global',
    name: 'Global Markets',
    adjective: 'Global',
    summary: 'What is moving across the world today, and where to look next.',
    exchanges: [NYSE, NASDAQ, TSE],
    indices: [
      { symbol: 'SPX', name: 'S&P 500', describes: '500 large US companies, weighted by market value' },
      { symbol: 'NIKKEI225', name: 'Nikkei 225', describes: '225 Japanese companies, weighted by share price rather than size' },
      { symbol: 'FTSE100', name: 'FTSE 100', describes: 'The 100 largest companies listed in London, most of their revenue earned abroad' },
    ],
    related: [
      { slug: 'us', because: 'the largest market by value, and the one most others follow' },
      { slug: 'japan', because: 'the first major market to open each day' },
    ],
    sections: { overview: true, news: true, events: true, learn: true },
    indexability: { overview: 'index', news: 'index', events: 'noindex', learn: 'noindex' },
    seo: {
      title: 'Global Markets Today: News, Indices & Market Hours',
      description:
        'Follow stock markets around the world: which are open now, what moved today, and how the major indices and exchanges relate to each other.',
      h1: 'Global Markets',
      intro: [
        'A stock market is not one place. It is a set of venues in different countries, each with its own opening hours, currency, listing rules and set of listed companies. When people say "the market rose", they mean a particular index in a particular country, over a particular period.',
        'Because those venues open in sequence rather than together, the trading day never really stops: Tokyo opens while New York is asleep, London overlaps with both, and news that breaks in one time zone is priced in wherever is open at the time. That is why a European index can open sharply lower on an announcement made in Asia overnight.',
        'The three words that get used interchangeably are worth separating. An **exchange** is the venue where trading happens — the New York Stock Exchange, the Tokyo Stock Exchange. A **market** is the broader idea of all trading in a country or region, usually across several exchanges. An **index** is a measurement: a rule for combining a fixed set of listed companies into one number, so their collective movement can be described in a sentence.',
        'Markets in different regions move together more than geography alone would suggest. Large companies earn revenue in many countries, the same institutions invest across borders, and the price of money — set by a handful of central banks — affects what every asset is worth. That correlation is not fixed: it rises sharply during a crisis and falls when the drivers are local.',
      ],
    },
  },
  {
    id: 'us',
    slug: 'us',
    type: 'country',
    name: 'United States',
    adjective: 'US',
    summary: 'US stocks, the S&P 500 and Nasdaq, exchange hours and what moved today.',
    countryCode: 'US',
    region: 'Americas',
    currency: 'USD',
    languages: ['EN'],
    exchanges: [NYSE, NASDAQ],
    indices: [
      { symbol: 'SPX', name: 'S&P 500', describes: '500 large US companies weighted by market value — the usual shorthand for "the US market"' },
      { symbol: 'DJI', name: 'Dow Jones Industrial Average', describes: '30 companies weighted by share price, which is why a high-priced stock moves it more than a large one' },
      { symbol: 'IXIC', name: 'Nasdaq Composite', describes: 'Almost everything listed on Nasdaq, so it leans heavily towards technology' },
    ],
    related: [
      { slug: 'global', because: 'the wider picture the US market sits inside' },
      { slug: 'japan', because: 'trades while New York is closed, and often reacts to it first' },
    ],
    sections: { overview: true, news: true, indices: true, exchanges: true, marketHours: true, events: true, learn: true },
    indexability: {
      overview: 'index',
      news: 'index',
      // Declared, deliberately not yet published: these need their own content
      // before they are worth a search result. See the report in the commit.
      indices: 'noindex',
      exchanges: 'noindex',
      marketHours: 'noindex',
      events: 'noindex',
      learn: 'noindex',
    },
    seo: {
      title: 'US Stock Market: News, Indices & Trading Hours',
      description:
        'Follow the US stock market: NYSE and Nasdaq hours, the S&P 500, Dow and Nasdaq Composite, and what moved today with the reasons reported.',
      h1: 'United States Stock Market',
      intro: [
        'The United States has two main venues — the New York Stock Exchange and Nasdaq — which trade the same hours and are distinguished more by which companies list on them than by how they work. Both run a regular session from 09:30 to 16:00 New York time, with pre-market and after-hours trading either side of it.',
        'That extended trading is thinner than the regular session: fewer participants, wider spreads, and prices that can move a long way on a small order. Company results are usually released outside the regular session precisely so that the reaction has time to spread before normal trading resumes, which is why a share can appear to gap overnight without having traded much at all.',
        'Three indices get quoted, and they are not measuring the same thing. The S&P 500 weights its 500 companies by market value, so the largest few dominate it. The Dow weights by share price, an accident of its 19th-century origins that makes a $500 share matter more than a much larger company trading at $50. The Nasdaq Composite includes almost everything on Nasdaq, which is why it moves with technology.',
        'US market hours matter to people who are not in the US, because a large share of the world’s listed company value trades here and because the Federal Reserve’s decisions on interest rates are made on this calendar. Both are reasons a market in another country can move sharply at 20:00 local time.',
      ],
    },
  },
  {
    id: 'japan',
    slug: 'japan',
    type: 'country',
    name: 'Japan',
    adjective: 'Japanese',
    summary: 'Japanese stocks, the Nikkei 225 and TOPIX, Tokyo trading hours and the lunch break.',
    countryCode: 'JP',
    region: 'Asia',
    currency: 'JPY',
    languages: ['JA', 'EN'],
    exchanges: [TSE],
    indices: [
      { symbol: 'NIKKEI225', name: 'Nikkei 225', describes: '225 companies weighted by share price, the same construction as the Dow and with the same distortion' },
      { symbol: 'TOPIX', name: 'TOPIX', describes: 'Every company in the Tokyo exchange’s Prime segment, weighted by market value' },
    ],
    related: [
      { slug: 'global', because: 'the wider picture, and the sequence Tokyo opens in' },
      { slug: 'us', because: 'opens as Tokyo closes, and Japanese exporters price in the dollar' },
    ],
    sections: { overview: true, news: true, indices: true, exchanges: true, marketHours: true, learn: true },
    indexability: {
      overview: 'index',
      news: 'noindex',
      indices: 'noindex',
      exchanges: 'noindex',
      marketHours: 'noindex',
      learn: 'noindex',
    },
    seo: {
      title: 'Japanese Stock Market: Nikkei 225, TOPIX & Tokyo Hours',
      description:
        'Follow the Japanese stock market: Tokyo Stock Exchange hours including the lunch break, the Nikkei 225 and TOPIX, and what moves Japanese shares.',
      h1: 'Japanese Stock Market',
      intro: [
        'Japan trades on the Tokyo Stock Exchange, and its day is split in two: 09:00 to 11:30, a break, then 12:30 to 15:30 Tokyo time. The lunch break is a genuine halt rather than a quiet period — no trading happens, and orders accumulate for the reopening, which is why the afternoon session often starts with a jump.',
        'Two indices describe the same market differently. The Nikkei 225 weights its constituents by share price, which means a company with an expensive share moves the index more than a much larger company with a cheap one. TOPIX covers the whole Prime segment weighted by market value, so it is the broader and less distorted measure — and the two can disagree noticeably on a day when a few high-priced shares move.',
        'The exchange reorganised its segments in 2022, replacing the old First and Second Sections with Prime, Standard and Growth, each with different listing requirements around liquidity and governance. The change was aimed at companies that had qualified for the top section historically and no longer met its standards.',
        'The yen matters more here than a currency usually does for a domestic index. Many of the largest listed Japanese companies earn a substantial share of their revenue abroad, so a weaker yen raises the yen value of those earnings — and Japanese equities and the currency frequently move in opposite directions for that reason alone.',
      ],
    },
  },
];

const BY_SLUG = new Map(MARKETS.map((market) => [market.slug, market]));

export function getMarket(slug: string): MarketConfig | null {
  return BY_SLUG.get(slug) ?? null;
}

/** Every market that has at least one reachable section. */
export function listMarkets(): MarketConfig[] {
  return MARKETS.filter((market) => Object.values(market.sections).some(Boolean));
}

export function sectionState(market: MarketConfig, section: MarketSection): Indexability {
  if (!market.sections[section]) return 'disabled';
  return market.indexability[section] ?? 'noindex';
}

/** Only pages a search engine should be offered — the sitemap reads this. */
export function isIndexable(market: MarketConfig, section: MarketSection): boolean {
  return sectionState(market, section) === 'index';
}
