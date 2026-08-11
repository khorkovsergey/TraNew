import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { AccessBootstrap } from '@/components/admin-metrics/AccessBootstrap';
import { Observatory } from '@/components/admin-metrics/Observatory';
import styles from '@/components/admin-metrics/Observatory.module.css';
import type { ObservatoryData } from '@/components/admin-metrics/types';
import type { Locale } from '@/i18n/routing';
import { authorizeMetrics, directLinkEnabled } from '@/lib/admin-metrics/access';
import { cohortGrid } from '@/lib/admin-metrics/cohortGrid';
import { instrumentationCoverage } from '@/lib/admin-metrics/coverage';
import { MARKETPLACE_MIN_SAMPLE } from '@/lib/admin-metrics/dictionary';
import { productFamilies } from '@/lib/admin-metrics/families';
import { reliabilityReport } from '@/lib/admin-metrics/families/reliability';
import { voyagerReport } from '@/lib/admin-metrics/families/voyager';
import { overview } from '@/lib/admin-metrics/overview';
import { portalMetrics } from '@/lib/admin-metrics/portal';
import { RANGES, rangeFrom } from '@/lib/admin-metrics/range';
import { cohortRetention, dayKey } from '@/lib/admin-metrics/retention';
import { readUserDays } from '@/lib/admin-metrics/telemetryQuery';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import type { MetricState, MetricValue } from '@/lib/analytics/states';

/**
 * The Product Observatory.
 *
 * Private by access control rather than by address: `access.ts` runs before any
 * query does. No navigation entry, no sitemap entry, and deliberately **no
 * `robots.txt` disallow** — a disallow line is a public list of the paths worth
 * trying, so the route carries `noindex` instead.
 *
 * ## What this file is now
 *
 * Queries, and nothing else. The whole presentation moved into
 * `components/admin-metrics/`, where the design handoff's fourteen sections are
 * fourteen components over one client shell. This file authorises, runs the
 * reads concurrently, tallies the states once, and hands a single serializable
 * bundle across the boundary.
 *
 * That split is what makes the interactive parts of the design safe to have.
 * The drawers, the presentation toggle and the filter chips are client state
 * over a payload that is already computed — **none of them can reach a query**,
 * so none of them can produce a number the server did not stand behind. The
 * range control is the one thing that genuinely needs a different query, and it
 * is a link that re-runs this function rather than state that reshapes the data
 * in the browser.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Product Observatory',
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ range?: string }>;
};

/**
 * Counts each canonical state across the metrics a reader can actually see.
 *
 * Computed here rather than in the component that draws it, so the tally in
 * section 14 is over the same `MetricValue` objects the cards above rendered.
 * It is how a product manager tells "this number is bad" from "there is no
 * number", which is the argument the whole page makes.
 */
function tallyStates(metrics: readonly MetricValue[]): Partial<Record<MetricState, number>> {
  const counts: Partial<Record<MetricState, number>> = {};
  for (const metric of metrics) counts[metric.state] = (counts[metric.state] ?? 0) + 1;
  return counts;
}

export default async function ObservatoryPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const auth = await authorizeMetrics();

  /*
   * The unauthorized shell says as little as it can: it does not confirm a
   * dashboard exists, does not say which access path failed, and renders no
   * data — the queries below have not run and will not.
   */
  if (!auth.authorized) {
    return (
      <div className={styles.root}>
        <div className={styles.backdrop} aria-hidden="true" />
        {/* The route's one main landmark. `PortalChrome` renders none here. */}
        <main id="main" className={styles.gate}>
          <p>Not available.</p>
          <AccessBootstrap enabled={directLinkEnabled()} />
        </main>
      </div>
    );
  }

  const { range } = await searchParams;
  const window = rangeFrom(range ?? null) ?? rangeFrom(null)!;
  const now = new Date();

  const [numbers, portal, coverage, userDays, families, voyager, reliability] = await Promise.all([
    overview(window.since),
    portalMetrics(window.since),
    instrumentationCoverage(window.since),
    readUserDays(window.since),
    productFamilies(window.since),
    voyagerReport(window.since),
    reliabilityReport(window.since),
  ]);

  const telemetryStartedOn = portal.collectingSince
    ? dayKey(new Date(portal.collectingSince))
    : null;

  const retention = cohortRetention(userDays, {
    today: now,
    telemetryStartedOn,
    minimumCohort: MARKETPLACE_MIN_SAMPLE,
    provenance: (metricId) => ({
      metricId,
      source: 'product_telemetry_event',
      sourceType: 'derived' as const,
      queriedAt: now.toISOString(),
    }),
    state: 'instrumented_going_forward',
  });

  /*
   * The heatmap is the same rule as the D-numbers, sliced by cohort rather than
   * summed over all of them, and it is built from `userDays` — which the page
   * has already read for `cohortRetention`. No second query, and the user key
   * never leaves the server: `cohortGrid` returns counts per cohort day.
   */
  const cohorts = cohortGrid(userDays, {
    today: now,
    telemetryStartedOn,
    minimumCohort: MARKETPLACE_MIN_SAMPLE,
  });

  const stateTally = tallyStates([
    numbers.eligibleSessions,
    numbers.meaningfulContinuation,
    numbers.internalContinuation,
    numbers.externalContinuation,
    numbers.secondActionRate,
    numbers.ttfaMedian,
    numbers.sessionsWithoutAction,
    numbers.registeredUsers,
    numbers.newRegistrations,
    numbers.telemetryEvents,
    numbers.sessions,
    numbers.confirmedRevenue,
    numbers.alertAdoption,
    numbers.anonymousReturn,
    ...retention.horizons.flatMap((horizon) => [horizon.returned, horizon.returnedMeaningfully]),
    ...Object.values(voyager.headline),
    ...Object.values(voyager.quota),
    ...Object.values(voyager.capability),
    reliability.failures.total,
    reliability.failures.perThousandPageViews,
    reliability.market.requests,
    reliability.market.successes,
    reliability.market.noData,
    reliability.market.providerErrors,
    reliability.market.notConfigured,
    ...Object.values(families.commerce.metrics),
    ...Object.values(families.wealth.metrics),
    ...Object.values(families.events.metrics),
    ...Object.values(families.academy.metrics),
    ...Object.values(families.experts.metrics),
    ...Object.values(families.saves.metrics),
    ...Object.values(families.accounts.metrics),
  ]);

  const data: ObservatoryData = {
    range: window.key,
    ranges: Object.keys(RANGES),
    route: `/${locale}/admin_admin_metrics`,
    /*
     * The deployment environment, not a build identifier. The application
     * exposes no build hash, and inventing one to fill the design's chip would
     * put a fabricated detail next to a real one.
     */
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    queriedAtMs: Date.parse(numbers.queriedAt),

    overview: numbers,
    portal,
    coverage,
    families,
    voyager,
    reliability,
    retention,
    cohorts,

    flags: {
      superchartEnabled: FEATURE_FLAGS.superchartEnabled,
      wealthHubEnabled: FEATURE_FLAGS.wealthHubEnabled,
      alertsEnabled: FEATURE_FLAGS.alertsEnabled,
    },

    stateTally,
  };

  return <Observatory data={data} />;
}
