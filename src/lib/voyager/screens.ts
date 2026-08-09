/**
 * The one place a page name is turned into a Voyager screen.
 *
 * Three closed sets used to be written down four times: the screens the
 * orchestrator knows, the screens the API accepts, the context kinds a link may
 * carry, and the mapping between them. They drifted, as four copies of a list
 * do — `market` and `events` were screens the policy layer understood and the
 * API rejected, so every question asked from a comparison, an Explore page or
 * an event came back **400** and the chat showed its outage card. The status
 * strip said "This comparison" over a failure that had nothing to do with the
 * connection.
 *
 * So there is one array of screens, one array of context kinds, and one map
 * between them. The API's accept list is that array rather than a copy of it,
 * which is what makes the drift impossible rather than merely fixed.
 *
 * Import-free, on purpose: the unit harness compiles this file with bare `tsc`
 * and asserts the invariants that used to be nobody's job.
 */

/* ------------------------------------------------------------- The screens */

/**
 * Which page Voyager thinks it is on. Drives prompts, sources, allowed actions
 * and the shape of the answer.
 */
export const VOYAGER_SCREENS = [
  'chart',
  'market',
  'symbol',
  'economy',
  'indicator',
  'wealth',
  'academy',
  'experts',
  'news',
  'portfolio',
  'strategy',
  'events',
  'ideas',
  'generic',
] as const;

export type VoyagerScreen = (typeof VOYAGER_SCREENS)[number];

export function isVoyagerScreen(value: unknown): value is VoyagerScreen {
  return typeof value === 'string' && (VOYAGER_SCREENS as readonly string[]).includes(value);
}

/**
 * Screens where market data is a source rather than a claim.
 *
 * A generic page listing "Market data & news" would overstate what the answer
 * rests on; a lesson page listing it would be worse, because the lesson is the
 * source and the market is not.
 */
export const MARKET_DATA_SCREENS: VoyagerScreen[] = [
  'chart',
  'market',
  'symbol',
  'economy',
  'indicator',
  'news',
  'ideas',
  'portfolio',
  'wealth',
];

/* -------------------------------------------------------- The context kinds */

/**
 * Where a question came from, as a link may say it.
 *
 * A closed set, because it is read from a URL and shown to the person as "what
 * Voyager can see". An unrecognised value is dropped rather than displayed: a
 * status strip that echoes whatever a link put in it is a status strip that can
 * be made to lie.
 */
export const CONTEXT_KINDS = [
  'home',
  'symbol',
  'chart',
  'comparison',
  'article',
  'event',
  'portfolio',
  'plan',
  'explore',
  'learn',
  'start',
  'ideas',
] as const;

export type ContextKind = (typeof CONTEXT_KINDS)[number];

export const CONTEXT_LABEL: Record<ContextKind, string> = {
  home: 'Home',
  symbol: 'This asset',
  chart: 'This chart',
  comparison: 'This comparison',
  article: 'This article',
  event: 'This event',
  portfolio: 'Your practice portfolio',
  plan: 'Your plan',
  explore: 'Explore',
  learn: 'A lesson',
  start: 'Your next step',
  ideas: 'This idea',
};

/**
 * Which server screen each context kind resolves to.
 *
 * The two vocabularies are deliberately different — one is what a link may
 * carry, the other is what the policy layer keys sources off — and this is the
 * single place they meet. A page that started sending its own screen name would
 * be choosing which sources the server offers it.
 *
 * `start` and `ideas` were missing until 2026-08-09, and both failed quietly
 * rather than loudly: a handoff from "Find my next step" was labelled *Home*
 * because `home` was the nearest kind anybody could pass, and Ideas sent
 * `explore:<topic>`, so an answer about one published idea was told it was
 * looking at the whole Explore hub.
 */
export const SCREEN_OF: Record<ContextKind, VoyagerScreen> = {
  home: 'generic',
  symbol: 'symbol',
  chart: 'chart',
  comparison: 'market',
  article: 'news',
  event: 'events',
  portfolio: 'portfolio',
  plan: 'strategy',
  explore: 'market',
  learn: 'academy',
  // The router's own questions are about what to do next, which is the same
  // conversation the strategy screen is built around.
  start: 'strategy',
  ideas: 'ideas',
};

export function screenFor(kind: ContextKind | null): VoyagerScreen {
  return kind ? SCREEN_OF[kind] : 'generic';
}

export type PageContext = { kind: ContextKind; subject: string | null };

/** `symbol:TSLA`, `comparison:etfs,bonds`, `home`. Anything else is nothing. */
export function parseContext(raw: unknown): PageContext | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;

  const [kind, ...rest] = raw.trim().toLowerCase().split(':');
  if (!(CONTEXT_KINDS as readonly string[]).includes(kind)) return null;

  const subject = rest.join(':').trim();
  return {
    kind: kind as ContextKind,
    // Bounded and stripped of anything that is not a plain identifier — this is
    // rendered in the status strip.
    subject: subject ? subject.replace(/[^a-z0-9,.\-\s]/gi, '').slice(0, 48) || null : null,
  };
}

export function contextLabel(context: PageContext | null): string {
  if (!context) return 'This conversation only';
  const base = CONTEXT_LABEL[context.kind];
  return context.subject ? `${base} · ${context.subject.toUpperCase()}` : base;
}
