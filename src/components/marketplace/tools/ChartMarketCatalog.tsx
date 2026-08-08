import type { ChartMarketProduct } from '@/content/chartMarket';
import { Icon } from '@/components/ui/Icon';
import { Link } from '@/i18n/navigation';
import {
  activeChips,
  countActive,
  EMPTY_FILTERS,
  FILTER_GROUPS,
  FILTER_GROUP_KEYS,
  filtersToQuery,
  optionLabel,
  toggleOption,
  TYPE_TAB_LABELS,
  withoutChip,
  type CatalogFilters,
} from '@/lib/chartMarket/filters';
import { optionCount, typeTabCount } from '@/lib/chartMarket/select';
import { CatalogToolbar } from './CatalogToolbar';
import { ScriptCard } from './ScriptCard';
import styles from './Tools.module.css';

/**
 * The catalogue.
 *
 * Every control except the search field and the sort menu is an anchor: a tab,
 * a filter option and a chip each have exactly one destination, and rendering
 * them as links means they work with no JavaScript, open in a new tab, and can
 * be copied. The state they carry is the query string, so back and forward walk
 * through filter changes the way people expect them to.
 */

const PATH = '/marketplace/tools/chart-market' as const;

function href(filters: CatalogFilters, extra: Record<string, string | null> = {}) {
  return { pathname: PATH, query: filtersToQuery(filters, extra) };
}

export function ChartMarketCatalog({
  filters,
  products,
  ownedIds,
}: {
  filters: CatalogFilters;
  products: ChartMarketProduct[];
  ownedIds: Set<string>;
}) {
  const chips = activeChips(filters);
  const active = countActive(filters);

  return (
    <>
      <div className={styles.headRow}>
        <div>
          <span className={styles.eyebrow}>
            <Icon name="flask" size={13} strokeWidth={2.2} />
            Pine Script marketplace
          </span>
          <h1 className={styles.h1} style={{ marginTop: 12 }}>
            Chart Market
          </h1>
          <p className={styles.lead}>
            Indicators, strategies and chart tools built by developers and traders. Browsing never
            needs an account — only buying does.
          </p>
        </div>
      </div>

      {/*
        * Said once, at the top, where somebody decides whether to trust the list.
        * These are sample listings; the alternative is nine convincing products
        * whose creators do not exist.
        */}
      <p className={styles.emptyText} style={{ margin: '14px 0 0', textAlign: 'left' }}>
        <b>Demonstration catalogue.</b> Nobody has published to Chart Market yet, so these listings,
        creators and reviews are sample content. The purchase flow, the access rules and the
        entitlement behind them are real.
      </p>

      <CatalogToolbar filters={filters} basePath={`/en${PATH}`} />

      <div className={styles.tabs}>
        {TYPE_TAB_LABELS.map((tab) => (
          <Link
            key={tab}
            className={`${styles.tab} ${tab === filters.type ? styles.tabOn : ''}`}
            href={href({ ...filters, type: tab })}
            aria-current={tab === filters.type ? 'true' : undefined}
          >
            {tab === filters.type && <Icon name="check" size={12} strokeWidth={3} />}
            {tab}
            <span className={styles.tabCount}>{typeTabCount(tab)}</span>
          </Link>
        ))}
      </div>

      {chips.length > 0 && (
        <div className={styles.chipRow}>
          {chips.map((chip) => (
            <Link
              key={`${chip.group}-${chip.value}`}
              className={styles.activeChip}
              href={href(withoutChip(filters, chip))}
            >
              {chip.label}
              <Icon name="close" size={11} strokeWidth={2.6} />
            </Link>
          ))}
          <Link className={styles.linkButton} href={href(EMPTY_FILTERS)}>
            Clear all
          </Link>
        </div>
      )}

      <div className={styles.catalogue}>
        <aside className={styles.filters}>
          <div className={styles.filterHead}>
            <span className={styles.filterHeadTitle}>Filters</span>
            {active > 0 && (
              <Link className={styles.linkButton} href={href(EMPTY_FILTERS)}>
                Clear
              </Link>
            )}
          </div>

          {FILTER_GROUP_KEYS.map((group) => (
            <div className={styles.filterGroup} key={group}>
              <div className={styles.filterGroupTitle}>{FILTER_GROUPS[group].title}</div>
              <div className={styles.filterOptions}>
                {FILTER_GROUPS[group].options.map((option) => {
                  const on = filters[group].includes(option);
                  return (
                    <Link
                      key={option}
                      className={`${styles.filterOption} ${on ? styles.filterOptionOn : ''}`}
                      href={href(toggleOption(filters, group, option))}
                      aria-pressed={on}
                    >
                      {/* The tick, not only the tint — selection has to survive
                          being read without colour. */}
                      <span className={`${styles.checkbox} ${on ? styles.checkboxOn : ''}`}>
                        {on && <Icon name="check" size={9} strokeWidth={4} />}
                      </span>
                      <span className={styles.filterOptionLabel}>{optionLabel(group, option)}</span>
                      <span className={styles.filterCount}>{optionCount(group, option)}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </aside>

        <div className={styles.main}>
          <div className={styles.resultCount}>
            {products.length} {products.length === 1 ? 'script' : 'scripts'}
          </div>

          {products.length > 0 ? (
            <div className={styles.grid}>
              {products.map((product) => (
                <ScriptCard
                  key={product.id}
                  product={product}
                  filters={filters}
                  owned={ownedIds.has(product.id)}
                />
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <div className={styles.emptyTitle}>No scripts match those filters</div>
              <p className={styles.emptyText}>
                Try a broader category, or clear the filters to see everything in Chart Market.
              </p>
              <div className={styles.emptyActions}>
                <Link className={styles.ghostButton} href={href(EMPTY_FILTERS)}>
                  Clear filters
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
