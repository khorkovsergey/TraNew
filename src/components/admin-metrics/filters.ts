/**
 * The global filter strip, and the reason none of it filters.
 *
 * The design carries seven segmentation chips across the top of the page. This
 * implementation renders all seven and makes **none of them change a number**,
 * which needs saying plainly rather than being discovered.
 *
 * The query layer computes one aggregate per window. There is no predicate to
 * push a device, a plan or an acquisition source into, so a working filter here
 * would have to be applied in the browser to figures that were already summed —
 * and a PMCR "for mobile" produced by scaling a portal-wide rate is not a
 * measurement of anything. That is the exact failure the provenance system
 * exists to prevent, so the controls stay visible, stay `All`, and say why.
 *
 * What *does* exist is a set of **precomputed breakdowns** — by landing
 * surface, acquisition bucket, auth state, entitlement and device — over the
 * eligible session population. Those are real, they are in sections 04 and 11,
 * and each disabled group points at the one that answers its question.
 *
 * Making a chip functional later is a query-layer change, not a UI one: it
 * needs the segmentation predicate to reach the session read. Flipping
 * `supported` here without that is how the page would start lying.
 */

export type FilterGroup = {
  key: string;
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  /** Whether selecting a non-`All` option would produce a real measurement. */
  supported: boolean;
  /** Shown under the group when it is not supported. Always names the alternative. */
  why: string;
};

const ALL = { value: 'All', label: 'All' };

export const FILTER_GROUPS: readonly FilterGroup[] = [
  {
    key: 'Audience',
    label: 'AUDIENCE',
    options: [ALL, { value: 'Anonymous', label: 'Anonymous' }, { value: 'Authenticated', label: 'Signed in' }],
    supported: false,
    why: 'Continuation by auth state is precomputed over eligible sessions and is in section 11. Re-scoping the page aggregates to one of them would need the predicate to reach the session read.',
  },
  {
    key: 'Visitor',
    label: 'VISITOR',
    options: [ALL, { value: 'New', label: 'New' }, { value: 'Returning', label: 'Returning' }],
    supported: false,
    why: 'New against returning needs a cross-session identity. It exists for authenticated users only, and the retention section is where that population is measured.',
  },
  {
    key: 'Source',
    label: 'SOURCE',
    options: [ALL, { value: 'Direct', label: 'Direct' }, { value: 'Referral', label: 'Referral' }],
    supported: false,
    why: 'The acquisition bucket is coarse and carries no campaign or partner. Continuation within each bucket is precomputed and is in section 11.',
  },
  {
    key: 'Device',
    label: 'DEVICE',
    options: [ALL, { value: 'Desktop', label: 'Desktop' }, { value: 'Mobile', label: 'Mobile' }],
    supported: false,
    why: 'Continuation by device is precomputed over eligible sessions and is in section 11.',
  },
  {
    key: 'Landing',
    label: 'LANDING',
    options: [ALL],
    supported: false,
    why: 'Continuation by landing surface is the first table in section 04, with a row per surface and the rate withheld below the cohort threshold.',
  },
  {
    key: 'Entitlement',
    label: 'ENTITLEMENT',
    options: [ALL],
    supported: false,
    why: 'Plan names are read from the entitlement model at runtime rather than written down. Continuation by entitlement is precomputed; the plan distribution itself is in section 10.',
  },
  {
    key: 'Geography',
    label: 'GEOGRAPHY',
    options: [ALL],
    supported: false,
    why: 'No geography is recorded. Country would need to be derived from an IP address, which is not collected — and at this volume a country column narrows a person down.',
  },
];

export type FilterState = Record<string, string>;

export const DEFAULT_FILTERS: FilterState = Object.fromEntries(
  FILTER_GROUPS.map((group) => [group.key, 'All'])
);

/** How many groups are away from `All`. Always zero while nothing is supported. */
export function activeFilterCount(filters: FilterState): number {
  return FILTER_GROUPS.filter((group) => (filters[group.key] ?? 'All') !== 'All').length;
}
