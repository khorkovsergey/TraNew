'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useLoginModal } from '@/components/shell/LoginModalProvider';
import { TrustLabel } from '@/components/ui/TrustLabel';
import { FIRST_LESSON } from '@/content/academy';
import { pick } from '@/content/types';
import { Link, useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { useAcademy } from '@/lib/academyProgress';
import { wave } from '@/lib/wave';
import modal from '@/components/shell/Modal.module.css';
import styles from './Academy.module.css';

const lesson = FIRST_LESSON;

/** Reading the lesson is worth 40%; the three tasks are worth 20% each. */
function lessonPercent(interOk: boolean, practiced: boolean, quickOk: boolean) {
  return 40 + (interOk ? 20 : 0) + (practiced ? 20 : 0) + (quickOk ? 20 : 0);
}

export function Lesson() {
  const t = useTranslations('academy');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { state, update } = useAcademy();
  const { openLogin } = useLoginModal();

  const [openTerm, setOpenTerm] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [savePromptSeen, setSavePromptSeen] = useState(false);

  const interOk = Boolean(state?.inter?.ok);
  const practiced = Boolean(state?.practiced);
  const quickOk = Boolean(state?.quick?.ok);
  const percent = lessonPercent(interOk, practiced, quickOk);
  const complete = percent >= 100;

  useEffect(() => {
    if (!state) return;
    if (state.stage !== 'lesson') update({ stage: 'lesson' });
    // Intentionally runs once per state identity change; update is stable.
  }, [state, update]);

  // The account ask arrives only after the first lesson delivered its value.
  useEffect(() => {
    if (complete && !savePromptSeen) {
      setSavePromptOpen(true);
      setSavePromptSeen(true);
    }
  }, [complete, savePromptSeen]);

  const chooseInteractive = (index: number, correct: boolean) => {
    update({ inter: { i: index, ok: correct } });
  };

  const chooseQuick = (index: number, correct: boolean) => {
    update({ quick: { i: index, ok: correct } });
  };

  const toggleTerm = (id: string) => {
    setOpenTerm((current) => (current === id ? null : id));
    if (state && !state.terms.includes(id)) {
      update({ terms: [...state.terms, id] });
    }
  };

  const ask = (id: string) => {
    const chip = lesson.ask.chips.find((item) => item.id === id);
    if (!chip) return;
    setAskAnswer(pick(chip.answer, locale));
    update({ qs: (state?.qs ?? 0) + 1 });
  };

  const finish = () => {
    update({ done: true, stage: 'done' });
    router.push('/academy/done');
  };

  const interChoice = state?.inter ?? null;
  const quickChoice = state?.quick ?? null;

  return (
    <>
      <div className={styles.lessonHead}>
        <div>
          <h1 className={styles.h1} style={{ marginTop: 0 }}>
            {pick(lesson.title, locale)}
          </h1>
        </div>
        <button className={styles.secondary} onClick={() => setAskOpen((open) => !open)}>
          {t('lesson.ask')}
        </button>
      </div>

      <div className={styles.progressRow}>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${percent}%` }} />
        </div>
        <span className={styles.progressLabel}>
          {t('lesson.progress', { minutes: lesson.minutes, percent })}
        </span>
      </div>

      {askOpen && (
        <div className={styles.askPanel}>
          <div className={styles.askHead}>
            <span className={styles.askTitle}>{pick(lesson.ask.title, locale)}</span>
            <button className={styles.textLink} onClick={() => setAskOpen(false)}>
              {t('lesson.askClose')}
            </button>
          </div>
          <div className={styles.askChips}>
            {lesson.ask.chips.map((chip) => (
              <button className={styles.askChip} key={chip.id} onClick={() => ask(chip.id)}>
                {pick(chip.label, locale)}
              </button>
            ))}
          </div>
          {askAnswer && (
            <div className={styles.askAnswer}>
              <div className={styles.askAnswerHead}>
                <TrustLabel kind="aiExplanation" />
              </div>
              {askAnswer}
            </div>
          )}
        </div>
      )}

      <section className={styles.cardWide}>
        <div className={styles.objectiveLabel}>{t('lesson.objective')}</div>
        <div className={styles.objectiveText}>{pick(lesson.objective, locale)}</div>
      </section>

      <section className={styles.cardWide}>
        <h2 className={styles.cardTitle}>{pick(lesson.ideaTitle, locale)}</h2>
        {lesson.paragraphs.map((paragraph) => (
          <p className={styles.paragraph} key={paragraph.en.slice(0, 24)}>
            {pick(paragraph, locale)}
          </p>
        ))}

        <div className={styles.termsRow}>
          <span className={styles.termsLabel}>{pick(lesson.keyTermsLabel, locale)}</span>
          {lesson.glossary.map((entry) => (
            <button
              key={entry.id}
              className={`${styles.term} ${openTerm === entry.id ? styles.termActive : ''}`}
              aria-expanded={openTerm === entry.id}
              onClick={() => toggleTerm(entry.id)}
            >
              {pick(entry.term, locale)}
            </button>
          ))}
        </div>

        {openTerm && (
          <div className={styles.termDef}>
            {pick(
              lesson.glossary.find((entry) => entry.id === openTerm)!.definition,
              locale
            )}
          </div>
        )}
      </section>

      <section className={styles.cardWide}>
        <h2 className={styles.cardTitle}>{pick(lesson.exampleTitle, locale)}</h2>
        <div className={styles.exampleLabels}>
          {lesson.exampleLabels.map((label, index) => (
            <span
              key={label.en}
              className={`${styles.exampleLabel} ${index === 0 ? styles.exampleLabelData : ''}`}
            >
              {pick(label, locale)}
            </span>
          ))}
        </div>
        <p className={styles.exampleText}>{pick(lesson.exampleText, locale)}</p>
        <svg viewBox="0 0 300 90" className={styles.exampleChart} aria-hidden="true">
          <polyline
            points={wave(3.2, 40, 300, 90)}
            fill="none"
            stroke="var(--tn-purple)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </section>

      <section className={styles.cardWide}>
        <h2 className={styles.cardTitle}>{pick(lesson.interactive.title, locale)}</h2>
        <div className={styles.quizRow}>
          {lesson.interactive.options.map((option, index) => {
            const picked = interChoice?.i === index;
            return (
              <button
                key={option.id}
                className={`${styles.quizOption} ${
                  picked ? (option.correct ? styles.quizCorrect : styles.quizWrong) : ''
                }`}
                onClick={() => chooseInteractive(index, option.correct)}
              >
                {pick(option.label, locale)}
              </button>
            );
          })}
        </div>
        {interChoice && (
          <div
            className={`${styles.feedback} ${
              interChoice.ok ? styles.feedbackCorrect : styles.feedbackWrong
            }`}
          >
            {pick(
              interChoice.ok
                ? lesson.interactive.correctMessage
                : lesson.interactive.wrongMessage,
              locale
            )}
          </div>
        )}
      </section>

      <section className={styles.practiceCard}>
        <div className={styles.practiceTitle}>{pick(lesson.practice.title, locale)}</div>
        <div className={styles.practiceText}>{pick(lesson.practice.text, locale)}</div>
        <div className={styles.practiceRow}>
          <Link
            className={styles.practiceCta}
            href={{ pathname: '/academy/practice/[ticker]', params: { ticker: 'TSLA' } }}
          >
            {pick(lesson.practice.cta, locale)}
          </Link>
          {practiced && (
            <span className={styles.practiceDone}>{pick(lesson.practice.done, locale)}</span>
          )}
        </div>
      </section>

      <section className={styles.cardWide}>
        <h2 className={styles.cardTitle}>{pick(lesson.quickCheck.title, locale)}</h2>
        <div className={styles.objectiveText}>{pick(lesson.quickCheck.question, locale)}</div>
        <div className={styles.quizColumn}>
          {lesson.quickCheck.options.map((option, index) => {
            const picked = quickChoice?.i === index;
            return (
              <button
                key={option.id}
                className={`${styles.quizOption} ${styles.quizOptionWide} ${
                  picked ? (option.correct ? styles.quizCorrect : styles.quizWrong) : ''
                }`}
                onClick={() => chooseQuick(index, option.correct)}
              >
                {pick(option.label, locale)}
              </button>
            );
          })}
        </div>
        {quickChoice && (
          <div
            className={`${styles.feedback} ${
              quickChoice.ok ? styles.feedbackCorrect : styles.feedbackWrong
            }`}
          >
            {pick(
              quickChoice.ok ? lesson.quickCheck.correctMessage : lesson.quickCheck.wrongMessage,
              locale
            )}
          </div>
        )}
      </section>

      {complete && (
        <section className={styles.completeCard}>
          <div className={styles.completeTitle}>{pick(lesson.completion.title, locale)}</div>
          <div className={styles.completeText}>{pick(lesson.completion.text, locale)}</div>
          <div className={styles.completeRow}>
            <button className={styles.completeCta} onClick={finish}>
              {t('lesson.nextLesson')}
            </button>
            <Link
              className={styles.completeGhost}
              href={{ pathname: '/academy/practice/[ticker]', params: { ticker: 'TSLA' } }}
            >
              {t('lesson.practiseAgain')}
            </Link>
            <Link className={styles.completeGhost} href="/academy/dashboard">
              {t('lesson.saveLater')}
            </Link>
          </div>
        </section>
      )}

      {savePromptOpen && (
        <>
          <div className={modal.overlay} onClick={() => setSavePromptOpen(false)} />
          <div className={modal.dialog} role="dialog" aria-modal="true">
            <div className={modal.title}>{t('save.title')}</div>
            <div className={modal.reassurance}>{t('save.text')}</div>
            <button
              className={modal.primary}
              style={{ background: 'var(--tn-purple)' }}
              onClick={() => {
                setSavePromptOpen(false);
                openLogin();
              }}
            >
              {t('save.saveCta')}
            </button>
            <button
              className={modal.social}
              style={{ width: '100%', marginTop: 10 }}
              onClick={() => setSavePromptOpen(false)}
            >
              {t('save.guestCta')}
            </button>
            <div className={modal.reassurance} style={{ marginTop: 14 }}>
              {t('save.note')}
            </div>
          </div>
        </>
      )}
    </>
  );
}
