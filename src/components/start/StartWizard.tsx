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
import { track } from '@/lib/events/analytics';
import {
  draftServerSnapshot,
  draftSnapshot,
  setAnswers,
  subscribeDraft,
} from '@/lib/start/draftStore';
import { riskComfortOf } from '@/lib/start/plan';
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

  const state = useSyncExternalStore(subscribeDraft, draftSnapshot, draftServerSnapshot);
  const answers = state.answers;

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

  const complete = isComplete(answers);

  const update = useCallback(
    (patch: Partial<StartAnswers>, atStep: number) => {
      setPinned(atStep);
      setAnswers({ ...answers, ...patch });
    },
    [answers]
  );

  /*
   * The last Continue does not save anything — it produces the result.
   *
   * The plan used to be a sidebar beside the questions, which meant the
   * personalised thing appeared before the answers that personalise it and had
   * to be generic until they arrived. It is its own screen now, and this is the
   * only way to it.
   */
  const finish = () => {
    track({ name: 'diagnostic_completed', steps: STEP_META.length });
    track({ name: 'plan_generated', steps: 0, risk: riskComfortOf(answers) });
    router.push('/start/plan');
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
                  <button className={styles.continue} disabled={!complete} onClick={finish}>
                    See my plan
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
            <span className={styles.railHeading}>Your path is being built</span>
          </div>

          {/*
            * A teaser, not a route.
            *
            * This panel used to render a finished five-step path from the first
            * moment the screen loaded — the same five steps whatever anybody
            * answered, under a heading that called it theirs. Showing the shape
            * of the answer while the questions are still being answered is the
            * honest version: something is coming, and it is not written yet.
            */}
          <p className={styles.railLead}>
            Each answer changes it. Nothing is decided until all four are in, so there is nothing
            here to read yet.
          </p>

          <ol className={styles.teaserList}>
            {STEP_META.map((meta, index) => {
              const answeredHere = index < step || (index === step && answered(answers, index));
              return (
                <li
                  key={meta.number}
                  className={`${styles.teaserRow} ${answeredHere ? styles.teaserRowOn : ''}`}
                >
                  <span className={styles.teaserBar} aria-hidden="true" />
                  <span className={styles.teaserLabel}>
                    {answeredHere ? meta.title : 'Waiting on your answer'}
                  </span>
                </li>
              );
            })}
          </ol>

          <div className={styles.railNote}>
            <Icon name="lock" size={14} strokeWidth={2} />
            Your answers stay in this browser. Saving is the last step, not the first.
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
