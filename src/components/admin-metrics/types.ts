import type { MetricState } from '@/lib/analytics/states';
import type { CoverageReport } from '@/lib/admin-metrics/coverage';
import type { ProductFamilies } from '@/lib/admin-metrics/families';
import type { ReliabilityReport } from '@/lib/admin-metrics/families/reliability';
import type { VoyagerReport } from '@/lib/admin-metrics/families/voyager';
import type { Overview } from '@/lib/admin-metrics/overview';
import type { PortalMetrics } from '@/lib/admin-metrics/portal';
import type { CohortGrid } from '@/lib/admin-metrics/cohortGrid';
import type { RetentionReport } from '@/lib/admin-metrics/retention';

/**
 * Everything the page queried, in one serializable bundle.
 *
 * The whole payload crosses the server/client boundary once, and the sections
 * read the **real report objects** rather than a view model built beside them.
 * That is the point: a view model is a second place a number can be shaped, and
 * a second place is eventually a second answer. Every one of these types is
 * already plain JSON — `MetricValue` carries its own state and provenance — so
 * nothing has to be flattened to make the crossing.
 *
 * Type-only imports throughout. The modules behind most of these are
 * `server-only`, and importing a value from one into the client bundle is a
 * build error rather than a subtle leak; `import type` is erased before it can
 * become either.
 */
export type ObservatoryData = {
  range: string;
  ranges: readonly string[];
  route: string;
  environment: string;
  /**
   * Server query time as epoch milliseconds.
   *
   * The single anchor every relative age on the page is measured against, so
   * the server pass and the hydration pass compute the same string and the
   * freshness chip stays the query-time snapshot the design asks for rather
   * than a counter that ticks while somebody reads.
   */
  queriedAtMs: number;

  overview: Overview;
  portal: PortalMetrics;
  coverage: CoverageReport;
  families: ProductFamilies;
  voyager: VoyagerReport;
  reliability: ReliabilityReport;
  retention: RetentionReport;
  cohorts: CohortGrid;

  /** Runtime feature-flag truth, read on the server. Never the file defaults. */
  flags: { superchartEnabled: boolean; wealthHubEnabled: boolean; alertsEnabled: boolean };

  /**
   * How many of the metrics a reader can actually see are in each state.
   *
   * Counted on the server over the same `MetricValue`s the sections render, so
   * the credibility tally in section 14 cannot drift from the cards above it.
   */
  stateTally: Partial<Record<MetricState, number>>;
};

/** Which drawer is open, and what it is about. */
export type DrawerRequest =
  | { kind: 'metric'; metricId: string; label: string }
  | { kind: 'dictionary' }
  | { kind: 'sources' }
  | { kind: 'area'; areaKey: string }
  | { kind: 'filters' };
