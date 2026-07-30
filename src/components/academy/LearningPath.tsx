'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { DIAGNOSTIC, FIRST_LESSON, PROFILE_FALLBACKS, STAGES } from '@/content/academy';
import { pick, type Localized } from '@/content/types';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { useAcademy, type AcademyState } from '@/lib/academyProgress';
import styles from './Academy.module.css';

/** Resolves the chosen option labels for one diagnostic question. */
function answerLabels(state: AcademyState | null, questionIndex: number, locale: Locale): string[] {
  if (!state) return [];
  const question = DIAGNOSTIC[questionIndex];
  const chosen = state.diag[questionIndex] ?? [];

  return chosen
    .map((id) => question.options.find((option) => option.id === id))
    .filter((option): option is (typeof question.options)[number] => Boolean(option))
    .map((option) => pick(option.label, locale));
}

function orFallback(values: string[], fallback: Localized, locale: Locale): string {
  return values.length > 0 ? values.join(', ') : pick(fallback, locale);
}

export function LearningPath() {
  const t = useTranslations('academy.path');
  const locale = useLocale() as Locale;
  const { state } = useAcademy();
  const [previewOpen, setPreviewOpen] = useState(false);

  const profile = [
    {
      key: 'level',
      value: orFallback(answerLabels(state, 0, locale), PROFILE_FALLBACKS.level, locale),
    },
    {
      key: 'goal',
      value: orFallback(answerLabels(state, 2, locale), PROFILE_FALLBACKS.goal, locale),
    },
    {
      key: 'format',
      value: orFallback(answerLabels(state, 4, locale), PROFILE_FALLBACKS.format, locale),
    },
    {
      key: 'pace',
      value: orFallback(answerLabels(state, 3, locale), PROFILE_FALLBACKS.pace, locale),
    },
    { key: 'estimate', value: pick(PROFILE_FALLBACKS.estimate, locale) },
  ];

  return (
    <>
      <div className={styles.card} style={{ marginTop: 24 }}>
        <div className={styles.rowCenter}>
          <div className={styles.cardTitle}>{t('profileTitle')}</div>
          <Link className={styles.textLink} href="/academy/setup">
            {t('edit')}
          </Link>
        </div>
        <div className={styles.stackTight}>
          {profile.map((row) => (
            <div className={styles.profileRow} key={row.key}>
              <span className={styles.profileKey}>{t(row.key)}</span>
              <span className={styles.profileValue}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.stack}>
        {STAGES.map((stage) => (
          <div className={styles.card} key={stage.name.en}>
            <div className={styles.rowBetween}>
              <div className={styles.cardTitle}>{pick(stage.name, locale)}</div>
              <div className={styles.stageMeta}>
                {t('lessonCount', { count: stage.lessons.length })}
              </div>
            </div>
            <div className={styles.stageOutcome}>{pick(stage.outcome, locale)}</div>

            {previewOpen && (
              <div className={styles.lessonChips}>
                {stage.lessons.map((lesson) => (
                  <span className={styles.lessonChip} key={lesson.en}>
                    {pick(lesson, locale)}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={styles.ctaRow}>
        <Link
          className={styles.primary}
          href={{ pathname: '/academy/lesson/[slug]', params: { slug: FIRST_LESSON.slug } }}
        >
          {t('startFirst')}
        </Link>
        <button className={styles.secondary} onClick={() => setPreviewOpen((open) => !open)}>
          {previewOpen ? t('hidePreview') : t('preview')}
        </button>
      </div>
    </>
  );
}
