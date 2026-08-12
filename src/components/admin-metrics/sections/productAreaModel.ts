import type { MetricState, MetricValue } from '@/lib/analytics/states';
import type { Tone } from '../primitives';
import { SURFACE_REGISTRY, featureStateFor } from '@/lib/analytics/surfaces';
import type { FamilyFacts } from '@/lib/admin-metrics/families/durable';
import type { ObservatoryData } from '../types';

/**
 * The product-area list, assembled on the frontend.
 *
 * Every part of it already exists on the page: the surface registry says what
 * the product areas are, the runtime flags say which are reachable, the
 * coverage report says which are instrumented and the family adapters carry the
 * durable facts. Joining them is a presentation concern, so it happens here
 * rather than behind a new endpoint.
 *
 * **Availability is resolved before behaviour**, which is the design's own
 * ordering rule and the reason the section exists. A zero on a surface behind a
 * flag that is off is not underperformance, and a card that showed the number
 * first would invite exactly that reading.
 */

export type ProductArea = {
  key: string;
  name: string;
  category: string;
  /** The canonical state the card and its badge are drawn from. */
  state: MetricState;
  /** The filter bucket, coarser than the state. */
  bucket: 'live' | 'collecting' | 'not_exposed' | 'no_source' | 'external';
  routes: readonly string[];
  note: string;
  /** Declared current events for the surface, and how many have arrived. */
  declared: number;
  observed: number;
  lastSeen: string | null;
  /**
   * Two or three headline figures, already formatted for the card.
   *
   * Toned rather than stated. The card's own badge carries the canonical
   * availability state; these three lines are just figures about it, and
   * giving each one a `MetricState` would make three more provenance claims
   * the row is not entitled to make.
   */
  stats: Array<{ label: string; value: string; tone: Tone }>;
  /** The durable family behind it, when there is one. */
  family?: FamilyFacts;
  /** Every metric the family carries, for the drawer. */
  metrics: Array<{ label: string; metric: MetricValue }>;
};

/** Which family adapter backs which surface. Written down; nothing derives it. */
const FAMILY_OF_SURFACE: Readonly<Record<string, keyof ObservatoryData['families']>> = {
  events: 'events',
  academy: 'academy',
  marketplace_academy: 'academy',
  experts: 'experts',
  wealth: 'wealth',
  subscriptions: 'commerce',
  account: 'accounts',
};

function titleCase(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
}

export function buildProductAreas(data: ObservatoryData): ProductArea[] {
  const { coverage, families, flags } = data;

  return SURFACE_REGISTRY.filter((surface) => surface.category !== 'system' || surface.key === 'portal')
    .map((surface) => {
      const rows = coverage.rows.filter(
        (row) => row.surface === surface.key && row.lifecycle === 'current'
      );
      const observedRows = rows.filter((row) => row.status === 'observed');
      const feature = featureStateFor(surface.key, flags);

      const lastSeen = rows
        .map((row) => row.lastSeen)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null;

      /*
       * Availability first. A flagged-off surface is `feature_disabled` however
       * many events it declares, and an outward-pointing one is `external`
       * however much traffic reaches it — in both cases the behavioural number
       * underneath answers a different question from the one a reader would
       * assume it answered.
       */
      const state: MetricState =
        feature === 'disabled'
          ? 'feature_disabled'
          : feature === 'external'
            ? 'external'
            : rows.length === 0
              ? 'not_measurable'
              : observedRows.length > 0
                ? 'live'
                : 'instrumented_going_forward';

      const bucket: ProductArea['bucket'] =
        state === 'feature_disabled'
          ? 'not_exposed'
          : state === 'external'
            ? 'external'
            : state === 'not_measurable'
              ? 'no_source'
              : state === 'live'
                ? 'live'
                : 'collecting';

      const familyKey = FAMILY_OF_SURFACE[surface.key];
      const family = familyKey ? (families[familyKey] as FamilyFacts) : undefined;

      const metrics = family
        ? Object.entries(family.metrics).map(([label, metric]) => ({
            label: titleCase(label.replace(/([A-Z])/g, ' $1').toLowerCase().trim()),
            metric,
          }))
        : [];

      const stats: ProductArea['stats'] = [
        {
          label: 'Events declared',
          value: rows.length === 0 ? 'none' : `${observedRows.length} / ${rows.length} seen`,
          tone: rows.length === 0 ? 'quiet' : observedRows.length > 0 ? 'positive' : 'caution',
        },
        {
          label: 'Rows in window',
          value:
            rows.length === 0
              ? '—'
              : new Intl.NumberFormat('en-US').format(rows.reduce((sum, row) => sum + row.count, 0)),
          tone: rows.length === 0 ? 'quiet' : 'neutral',
        },
        {
          label: 'Durable source',
          value: family ? family.sources.join(', ') : 'none',
          tone: family ? 'positive' : 'quiet',
        },
      ];

      const note =
        feature === 'disabled'
          ? `Behind the ${surface.gatedBy} flag, which is off. A zero here would be false.`
          : feature === 'external'
            ? 'Points outward. Continuation here is external and never folded into the internal rate.'
            : (surface.note ??
              (rows.length === 0
                ? 'No behavioural event is declared for this surface.'
                : `${surface.pmcrEligible ? 'Counts toward PMCR' : 'Excluded from the PMCR denominator'}.`));

      return {
        key: surface.key,
        name: surface.label,
        category: surface.category,
        state,
        bucket,
        routes: surface.routes,
        note,
        declared: rows.length,
        observed: observedRows.length,
        lastSeen,
        stats,
        family,
        metrics,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const AREA_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live' },
  { key: 'collecting', label: 'Collecting' },
  { key: 'not_exposed', label: 'Not exposed' },
  { key: 'no_source', label: 'No source' },
  { key: 'external', label: 'External' },
] as const;

export type AreaFilterKey = (typeof AREA_FILTERS)[number]['key'];
