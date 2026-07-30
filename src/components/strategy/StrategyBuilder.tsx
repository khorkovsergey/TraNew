'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ALLOCATION_BANDS, STRATEGY_STEPS } from '@/content/strategy';
import { pick } from '@/content/types';
import { Link } from '@/i18n/navigation';
import type { Locale, StaticPathname } from '@/i18n/routing';
import styles from './Strategy.module.css';

const CONTINUE_CARDS: Array<{ key: 'Explore' | 'Guide' | 'Learn' | 'Expert'; href: StaticPathname }> =
  [
    { key: 'Explore', href: '/explore' },
    { key: 'Guide', href: '/research' },
    { key: 'Learn', href: '/academy' },
    { key: 'Expert', href: '/marketplace/experts' },
  ];

const emptyAnswers = () => STRATEGY_STEPS.map(() => [] as string[]);

export function StrategyBuilder() {
  const t = useTranslations('strategy');
  const locale = useLocale() as Locale;

  // Interview state lives for the session only — nothing here is worth persisting
  // without an account, and a stale half-answered interview is worse than a fresh one.
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[][]>(emptyAnswers);
  const [done, setDone] = useState(false);

  const question = STRATEGY_STEPS[step];
  const current = answers[step];
  const canAdvance = current.length > 0;
  const isLast = step === STRATEGY_STEPS.length - 1;
  const percent = Math.round(((step + 1) / STRATEGY_STEPS.length) * 100);

  const toggle = (optionId: string) => {
    setAnswers((previous) =>
      previous.map((value, index) => {
        if (index !== step) return value;
        if (!question.multi) return [optionId];
        return value.includes(optionId)
          ? value.filter((id) => id !== optionId)
          : [...value, optionId];
      })
    );
  };

  const labelsFor = (stepIndex: number): string => {
    const step_ = STRATEGY_STEPS[stepIndex];
    const chosen = answers[stepIndex];
    if (chosen.length === 0) return t('empty');

    return chosen
      .map((id) => step_.options.find((option) => option.id === id))
      .filter((option): option is (typeof step_.options)[number] => Boolean(option))
      .map((option) => pick(option.label, locale))
      .join(', ');
  };

  const restart = () => {
    setAnswers(emptyAnswers());
    setStep(0);
    setDone(false);
  };

  if (!done) {
    return (
      <>
        <div className={styles.progressRow}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${percent}%` }} />
          </div>
          <span className={styles.progressLabel}>
            {t('stepOf', { step: step + 1, total: STRATEGY_STEPS.length })}
          </span>
        </div>

        <h2 className={styles.qTitle}>{pick(question.title, locale)}</h2>
        {question.sub && <div className={styles.qSub}>{pick(question.sub, locale)}</div>}

        <div className={styles.options}>
          {question.options.map((option) => {
            const selected = current.includes(option.id);
            return (
              <button
                key={option.id}
                className={`${styles.option} ${selected ? styles.optionSelected : ''}`}
                aria-pressed={selected}
                onClick={() => toggle(option.id)}
              >
                {pick(option.label, locale)}
              </button>
            );
          })}
        </div>

        <div className={styles.footer}>
          {step > 0 && (
            <button className={styles.secondary} onClick={() => setStep(step - 1)}>
              {t('back')}
            </button>
          )}
          <button
            className={styles.primary}
            disabled={!canAdvance}
            style={canAdvance ? undefined : { opacity: 0.45, cursor: 'not-allowed' }}
            onClick={() => (isLast ? setDone(true) : setStep(step + 1))}
          >
            {isLast ? t('finish') : t('next')}
          </button>
          {!canAdvance && <span className={styles.hint}>{t('chooseOne')}</span>}
        </div>
      </>
    );
  }

  return (
    <>
      <h2 className={styles.h1} style={{ marginTop: 26 }}>
        {t('planTitle')}
      </h2>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryTile}>
          <div className={styles.summaryKey}>{t('summaryGoals')}</div>
          <div className={styles.summaryValue}>{labelsFor(1)}</div>
        </div>
        <div className={styles.summaryTile}>
          <div className={styles.summaryKey}>{t('summaryHorizon')}</div>
          <div className={styles.summaryValue}>{labelsFor(2)}</div>
        </div>
        <div className={styles.summaryTile}>
          <div className={styles.summaryKey}>{t('summaryRisk')}</div>
          <div className={styles.summaryValue}>{labelsFor(4)}</div>
        </div>
        <div className={styles.summaryTile}>
          <div className={styles.summaryKey}>{t('summaryLiquidity')}</div>
          <div className={styles.summaryValue}>{labelsFor(3)}</div>
        </div>
      </div>

      <section className={styles.card}>
        <h3 className={styles.cardTitle}>{t('rangesTitle')}</h3>
        <div className={styles.bands}>
          {ALLOCATION_BANDS.map((band) => (
            <div key={band.id}>
              <div className={styles.bandHead}>
                <span className={styles.bandLabel}>{pick(band.label, locale)}</span>
                <span className={`${styles.bandRange} tn-num`}>
                  {band.from}–{band.to}%
                </span>
              </div>
              <div className={styles.bandTrack}>
                <div
                  className={styles.bandFill}
                  style={{
                    left: `${band.from}%`,
                    width: `${band.to - band.from}%`,
                    background: band.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className={styles.note}>{t('rangesNote')}</p>
      </section>

      <h3 className={styles.sectionTitle}>{t('continueTitle')}</h3>
      <div className={styles.cards}>
        {CONTINUE_CARDS.map((card) => (
          <Link className={styles.continueCard} href={card.href} key={card.key}>
            <div className={styles.continueTitle}>{t(`card${card.key}Title`)}</div>
            <div className={styles.continueText}>{t(`card${card.key}Text`)}</div>
          </Link>
        ))}
      </div>

      <section className={styles.upsell}>
        <div className={styles.upsellTitle}>{t('upsellTitle')}</div>
        <div className={styles.upsellText}>{t('upsellText')}</div>
        <Link
          className={styles.upsellCta}
          href={{ pathname: '/tool/[slug]', params: { slug: 'ai-private' } }}
        >
          {t('upsellCta')}
        </Link>
      </section>

      <button className={styles.restart} onClick={restart}>
        {t('restart')}
      </button>
    </>
  );
}
