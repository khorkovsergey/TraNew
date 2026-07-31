'use client';

import { useTranslations } from 'next-intl';
import { useLoginModal } from '@/components/shell/LoginModalProvider';
import { Link } from '@/i18n/navigation';
import type { Ticker } from '@/lib/symbolSearch';
import { OwnThis } from './OwnThis';
import styles from './Symbol.module.css';

/**
 * Watchlist and alerts are the two actions that save something, so they — and only
 * they — ask an anonymous visitor to create an account.
 */
export function SymbolActions({
  ticker,
  name,
  price,
}: {
  ticker: Ticker;
  name: string;
  price: string;
}) {
  const t = useTranslations('symbol.actions');
  const { openLogin } = useLoginModal();

  return (
    <div className={styles.actions}>
      <Link className={`${styles.action} ${styles.actionPrimary}`} href="/supercharts">
        {t('openChart')}
      </Link>

      <Link
        className={styles.action}
        href={{ pathname: '/research', query: { q: `Compare ${name} with…` } }}
      >
        {t('compare')}
      </Link>

      <button className={styles.action} onClick={openLogin}>
        {t('watchlist')}
      </button>

      <button className={styles.action} onClick={openLogin}>
        {t('alert')}
      </button>

      <Link
        className={`${styles.action} ${styles.actionAi}`}
        href={{ pathname: '/research', query: { q: `What is happening with ${ticker} today?` } }}
      >
        {t('voyager')}
      </Link>

      {/* Contextual doorway into the Wealth Hub, right where the holding is looked at. */}
      <OwnThis ticker={ticker} name={name} price={price} />
    </div>
  );
}
