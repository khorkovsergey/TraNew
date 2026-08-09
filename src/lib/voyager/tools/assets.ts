/**
 * Which instrument somebody meant.
 *
 * This replaces a ten-name dictionary that lived beside the scripted chart
 * scenario and did two jobs badly: it decided that "apple" meant AAPL wherever
 * the word appeared, and it had no way to say it was unsure. Asked for
 * something it did not know, the layer above it drew Tesla.
 *
 * The rule here is the one the brief states twice: **a ticker is never the
 * model's guess when something deterministic can check it.** This module
 * resolves what it knows from a catalogue that is checked in and reviewable,
 * marks everything else as needing verification, and refuses to pick when a
 * word genuinely means more than one instrument. The verification itself is a
 * provider quote, on the server, in `marketData.ts` — a symbol that returns a
 * price with a name and a currency attached is a symbol that exists.
 *
 * Two things it deliberately will not do:
 *
 * - **Guess from a word.** "Could you chart apple" in a lesson about
 *   commodities is not a request for AAPL. Every alias here has to be a name
 *   that only means the instrument.
 * - **Choose between real alternatives.** "Gold" is an ETF, a spot rate and a
 *   futures contract, and picking one silently is how somebody ends up reading
 *   about the wrong one. Ambiguity is an answer: it becomes a short question.
 *
 * Import-free, so the unit harness compiles it alone.
 */

export type AssetClass = 'stock' | 'etf' | 'index' | 'crypto' | 'commodity';

export type AssetCandidate = {
  /** Stable across sessions, so a follow-up can name the same instrument. */
  canonicalId: string;
  symbol: string;
  /** What the market provider is asked for. Usually the symbol; not always. */
  providerSymbol: string;
  displayName: string;
  assetClass: AssetClass;
  exchange?: string;
  currency?: string;
};

type CatalogueEntry = AssetCandidate & {
  /** Names that mean this and only this. Matched whole, never as substrings. */
  aliases: string[];
};

function entry(
  symbol: string,
  displayName: string,
  assetClass: AssetClass,
  aliases: string[],
  extra: { providerSymbol?: string; exchange?: string; currency?: string } = {}
): CatalogueEntry {
  return {
    canonicalId: `${assetClass}:${symbol}`,
    symbol,
    providerSymbol: extra.providerSymbol ?? symbol,
    displayName,
    assetClass,
    exchange: extra.exchange,
    currency: extra.currency,
    aliases: aliases.map((alias) => alias.toLowerCase()),
  };
}

/**
 * The instruments this portal can name without asking anybody.
 *
 * Short on purpose, and not a universe: anything outside it still resolves,
 * through the provider, as long as somebody types a ticker. What the catalogue
 * buys is names — "Tesla", "the S&P", "биткоин" — and the confidence to use
 * them without a round trip.
 */
const CATALOGUE: CatalogueEntry[] = [
  entry('AAPL', 'Apple Inc.', 'stock', ['apple inc', 'apple computer'], {
    exchange: 'NASDAQ',
    currency: 'USD',
  }),
  entry('MSFT', 'Microsoft Corporation', 'stock', ['microsoft', 'майкрософт'], {
    exchange: 'NASDAQ',
    currency: 'USD',
  }),
  entry('NVDA', 'NVIDIA Corporation', 'stock', ['nvidia', 'нвидиа'], {
    exchange: 'NASDAQ',
    currency: 'USD',
  }),
  entry('TSLA', 'Tesla, Inc.', 'stock', ['tesla', 'тесла'], {
    exchange: 'NASDAQ',
    currency: 'USD',
  }),
  entry('AMZN', 'Amazon.com, Inc.', 'stock', ['amazon', 'амазон'], {
    exchange: 'NASDAQ',
    currency: 'USD',
  }),
  entry('GOOGL', 'Alphabet Inc.', 'stock', ['alphabet', 'google'], {
    exchange: 'NASDAQ',
    currency: 'USD',
  }),
  entry('META', 'Meta Platforms, Inc.', 'stock', ['meta platforms', 'facebook'], {
    exchange: 'NASDAQ',
    currency: 'USD',
  }),
  entry('AMD', 'Advanced Micro Devices, Inc.', 'stock', ['advanced micro devices'], {
    exchange: 'NASDAQ',
    currency: 'USD',
  }),
  entry('AVGO', 'Broadcom Inc.', 'stock', ['broadcom'], {
    exchange: 'NASDAQ',
    currency: 'USD',
  }),
  entry('NFLX', 'Netflix, Inc.', 'stock', ['netflix'], {
    exchange: 'NASDAQ',
    currency: 'USD',
  }),

  entry('SPY', 'SPDR S&P 500 ETF Trust', 'etf', ['s&p 500', 'sp500', 's and p 500', 'спх'], {
    exchange: 'NYSE',
    currency: 'USD',
  }),
  entry('QQQ', 'Invesco QQQ Trust', 'etf', ['nasdaq 100', 'nasdaq100'], {
    exchange: 'NASDAQ',
    currency: 'USD',
  }),
  entry('VTI', 'Vanguard Total Stock Market ETF', 'etf', ['total stock market'], {
    exchange: 'NYSE',
    currency: 'USD',
  }),

  entry('BTC/USD', 'Bitcoin', 'crypto', ['bitcoin', 'биткоин', 'биткойн'], {
    currency: 'USD',
  }),
  entry('ETH/USD', 'Ethereum', 'crypto', ['ethereum', 'эфириум'], { currency: 'USD' }),

  /*
   * The genuinely ambiguous ones, listed as the alternatives they are.
   *
   * "Gold" is an ETF holding bullion and a spot rate against the dollar; they
   * do not move identically and they are not the same question. Sharing an
   * alias is what makes the resolver ask rather than choose.
   */
  entry('GLD', 'SPDR Gold Shares (ETF)', 'etf', ['gold', 'золото'], {
    exchange: 'NYSE',
    currency: 'USD',
  }),
  entry('XAU/USD', 'Gold spot price', 'commodity', ['gold', 'золото'], { currency: 'USD' }),
  entry('USO', 'United States Oil Fund (ETF)', 'etf', ['oil', 'нефть'], {
    exchange: 'NYSE',
    currency: 'USD',
  }),
  entry('WTI/USD', 'WTI crude spot price', 'commodity', ['oil', 'нефть'], { currency: 'USD' }),
];

export type AssetResolution =
  /** The catalogue knows this name or ticker outright. */
  | { status: 'exact'; asset: AssetCandidate; alternatives: AssetCandidate[] }
  /** Ticker-shaped and unknown here. A provider quote decides whether it exists. */
  | { status: 'unverified'; symbol: string }
  /** The word means more than one instrument, and choosing would be guessing. */
  | { status: 'ambiguous'; alternatives: AssetCandidate[] }
  /** Neither a name this portal knows nor anything shaped like a symbol. */
  | { status: 'unknown' };

function normalise(query: string): string {
  return query.toLowerCase().replace(/[^\p{L}\p{N}&./\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function candidate(item: CatalogueEntry): AssetCandidate {
  const { aliases: _aliases, ...rest } = item;
  void _aliases;
  return rest;
}

/** Ticker-shaped: what a provider would accept as a symbol. */
export function looksLikeSymbol(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9]{0,5}([./][A-Za-z]{2,4})?$/.test(value.trim());
}

/**
 * What a query resolves to, before anything is fetched.
 *
 * Order matters and it is the order of certainty: an exact ticker, then an
 * exact name, then a name mentioned inside a longer sentence. Nothing is
 * matched as a substring of a word — "meta" must not be found inside
 * "metallurgy", and the whole-token rule is what stops it.
 */
export function resolveAsset(query: unknown): AssetResolution {
  if (typeof query !== 'string') return { status: 'unknown' };

  const raw = query.trim();
  if (!raw) return { status: 'unknown' };

  const text = normalise(raw);
  const upper = raw.toUpperCase();

  const bySymbol = CATALOGUE.filter(
    (item) => item.symbol === upper || item.providerSymbol === upper
  );
  if (bySymbol.length === 1) {
    return { status: 'exact', asset: candidate(bySymbol[0]), alternatives: [] };
  }

  /* An alias that is the whole query, then an alias that appears in it as its
     own words. Both are exact about *which* instrument; the difference is only
     how much else the person said. */
  const whole = CATALOGUE.filter((item) => item.aliases.includes(text));
  const mentioned = whole.length
    ? whole
    : CATALOGUE.filter((item) =>
        item.aliases.some((alias) => new RegExp(`(^|\\s)${escape(alias)}($|\\s)`, 'u').test(text))
      );

  if (mentioned.length === 1) {
    return { status: 'exact', asset: candidate(mentioned[0]), alternatives: [] };
  }

  if (mentioned.length > 1) {
    // Deduplicated by instrument: two entries sharing one alias are two real
    // alternatives, and the person is the only one who knows which they meant.
    return { status: 'ambiguous', alternatives: mentioned.map(candidate) };
  }

  if (looksLikeSymbol(raw)) {
    return { status: 'unverified', symbol: upper };
  }

  return { status: 'unknown' };
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The clarification an ambiguous resolution asks, ready to be shown. */
export function clarification(alternatives: AssetCandidate[]): string {
  const names = alternatives.map((asset) => `${asset.displayName} (${asset.symbol})`);
  return `That could be ${names.join(' or ')} — which did you mean?`;
}
