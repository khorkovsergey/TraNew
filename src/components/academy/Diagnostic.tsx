'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { DIAGNOSTIC } from '@/content/academy';
import { pick } from '@/content/types';
import { useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { ACADEMY_DEFAULTS, useAcademy } from '@/lib/academyProgress';
import styles from './Academy.module.css';

export function Diagnostic() {
  const t = useTranslations('academy');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { state, update } = useAcademy();

  /**
   * "I already know the basics" pre-answers the level question and jumps past it.
   * Read from the URL here rather than via useSearchParams — that hook opts the
   * whole subtree out of prerendering, and this screen should ship in the HTML.
   */
  useEffect(() => {
    if (!state) return;
    if (new URLSearchParams(window.location.search).get('skip') !== '1') return;
    if (state.diag[0].length === 0) {
      const diag = state.diag.map((answers, index) => (index === 0 ? ['basics'] : answers));
      update({ diag, diagStep: Math.max(state.diagStep, 1), stage: 'diagnostic' });
    }
  }, [state, update]);

  // Render the first question from defaults before hydration so the screen is never
  // blank and the server HTML matches the client's first pass; saved answers arrive
  // once localStorage has been read.
  const view = state ?? ACADEMY_DEFAULTS;

  const step = Math.min(view.diagStep, DIAGNOSTIC.length - 1);
  const question = DIAGNOSTIC[step];
  const answers = view.diag[step] ?? [];
  const isLast = step === DIAGNOSTIC.length - 1;
  const canAdvance = answers.length > 0;
  const percent = Math.round(((step + 1) / DIAGNOSTIC.length) * 100);

  const setAnswers = (next: string[]) => {
    const diag = view.diag.map((value, index) => (index === step ? next : value));
    update({ diag, stage: 'diagnostic' });
  };

  const toggle = (optionId: string) => {
    if (!question.multi) {
      setAnswers([optionId]);
      return;
    }

    if (answers.includes(optionId)) {
      setAnswers(answers.filter((id) => id !== optionId));
      return;
    }

    // Question five caps selections at two; drop the oldest to keep the tap working.
    const next = question.max && answers.length >= question.max
      ? [...answers.slice(1), optionId]
      : [...answers, optionId];
    setAnswers(next);
  };

  const goNext = () => {
    if (!canAdvance) return;

    if (isLast) {
      update({ pathReady: true, stage: 'path', diagStep: DIAGNOSTIC.length - 1 });
      router.push('/academy/path');
      return;
    }
    update({ diagStep: step + 1 });
  };

  const goBack = () => {
    if (step === 0) return;
    update({ diagStep: step - 1 });
  };

  const hasDescriptions = question.options.some((option) => option.desc);

  return (
    <>
      <div className={styles.progressRow}>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${percent}%` }} />
        </div>
        <span className={styles.progressLabel}>
          {t('setup.stepOf', { step: step + 1, total: DIAGNOSTIC.length })}
        </span>
      </div>

      <div className={styles.qHead}>
        <h2 className={styles.qTitle}>{pick(question.title, locale)}</h2>
        {question.sub && <div className={styles.qSub}>{pick(question.sub, locale)}</div>}
      </div>

      <div className={hasDescriptions ? styles.optionsGrid : styles.options}>
        {question.options.map((option) => {
          const selected = answers.includes(option.id);
          return (
            <button
              key={option.id}
              className={`${styles.option} ${selected ? styles.optionSelected : ''}`}
              aria-pressed={selected}
              onClick={() => toggle(option.id)}
            >
              {pick(option.label, locale)}
              {option.desc && (
                <span className={styles.optionDesc}>{pick(option.desc, locale)}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className={styles.qFooter}>
        {step > 0 && (
          <button className={styles.secondary} onClick={goBack}>
            {t('setup.back')}
          </button>
        )}
        <button
          className={styles.primary}
          onClick={goNext}
          disabled={!canAdvance}
          style={canAdvance ? undefined : { opacity: 0.45, cursor: 'not-allowed' }}
        >
          {isLast ? t('setup.create') : t('setup.next')}
        </button>
        <span className={styles.hint}>
          {canAdvance
            ? question.max
              ? t('setup.maxReached', { max: question.max })
              : t('setup.noAccount')
            : t('setup.chooseOne')}
        </span>
      </div>
    </>
  );
}
