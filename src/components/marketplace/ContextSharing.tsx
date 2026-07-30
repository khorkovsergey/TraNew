'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { NEVER_SHARED, SHARING_ITEMS } from '@/content/experts';
import { pick } from '@/content/types';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { useExpertFlow } from '@/lib/expertFlow';
import styles from './Marketplace.module.css';

export function ContextSharing({ expertId }: { expertId: string }) {
  const t = useTranslations('marketplace.sharing');
  const locale = useLocale() as Locale;
  const { state, update } = useExpertFlow();
  const [previewOpen, setPreviewOpen] = useState(false);

  // Absent means off. Nothing is shared unless the reader turned it on here.
  const shares = state?.shares ?? {};
  const selected = SHARING_ITEMS.filter((item) => shares[item.id]);
  const notSelected = SHARING_ITEMS.filter((item) => !shares[item.id]);

  const toggle = (id: string) => {
    update({ shares: { ...shares, [id]: !shares[id] } });
  };

  return (
    <>
      <section className={styles.card}>
        {SHARING_ITEMS.map((item) => {
          const on = Boolean(shares[item.id]);
          return (
            <div className={styles.toggleRow} key={item.id}>
              <span className={styles.toggleLabel}>{pick(item.label, locale)}</span>
              <button
                className={`${styles.toggle} ${on ? styles.toggleOn : ''}`}
                role="switch"
                aria-checked={on}
                aria-label={pick(item.label, locale)}
                onClick={() => toggle(item.id)}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          );
        })}
      </section>

      <div className={styles.ctaRow}>
        <button className={styles.ghost} onClick={() => setPreviewOpen((open) => !open)}>
          {previewOpen ? t('hidePreview') : t('preview')}
        </button>
        <Link
          className={styles.primary}
          href={{ pathname: '/marketplace/experts/[id]/booking', params: { id: expertId } }}
        >
          {t('continue')}
        </Link>
      </div>

      {previewOpen && (
        <div className={styles.previewGrid}>
          <div className={styles.willReceive}>
            <div className={styles.previewTitle} style={{ color: 'var(--tn-green)' }}>
              {t('willReceive')}
            </div>
            <div className={styles.previewList}>
              {selected.length === 0 ? (
                <span>{t('nothingSelected')}</span>
              ) : (
                selected.map((item) => <span key={item.id}>· {pick(item.label, locale)}</span>)
              )}
            </div>
          </div>

          <div className={styles.willNotReceive}>
            <div className={styles.previewTitle} style={{ color: 'var(--tn-red)' }}>
              {t('willNotReceive')}
            </div>
            <div className={styles.previewList}>
              {/* Both the toggles left off and the things we never share at all. */}
              {notSelected.map((item) => (
                <span key={item.id}>· {pick(item.label, locale)}</span>
              ))}
              {NEVER_SHARED.map((item) => (
                <span key={item.en}>· {pick(item, locale)}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
