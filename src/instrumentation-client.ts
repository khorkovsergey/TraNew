import { setAnalyticsSink } from '@/lib/events/analytics';
import { HttpAnalyticsSink } from '@/lib/analytics/sink';
import { routeTemplateFor, surfaceForRoute } from '@/lib/analytics/surfaces';
import { deviceClass } from '@/lib/analytics/identity';
import { isWebVital, rate, toStoredValue } from '@/lib/admin-metrics/webVitals';

/**
 * Client instrumentation: where the portal gets a session, a page view, and a
 * real destination for everything the product was already emitting into a
 * silent sink.
 *
 * Next runs this before the application hydrates, which is why it is the right
 * place rather than a component in the layout. That matters here beyond
 * tidiness: `src/app/[locale]/layout.tsx` belongs to no section, so a provider
 * added there would have been this section editing a file nobody owns.
 * `instrumentation-client.ts` is in the metrics section's `owns` list, and this
 * is the seam it was reserved for.
 *
 * The two jobs are separate on purpose:
 *
 * 1. **Connect the sink.** `setAnalyticsSink` has been exported and uncalled
 *    since analytics.ts was written, with a header explaining that swapping the
 *    destination should be a one-line change and no emitter should have to be
 *    found again. This is that line. No feature component changes.
 *
 * 2. **Add the backbone.** The product had no session, page-view or navigation
 *    event of any kind — every event was feature-local, so there was never a
 *    denominator to put one over. Continuation, time-to-first-action and
 *    retention are all impossible without this, and none of them can be
 *    reconstructed from feature events afterwards.
 *
 * Everything here is wrapped. A failure in the analytics bootstrap must not
 * stop an application from starting.
 */

let sink: HttpAnalyticsSink | null = null;
let lastArea = '';
let lastRoute = '';
let hops = 0;

/** Route templates only — a populated path can name a position somebody holds. */
function here(pathname = location.pathname): { route: string; area: string } {
  const route = routeTemplateFor(pathname);
  return { route, area: surfaceForRoute(route) };
}

/**
 * Records a view of a route, once.
 *
 * The guard is the point. A `replace` transition that does not change the route
 * — a query-string edit, a shallow update — is not a second view of anything,
 * and a duplicate page view inflates the only signal that decides whether a
 * session is eligible at all. Returning early is cheaper than teaching every
 * downstream query to deduplicate.
 */
function viewed(pathname: string): void {
  if (!sink) return;

  const { route, area } = here(pathname);
  if (route === lastRoute) return;

  sink.enqueue('portal_page_viewed', { route, area });

  if (lastArea && lastArea !== area) {
    hops += 1;
    sink.enqueue('portal_navigation_completed', { from: lastArea, to: area, hop: hops });
  }

  lastArea = area;
  lastRoute = route;
  armEngagement(area);
}

/**
 * The engagement checkpoint, at three seconds.
 *
 * PMCR's denominator is a landing plus three engaged seconds — the design
 * handoff's definition, adopted because it removes the bounce that no product
 * change could ever have improved. That makes this timer load-bearing rather
 * than decorative: without it there is no eligible-session set, and PMCR is not
 * derivable from page views alone.
 *
 * A hidden tab does not count. Time on a page nobody is looking at is not
 * engagement, and counting it would inflate exactly the metric this dashboard
 * exists to keep honest.
 */
function armEngagement(area: string): void {
  const startedAt = Date.now();

  const timer = setTimeout(() => {
    if (document.visibilityState !== 'visible') return;
    sink?.enqueue('portal_engagement_checkpoint', {
      seconds: Math.round((Date.now() - startedAt) / 1000),
      area,
    });
  }, 3_000);

  addEventListener('pagehide', () => clearTimeout(timer), { once: true });
}

try {
  sink = new HttpAnalyticsSink();
  setAnalyticsSink(sink);

  const { route, area } = here();
  lastArea = area;
  lastRoute = route;

  sink.enqueue('portal_session_started', {
    entry: route,
    // Both are derived inside the sink, from the viewport and the referrer's
    // host. Neither the user-agent string nor the referrer URL is read here or
    // sent anywhere.
    acquisition: 'unknown',
    device: 'unknown',
  });

  sink.enqueue('portal_page_viewed', { route, area });
  armEngagement(area);
  watchFailures();
  watchWebVitals();
} catch {
  /* A portal that cannot measure itself is still a portal. */
}

/* ------------------------------------------------------- Web Vitals (Phase 5) */

const NAVIGATION_TYPES = ['navigate', 'reload', 'back_forward', 'prerender', 'restore'];

/**
 * Records one Core Web Vital.
 *
 * What travels is the metric, its bucket, an integer value, the product area
 * and a coarse device class. Not the URL, not the element that was slow, not
 * the user agent, not the navigation timing origin.
 */
function reportWebVital(metric: { name: string; value: number; navigationType?: string }): void {
  try {
    if (!sink) return;

    const name = metric.name.toLowerCase();
    if (!isWebVital(name)) return;

    const { area } = here();
    const navigationType =
      metric.navigationType && NAVIGATION_TYPES.includes(metric.navigationType)
        ? metric.navigationType
        : 'unknown';

    sink.enqueue('web_vital_measured', {
      metric: name,
      rating: rate(name, metric.value),
      /* Scaled once, in `webVitals.ts`. CLS would otherwise round to zero. */
      value: toStoredValue(name, metric.value),
      area,
      navigationType,
      device: deviceClass(typeof innerWidth === 'number' ? innerWidth : 0),
    });
  } catch {
    /* A page that cannot measure itself is still a page. */
  }
}


/**
 * Subscribes to the browser's own vitals reporting.
 *
 * ## Why this import path, and what it costs
 *
 * Next ships `web-vitals` inside itself and exposes it publicly only as
 * `useReportWebVitals`, a **React hook**. A hook needs a component, a component
 * needs a global mount point, and the only global mount point is
 * `src/app/[locale]/layout.tsx` — which belongs to no section. Editing an
 * unowned file quietly is the thing this project's protocol exists to prevent,
 * and requesting ownership of it would have blocked reliability entirely.
 *
 * The compiled module underneath exports plain functions rather than hooks, so
 * it can be called from here: no new dependency, no bundle duplication, no
 * foreign file. The cost is that `next/dist/compiled/*` is an internal path and
 * a future Next may move it — so the import is dynamic and failure is silent.
 * If it ever disappears the portal keeps working and Web Vitals stop arriving,
 * which the coverage table reports as an unobserved event rather than as a
 * healthy zero.
 *
 * INP is included precisely because it is the one nobody should reimplement:
 * measuring interaction latency correctly is subtle, and a hand-rolled
 * approximation would be a number that looks like INP and is not.
 */
type VitalReporter = (report: (metric: { name: string; value: number; navigationType?: string }) => void) => void;

function watchWebVitals(): void {
  /*
   * Typed locally because the compiled module ships no declarations. The shape
   * is asserted rather than trusted — each subscriber is called only if it is
   * actually a function, so a moved or renamed export degrades to no vitals
   * instead of a TypeError during hydration.
   */
  void (
    // @ts-expect-error — the compiled module ships no declarations. Suppressed
    // here, locally, rather than adding a .d.ts outside this section's owned
    // paths; the shape is checked at runtime just below.
    import('next/dist/compiled/web-vitals') as Promise<Record<string, VitalReporter | undefined>>
  )
    .then((vitals) => {
      for (const subscribe of [vitals.onLCP, vitals.onINP, vitals.onCLS, vitals.onFCP, vitals.onTTFB]) {
        if (typeof subscribe === 'function') subscribe(reportWebVital);
      }
    })
    .catch(() => {
      /* Measuring the page must never be able to break it. */
    });
}

/* ------------------------------------------------- Runtime failures (Phase 5) */

/**
 * Failure *classes*, and nothing else.
 *
 * Two native listeners, no monkeypatching: `fetch` is left alone, `console` is
 * left alone, no component is wrapped and no SDK is installed. The browser
 * already tells us that something threw; everything beyond that — the message,
 * the stack, the URL — is written by whoever threw it and routinely carries an
 * id, a ticker or a fragment of somebody's input. There is no dependable way to
 * sanitise arbitrary error text, so none is collected.
 *
 * A count by class and surface is what a reliability page can act on anyway:
 * it says *where* things break, and the fix is found by reproducing it rather
 * than by reading a truncated stack in a dashboard.
 */
function watchFailures(): void {
  const report = (failureClass: 'unhandled_error' | 'unhandled_rejection' | 'resource') => {
    try {
      sink?.enqueue('client_runtime_failure', {
        class: failureClass,
        phase: document.readyState === 'complete' ? 'runtime' : 'bootstrap',
        area: here().area,
      });
    } catch {
      /* ignore */
    }
  };

  addEventListener(
    'error',
    (event) => {
      /*
       * A failed image or script fires `error` on the element rather than on
       * the window, and `event.error` is absent — that is the only reliable way
       * the browser distinguishes the two, so it is the only distinction drawn.
       */
      report(event instanceof ErrorEvent && event.error ? 'unhandled_error' : 'resource');
    },
    true
  );

  addEventListener('unhandledrejection', () => report('unhandled_rejection'));
}

/**
 * Client-side navigation.
 *
 * Next calls this as a client-side transition begins and hands over the target
 * URL. That URL is used rather than `location`, which has not been updated yet
 * — an earlier version read `location` from a zero-delay timeout and was
 * racing the router for the answer.
 *
 * **This hook fires for client-side transitions only.** A full page load does
 * not go through the router at all; it re-runs this whole module, which emits a
 * session start and a page view of its own. That asymmetry is correct and is
 * left alone: making a full reload look like an SPA transition would invent a
 * navigation that the browser, not the product, performed. The production smoke
 * that noticed `portal_navigation_completed` missing on a hard navigation was
 * observing this working as intended.
 *
 * A `<Link>` press is emphatically **not** a meaningful action. It is a route
 * change; what it meant comes from the action taxonomy, and neither
 * `portal_page_viewed` nor `portal_navigation_completed` is marked meaningful,
 * so no combination of them can manufacture continuation. A feature event fired
 * by the same click is the thing that counts, and it counts once.
 */
export function onRouterTransitionStart(url: string): void {
  try {
    viewed(new URL(url, location.origin).pathname);
  } catch {
    /* ignore */
  }
}
