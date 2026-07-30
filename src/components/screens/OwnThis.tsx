'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import type { Ticker } from '@/lib/symbolSearch';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import styles from './OwnThis.module.css';

/**
 * The contextual entry point into the Wealth Hub. Declaring a holding here creates
 * the link between a chart the reader already looks at and their own record —
 * quantity and price only, with goal and account left for later.
 */
export function OwnThis({ ticker, name, price }: { ticker: Ticker; name: string; price: string }) {
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [avgPrice, setAvgPrice] = useState('');

  if (!FEATURE_FLAGS.wealthHubEnabled) return null;

  if (added) {
    return (
      <div className={styles.personalContext}>
        <div className={styles.label}>Personal context</div>
        <div className={styles.summary}>
          {quantity || '120'} × {name} · avg ${avgPrice || '210'} · current {price} · linked to
          your Wealth Record and this chart
        </div>
        <div className={styles.actions}>
          <Link
            className={styles.primary}
            href={{ pathname: '/account/wealth/assets/[id]', params: { id: 'tsla' } }}
          >
            View in My Wealth
          </Link>
          <Link
            className={styles.ghost}
            href={{
              pathname: '/research',
              query: { q: `What if I sell half my ${name} position?` },
            }}
          >
            What if I sell half?
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <button className={styles.trigger} onClick={() => setOpen((value) => !value)}>
        I own this
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelTitle}>Add {ticker} to your Wealth Record</div>
          <div className={styles.fields}>
            <input
              className={styles.field}
              placeholder="Quantity"
              inputMode="decimal"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
            <input
              className={styles.field}
              placeholder="Average purchase price"
              inputMode="decimal"
              value={avgPrice}
              onChange={(event) => setAvgPrice(event.target.value)}
            />
            <button className={styles.primary} onClick={() => setAdded(true)}>
              Add to My Wealth
            </button>
          </div>
          <div className={styles.hint}>
            Stays linked to this chart · goal and account can be set later
          </div>
        </div>
      )}
    </>
  );
}
