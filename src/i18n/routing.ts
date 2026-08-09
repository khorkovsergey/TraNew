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
    /*
     * Compare assets — 2–4 real instruments side by side. Declared before the
     * dynamic segment for the same reason the directory sorts that way: a
     * static child wins over `[market]`, so this is the compare screen and
     * never a market whose slug happens to be "compare".
     */
    '/markets/compare': '/markets/compare',
    '/markets/[market]': '/markets/[market]',
    '/markets/[market]/news': '/markets/[market]/news',
    '/news': '/news',
    '/ideas': '/ideas',
    '/explore': '/explore',
    /*
     * The asset-class pages, and the catalogue that lists them. They replace
     * `/tool/{stocks|etfs|…}`, which was the generic placeholder screen — those
     * six slugs now redirect here (see middleware.ts).
     */
    '/explore/options': '/explore/options',
    '/explore/[class]': '/explore/[class]',

    // Symbols & research
    '/symbols/[ticker]': '/symbols/[ticker]',
    '/research': '/research',
    '/supercharts': '/supercharts',
    '/voyager': '/voyager',
    /*
     * The structured session, beside the dialogue rather than merged into it.
     *
     * Voyager is a conversation; this is a saved workspace that goes question →
     * evidence → conclusion, with a canvas, an inspector and a change history.
     * They were one page and the page could only be one of them at a time.
     */
    '/voyager/research': '/voyager/research',
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
    /*
     * Academy — the paid course catalogue. It sits under Marketplace rather
     * than under `/academy`, which is Learn and stays free: two things called
     * Academy on one route would leave nobody able to say which one a link
     * meant.
     */
    '/marketplace/academy': '/marketplace/academy',
    '/marketplace/academy/my-learning': '/marketplace/academy/my-learning',
    '/marketplace/academy/[slug]': '/marketplace/academy/[slug]',
    '/marketplace/consultations/[id]': '/marketplace/consultations/[id]',
    '/marketplace/consultations/[id]/summary': '/marketplace/consultations/[id]/summary',

    /*
     * Tools & Data. The hub is a gateway to two products that exist and two
     * that do not yet, and it says which is which on itself.
     *
     * Chart Market is one route rather than four. The catalogue, a product, the
     * checkout and the confirmation are states of one screen held in the query
     * string, so the back button walks the purchase backwards and a link to a
     * script is a link to that script — which is what a person copies out of the
     * address bar.
     *
     * `/professional-tools` was the placeholder that used to live at `/tools`.
     * It redirects here (see middleware.ts); the old address should stop
     * existing rather than keep working invisibly.
     */
    '/marketplace/tools': '/marketplace/tools',
    '/marketplace/tools/chart-market': '/marketplace/tools/chart-market',
    '/marketplace/tools/supercharts': '/marketplace/tools/supercharts',

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
    /*
     * The plan a diagnostic produced. Its own route rather than a state inside
     * the wizard: the result is a thing to come back to, share a link to and
     * land on after signing up, and none of that works if it only exists as the
     * last screen of a form.
     */
    '/start/plan': '/start/plan',
    /* The guest's temporary workspace. Signed-in visitors are sent to theirs. */
    '/workspace': '/workspace',

    // Info pages
    '/why': '/why-tradingnew',
    '/trust': '/trust-center',
    '/how-we-explain': '/how-we-explain-markets',
    '/guidance': '/personal-guidance',
  },
});

export type AppPathname = keyof typeof routing.pathnames;

/**
 * Routes with no dynamic segment. These are the only ones `<Link href="...">` accepts
 * as a bare string — dynamic routes must be passed as `{ pathname, params }`.
 */
export type StaticPathname = Exclude<AppPathname, `${string}[${string}]${string}`>;
