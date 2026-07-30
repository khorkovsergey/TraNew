export const TICKERS = ['TSLA', 'SPX', 'BTC', 'GOLD', 'NVDA'] as const;
export type Ticker = (typeof TICKERS)[number];

/** Spellings people actually type, in both locales, mapped to a canonical ticker. */
const ALIASES: Record<string, Ticker> = {
  tsla: 'TSLA',
  tesla: 'TSLA',
  тесла: 'TSLA',
  spx: 'SPX',
  's&p': 'SPX',
  's&p 500': 'SPX',
  'sp500': 'SPX',
  'sp 500': 'SPX',
  'снп 500': 'SPX',
  btc: 'BTC',
  bitcoin: 'BTC',
  биткоин: 'BTC',
  биткойн: 'BTC',
  gold: 'GOLD',
  xau: 'GOLD',
  золото: 'GOLD',
  nvda: 'NVDA',
  nvidia: 'NVDA',
  нвидиа: 'NVDA',
};

export function isTicker(value: string): value is Ticker {
  return (TICKERS as readonly string[]).includes(value.toUpperCase());
}

/**
 * The hero search is the portal's single entry point: a recognised asset opens its
 * Symbol Overview, anything else becomes a question for the Research Workspace.
 */
export function resolveSearch(query: string): { kind: 'symbol'; ticker: Ticker } | { kind: 'question'; q: string } {
  const trimmed = query.trim();
  const key = trimmed.toLowerCase();
  const match = ALIASES[key];

  if (match) return { kind: 'symbol', ticker: match };
  if (isTicker(trimmed)) return { kind: 'symbol', ticker: trimmed.toUpperCase() as Ticker };

  return { kind: 'question', q: trimmed };
}
