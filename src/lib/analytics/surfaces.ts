/**
 * The surface registry — metadata over the real route catalogue.
 *
 * Import-free, and deliberately *not* a second routing system. `src/i18n/routing.ts`
 * remains the single source of truth for paths; this says what each one is for
 * the purpose of measurement: which product area it belongs to, whether a
 * session landing there is eligible for continuation, which feature flag can
 * make it unreachable, and whether it leaves the portal.
 *
 * The reason it exists at all: a route template is not a product area. Six
 * routes make up Markets and one of them is a redirect stub; `/academy` and
 * `/marketplace/academy` are two different products with one name. A dashboard
 * grouped by URL would answer a question nobody asked.
 */

/** Which flag can switch a surface off. Resolved at runtime, never assumed. */
export type FlagName = 'superchartEnabled' | 'wealthHubEnabled' | 'alertsEnabled';

export type SurfaceDefinition = {
  key: string;
  label: string;
  category: 'entry' | 'research' | 'learn' | 'community' | 'marketplace' | 'account' | 'system';
  /** Route templates from `routing.ts`. Never populated paths. */
  routes: readonly string[];
  /**
   * Whether a session that lands here counts in the PMCR denominator.
   *
   * Sign-in, sign-up and the dashboard itself are excluded: they are steps in
   * somebody else's flow or they are us, and neither is a visit whose
   * continuation a product change could improve.
   */
  pmcrEligible: boolean;
  gatedBy?: FlagName;
  /** A destination outside the portal. Counted as continuation, shown apart. */
  external?: boolean;
  note?: string;
};

export const SURFACE_REGISTRY: readonly SurfaceDefinition[] = [
  { key: 'home', label: 'Home', category: 'entry', routes: ['/'], pmcrEligible: true },
  { key: 'start', label: 'Find my next step', category: 'entry', routes: ['/start', '/start/plan', '/workspace'], pmcrEligible: true },

  { key: 'markets', label: 'Markets', category: 'research', routes: ['/market', '/market/brief', '/markets/global', '/markets/[market]', '/markets/[market]/news'], pmcrEligible: true },
  { key: 'market_compare', label: 'Compare assets', category: 'research', routes: ['/markets/compare'], pmcrEligible: true },
  { key: 'symbols', label: 'Symbols', category: 'research', routes: ['/symbols/[ticker]'], pmcrEligible: true },
  { key: 'research', label: 'Research', category: 'research', routes: ['/research'], pmcrEligible: true },
  { key: 'economy', label: 'Economy', category: 'research', routes: ['/economy', '/economy/countries/[id]', '/economy/indicators/[slug]'], pmcrEligible: true },
  { key: 'news', label: 'News', category: 'research', routes: ['/news'], pmcrEligible: true },
  { key: 'ideas', label: 'Ideas', category: 'research', routes: ['/ideas'], pmcrEligible: true },
  { key: 'explore', label: 'Explore', category: 'research', routes: ['/explore', '/explore/options', '/explore/[class]'], pmcrEligible: true, note: 'Many menu rows under Explore are inert "Coming soon" entries. Adoption there is demand, not usage.' },
  {
    key: 'supercharts',
    label: 'Supercharts',
    category: 'research',
    routes: ['/supercharts'],
    pmcrEligible: true,
    gatedBy: 'superchartEnabled',
    note: 'Flag defaults off. Every Superchart metric is conditional on it, and eleven declared events are unreachable while it is.',
  },

  { key: 'voyager', label: 'Voyager', category: 'research', routes: ['/voyager'], pmcrEligible: true },
  { key: 'voyager_research', label: 'Voyager research', category: 'research', routes: ['/voyager/research'], pmcrEligible: true },

  { key: 'academy', label: 'Learn', category: 'learn', routes: ['/academy', '/academy/setup', '/academy/path', '/academy/dashboard', '/academy/lesson/[slug]', '/academy/done'], pmcrEligible: true },
  { key: 'practice', label: 'Practice', category: 'learn', routes: ['/academy/practice/[ticker]', '/portfolio'], pmcrEligible: true },
  { key: 'events', label: 'Events', category: 'community', routes: ['/events', '/events/[slug]', '/events/create', '/events/my', '/events/manage', '/events/manage/[eventId]', '/organizers/[slug]', '/learning-events'], pmcrEligible: true },

  { key: 'marketplace', label: 'Marketplace', category: 'marketplace', routes: ['/marketplace'], pmcrEligible: true },
  { key: 'experts', label: 'Expert services', category: 'marketplace', routes: ['/marketplace/experts', '/marketplace/experts/intake', '/marketplace/experts/matches', '/marketplace/experts/compare', '/marketplace/experts/[id]', '/marketplace/experts/[id]/sharing', '/marketplace/experts/[id]/booking', '/marketplace/consultations/[id]', '/marketplace/consultations/[id]/summary'], pmcrEligible: true },
  { key: 'marketplace_academy', label: 'Academy (paid)', category: 'marketplace', routes: ['/marketplace/academy', '/marketplace/academy/[slug]', '/marketplace/academy/my-learning'], pmcrEligible: true },
  { key: 'tools', label: 'Tools & Data', category: 'marketplace', routes: ['/marketplace/tools', '/marketplace/tools/supercharts'], pmcrEligible: true },
  { key: 'chart_market', label: 'Chart Market', category: 'marketplace', routes: ['/marketplace/tools/chart-market'], pmcrEligible: true },
  { key: 'subscriptions', label: 'Subscriptions', category: 'marketplace', routes: ['/marketplace/subscriptions'], pmcrEligible: true },

  { key: 'account', label: 'Account', category: 'account', routes: ['/account', '/account/workspace', '/account/voyager', '/account/activity', '/account/academy', '/account/purchases', '/account/settings'], pmcrEligible: false, note: 'Signed-in housekeeping. A visit here is not a landing whose continuation means anything.' },
  {
    key: 'wealth',
    label: 'Wealth Hub',
    category: 'account',
    routes: ['/account/wealth', '/account/wealth/assets/[id]'],
    pmcrEligible: false,
    gatedBy: 'wealthHubEnabled',
    note: 'Counts and presence only. No value is ever read, and nothing here is decrypted.',
  },

  { key: 'auth', label: 'Sign in / sign up', category: 'system', routes: ['/sign-in', '/sign-up', '/forgot-password', '/reset-password'], pmcrEligible: false },
  { key: 'info', label: 'Info pages', category: 'system', routes: ['/why', '/trust', '/how-we-explain', '/guidance', '/strategy', '/tool/[slug]'], pmcrEligible: true },
  { key: 'community', label: 'Community & brokers', category: 'community', routes: ['/community', '/brokers'], pmcrEligible: true, external: true, note: 'Points outward. Continuation here is external and is never folded into the internal rate.' },

  { key: 'portal', label: 'Portal (global)', category: 'system', routes: [], pmcrEligible: false, note: 'The backbone events, which belong to no one screen.' },
  { key: 'observatory', label: 'Product Observatory', category: 'system', routes: ['/admin_admin_metrics'], pmcrEligible: false, note: 'Us. Excluded from every denominator — a dashboard that counted its own operators would be measuring the wrong people.' },
];

export const SURFACE_BY_KEY: ReadonlyMap<string, SurfaceDefinition> = new Map(
  SURFACE_REGISTRY.map((surface) => [surface.key, surface])
);

const ROUTE_TO_SURFACE: ReadonlyMap<string, string> = new Map(
  SURFACE_REGISTRY.flatMap((surface) => surface.routes.map((route) => [route, surface.key] as const))
);

/** The surface a route template belongs to, or `unknown` — never a guess. */
export function surfaceForRoute(routeTemplate: string): string {
  return ROUTE_TO_SURFACE.get(routeTemplate) ?? 'unknown';
}

/**
 * Reduces a real pathname to a route template.
 *
 * This is the function that keeps a ticker out of the database. `/en/symbols/TSLA`
 * becomes `/symbols/[ticker]`, and the segment that said which position somebody
 * was looking at is gone before anything is stored — on the client, before the
 * event is even queued.
 *
 * It works by matching against the declared routes rather than by guessing at
 * segment shapes, so an unrecognised path becomes `unknown` instead of being
 * passed through with its contents intact.
 */
export function routeTemplateFor(pathname: string): string {
  const withoutLocale = pathname.replace(/^\/en(?=\/|$)/, '') || '/';
  const segments = withoutLocale.split('/').filter(Boolean);

  for (const [template] of ROUTE_TO_SURFACE) {
    const parts = template.split('/').filter(Boolean);
    if (parts.length !== segments.length) continue;

    const matches = parts.every(
      (part, index) => (part.startsWith('[') && part.endsWith(']')) || part === segments[index]
    );
    if (matches) return template;
  }

  return withoutLocale === '/' ? '/' : 'unknown';
}

/* ---------------------------------------------------------- Feature state */

export type FeatureState = 'live' | 'disabled' | 'coming_soon' | 'external' | 'legacy' | 'unknown';

/**
 * What a surface is right now, given the flags as they actually are.
 *
 * Flags arrive as an argument rather than being imported, so this stays
 * checkable and so the dashboard reads the runtime values instead of the
 * defaults written in `featureFlags.ts` — the production values are set on the
 * host and cannot be known from the repository.
 */
export function featureStateFor(
  surfaceKey: string,
  flags: Readonly<Record<FlagName, boolean>>
): FeatureState {
  const surface = SURFACE_BY_KEY.get(surfaceKey);
  if (!surface) return 'unknown';
  if (surface.external) return 'external';
  if (surface.gatedBy && !flags[surface.gatedBy]) return 'disabled';
  return 'live';
}

/**
 * The surfaces a rate may be measured over: live, and eligible.
 *
 * A denominator that includes a surface nobody can reach produces the exact
 * error this dashboard was built to avoid — a feature reported as unwanted when
 * it was merely switched off.
 */
export function measurableSurfaces(
  flags: Readonly<Record<FlagName, boolean>>
): readonly SurfaceDefinition[] {
  return SURFACE_REGISTRY.filter(
    (surface) => surface.pmcrEligible && featureStateFor(surface.key, flags) === 'live'
  );
}
