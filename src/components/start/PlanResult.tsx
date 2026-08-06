'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useLoginModal } from '@/components/shell/LoginModalProvider';
import { Icon } from '@/components/ui/Icon';
import { Link, useRouter } from '@/i18n/navigation';
import { track } from '@/lib/events/analytics';
import {
  draftServerSnapshot,
  draftSnapshot,
  markStep,
  subscribeDraft,
} from '@/lib/start/draftStore';
import { isComplete } from '@/lib/start/path';
import {
  nextStep,
  planProgress,
  profileOf,
  shapedBy,
  type PlanAction,
  type PlanStep,
} from '@/lib/start/plan';
import styles from './PlanResult.module.css';

/**
 * "Your plan is ready".
 *
 * Its own route, not the last screen of the form. The result is something to
 * come back to, link to, and land on after signing up, and none of that works
 * if it only exists as a state inside a wizard.
 *
 * Nothing here is generic. If there are no answers the page does not render a
 * default route — it sends you to the questions, because a plan nobody answered
 * for is the thing this journey exists to replace.
 */
export function PlanResult() {
  const router = useRouter();
  const { authed, openLogin } = useLoginModal();
  const state = useSyncExternalStore(subscribeDraft, draftSnapshot, draftServerSnapshot);

  const { answers, steps, done } = state;
  const ready = isComplete(answers) && steps.length > 0;
  const progress = planProgress(steps, done);
  const next = nextStep(steps, done);

  /*
   * No answers, no plan.
   *
   * The check reads the store directly rather than the rendered value. The
   * first client render uses the *server* snapshot — an empty plan — so an
   * effect that trusted it bounced everybody straight back to the questions on
   * a reload, including the people who had just answered them. `draftSnapshot`
   * loads on its first call, so by the time this runs it is the real answer.
   */
  useEffect(() => {
    if (!isComplete(draftSnapshot().answers)) router.replace('/start');
  }, [router]);

  useEffect(() => {
    if (ready) track({ name: 'save_prompt_viewed', surface: 'plan' });
  }, [ready]);

  if (!ready) {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Looking for your answers…</p>
      </div>
    );
  }

  const start = (step: PlanStep, index: number) => {
    track({ name: 'plan_step_started', stepId: step.id, index });
    const target = destinationOf(step.action);
    if (target === null) {
      save();
      return;
    }
    router.push(target as never);
  };

  const save = () => {
    track({ name: 'save_prompt_viewed', surface: 'plan-cta' });
    if (!authed) {
      openLogin();
      return;
    }
    router.push('/account');
  };

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <span className={styles.badge}>
            <Icon name="check" size={13} strokeWidth={2.6} />
            Diagnostic complete
          </span>
          <h1 className={styles.h1}>
            Your plan is <span className={styles.accent}>ready</span>
          </h1>
          <p className={styles.lead}>
            Four answers, four steps that follow from them. Every one says which answer put it
            there.
          </p>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element -- decorative. */}
        <img className={styles.robot} src="/redesign/voyager-robot.png" alt="" aria-hidden="true" />
      </div>

      <div className={styles.segments} aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <span key={index} className={styles.segmentOn} />
        ))}
        <span className={styles.segmentLabel}>Result</span>
      </div>

      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.profile}>
            <div className={styles.profileHead}>
              <h2 className={styles.h2}>Your profile</h2>
              <Link className={styles.editLink} href="/start" prefetch={false}>
                Edit answers
              </Link>
            </div>
            <dl className={styles.profileGrid}>
              {profileOf(answers).map((row) => (
                <div key={row.label} className={styles.profileRow}>
                  <dt className={styles.profileLabel}>{row.label}</dt>
                  <dd className={styles.profileValue}>{row.value}</dd>
                  <dd className={styles.profileNote}>{row.note}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className={styles.route}>
            <div className={styles.routeHead}>
              <h2 className={styles.h2}>Your route</h2>
              <span className={styles.routeCount}>
                {progress.completed} of {progress.total} done
              </span>
            </div>
            <div className={styles.progressTrack} aria-hidden="true">
              <div className={styles.progressFill} style={{ width: `${progress.percent}%` }} />
            </div>

            <ol className={styles.steps}>
              {steps.map((step, index) => {
                const isDone = done.includes(step.id);
                const isNext = next?.id === step.id;

                return (
                  <li
                    key={step.id}
                    className={`${styles.step} ${isNext ? styles.stepNext : ''} ${
                      isDone ? styles.stepDone : ''
                    }`}
                  >
                    <div className={styles.stepHead}>
                      <span className={styles.stepNumber}>
                        {isDone ? <Icon name="check" size={14} strokeWidth={2.6} /> : index + 1}
                      </span>
                      <div className={styles.stepText}>
                        <div className={styles.stepTitle}>{step.title}</div>
                        <div className={styles.stepBody}>{step.text}</div>
                      </div>
                      <span className={styles.stepMinutes}>{step.minutes} min</span>
                    </div>

                    {/*
                     * Why this step exists, quoting the answer that produced it.
                     * It is part of the trust design rather than a caption: a
                     * personalised route that cannot say what personalised it is
                     * indistinguishable from a generic one with a better title.
                     */}
                    <div className={styles.why}>
                      <Icon name="sparkle" size={14} strokeWidth={2} className={styles.whyIcon} />
                      {step.why}
                    </div>

                    <div className={styles.stepActions}>
                      <button
                        className={isNext ? styles.stepCtaPrimary : styles.stepCta}
                        onClick={() => start(step, index)}
                      >
                        {labelFor(step.action, isDone)}
                        <Icon name="arrowRight" size={15} strokeWidth={2.2} />
                      </button>

                      <button
                        className={styles.stepDoneToggle}
                        aria-pressed={isDone}
                        onClick={() => {
                          markStep(step.id, !isDone);
                          if (!isDone) {
                            track({
                              name: 'plan_step_completed',
                              stepId: step.id,
                              ofSteps: steps.length,
                            });
                          }
                        }}
                      >
                        {isDone ? 'Mark not done' : 'Mark done'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <aside className={styles.rail}>
          <section className={styles.shaped}>
            <h2 className={styles.railTitle}>How your answers shaped this</h2>
            <ul className={styles.shapedList}>
              {shapedBy(answers).map((line) => (
                <li key={line} className={styles.shapedItem}>
                  <span className={styles.shapedDot} aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.saveCard}>
            <h2 className={styles.railTitle}>Keep it</h2>
            <p className={styles.saveText}>
              The plan and your progress live in this browser. An account keeps them, and puts them
              on your other devices.
            </p>
            <button className={styles.savePrimary} onClick={save}>
              Save my plan
              <Icon name="bookmark" size={16} strokeWidth={2.2} />
            </button>
            <Link className={styles.saveGhost} href="/workspace" prefetch={false}>
              Continue without an account
            </Link>
            <p className={styles.saveNote}>Nothing is lost either way.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** Where a step's action goes. Null means "this one asks for an account". */
function destinationOf(action: PlanAction): object | string | null {
  if (action.kind === 'learn') {
    return action.slug === 'cash'
      ? { pathname: '/explore/[class]', params: { class: 'cash' } }
      : action.slug
        ? { pathname: '/academy/lesson/[slug]', params: { slug: action.slug } }
        : '/academy/path';
  }
  if (action.kind === 'compare') {
    return {
      pathname: '/research',
      query: { q: 'Compare these options', assets: action.assets.join(',') },
    };
  }
  if (action.kind === 'practice') return '/portfolio';
  return null;
}

function labelFor(action: PlanAction, done: boolean): string {
  if (done) return 'Open again';
  if (action.kind === 'learn') return 'Start reading';
  if (action.kind === 'compare') return 'Open the comparison';
  if (action.kind === 'practice') return 'Open the simulator';
  return 'Create an account';
}
