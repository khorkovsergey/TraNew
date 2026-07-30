import { defineRouting } from 'next-intl/routing';

export const locales = ['en'] as const;
export type Locale = (typeof locales)[number];

/**
 * Single source of truth for client paths.
 *
 * The portal is English-only. The i18n layer is kept because it already carries
 * routing, metadata and message loading — adding a locale back means putting it in
 * `locales` and giving these entries a per-locale object again.
 */
export const routing = defineRouting({
  locales,
  defaultLocale: 'en',
  localePrefix: 'always',
  pathnames: {
    '/': '/',

    // Market
    '/market': '/market',
    '/market/brief': '/market/brief',
    '/news': '/news',
    '/ideas': '/ideas',
    '/explore': '/explore',

    // Symbols & research
    '/symbols/[ticker]': '/symbols/[ticker]',
    '/research': '/research',
    '/supercharts': '/supercharts',
    '/portfolio': '/portfolio',

    // Economy & community
    '/economy': '/economy',
    '/economy/countries/[id]': '/economy/countries/[id]',
    '/economy/indicators/[slug]': '/economy/indicators/[slug]',
    '/community': '/community',
    '/brokers': '/brokers',

    // Academy
    '/academy': '/academy',
    '/academy/setup': '/academy/setup',
    '/academy/path': '/academy/path',
    '/academy/dashboard': '/academy/dashboard',
    '/academy/lesson/[slug]': '/academy/lesson/[slug]',
    '/academy/practice/[ticker]': '/academy/practice/[ticker]',
    '/academy/done': '/academy/done',

    // Strategy
    '/strategy': '/strategy',

    // Marketplace
    '/marketplace': '/marketplace',
    '/marketplace/experts': '/marketplace/experts',
    '/marketplace/experts/intake': '/marketplace/experts/intake',
    '/marketplace/experts/matches': '/marketplace/experts/matches',
    '/marketplace/experts/compare': '/marketplace/experts/compare',
    '/marketplace/experts/[id]': '/marketplace/experts/[id]',
    '/marketplace/experts/[id]/sharing': '/marketplace/experts/[id]/sharing',
    '/marketplace/experts/[id]/booking': '/marketplace/experts/[id]/booking',
    '/marketplace/consultations/[id]': '/marketplace/consultations/[id]',
    '/marketplace/consultations/[id]/summary': '/marketplace/consultations/[id]/summary',

    // My TradingNew — the signed-in account area.
    '/account': '/account',
    '/account/workspace': '/account/workspace',
    '/account/copilot': '/account/copilot',
    '/account/activity': '/account/activity',
    '/account/academy': '/account/academy',
    '/account/purchases': '/account/purchases',
    '/account/settings': '/account/settings',
    '/account/wealth': '/account/wealth',
    '/account/wealth/assets/[id]': '/account/wealth/assets/[id]',

    // Generic catalogue tool page — screeners, calendars, asset classes, compare.
    '/tool/[slug]': '/tool/[slug]',

    // Value-first entry point for anonymous visitors (never a pricing page).
    '/start': '/start',

    // Info pages
    '/why': '/why-tradingnew',
    '/trust': '/trust-center',
    '/how-we-explain': '/how-we-explain-markets',
    '/guidance': '/personal-guidance',
    '/tools': '/professional-tools',
  },
});

export type AppPathname = keyof typeof routing.pathnames;

/**
 * Routes with no dynamic segment. These are the only ones `<Link href="...">` accepts
 * as a bare string — dynamic routes must be passed as `{ pathname, params }`.
 */
export type StaticPathname = Exclude<AppPathname, `${string}[${string}]${string}`>;
