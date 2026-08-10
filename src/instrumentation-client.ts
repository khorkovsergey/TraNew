import { setAnalyticsSink } from '@/lib/events/analytics';
import { HttpAnalyticsSink } from '@/lib/analytics/sink';
import { routeTemplateFor, surfaceForRoute } from '@/lib/analytics/surfaces';

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
} catch {
  /* A portal that cannot measure itself is still a portal. */
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
