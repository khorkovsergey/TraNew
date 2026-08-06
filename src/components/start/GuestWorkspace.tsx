'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useLoginModal } from '@/components/shell/LoginModalProvider';
import { Icon } from '@/components/ui/Icon';
import { Link, useRouter } from '@/i18n/navigation';
import { track } from '@/lib/events/analytics';
import { draftServerSnapshot, draftSnapshot, subscribeDraft } from '@/lib/start/draftStore';
import { isComplete } from '@/lib/start/path';
import { nextStep, planProgress } from '@/lib/start/plan';
import styles from './GuestWorkspace.module.css';

/**
 * The guest's workspace.
 *
 * Everything a person can hold without an account, in one place, with the fact
 * that it is temporary said at the top rather than discovered when a browser is
 * cleared. It reads the same store the plan page writes — the route here is the
 * route there, and a step marked done on one is done on the other.
 *
 * Signed-in visitors are sent to their own home. Two places to keep the same
 * work would eventually disagree about which is real.
 */
export function GuestWorkspace() {
  const router = useRouter();
  const { authed, openLogin } = useLoginModal();
  const state = useSyncExternalStore(subscribeDraft, draftSnapshot, draftServerSnapshot);

  const { answers, steps, done } = state;
  const hasPlan = isComplete(answers) && steps.length > 0;
  const progress = planProgress(steps, done);
  const next = nextStep(steps, done);

  useEffect(() => {
    if (authed) router.replace('/account');
  }, [authed, router]);

  useEffect(() => {
    if (hasPlan) {
      track({
        name: 'plan_resumed',
        surface: 'guest-workspace',
        completed: progress.completed,
        ofSteps: progress.total,
      });
    }
  }, [hasPlan, progress.completed, progress.total]);

  return (
    <div className={styles.page}>
      {/*
       * Said at the top, every visit. "Stored in this browser" is the single
       * most important fact about this screen, and it is the one somebody
       * otherwise finds out by losing something.
       */}
      <div className={styles.banner}>
        <Icon name="info" size={16} strokeWidth={2} />
        <span>
          <b>Temporary workspace</b> — everything here is stored in this browser only. Clearing it,
          or opening the site elsewhere, starts from nothing.
        </span>
        <button className={styles.bannerCta} onClick={() => openLogin()}>
          Create an account to keep it
        </button>
      </div>

      <h1 className={styles.h1}>Your workspace</h1>

      {hasPlan ? (
        <section className={styles.resume}>
          <div className={styles.resumeHead}>
            <span className={styles.resumeIcon}>
              <Icon name="bookmark" size={18} strokeWidth={2} />
            </span>
            <div>
              <div className={styles.resumeTitle}>Continue where you left off</div>
              <div className={styles.resumeSub}>
                {next
                  ? `Next: ${next.title}`
                  : 'Every step is done. The last one was saving it.'}
              </div>
            </div>
            <span className={styles.resumeCount}>
              step {Math.min(progress.completed + 1, progress.total)} of {progress.total}
            </span>
          </div>

          <div className={styles.progressTrack} aria-hidden="true">
            <div className={styles.progressFill} style={{ width: `${progress.percent}%` }} />
          </div>

          <Link className={styles.resumeCta} href="/start/plan" prefetch={false}>
            Resume my plan
            <Icon name="arrowRight" size={16} strokeWidth={2.4} />
          </Link>
        </section>
      ) : (
        <section className={styles.resume}>
          <div className={styles.resumeTitle}>No plan yet</div>
          <p className={styles.resumeSub}>
            Four questions produce one. Nothing is saved anywhere until you ask for it.
          </p>
          <Link className={styles.resumeCta} href="/start" prefetch={false}>
            Answer the four questions
            <Icon name="arrowRight" size={16} strokeWidth={2.4} />
          </Link>
        </section>
      )}

      <div className={styles.grid}>
        <Card
          icon="book"
          title="Learning"
          body={
            hasPlan
              ? 'Your path is built. Progress is kept beside the plan.'
              : 'Start anywhere in the beginner path — no account needed.'
          }
          cta="Open the lessons"
          href="/academy"
        />
        <Card
          icon="scale"
          title="Comparisons"
          body="Anything you compare opens from a link, so it can be shared or reopened."
          cta="Compare the options"
          href="/explore/options"
        />
        <Card
          icon="pie"
          title="Practice portfolio"
          body="Virtual money and real prices. It runs without an account."
          cta="Open the simulator"
          href="/portfolio"
        />
        <Card
          icon="sparkle"
          title="Voyager"
          body="Ten free questions a day on this browser. An account raises the limit."
          cta="Ask a question"
          href="/voyager"
        />
      </div>

      <section className={styles.saveBanner}>
        <div>
          <div className={styles.saveTitle}>Do not lose this</div>
          <p className={styles.saveText}>
            An account keeps the plan, the progress and anything you have compared, and puts them
            on your other devices. It is free and it is the only reason we ask.
          </p>
        </div>
        <button className={styles.saveCta} onClick={() => openLogin()}>
          Save my plan
          <Icon name="bookmark" size={16} strokeWidth={2.2} />
        </button>
      </section>
    </div>
  );
}

function Card({
  icon,
  title,
  body,
  cta,
  href,
}: {
  icon: 'book' | 'scale' | 'pie' | 'sparkle';
  title: string;
  body: string;
  cta: string;
  href: '/academy' | '/explore/options' | '/portfolio' | '/voyager';
}) {
  return (
    <div className={styles.card}>
      <Icon name={icon} size={22} strokeWidth={1.8} className={styles.cardIcon} />
      <div className={styles.cardTitle}>{title}</div>
      <p className={styles.cardBody}>{body}</p>
      <Link className={styles.cardCta} href={href} prefetch={false}>
        {cta}
        <Icon name="arrowRight" size={14} strokeWidth={2.2} />
      </Link>
    </div>
  );
}
