'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { NEVER_SHARED, SHARING_ITEMS } from '@/content/experts';
import type { ExpertBrief } from '@/lib/experts/brief';
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
  /*
   * The brief itself, so the preview shows what is being shared rather than
   * that something is.
   *
   * Listing the label "Consultation brief" tells somebody a file is going and
   * nothing about what is in it — and this one holds what they are trying to do
   * with their money. Consent to a heading is not consent.
   */
  const [brief, setBrief] = useState<ExpertBrief | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('tn_expert_brief_v1');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setBrief(JSON.parse(raw) as ExpertBrief);
    } catch {
      /* No brief to preview. The toggles still work. */
    }
  }, []);

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
                selected.map((item) => (
                  <span key={item.id}>
                    · {pick(item.label, locale)}
                    {/* Shown in full, because this is the moment of consent. */}
                    {item.id === 'brief' && brief?.goal && (
                      <span className={styles.previewBrief}>
                        {[
                          brief.goal,
                          brief.services.join(', '),
                          brief.country,
                          brief.languages.join(', '),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    )}
                  </span>
                ))
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
