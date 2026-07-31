'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { draftAlertAction, isSavedAction, toggleSavedAction } from '@/app/actions/saved';
import { useLoginModal } from '@/components/shell/LoginModalProvider';
import { Link } from '@/i18n/navigation';
import type { Ticker } from '@/lib/symbolSearch';
import { OwnThis } from './OwnThis';
import styles from './Symbol.module.css';

/**
 * Watchlist and alerts are the two actions that save something, so they — and only
 * they — ask an anonymous visitor to create an account.
 *
 * Both write through server actions: the saved symbol becomes the same row the
 * Workspace lists and an alert can point at, rather than a separate copy that only
 * this page knows about.
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
  const [saved, setSaved] = useState(false);
  const [alerted, setAlerted] = useState(false);
  const [pending, startTransition] = useTransition();

  // Reflects what is actually stored, so the button does not claim "Saved" for
  // someone who saved it on another device and then signed in here.
  useEffect(() => {
    let cancelled = false;
    isSavedAction('symbol', ticker).then((value) => {
      if (!cancelled) setSaved(value);
    });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const onWatchlist = () =>
    startTransition(async () => {
      const result = await toggleSavedAction({
        kind: 'symbol',
        ref: ticker,
        title: name,
        subtitle: ticker,
      });
      if (result.status === 'sign_in_required') openLogin();
      else setSaved(result.status === 'saved');
    });

  const onAlert = () =>
    startTransition(async () => {
      const result = await draftAlertAction({
        ref: ticker,
        label: `${name} price alert`,
      });
      if (result.status === 'sign_in_required') openLogin();
      else setAlerted(true);
    });

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

      <button
        className={styles.action}
        onClick={onWatchlist}
        disabled={pending}
        aria-pressed={saved}
      >
        {saved ? 'In your watchlist' : t('watchlist')}
      </button>

      {/* Says "drafted", not "created": the alert is not watching anything until
          it is switched on in the workspace. */}
      <button className={styles.action} onClick={onAlert} disabled={pending || alerted}>
        {alerted ? 'Alert drafted' : t('alert')}
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
