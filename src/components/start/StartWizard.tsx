'use client';

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { useLoginModal } from '@/components/shell/LoginModalProvider';
import { Icon } from '@/components/ui/Icon';
import {
  HORIZON_QUESTION,
  KNOWLEDGE_QUESTION,
  LEARNING_QUESTION,
  PRIORITY_QUESTION,
  START_TRUST,
  STEP_META,
  UNLOCKS,
  type WizardOption,
} from '@/content/startWizard';
import { useRouter } from '@/i18n/navigation';
import {
  draftServerSnapshot,
  draftSnapshot,
  setDraft,
  subscribeDraft,
} from '@/lib/start/draftStore';
import {
  MAX_PRIORITIES,
  firstUnanswered,
  isComplete,
  suggestPath,
  togglePriority,
  type Horizon,
  type Knowledge,
  type LearningStyle,
  type Priority,
  type StartAnswers,
} from '@/lib/start/path';
import styles from './StartWizard.module.css';

/**
 * Start Investing — the four-question funnel.
 *
 * A guest can finish the whole thing. Registration is asked for once, at the
 * end, to save a result that already exists on screen; it is never a gate in
 * front of the questions, and "Continue without account" is a real button that
 * goes somewhere useful rather than a smaller way of saying no.
 *
 * The draft lives in this browser's local storage and nowhere else until it is
 * saved. That is four preference keys — no name, no amount, no holdings — and
 * the trust line under the wizard says so.
 */

export function StartWizard() {
  const router = useRouter();
  const { openLogin, authed } = useLoginModal();

  const answers = useSyncExternalStore(subscribeDraft, draftSnapshot, draftServerSnapshot);

  /*
   * Which step is on screen.
   *
   * Null means "wherever the draft left off", so a returning visitor lands on
   * their first unanswered question without an effect having to move them there.
   * The first interaction pins it — otherwise answering question one would slide
   * the rail to question two before the person pressed Continue.
   */
  const [pinned, setPinned] = useState<number | null>(null);
  const step = pinned ?? firstUnanswered(answers);
  const [saved, setSaved] = useState(false);

  const path = useMemo(() => suggestPath(answers), [answers]);
  const complete = isComplete(answers);

  const update = useCallback(
    (patch: Partial<StartAnswers>, atStep: number) => {
      setPinned(atStep);
      setDraft({ ...answers, ...patch });
    },
    [answers]
  );

  const save = () => {
    if (!authed) {
      // The one place an account is asked for, and only to keep something.
      openLogin();
      return;
    }
    setSaved(true);
    router.push('/strategy');
  };

  const progress = Math.round(((step + 1) / STEP_META.length) * 100);

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.main}>
          <div className={styles.head}>
            <div>
              <h1 className={styles.h1}>
                Start investing with <span className={styles.accentText}>clarity</span>
              </h1>
              <p className={styles.lead}>
                Answer a few simple questions and we will suggest a starting path that fits you.
              </p>
            </div>

            <div className={styles.progressBlock}>
              <div className={styles.progressLine}>
                <span>
                  Step {step + 1} of {STEP_META.length}
                </span>
                <span className={styles.progressPercent}>{progress}%</span>
              </div>
              {/* The number is in the text above; the bar repeats it for people who
                  read shapes faster than digits, and is hidden from the reader that
                  already heard it. */}
              <div className={styles.progressTrack} aria-hidden="true">
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <ol className={styles.rail}>
              {STEP_META.map((meta, index) => {
                const state = index < step ? 'done' : index === step ? 'current' : 'todo';
                return (
                  <li key={meta.number} className={styles.railItem}>
                    <div className={styles.railGutter}>
                      <button
                        className={`${styles.railDot} ${styles[`dot_${state}`]}`}
                        aria-current={state === 'current' ? 'step' : undefined}
                        /* Going back is allowed; jumping ahead of an unanswered
                           question is not, because the step after it would have
                           nothing to work with. */
                        disabled={index > step}
                        onClick={() => setPinned(index)}
                      >
                        {state === 'done' ? (
                          <Icon name="check" size={14} strokeWidth={2.6} />
                        ) : (
                          meta.number
                        )}
                        <span className="tn-sr-only">
                          {`Step ${meta.number}: ${meta.title}`}
                          {state === 'done' ? ' — answered' : ''}
                        </span>
                      </button>
                      {index < STEP_META.length - 1 && <span className={styles.railLine} />}
                    </div>

                    <div className={state === 'current' ? styles.railTextCurrent : styles.railText}>
                      <div className={styles.railTitle}>
                        {meta.number} · {meta.title}
                      </div>
                      <div className={styles.railSub}>{meta.sub}</div>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className={styles.questionPane}>
              {step === 0 && (
                <Question
                  heading={KNOWLEDGE_QUESTION.heading}
                  hint={KNOWLEDGE_QUESTION.hint}
                  options={KNOWLEDGE_QUESTION.options}
                  selected={answers.knowledge ? [answers.knowledge] : []}
                  onPick={(key: Knowledge) => update({ knowledge: key }, 0)}
                />
              )}

              {step === 1 && (
                <Question
                  heading={PRIORITY_QUESTION.heading}
                  hint={PRIORITY_QUESTION.hint}
                  options={PRIORITY_QUESTION.options}
                  selected={answers.priorities}
                  multi
                  onPick={(key: Priority) =>
                    update({ priorities: togglePriority(answers.priorities, key) }, 1)
                  }
                />
              )}

              {step === 2 && (
                <Question
                  heading={HORIZON_QUESTION.heading}
                  hint={HORIZON_QUESTION.hint}
                  options={HORIZON_QUESTION.options}
                  selected={answers.horizon ? [answers.horizon] : []}
                  onPick={(key: Horizon) => update({ horizon: key }, 2)}
                />
              )}

              {step === 3 && (
                <Question
                  heading={LEARNING_QUESTION.heading}
                  hint={LEARNING_QUESTION.hint}
                  options={LEARNING_QUESTION.options}
                  selected={answers.learning ? [answers.learning] : []}
                  onPick={(key: LearningStyle) => update({ learning: key }, 3)}
                />
              )}

              <div className={styles.note}>
                <Icon name="info" size={15} strokeWidth={2} />
                You can change your answers at any time.
              </div>

              <div className={styles.actions}>
                <button
                  className={styles.back}
                  disabled={step === 0}
                  onClick={() => setPinned(Math.max(0, step - 1))}
                >
                  <Icon name="arrowLeft" size={15} strokeWidth={2.2} />
                  Back
                </button>

                {step < STEP_META.length - 1 ? (
                  <button
                    className={styles.continue}
                    disabled={!answered(answers, step)}
                    onClick={() => setPinned(step + 1)}
                  >
                    Continue
                    <Icon name="arrowRight" size={16} strokeWidth={2.4} />
                  </button>
                ) : (
                  <button className={styles.continue} disabled={!complete} onClick={save}>
                    Save my plan
                    <Icon name="arrowRight" size={16} strokeWidth={2.4} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <section className={styles.unlockStrip}>
            <div className={styles.unlockHead}>
              <span className={styles.unlockIcon}>
                <Icon name="lock" size={18} strokeWidth={2} />
              </span>
              <div>
                <div className={styles.unlockTitle}>What an account adds</div>
                <div className={styles.unlockSub}>
                  Everything above works without one. This is what saving it gets you.
                </div>
              </div>
            </div>

            <div className={styles.unlockGrid}>
              {UNLOCKS.map((item) => (
                <div key={item.title} className={styles.unlockItem}>
                  <Icon
                    name={item.icon}
                    size={22}
                    strokeWidth={1.8}
                    className={styles[`accent_${item.accent}`]}
                  />
                  <div>
                    <div className={styles.unlockItemTitle}>{item.title}</div>
                    <div className={styles.unlockItemText}>{item.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className={styles.rail2}>
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative,
              fixed size, no LCP role. */}
          <img className={styles.robot} src="/redesign/voyager-robot.png" alt="" aria-hidden="true" />

          <div className={styles.railHead}>
            <Icon name="sparkle" size={19} strokeWidth={2} className={styles.accent_cyan} />
            <span className={styles.railHeading}>Your suggested starting path</span>
          </div>
          <p className={styles.railLead}>
            {complete
              ? 'Based on your answers. It orders what to learn — it does not tell you what to buy.'
              : 'This updates as you answer. It orders what to learn — it does not tell you what to buy.'}
          </p>

          <ol className={styles.pathList}>
            {path.map((entry, index) => (
              <li key={entry.id} className={styles.pathRow}>
                <span className={styles.pathText}>
                  <span className={styles.pathTitle}>{entry.title}</span>
                  <span className={styles.pathBody}>{entry.text}</span>
                </span>
                <span className={`${styles.pathNumber} ${styles[`num_${entry.accent}`]}`}>
                  {index + 1}
                </span>
              </li>
            ))}
          </ol>

          <button className={styles.savePlan} disabled={!complete} onClick={save}>
            {saved ? 'Saved' : 'Save my plan'}
            <Icon name="bookmark" size={16} strokeWidth={2.2} />
          </button>

          <button
            className={styles.withoutAccount}
            onClick={() => router.push(answers.learning === 'practice' ? '/portfolio' : '/academy')}
          >
            Continue without an account
          </button>

          <div className={styles.railNote}>
            <Icon name="lock" size={14} strokeWidth={2} />
            {complete
              ? 'Your answers are in this browser only. Saving keeps them to your account.'
              : 'Answer all four questions to save this path.'}
          </div>
        </aside>
      </div>

      <div className={styles.trustBar}>
        {START_TRUST.map((item) => (
          <div key={item.label} className={styles.trustItem}>
            <Icon
              name={item.icon}
              size={17}
              strokeWidth={2}
              className={styles[`accent_${item.accent}`]}
            />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Whether the step currently on screen has enough to move on from. */
function answered(answers: StartAnswers, step: number): boolean {
  if (step === 0) return answers.knowledge !== null;
  if (step === 1) return answers.priorities.length > 0;
  if (step === 2) return answers.horizon !== null;
  return answers.learning !== null;
}

function Question<T extends string>({
  heading,
  hint,
  options,
  selected,
  multi = false,
  onPick,
}: {
  heading: string;
  hint: string;
  options: WizardOption<T>[];
  selected: T[];
  multi?: boolean;
  onPick: (key: T) => void;
}) {
  return (
    <>
      <h2 className={styles.questionHeading}>{heading}</h2>
      <div className={styles.questionHint}>{hint}</div>

      {/*
       * Real radio and checkbox semantics rather than a grid of buttons: "choose
       * up to two" and "choose one" are different promises, and a button says
       * neither of them to anyone not looking at the tick.
       */}
      <div className={styles.optionGrid} role={multi ? 'group' : 'radiogroup'} aria-label={heading}>
        {options.map((option) => {
          const on = selected.includes(option.key);
          const full = multi && !on && selected.length >= MAX_PRIORITIES;

          return (
            <button
              key={option.key}
              type="button"
              role={multi ? 'checkbox' : 'radio'}
              aria-checked={on}
              className={`${styles.option} ${on ? styles.optionOn : ''}`}
              onClick={() => onPick(option.key)}
            >
              <span className={styles.optionTop}>
                <Icon
                  name={option.icon}
                  size={26}
                  strokeWidth={1.8}
                  className={styles[`accent_${option.accent}`]}
                />
                <span className={`${styles.tick} ${on ? styles.tickOn : ''}`} aria-hidden="true">
                  {on && <Icon name="check" size={13} strokeWidth={3} />}
                </span>
              </span>
              <span className={styles.optionTitle}>{option.title}</span>
              <span className={styles.optionText}>{option.text}</span>
              {/* Said, not implied by a click that appears to do nothing. */}
              {full && <span className={styles.optionSwap}>Replaces your first choice</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}
