'use client';

import { useTransition } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from '@/i18n/navigation';
import {
  filtersToSearch,
  SORTS,
  SORT_LABEL,
  type CatalogFilters,
  type Sort,
} from '@/lib/chartMarket/filters';
import styles from './Tools.module.css';

/**
 * The two controls that cannot be links.
 *
 * Everything else on the catalogue — the type tabs, the filter options, the
 * active chips — is an anchor the server rendered, because each of them has one
 * destination and an anchor is the right element for that. A text field and a
 * sort menu do not: what they navigate to depends on what somebody typed or
 * chose, so these two are the only part of the screen that needs the browser.
 *
 * The field is submitted rather than debounced. A search that fires per
 * keystroke replaces the history entry on every letter, and the back button then
 * walks backwards through the spelling of a word.
 */

export type CatalogToolbarProps = {
  filters: CatalogFilters;
  /** Already locale-prefixed by the caller's `usePathname` equivalent on the server. */
  basePath: string;
};

export function CatalogToolbar({ filters, basePath }: CatalogToolbarProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const go = (next: CatalogFilters) => {
    startTransition(() => {
      router.replace(`${basePath}${filtersToSearch(next)}` as never, { scroll: false });
    });
  };

  return (
    <div className={styles.toolbar}>
      <form
        className={styles.searchBox}
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get('q');
          go({ ...filters, q: typeof value === 'string' ? value : '' });
        }}
      >
        <Icon name="search" size={17} strokeWidth={1.9} />
        {/*
          * Uncontrolled, and keyed on the query in the URL.
          *
          * The field has no state of its own to keep in step with anything: it
          * starts from the URL, and when the URL's query changes — a chip
          * removed, "Clear all" pressed — the key changes and the browser gives
          * a fresh field with the new value. The alternative, mirroring the prop
          * into state and correcting it in an effect, is the two-sources-of-truth
          * bug this whole screen is arranged to avoid, in miniature.
          */}
        <input
          key={filters.q}
          className={styles.searchInput}
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Search indicators, strategies, creators…"
          aria-label="Search Chart Market"
        />
        {/* Submitting with Enter is the normal path; the button is what makes
            that possible for anyone who cannot press Enter in a field. */}
        <button className={styles.ghostButton} type="submit" disabled={pending}>
          Search
        </button>
      </form>

      <label className={styles.select}>
        <span className="tn-sr-only">Sort by</span>
        <select
          value={filters.sort}
          onChange={(event) => go({ ...filters, sort: event.target.value as Sort })}
          style={{
            border: 0,
            background: 'transparent',
            color: 'inherit',
            font: 'inherit',
            cursor: 'pointer',
          }}
        >
          {SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {SORT_LABEL[sort]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
