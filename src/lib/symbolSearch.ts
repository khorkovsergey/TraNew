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

/* -------------------------------------------------------------- Suggestions */

/**
 * What the hero field offers while someone is typing.
 *
 * The field asks for "any asset, or a question" and used to answer nothing at
 * all until Enter, which meant the only way to find out whether it understood
 * you was to commit. These are the destinations it can actually reach, so the
 * list is short, exact and honest — and the last row always offers to take the
 * words as a question, so a query it does not recognise is still a way forward
 * rather than a dead end.
 */

export type Suggestion =
  | { kind: 'symbol'; ticker: Ticker; label: string; hint: string }
  | { kind: 'section'; path: SectionPath; label: string; hint: string }
  | { kind: 'question'; q: string; label: string; hint: string };

export type SectionPath =
  | '/explore'
  | '/market/brief'
  | '/news'
  | '/ideas'
  | '/economy'
  | '/supercharts'
  | '/research'
  | '/academy'
  | '/events'
  | '/strategy'
  | '/marketplace/experts'
  | '/account/wealth'
  | '/portfolio';

const SYMBOL_NAMES: Record<Ticker, string> = {
  TSLA: 'Tesla',
  SPX: 'S&P 500',
  BTC: 'Bitcoin',
  GOLD: 'Gold',
  NVDA: 'NVIDIA',
};

const SYMBOL_KIND: Record<Ticker, string> = {
  TSLA: 'Stock · NASDAQ',
  SPX: 'Index · US',
  BTC: 'Crypto',
  GOLD: 'Commodity',
  NVDA: 'Stock · NASDAQ',
};

/** Sections, with the words people use for them rather than only their titles. */
const SECTIONS: Array<{ path: SectionPath; label: string; hint: string; terms: string[] }> = [
  { path: '/explore', label: 'Explore markets', hint: 'Markets overview', terms: ['explore', 'markets', 'overview'] },
  { path: '/market/brief', label: "Today's market brief", hint: 'What moved and why', terms: ['brief', 'today', 'summary', 'market'] },
  { path: '/news', label: 'Market news', hint: 'News', terms: ['news', 'headlines'] },
  { path: '/ideas', label: 'Trading ideas', hint: 'Community ideas', terms: ['ideas', 'community'] },
  { path: '/economy', label: 'Economy', hint: 'Inflation, rates, growth', terms: ['economy', 'inflation', 'cpi', 'rates', 'gdp', 'macro'] },
  { path: '/supercharts', label: 'Supercharts', hint: 'Charting', terms: ['chart', 'charts', 'supercharts', 'technical'] },
  { path: '/research', label: 'Research workspace', hint: 'Ask a question', terms: ['research', 'workspace', 'question'] },
  { path: '/academy', label: 'Academy', hint: 'Learn investing', terms: ['academy', 'learn', 'course', 'lesson', 'beginner'] },
  { path: '/events', label: 'Events', hint: 'Meetups, webinars, conferences', terms: ['event', 'events', 'meetup', 'webinar', 'conference', 'workshop'] },
  { path: '/strategy', label: 'Strategy Builder', hint: 'Build a plan', terms: ['strategy', 'plan', 'allocation', 'portfolio plan'] },
  { path: '/marketplace/experts', label: 'Expert services', hint: 'Book a consultation', terms: ['expert', 'experts', 'adviser', 'advisor', 'consultation'] },
  { path: '/account/wealth', label: 'Wealth Hub', hint: 'Your capital in one place', terms: ['wealth', 'net worth', 'assets', 'property'] },
  { path: '/portfolio', label: 'Portfolio', hint: 'Holdings', terms: ['portfolio', 'holdings', 'positions'] },
];

const MAX = 6;

export function suggest(query: string): Suggestion[] {
  const raw = query.trim();
  if (!raw) return [];

  const key = raw.toLowerCase();
  const results: Suggestion[] = [];

  // Symbols first: an exact ticker or a name someone typed is the strongest
  // possible signal about what they want.
  for (const ticker of TICKERS) {
    const name = SYMBOL_NAMES[ticker];
    const matches =
      ticker.toLowerCase().startsWith(key) ||
      name.toLowerCase().startsWith(key) ||
      Object.entries(ALIASES).some(([alias, value]) => value === ticker && alias.startsWith(key));

    if (matches) {
      results.push({ kind: 'symbol', ticker, label: name, hint: SYMBOL_KIND[ticker] });
    }
  }

  for (const section of SECTIONS) {
    if (results.length >= MAX) break;
    const matches =
      section.label.toLowerCase().includes(key) ||
      section.terms.some((term) => term.startsWith(key) || key.startsWith(term));

    if (matches) {
      results.push({ kind: 'section', path: section.path, label: section.label, hint: section.hint });
    }
  }

  // Always last, always offered: whatever was typed, taken as a question.
  results.push({
    kind: 'question',
    q: raw,
    label: `Ask: “${raw}”`,
    hint: 'Research workspace',
  });

  return results.slice(0, MAX + 1);
}
