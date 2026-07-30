'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/Icon';
import { Link } from '@/i18n/navigation';
import { useExpertFlow } from '@/lib/expertFlow';
import styles from './Marketplace.module.css';

export function SummaryRating() {
  const t = useTranslations('marketplace.summary');
  const { state, update } = useExpertFlow();
  const rating = state?.rating ?? 0;

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>{t('rate')}</h2>
      <div className={styles.stars}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            className={`${styles.star} ${value <= rating ? styles.starOn : ''}`}
            aria-label={String(value)}
            aria-pressed={value <= rating}
            onClick={() => update({ rating: value })}
          >
            <Icon name="star" size={24} strokeWidth={1.8} />
          </button>
        ))}
      </div>

      <div className={styles.ctaRow}>
        <Link className={styles.primary} href="/marketplace/experts/matches">
          {t('followUp')}
        </Link>
        <Link className={styles.ghost} href="/">
          {t('done')}
        </Link>
      </div>
    </section>
  );
}
