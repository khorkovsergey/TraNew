'use client';

import { useLocale, useTranslations } from 'next-intl';
import { BOOKING_REFERENCE, EXPERTS, SHARING_ITEMS, expertById } from '@/content/experts';
import { pick } from '@/content/types';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { useExpertFlow } from '@/lib/expertFlow';
import styles from './Marketplace.module.css';

export function Consultation({ bookingId }: { bookingId: string }) {
  const t = useTranslations('marketplace.consultation');
  const locale = useLocale() as Locale;
  const { state } = useExpertFlow();

  // Fall back to the best-match expert so the screen is meaningful on a cold load.
  const expert = expertById(state?.expertId ?? '') ?? EXPERTS[0];
  const chosenPackage =
    expert.packages.find((item) => item.id === state?.packageId) ?? expert.packages[1];
  const shares = state?.shares ?? {};
  const shared = SHARING_ITEMS.filter((item) => shares[item.id]);

  return (
    <>
      <div className={styles.reference}>
        {t('reference', { reference: BOOKING_REFERENCE })} · /marketplace/consultations/
        {bookingId}
      </div>

      <section className={styles.card}>
        <div className={styles.kv}>
          <span className={styles.kvKey}>{expert.name}</span>
          <span className={styles.kvValue}>{pick(expert.provider, locale)}</span>
        </div>
        <div className={styles.kv}>
          <span className={styles.kvKey}>{pick(chosenPackage.label, locale)}</span>
          <span className={`${styles.kvValue} tn-num`}>{chosenPackage.price}</span>
        </div>
        <div className={styles.kv}>
          <span className={styles.kvKey}>{state?.slot ?? pick(expert.availability, locale)}</span>
          <span className={styles.kvValue}>Europe/Nicosia</span>
        </div>
        <div className={styles.ctaRow}>
          <button className={styles.primary}>{t('join')}</button>
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t('sharedContext')}</h2>
        <div className={styles.chips}>
          {shared.length === 0 ? (
            <span className={styles.chip}>—</span>
          ) : (
            shared.map((item) => (
              <span className={styles.chip} key={item.id}>
                {pick(item.label, locale)}
              </span>
            ))
          )}
        </div>
        <div className={styles.ctaRow}>
          <Link
            className={styles.ghost}
            href={{
              pathname: '/marketplace/experts/[id]/sharing',
              params: { id: expert.id },
            }}
          >
            {t('update')}
          </Link>
          <button className={styles.ghost}>{t('messages')}</button>
          <button className={styles.ghost}>{t('documents')}</button>
          <button className={styles.dangerLink}>{t('cancel')}</button>
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t('afterTitle')}</h2>
        <p className={styles.briefValue}>{t('afterText')}</p>
        <div className={styles.ctaRow}>
          <Link
            className={styles.primary}
            href={{
              pathname: '/marketplace/consultations/[id]/summary',
              params: { id: bookingId },
            }}
          >
            {t('viewSummary')}
          </Link>
        </div>
      </section>
    </>
  );
}
