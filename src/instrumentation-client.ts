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
let hops = 0;

/** Route templates only — a populated path can name a position somebody holds. */
function here(): { route: string; area: string } {
  const route = routeTemplateFor(location.pathname);
  return { route, area: surfaceForRoute(route) };
}

function viewed(): void {
  if (!sink) return;

  const { route, area } = here();
  sink.enqueue('portal_page_viewed', { route, area });

  if (lastArea && lastArea !== area) {
    hops += 1;
    sink.enqueue('portal_navigation_completed', { from: lastArea, to: area, hop: hops });
  }

  lastArea = area;
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
 * Next calls this as a transition begins; the URL has not changed yet, so the
 * view is recorded on the next frame once the router has committed. A
 * `<Link>` press is emphatically *not* a meaningful action — it is a route
 * change, and what it means comes from the action taxonomy, not from the fact
 * that something was clicked.
 */
export function onRouterTransitionStart(): void {
  try {
    setTimeout(viewed, 0);
  } catch {
    /* ignore */
  }
}
