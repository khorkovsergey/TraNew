'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/Icon';
import { Link, useRouter } from '@/i18n/navigation';
import { consumeSearchFocus } from '@/lib/searchFocus';
import { resolveSearch, suggest, type Suggestion } from '@/lib/symbolSearch';
import styles from './Home.module.css';

const POPULAR = [
  { ticker: 'TSLA', labelKey: 'tesla' },
  { ticker: 'SPX', labelKey: 'sp500' },
  { ticker: 'BTC', labelKey: 'bitcoin' },
  { ticker: 'GOLD', labelKey: 'gold' },
  { ticker: 'NVDA', labelKey: 'nvidia' },
] as const;

/**
 * The hero search.
 *
 * It answers while you type now. Before, the field invited "any asset, or a
 * question" and then said nothing at all until Enter — so the only way to learn
 * whether it had understood you was to commit and see where you landed. The
 * suggestions are the destinations it can genuinely reach, and the last one is
 * always "ask this as a question", so an unrecognised query is a route forward
 * rather than a shrug.
 *
 * Built as a combobox rather than a list under a text box: arrow keys move
 * through it, Enter takes the highlighted row, Escape closes it, and the active
 * row is announced. A suggestion list that only works with a mouse is one that
 * half the people using it cannot reach.
 */
export function HeroSearch() {
  const t = useTranslations('home');
  const tMenu = useTranslations('menu.symbols');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const items = open ? suggest(query) : [];

  useEffect(() => {
    if (consumeSearchFocus()) {
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, []);

  const go = (suggestion: Suggestion) => {
    setOpen(false);

    if (suggestion.kind === 'symbol') {
      router.push({ pathname: '/symbols/[ticker]', params: { ticker: suggestion.ticker } });
      return;
    }
    if (suggestion.kind === 'section') {
      router.push(suggestion.path);
      return;
    }
    router.push({ pathname: '/research', query: { q: suggestion.q } });
  };

  /** Enter with nothing highlighted keeps exactly the behaviour it always had. */
  const submit = () => {
    if (active >= 0 && items[active]) {
      go(items[active]);
      return;
    }

    if (!query.trim()) {
      inputRef.current?.focus();
      return;
    }

    const result = resolveSearch(query);
    setOpen(false);

    if (result.kind === 'symbol') {
      router.push({ pathname: '/symbols/[ticker]', params: { ticker: result.ticker } });
    } else {
      router.push({ pathname: '/research', query: { q: result.q } });
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
      return;
    }

    if (!items.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => (current + 1) % items.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => (current <= 0 ? items.length - 1 : current - 1));
    }
  };

  return (
    <>
      <div className={styles.searchWrap}>
        <form
          className={styles.search}
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Icon name="search" size={22} className={styles.searchIcon} />
          <input
            ref={inputRef}
            className={styles.searchInput}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(event.target.value.trim().length > 0);
              setActive(-1);
            }}
            onFocus={() => setOpen(query.trim().length > 0)}
            // Closing on blur immediately would fire before a click on a
            // suggestion ever lands on it.
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onKeyDown={onKeyDown}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            role="combobox"
            aria-expanded={open && items.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            autoComplete="off"
          />
          <button className={styles.searchSubmit} type="submit" aria-label={t('searchSubmit')}>
            <Icon name="arrowRight" size={20} strokeWidth={2.2} />
          </button>
        </form>

        {open && items.length > 0 && (
          <ul className={styles.suggestions} id={listId} role="listbox" aria-label="Suggestions">
            {items.map((item, index) => (
              <li key={`${item.kind}-${index}`}>
                <button
                  type="button"
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  className={`${styles.suggestion} ${index === active ? styles.suggestionOn : ''}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(item)}
                >
                  <span className={styles.suggestionLabel}>{item.label}</span>
                  <span className={styles.suggestionHint}>{item.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.popularRow}>
        <span className={styles.popularLabel}>{t('popular')}</span>
        {/*
          * Not prefetched.
          *
          * Next prefetches every visible link, so landing here fired five
          * requests for five dynamic symbol pages — each of which calls the
          * market-data vendor — before anyone had clicked anything. On a return
          * visit they stopped completing at all: 21 low-priority requests left
          * permanently in flight, holding connections the browser then could not
          * use for anything the person actually asked for.
          *
          * These pages render in about 15ms once warm, so there is nothing worth
          * prefetching here anyway.
          */}
        {POPULAR.map((item) => (
          <Link
            key={item.ticker}
            className={styles.popularChip}
            prefetch={false}
            href={{ pathname: '/symbols/[ticker]', params: { ticker: item.ticker } }}
          >
            {tMenu(item.labelKey)}
          </Link>
        ))}
      </div>
    </>
  );
}
