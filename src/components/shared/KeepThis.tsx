'use client';

import { useCallback, useEffect, useState } from 'react';
import { savePlanAction, saveLearningPathAction } from '@/app/actions/strategy';
import { Link, useRouter } from '@/i18n/navigation';
import { readPending, usePending, writePending, type PendingKind } from '@/lib/pendingWork';
import styles from './KeepThis.module.css';

/**
 * "This lives in this browser only. Keep it?"
 *
 * The same offer serves the research plan and the learning path, because they
 * are the same situation: someone answered questions, something was produced,
 * and until now nothing asked whether they wanted to keep it.
 *
 * One control, not two. The button does not ask whether you are signed in
 * before deciding what to be — it tries to save and lets the server answer.
 * That avoids probing an endpoint for identity and makes the same button
 * correct for someone who signed in an hour ago and someone who never has.
 */

type State = 'idle' | 'saving' | 'saved' | 'error';

export type KeepThisCopy = {
  title: string;
  text: string;
  cta: string;
  saving: string;
  savedTitle: string;
  savedText: string;
  savedCta: string;
  error: string;
};

export function KeepThis({
  kind,
  payload,
  copy,
}: {
  kind: Extract<PendingKind, 'strategy' | 'academy'>;
  payload: unknown;
  copy: KeepThisCopy;
}) {
  const router = useRouter();
  /*
   * Someone who asked to keep this and then registered arrives with the claim
   * already set, so the card starts in `saving` rather than being flipped there
   * by an effect. Same visible behaviour, one render instead of two, and no
   * setState in an effect body.
   */
  const claim = usePending<{ claim?: boolean }>(kind)?.claim === true;
  const [state, setState] = useState<State>(claim ? 'saving' : 'idle');

  const attempt = useCallback(
    async (fromReturn: boolean) => {
      if (!fromReturn) setState('saving');

      const result =
        kind === 'strategy'
          ? await savePlanAction({ answers: payload })
          : await saveLearningPathAction({ level: payload });

      if (result.status === 'saved') {
        // The claim is spent. Left set, it would re-save on every later visit,
        // including after someone had deliberately deleted the thing.
        writePending(kind, { ...(readPending<object>(kind) ?? {}), claim: false });
        setState('saved');
        return;
      }

      if (result.status === 'sign_in_required') {
        if (fromReturn) {
          // Back from registration and still anonymous — the confirmation email
          // is probably unopened. Say nothing; the button is still there.
          setState('idle');
          return;
        }

        /*
         * Record that this person asked, then send them to register. The flag is
         * what lets the return trip finish the job — without it, saving for
         * whoever happens to be signed in would be writing to an account nobody
         * asked us to write to.
         */
        writePending(kind, { ...(readPending<object>(kind) ?? {}), claim: true });
        router.push('/sign-up');
        return;
      }

      setState('error');
    },
    [kind, payload, router]
  );

  useEffect(() => {
    /*
     * The rule cannot see that nothing here sets state synchronously: on this
     * path `attempt` skips its `setState('saving')` and every other write is
     * behind an `await`. The card is already in `saving` from its initial state
     * for exactly this reason, so there is no cascade to avoid — and a network
     * write on arrival is what an effect is for.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (claim) void attempt(true);
  }, [attempt, claim]);

  if (state === 'saved') {
    return (
      <section className={styles.keep}>
        <div className={styles.title}>{copy.savedTitle}</div>
        <p className={styles.text}>{copy.savedText}</p>
        <Link className={styles.cta} href="/account/workspace">
          {copy.savedCta}
        </Link>
      </section>
    );
  }

  return (
    <section className={styles.keep}>
      <div className={styles.title}>{copy.title}</div>
      <p className={styles.text}>{copy.text}</p>

      <button
        className={styles.cta}
        onClick={() => void attempt(false)}
        disabled={state === 'saving'}
      >
        {state === 'saving' ? copy.saving : copy.cta}
      </button>

      {state === 'error' && <p className={styles.error}>{copy.error}</p>}
    </section>
  );
}
