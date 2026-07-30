'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/Icon';
import { Link, useRouter } from '@/i18n/navigation';
import { consumeSearchFocus } from '@/lib/searchFocus';
import { resolveSearch } from '@/lib/symbolSearch';
import styles from './Home.module.css';

const POPULAR = [
  { ticker: 'TSLA', labelKey: 'tesla' },
  { ticker: 'SPX', labelKey: 'sp500' },
  { ticker: 'BTC', labelKey: 'bitcoin' },
  { ticker: 'GOLD', labelKey: 'gold' },
  { ticker: 'NVDA', labelKey: 'nvidia' },
] as const;

export function HeroSearch() {
  const t = useTranslations('home');
  const tMenu = useTranslations('menu.symbols');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (consumeSearchFocus()) {
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, []);

  const submit = () => {
    if (!query.trim()) {
      inputRef.current?.focus();
      return;
    }

    const result = resolveSearch(query);
    if (result.kind === 'symbol') {
      router.push({ pathname: '/symbols/[ticker]', params: { ticker: result.ticker } });
    } else {
      router.push({ pathname: '/research', query: { q: result.q } });
    }
  };

  return (
    <>
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
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
        />
        <button className={styles.searchSubmit} type="submit" aria-label={t('searchSubmit')}>
          <Icon name="arrowRight" size={20} strokeWidth={2.2} />
        </button>
      </form>

      <div className={styles.popularRow}>
        <span className={styles.popularLabel}>{t('popular')}</span>
        {POPULAR.map((item) => (
          <Link
            key={item.ticker}
            className={styles.popularChip}
            href={{ pathname: '/symbols/[ticker]', params: { ticker: item.ticker } }}
          >
            {tMenu(item.labelKey)}
          </Link>
        ))}
      </div>
    </>
  );
}
