import type { MetricValue } from '@/lib/analytics/states';
import type { ObservatoryData } from './types';

/**
 * Every `MetricValue` on the page, indexed by its `metricId`.
 *
 * The drill-down drawer needs to answer "what is this number, and where did it
 * come from" for whatever a reader clicked. It could take the metric as a prop
 * from each call site, but then eight sections would each have to remember to
 * pass one and the drawer would silently show nothing when one forgot.
 *
 * Walking the reports instead means the drawer is looking at **the same object
 * the card rendered** — same value, same state, same provenance — so the drawer
 * and the card cannot disagree. A metric that is genuinely not in any report
 * comes back undefined, and the drawer says the dictionary has an entry with no
 * live value rather than inventing one.
 */
export function indexMetrics(data: ObservatoryData): Map<string, MetricValue> {
  const index = new Map<string, MetricValue>();

  const add = (metric: MetricValue | undefined) => {
    if (metric && typeof metric === 'object' && 'metricId' in metric && !index.has(metric.metricId)) {
      index.set(metric.metricId, metric);
    }
  };

  const addAll = (record: Record<string, MetricValue> | undefined) => {
    if (!record) return;
    for (const metric of Object.values(record)) add(metric);
  };

  /* Overview carries the headline set, so it goes in first and wins ties. */
  for (const [, value] of Object.entries(data.overview)) {
    if (value && typeof value === 'object' && 'state' in value) add(value as MetricValue);
  }

  add(data.portal.continuation.overall);
  add(data.portal.continuation.internal);
  add(data.portal.continuation.external);
  add(data.portal.ttfa.median);
  add(data.portal.ttfa.p75);
  add(data.portal.ttfa.p90);
  add(data.portal.ttfa.withoutAction);
  add(data.portal.secondAction.rate);
  add(data.portal.sessionsSeen);
  add(data.portal.eligibleSessions);

  for (const horizon of data.retention.horizons) {
    add(horizon.returned);
    add(horizon.returnedMeaningfully);
  }
  add(data.retention.anonymous);

  addAll(data.voyager.headline);
  addAll(data.voyager.quota);
  addAll(data.voyager.capability);

  add(data.reliability.failures.total);
  add(data.reliability.failures.perThousandPageViews);
  add(data.reliability.market.requests);
  add(data.reliability.market.successes);
  add(data.reliability.market.noData);
  add(data.reliability.market.providerErrors);
  add(data.reliability.market.notConfigured);
  add(data.reliability.market.withVolume);

  for (const family of Object.values(data.families)) {
    if (family && typeof family === 'object' && 'metrics' in family) {
      addAll((family as { metrics: Record<string, MetricValue> }).metrics);
    }
  }

  return index;
}
