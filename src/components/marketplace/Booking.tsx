'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/Icon';
import { BOOKING_REFERENCE, CONSENTS, SLOTS, type Expert } from '@/content/experts';
import { pick } from '@/content/types';
import type { Locale } from '@/i18n/routing';
import { useRouter } from '@/i18n/navigation';
import { useExpertFlow } from '@/lib/expertFlow';
import styles from './Marketplace.module.css';

const PLATFORM_FEE = 5;

function euros(value: number) {
  return `€${value}`;
}

function priceValue(price: string) {
  return Number(price.replace(/[^0-9.]/g, ''));
}

export function Booking({ expert }: { expert: Expert }) {
  const t = useTranslations('marketplace.booking');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { state, update } = useExpertFlow();

  const packageId = state?.packageId ?? expert.packages[1].id;
  const chosenPackage =
    expert.packages.find((item) => item.id === packageId) ?? expert.packages[1];
  const slot = state?.slot ?? null;
  const consents = state?.consents ?? {};
  const booking = state?.booking ?? 'none';

  const total = priceValue(chosenPackage.price) + PLATFORM_FEE;
  const allConsented = CONSENTS.every((consent) => consents[consent.id]);
  const held = booking === 'slot_held' || booking === 'payment_pending';

  const holdSlot = () => {
    if (!slot) return;
    update({ booking: 'slot_held' });
  };

  const confirm = () => {
    if (!allConsented) return;
    update({ booking: 'confirmed', expertId: expert.id });
    router.push({
      pathname: '/marketplace/consultations/[id]',
      params: { id: BOOKING_REFERENCE.toLowerCase() },
    });
  };

  return (
    <div className={styles.bookingGrid}>
      <div>
        <section className={styles.card} style={{ marginTop: 0 }}>
          <h2 className={styles.cardTitle}>{t('package')}</h2>
          {expert.packages.map((item) => {
            const active = item.id === packageId;
            return (
              <button
                key={item.id}
                className={`${styles.radioRow} ${active ? styles.radioSelected : ''}`}
                onClick={() => update({ packageId: item.id })}
              >
                <span className={styles.radioMark} />
                <span>{pick(item.label, locale)}</span>
                <span className={`${styles.radioPrice} tn-num`}>{item.price}</span>
              </button>
            );
          })}
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>{t('slot')}</h2>
          <div className={styles.hint} style={{ marginTop: 6 }}>
            {t('timezone')}
          </div>
          <div className={styles.slotGrid}>
            {SLOTS.map((option) => {
              const label = pick(option, locale);
              const active = slot === label;
              return (
                <button
                  key={option.en}
                  className={`${styles.slot} ${active ? styles.slotSelected : ''}`}
                  disabled={held}
                  onClick={() => update({ slot: label })}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {!held && (
            <button
              className={styles.dark}
              disabled={!slot}
              style={slot ? undefined : { opacity: 0.45, cursor: 'not-allowed' }}
              onClick={holdSlot}
            >
              {t('hold')}
            </button>
          )}
          {!slot && !held && (
            <div className={styles.hint} style={{ marginTop: 10 }}>
              {t('selectSlot')}
            </div>
          )}

          {/* A held slot is explicitly not a confirmed booking. */}
          {held && <div className={styles.heldBanner}>{t('held')}</div>}
        </section>

        {held && (
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t('consentsTitle')}</h2>
            <div className={styles.consentList}>
              {CONSENTS.map((consent) => {
                const on = Boolean(consents[consent.id]);
                return (
                  <button
                    key={consent.id}
                    className={styles.consentRow}
                    role="checkbox"
                    aria-checked={on}
                    onClick={() =>
                      update({ consents: { ...consents, [consent.id]: !on } })
                    }
                  >
                    <span className={`${styles.checkbox} ${on ? styles.checkboxOn : ''}`}>
                      {on && <Icon name="check" size={13} strokeWidth={3} />}
                    </span>
                    <span>{pick(consent.label, locale)}</span>
                  </button>
                );
              })}
            </div>
            <div className={styles.hint} style={{ marginTop: 12 }}>
              {t('consentHint')}
            </div>
          </section>
        )}
      </div>

      <aside className={styles.card} style={{ marginTop: 0 }}>
        <h2 className={styles.cardTitle}>{t('summary')}</h2>
        <div style={{ marginTop: 12 }}>
          <div className={styles.totalRow}>
            <span>{pick(chosenPackage.label, locale)}</span>
            <span className="tn-num">{chosenPackage.price}</span>
          </div>
          <div className={styles.totalRow}>
            <span>{t('platformFee')}</span>
            <span className="tn-num">{euros(PLATFORM_FEE)}</span>
          </div>
          <div className={styles.totalRow}>
            <span>{t('taxes')}</span>
            <span className="tn-num">{euros(0)}</span>
          </div>
          <div className={`${styles.totalRow} ${styles.totalRowFinal}`}>
            <span>{t('total')}</span>
            <span className="tn-num">{euros(total)}</span>
          </div>
        </div>

        {held && (
          <button
            className={styles.payButton}
            disabled={!allConsented}
            style={allConsented ? undefined : { opacity: 0.45, cursor: 'not-allowed' }}
            onClick={confirm}
          >
            {t('pay', { total: euros(total) })}
          </button>
        )}
      </aside>
    </div>
  );
}
