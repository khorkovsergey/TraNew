import {
  CHART_MARKET_PRODUCTS,
  priceBand,
  type ChartMarketProduct,
} from '@/content/chartMarket';
import {
  TYPE_TABS,
  type CatalogFilters,
  type FilterGroupKey,
  type Sort,
  type TypeTab,
} from './filters';

/**
 * Turning the browsing state into a list of products.
 *
 * Separate from `filters.ts` because this file imports the catalogue and that
 * one does not: the toolbar is a client component, and a client component that
 * touched these functions would pull nine products' descriptions and reviews
 * into the bundle to render a search box.
 *
 * The predicate lives here once. Counting the tabs with one rule and filtering
 * the grid with another is how a tab comes to promise four results and show
 * three.
 */

function creatorBand(product: ChartMarketProduct): string {
  return product.creatorVerified ? 'Verified' : 'Community';
}

function compatibilityBand(product: ChartMarketProduct): string {
  return `Pine v${product.pine}`;
}

function matchesSearch(product: ChartMarketProduct, needle: string): boolean {
  if (!needle) return true;
  const haystack = [product.title, product.creator, product.short, product.type]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

/** Every group narrows; options within a group widen. */
export function matches(product: ChartMarketProduct, filters: CatalogFilters): boolean {
  const wanted = TYPE_TABS[filters.type];
  if (wanted && product.type !== wanted) return false;
  if (!matchesSearch(product, filters.q.trim().toLowerCase())) return false;

  if (filters.price.length && !filters.price.includes(priceBand(product))) return false;
  if (filters.rating.length && !filters.rating.some((floor) => product.rating >= Number(floor))) {
    return false;
  }
  if (filters.creator.length && !filters.creator.includes(creatorBand(product))) return false;
  if (filters.compatibility.length && !filters.compatibility.includes(compatibilityBand(product))) {
    return false;
  }

  return true;
}

export function sortProducts(
  products: ChartMarketProduct[],
  sort: Sort
): ChartMarketProduct[] {
  const list = [...products];

  switch (sort) {
    case 'Rating':
      return list.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
    case 'Newest':
      return list.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    case 'Price':
      return list.sort((a, b) => a.amountCents - b.amountCents || b.installs - a.installs);
    case 'Popular':
    default:
      return list.sort((a, b) => b.installs - a.installs);
  }
}

export function selectProducts(filters: CatalogFilters): ChartMarketProduct[] {
  return sortProducts(
    CHART_MARKET_PRODUCTS.filter((product) => matches(product, filters)),
    filters.sort
  );
}

/* ---------------------------------------------------------------- The counts */

/**
 * How many products a tab holds.
 *
 * Counted against the whole catalogue rather than against the current result
 * set. A tab that reported "0" because of a filter set on another tab would be
 * telling somebody the category is empty when it is not.
 */
export function typeTabCount(tab: TypeTab): number {
  const wanted = TYPE_TABS[tab];
  return wanted
    ? CHART_MARKET_PRODUCTS.filter((product) => product.type === wanted).length
    : CHART_MARKET_PRODUCTS.length;
}

export function optionCount(group: FilterGroupKey, value: string): number {
  return CHART_MARKET_PRODUCTS.filter((product) => {
    switch (group) {
      case 'price':
        return priceBand(product) === value;
      case 'rating':
        return product.rating >= Number(value);
      case 'creator':
        return creatorBand(product) === value;
      case 'compatibility':
        return compatibilityBand(product) === value;
    }
  }).length;
}

