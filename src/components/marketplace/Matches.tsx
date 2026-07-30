'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/Icon';
import { EXPERTS, type CredentialStatus, type MatchBand } from '@/content/experts';
import { pick } from '@/content/types';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { useExpertFlow } from '@/lib/expertFlow';
import styles from './Marketplace.module.css';

const BAND_CLASS: Record<MatchBand, string> = {
  best: styles.bandBest,
  strong: styles.bandStrong,
  suitable: styles.bandSuitable,
};

const BAND_CARD: Record<MatchBand, string> = {
  best: styles.matchCardBest,
  strong: styles.matchCardStrong,
  suitable: '',
};

const CRED_CLASS: Record<CredentialStatus, string> = {
  verified: styles.credVerified,
  verification_pending: styles.credSelf,
  self_declared: styles.credSelf,
  not_applicable: styles.credNone,
  demo: styles.credNone,
};

const BAND_KEY: Record<MatchBand, 'bandBest' | 'bandStrong' | 'bandSuitable'> = {
  best: 'bandBest',
  strong: 'bandStrong',
  suitable: 'bandSuitable',
};

export function Matches() {
  const t = useTranslations('marketplace');
  const locale = useLocale() as Locale;
  const { state, update } = useExpertFlow();

  const saved = state?.saved ?? [];

  const toggleSave = (id: string) => {
    update({
      saved: saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id],
    });
  };

  return (
    <>
      <div className={styles.matchList}>
        {EXPERTS.map((expert) => (
          <article
            className={`${styles.matchCard} ${BAND_CARD[expert.band]}`}
            key={expert.id}
          >
            <div className={styles.matchHead}>
              <div className={styles.identity}>
                <div
                  className={styles.avatar}
                  style={{ background: expert.tile, color: expert.color }}
                  aria-hidden="true"
                >
                  {expert.initials}
                </div>
                <div>
                  <div className={styles.name}>{expert.name}</div>
                  <div className={styles.provider}>{pick(expert.provider, locale)}</div>
                </div>
              </div>
              <div className={styles.priceBlock}>
                <div className={`${styles.price} tn-num`}>{expert.price}</div>
                <div className={styles.priceMeta}>
                  {pick(expert.duration, locale)} · ★ {expert.rating}
                </div>
              </div>
            </div>

            <div className={styles.badges}>
              <span className={`${styles.band} ${BAND_CLASS[expert.band]}`}>
                {t(`matches.${BAND_KEY[expert.band]}`)}
              </span>
              <span className={`${styles.band} ${CRED_CLASS[expert.credential]}`}>
                {t(`credential.${expert.credential}`)}
              </span>
              <span className={`${styles.band} ${styles.bandSuitable}`}>
                {pick(expert.jurisdiction, locale)}
              </span>
              <span className={`${styles.band} ${styles.bandSuitable}`}>{expert.languages}</span>
            </div>

            <div className={styles.whyTitle}>{t('matches.why')}</div>
            <div className={styles.reasons}>
              {expert.reasons.map((reason) => (
                <div className={styles.reason} key={reason.en}>
                  <Icon name="check" size={15} strokeWidth={2.5} />
                  {pick(reason, locale)}
                </div>
              ))}
            </div>

            <div className={styles.matchActions}>
              <Link
                className={styles.primary}
                href={{ pathname: '/marketplace/experts/[id]', params: { id: expert.id } }}
                onClick={() => update({ expertId: expert.id })}
              >
                {t('matches.view')}
              </Link>
              <Link className={styles.ghost} href="/marketplace/experts/compare">
                {t('matches.compare')}
              </Link>
              <button
                className={`${styles.saveButton} ${
                  saved.includes(expert.id) ? styles.saveButtonActive : ''
                }`}
                onClick={() => toggleSave(expert.id)}
              >
                {saved.includes(expert.id) ? t('matches.saved') : t('matches.save')}
              </button>
            </div>
          </article>
        ))}
      </div>

      <p className={styles.disclaimer}>{t('matches.noPercentages')}</p>
    </>
  );
}
