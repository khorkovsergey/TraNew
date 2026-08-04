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

    /*
     * The markets cluster. `/markets/global` is the canonical entry — the menu
     * item that used to say "Entire World" points here, and `/market/brief`
     * redirects to it.
     *
     * Sections are separate routes rather than tabs on one, because each answers
     * a different question and a person arriving from a search for "US market
     * hours" should land on the answer, not on a page where it is behind a
     * click.
     */
    '/markets/global': '/markets/global',
    '/markets/[market]': '/markets/[market]',
    '/markets/[market]/news': '/markets/[market]/news',
    '/news': '/news',
    '/ideas': '/ideas',
    '/explore': '/explore',

    // Symbols & research
    '/symbols/[ticker]': '/symbols/[ticker]',
    '/research': '/research',
    '/supercharts': '/supercharts',
    '/voyager': '/voyager',
    '/marketplace/subscriptions': '/marketplace/subscriptions',
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

    /*
     * Learning & Events. The hub is the shared entry point for the two halves —
     * Academy keeps its own routes, so nothing that already links to a lesson
     * has to change.
     *
     * `/events/my` is not in the handoff's route list; the product structure
     * names "My events" as a screen without giving it one, and folding it into
     * `/events/manage` would put an attendee's registrations on the organizer's
     * dashboard, which are two different people's pages.
     */
    '/learning-events': '/learning-events',
    '/events': '/events',
    '/events/[slug]': '/events/[slug]',
    '/events/create': '/events/create',
    '/events/my': '/events/my',
    '/events/manage': '/events/manage',
    '/events/manage/[eventId]': '/events/manage/[eventId]',
    '/organizers/[slug]': '/organizers/[slug]',

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

    // Authentication
    '/sign-in': '/sign-in',
    '/sign-up': '/sign-up',
    '/forgot-password': '/forgot-password',
    '/reset-password': '/reset-password',

    // My TradingNew — the signed-in account area.
    '/account': '/account',
    '/account/workspace': '/account/workspace',
    '/account/voyager': '/account/voyager',
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
