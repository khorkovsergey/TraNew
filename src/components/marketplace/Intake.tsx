'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { TrustLabel } from '@/components/ui/TrustLabel';
import { EXPERT_TASKS, INTAKE } from '@/content/experts';
import { pick } from '@/content/types';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { EXPERT_FLOW_DEFAULTS, useExpertFlow } from '@/lib/expertFlow';
import styles from './Marketplace.module.css';

export function Intake() {
  const t = useTranslations('marketplace');
  const locale = useLocale() as Locale;
  const { state, update } = useExpertFlow();

  // A task card on the landing screen answers question one and skips ahead.
  useEffect(() => {
    if (!state || state.answers.task) return;
    const taskId = new URLSearchParams(window.location.search).get('task');
    if (!taskId) return;

    const task = EXPERT_TASKS.find((item) => item.id === taskId);
    const label = task ? pick(task.title, locale) : pick(INTAKE[0].options.at(-1)!, locale);
    update({ answers: { ...state.answers, task: label }, step: 1 });
  }, [state, locale, update]);

  const view = state ?? EXPERT_FLOW_DEFAULTS;
  const step = Math.min(view.step, INTAKE.length - 1);
  const question = INTAKE[step];
  const selected = view.answers[question.key];
  const isLast = step === INTAKE.length - 1;
  const percent = Math.round(((step + 1) / INTAKE.length) * 100);

  const answer = (label: string) => {
    update({ answers: { ...view.answers, [question.key]: label } });
  };

  const goNext = () => {
    if (!selected) return;
    if (isLast) {
      update({ briefReady: true });
      return;
    }
    update({ step: step + 1 });
  };

  const answerOf = (key: string) => view.answers[key] ?? '—';

  if (view.briefReady) {
    return (
      <>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>{t('brief.title')}</h2>
            <TrustLabel kind="aiExplanation" />
            <span className={styles.hint}>{t('brief.label')}</span>
          </div>

          <div className={styles.briefSection}>
            <div className={styles.briefKey}>{t('brief.goal')}</div>
            <div className={styles.briefValue}>
              {t('brief.goalValue', {
                task: answerOf('task'),
                outcome: answerOf('outcome'),
              })}
            </div>
          </div>

          <div className={styles.briefSection}>
            <div className={styles.briefKey}>{t('brief.situation')}</div>
            <div className={styles.briefValue}>
              {t('brief.situationValue', {
                experience: answerOf('experience'),
                country: answerOf('country'),
                amount: answerOf('amount'),
              })}
            </div>
          </div>

          <div className={styles.briefSection}>
            <div className={styles.briefKey}>{t('brief.topics')}</div>
            <div className={styles.bullets}>
              {(['topic1', 'topic2', 'topic3'] as const).map((topic) => (
                <div className={styles.bullet} key={topic}>
                  <span>•</span>
                  <span>{t(`brief.${topic}`)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.briefSection}>
            <div className={styles.briefKey}>{t('brief.preferred')}</div>
            <div className={styles.chips}>
              <span className={styles.chip}>{answerOf('language')}</span>
              <span className={styles.chip}>{answerOf('format')}</span>
              <span className={styles.chip}>{answerOf('country')}</span>
            </div>
          </div>

          <p className={styles.disclaimer}>{t('brief.disclaimer')}</p>
        </section>

        <div className={styles.ctaRow}>
          <Link className={styles.primary} href="/marketplace/experts/matches">
            {t('brief.find')}
          </Link>
          <button
            className={styles.ghost}
            onClick={() => update({ briefReady: false, step: 0 })}
          >
            {t('brief.edit')}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={styles.progressRow}>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${percent}%` }} />
        </div>
        <span className={styles.progressLabel}>
          {t('intake.stepOf', { step: step + 1, total: INTAKE.length })}
        </span>
      </div>

      <h2 className={styles.question}>{pick(question.question, locale)}</h2>
      {/* The capital question is the one people distrust — explain it before asking. */}
      {question.hint && (
        <div className={styles.questionHint}>{pick(question.hint, locale)}</div>
      )}

      <div className={styles.options}>
        {question.options.map((option) => {
          const label = pick(option, locale);
          const isSelected = selected === label;
          return (
            <button
              key={label}
              className={`${styles.option} ${isSelected ? styles.optionSelected : ''}`}
              aria-pressed={isSelected}
              onClick={() => answer(label)}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className={styles.ctaRow}>
        {step > 0 && (
          <button className={styles.ghost} onClick={() => update({ step: step - 1 })}>
            {t('intake.back')}
          </button>
        )}
        <button
          className={styles.primary}
          disabled={!selected}
          style={selected ? undefined : { opacity: 0.45, cursor: 'not-allowed' }}
          onClick={goNext}
        >
          {isLast ? t('intake.finish') : t('intake.next')}
        </button>
        {!selected && <span className={styles.hint}>{t('intake.chooseOne')}</span>}
      </div>
    </>
  );
}
