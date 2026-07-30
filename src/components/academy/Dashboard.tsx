'use client';

import { useLocale, useTranslations } from 'next-intl';
import { FIRST_LESSON, STAGES } from '@/content/academy';
import { pick } from '@/content/types';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { academyPercent, useAcademy } from '@/lib/academyProgress';
import styles from './Academy.module.css';

export function Dashboard() {
  const t = useTranslations('academy.dashboard');
  const locale = useLocale() as Locale;
  const { state } = useAcademy();

  const percent = state ? academyPercent(state) : 0;
  const finished = Boolean(state?.done);

  return (
    <>
      <div className={styles.card} style={{ marginTop: 24 }}>
        <div className={styles.cardTitle}>{t('continueTitle')}</div>
        <div className={styles.stageOutcome}>{pick(FIRST_LESSON.title, locale)}</div>
        <div className={styles.progressRow}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${percent}%` }} />
          </div>
          <span className={styles.progressLabel}>
            {t('progress', { minutes: FIRST_LESSON.minutes, percent })}
          </span>
        </div>
        <Link
          className={`${styles.primary} ${styles.primarySmall}`}
          style={{ display: 'inline-block', marginTop: 16 }}
          href={{ pathname: '/academy/lesson/[slug]', params: { slug: FIRST_LESSON.slug } }}
        >
          {t('continueCta')}
        </Link>
      </div>

      <h2 className={styles.sectionTitle}>{t('yourPath')}</h2>
      <div className={styles.stackTight}>
        {STAGES.map((stage, index) => {
          const active = index === 0;
          const status = active ? (finished ? t('complete') : t('inProgress')) : t('upNext');

          return (
            <div className={styles.card} key={stage.name.en}>
              <div className={styles.rowCenter}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{pick(stage.name, locale)}</div>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <span className={styles.stageMeta}>
                    {stage.lessons.length}
                  </span>
                  <span
                    className={`${styles.status} ${active ? styles.statusActive : styles.statusIdle}`}
                  >
                    {status}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.nextAction}>
        <div className={styles.nextActionTitle}>{t('nextActionTitle')}</div>
        <div className={styles.nextActionText}>{t('nextActionText')}</div>
        <Link
          className={styles.nextActionCta}
          href={{ pathname: '/academy/practice/[ticker]', params: { ticker: 'TSLA' } }}
        >
          {t('nextActionCta')}
        </Link>
      </div>

      <div className={styles.counters}>
        <div className={styles.counter}>
          <div className={`${styles.counterValue} tn-num`}>{state?.watch.length ?? 0}</div>
          <div className={styles.counterLabel}>{t('counterWatchlist')}</div>
        </div>
        <div className={styles.counter}>
          <div className={`${styles.counterValue} tn-num`}>{state?.qs ?? 0}</div>
          <div className={styles.counterLabel}>{t('counterQuestions')}</div>
        </div>
        <div className={styles.counter}>
          <div className={`${styles.counterValue} tn-num`}>{state?.terms.length ?? 0}</div>
          <div className={styles.counterLabel}>{t('counterTerms')}</div>
        </div>
      </div>
    </>
  );
}
