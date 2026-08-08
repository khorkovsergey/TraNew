import type { ScriptType } from '@/content/chartMarket';

/**
 * Chart Market's browsing state.
 *
 * Everything lives in the query string. The server reads it, filters, and
 * renders; the controls write a new query string and the server does it again.
 * That is what makes refresh, back, forward and a pasted link agree with each
 * other — the same reason Events works this way, and the same trap avoided:
 * local state mirrored into the URL by an effect is two sources of truth that
 * eventually disagree, usually on the back button.
 *
 * Deliberately free of the catalogue itself. The toolbar runs in the browser and
 * needs to build query strings; it has no business carrying nine products, their
 * descriptions and their reviews across the wire to do it. The selecting and
 * counting live in `select.ts`, which the server imports and the browser does
 * not.
 */

/**
 * Tab label to the type it selects.
 *
 * Written out rather than derived by trimming the plural off the label. That
 * shortcut works for four of these and fails for the two it does not — the tab
 * would filter on a type no product has and report zero, which reads as an
 * empty category rather than as a bug.
 */
export const TYPE_TABS = {
  All: null,
  Indicators: 'Indicator',
  Strategies: 'Strategy',
  Overlays: 'Overlay',
  Signals: 'Signal',
  Utilities: 'Utility',
} as const satisfies Record<string, ScriptType | null>;

export type TypeTab = keyof typeof TYPE_TABS;

export const TYPE_TAB_LABELS = Object.keys(TYPE_TABS) as TypeTab[];

export const SORTS = ['Popular', 'Rating', 'Newest', 'Price'] as const;
export type Sort = (typeof SORTS)[number];

export const SORT_LABEL: Record<Sort, string> = {
  Popular: 'Most popular',
  Rating: 'Highest rated',
  Newest: 'Newest',
  Price: 'Price: low to high',
};

/** The filter groups, in the order the column shows them. */
export const FILTER_GROUPS = {
  price: { title: 'Price', options: ['Free', 'Paid'] },
  rating: { title: 'Rating', options: ['4.8', '4.5'] },
  creator: { title: 'Creator', options: ['Verified', 'Community'] },
  compatibility: { title: 'Compatibility', options: ['Pine v6', 'Pine v5'] },
} as const;

export type FilterGroupKey = keyof typeof FILTER_GROUPS;

export const FILTER_GROUP_KEYS = Object.keys(FILTER_GROUPS) as FilterGroupKey[];

export function optionLabel(group: FilterGroupKey, value: string): string {
  return group === 'rating' ? `${value} and up` : value;
}

export type CatalogFilters = {
  q: string;
  type: TypeTab;
  sort: Sort;
  price: string[];
  rating: string[];
  creator: string[];
  compatibility: string[];
};

export const EMPTY_FILTERS: CatalogFilters = {
  q: '',
  type: 'All',
  sort: 'Popular',
  price: [],
  rating: [],
  creator: [],
  compatibility: [],
};

type RawParams = Record<string, string | string[] | undefined>;

function one(raw: RawParams, key: string): string | null {
  const value = raw[key];
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === 'string' && first !== '' ? first : null;
}

/**
 * Reads a group's selection, keeping only options that exist.
 *
 * A value nobody offered would otherwise sit in the URL excluding everything
 * and showing an empty catalogue with no chip explaining why.
 */
function many(raw: RawParams, group: FilterGroupKey): string[] {
  const value = raw[group];
  const parts = (Array.isArray(value) ? value : [value ?? ''])
    .flatMap((entry) => (entry ?? '').split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);

  const allowed = FILTER_GROUPS[group].options as readonly string[];
  return [...new Set(parts)].filter((entry) => allowed.includes(entry));
}

export function parseFilters(raw: RawParams): CatalogFilters {
  const type = one(raw, 'type');
  const sort = one(raw, 'sort');

  return {
    q: one(raw, 'q') ?? '',
    type: type && type in TYPE_TABS ? (type as TypeTab) : 'All',
    sort: sort && (SORTS as readonly string[]).includes(sort) ? (sort as Sort) : 'Popular',
    price: many(raw, 'price'),
    rating: many(raw, 'rating'),
    creator: many(raw, 'creator'),
    compatibility: many(raw, 'compatibility'),
  };
}

/**
 * The query for a set of filters.
 *
 * Defaults are omitted, so the plain catalogue URL stays plain and two ways of
 * arriving at the same view produce the same address.
 *
 * An object rather than a string, because `<Link>` here takes
 * `{ pathname, query }` — handing it a path with `?…` glued on defeats the
 * routing layer that turns an internal pathname into the address people see.
 */
export function filtersToQuery(
  filters: CatalogFilters,
  extra: Record<string, string | null | undefined> = {}
): Record<string, string> {
  const query: Record<string, string> = {};

  for (const [key, value] of Object.entries(extra)) {
    if (value) query[key] = value;
  }

  if (filters.q) query.q = filters.q;
  if (filters.type !== 'All') query.type = filters.type;
  if (filters.sort !== 'Popular') query.sort = filters.sort;
  for (const group of FILTER_GROUP_KEYS) {
    if (filters[group].length) query[group] = filters[group].join(',');
  }

  return query;
}

/** The same thing as a search string, for the one caller that navigates by hand. */
export function filtersToSearch(
  filters: CatalogFilters,
  extra: Record<string, string | null | undefined> = {}
): string {
  const search = new URLSearchParams(filtersToQuery(filters, extra)).toString();
  return search ? `?${search}` : '';
}

export function countActive(filters: CatalogFilters): number {
  return (
    FILTER_GROUP_KEYS.reduce((total, group) => total + filters[group].length, 0) +
    (filters.q ? 1 : 0) +
    (filters.type === 'All' ? 0 : 1)
  );
}

export function toggleOption(
  filters: CatalogFilters,
  group: FilterGroupKey,
  value: string
): CatalogFilters {
  const current = filters[group];
  return {
    ...filters,
    [group]: current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value],
  };
}

/* ------------------------------------------------------------- Active chips */

export type ActiveChip = {
  label: string;
  group: FilterGroupKey | 'type' | 'q';
  value: string;
};

export function activeChips(filters: CatalogFilters): ActiveChip[] {
  const chips: ActiveChip[] = [];

  if (filters.q) chips.push({ label: `“${filters.q}”`, group: 'q', value: filters.q });
  if (filters.type !== 'All') {
    chips.push({ label: filters.type, group: 'type', value: filters.type });
  }
  for (const group of FILTER_GROUP_KEYS) {
    for (const value of filters[group]) {
      chips.push({ label: optionLabel(group, value), group, value });
    }
  }

  return chips;
}

export function withoutChip(filters: CatalogFilters, chip: ActiveChip): CatalogFilters {
  if (chip.group === 'q') return { ...filters, q: '' };
  if (chip.group === 'type') return { ...filters, type: 'All' };
  return toggleOption(filters, chip.group, chip.value);
}
