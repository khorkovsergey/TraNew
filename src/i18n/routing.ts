import { defineRouting } from 'next-intl/routing';

export const locales = ['en', 'ru'] as const;
export type Locale = (typeof locales)[number];

/**
 * Single source of truth for client paths.
 *
 * Every route is locale-prefixed and carries a translated slug; Russian slugs are
 * transliterated to latin so links stay copy-pasteable and readable in analytics.
 * Brand names (supercharts, marketplace) stay identical across locales on purpose.
 */
export const routing = defineRouting({
  locales,
  defaultLocale: 'en',
  localePrefix: 'always',
  localeDetection: true,
  pathnames: {
    '/': '/',

    // Market
    '/market': { en: '/market', ru: '/rynok' },
    '/market/brief': { en: '/market/brief', ru: '/rynok/obzor-dnya' },
    '/news': { en: '/news', ru: '/novosti' },
    '/ideas': { en: '/ideas', ru: '/idei' },
    '/explore': { en: '/explore', ru: '/vozmozhnosti' },

    // Symbols & research
    '/symbols/[ticker]': { en: '/symbols/[ticker]', ru: '/simvoly/[ticker]' },
    '/research': { en: '/research', ru: '/issledovanie' },
    '/supercharts': { en: '/supercharts', ru: '/supercharts' },
    '/portfolio': { en: '/portfolio', ru: '/portfel' },

    // Economy & community
    '/economy': { en: '/economy', ru: '/ekonomika' },
    '/community': { en: '/community', ru: '/soobshchestvo' },
    '/brokers': { en: '/brokers', ru: '/brokery' },

    // Academy
    '/academy': { en: '/academy', ru: '/akademiya' },
    '/academy/setup': { en: '/academy/setup', ru: '/akademiya/nastroyka' },
    '/academy/path': { en: '/academy/path', ru: '/akademiya/plan' },
    '/academy/dashboard': { en: '/academy/dashboard', ru: '/akademiya/kabinet' },
    '/academy/lesson/[slug]': { en: '/academy/lesson/[slug]', ru: '/akademiya/urok/[slug]' },
    '/academy/practice/[ticker]': {
      en: '/academy/practice/[ticker]',
      ru: '/akademiya/praktika/[ticker]',
    },
    '/academy/done': { en: '/academy/done', ru: '/akademiya/itog' },

    // Strategy
    '/strategy': { en: '/strategy', ru: '/strategiya' },

    // Marketplace
    '/marketplace': { en: '/marketplace', ru: '/marketplace' },
    '/marketplace/experts': { en: '/marketplace/experts', ru: '/marketplace/eksperty' },
    '/marketplace/experts/intake': {
      en: '/marketplace/experts/intake',
      ru: '/marketplace/eksperty/anketa',
    },
    '/marketplace/experts/matches': {
      en: '/marketplace/experts/matches',
      ru: '/marketplace/eksperty/podbor',
    },
    '/marketplace/experts/compare': {
      en: '/marketplace/experts/compare',
      ru: '/marketplace/eksperty/sravnenie',
    },
    '/marketplace/experts/[id]': {
      en: '/marketplace/experts/[id]',
      ru: '/marketplace/eksperty/[id]',
    },
    '/marketplace/experts/[id]/sharing': {
      en: '/marketplace/experts/[id]/sharing',
      ru: '/marketplace/eksperty/[id]/dostup-k-dannym',
    },
    '/marketplace/experts/[id]/booking': {
      en: '/marketplace/experts/[id]/booking',
      ru: '/marketplace/eksperty/[id]/bronirovanie',
    },
    '/marketplace/consultations/[id]': {
      en: '/marketplace/consultations/[id]',
      ru: '/marketplace/konsultatsii/[id]',
    },
    '/marketplace/consultations/[id]/summary': {
      en: '/marketplace/consultations/[id]/summary',
      ru: '/marketplace/konsultatsii/[id]/itog',
    },

    // Generic catalogue tool page — screeners, calendars, asset classes, compare.
    '/tool/[slug]': { en: '/tool/[slug]', ru: '/instrument/[slug]' },

    // Value-first entry point for anonymous visitors (never a pricing page).
    '/start': { en: '/start', ru: '/nachat' },

    // Info pages
    '/why': { en: '/why-tradingnew', ru: '/pochemu-tradingnew' },
    '/trust': { en: '/trust-center', ru: '/tsentr-doveriya' },
    '/how-we-explain': { en: '/how-we-explain-markets', ru: '/kak-my-obyasnyaem-rynok' },
    '/guidance': { en: '/personal-guidance', ru: '/personalnye-rekomendatsii' },
    '/tools': { en: '/professional-tools', ru: '/professionalnye-instrumenty' },
  },
});

export type AppPathname = keyof typeof routing.pathnames;

/**
 * Routes with no dynamic segment. These are the only ones `<Link href="...">` accepts
 * as a bare string — dynamic routes must be passed as `{ pathname, params }`.
 */
export type StaticPathname = Exclude<AppPathname, `${string}[${string}]${string}`>;
