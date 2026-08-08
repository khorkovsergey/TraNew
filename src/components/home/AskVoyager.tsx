'use client';

import { useState } from 'react';
import { useLoginModal } from '@/components/shell/LoginModalProvider';
import { clarityLine, contextParam, stashDraft } from '@/components/voyager/AskEntry';
import { Icon } from '@/components/ui/Icon';
import { TODAY_VOYAGER_QUESTION, VOYAGER_SUGGESTIONS } from '@/content/homeV2';
import { useRouter } from '@/i18n/navigation';
import styles from './HomeV2.module.css';

/**
 * The two Voyager entry points on Home — the hero card and the fourth card in
 * "Today in 3 minutes".
 *
 * Both carry the question to the workspace rather than answering here. The
 * workspace is where an answer can show its sources, its refusals and its
 * consent state, and an answer without those is the thing this product exists
 * not to give.
 *
 * They share one hook so the second one cannot quietly forget the context and
 * leave the workspace saying it can see a page it was never told about.
 */

function useAsk() {
  const router = useRouter();

  /*
   * The question goes through storage, the page it came from goes in the URL.
   *
   * A question in a query string is in the browser history, in the referrer of
   * the next request and in any log along the way. The context is a page name
   * and can travel openly; the question is the person's and does not have to.
   */
  return (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    stashDraft(trimmed, { kind: 'home' });
    router.push({ pathname: '/voyager', query: { context: contextParam({ kind: 'home' }) } });
  };
}

/** The hero card: the AI layer across the product, not a beginner's help desk. */
export function AskVoyager() {
  const { authed } = useLoginModal();
  const [draft, setDraft] = useState('');
  const ask = useAsk();

  return (
    <div className={styles.askCard}>
      <div className={styles.askBody}>
        <div className={styles.askText}>
          <div className={styles.askHead}>
            <Icon name="sparkle" size={20} className={styles.askSparkle} />
            <span className={styles.askTitle}>Ask Voyager</span>
          </div>
          <p className={styles.askSub}>Your AI guide across finance.</p>

          <form
            className={styles.askForm}
            onSubmit={(event) => {
              event.preventDefault();
              ask(draft);
            }}
          >
            <input
              className={styles.askInput}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask anything about markets, investing or finance"
              aria-label="Ask Voyager"
            />
            <button className={styles.askSend} type="submit" aria-label="Ask Voyager">
              <Icon name="send" size={15} strokeWidth={2.2} />
            </button>
          </form>

          {/* Four facts, in the order somebody hesitating needs them. */}
          <p className={styles.clarity}>{clarityLine(authed)}</p>

          <div className={styles.askTryLabel}>Try asking</div>
          <div className={styles.askChips}>
            {VOYAGER_SUGGESTIONS.map((suggestion) => (
              <button key={suggestion} className={styles.askChip} onClick={() => ask(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element --
            A decorative PNG at a fixed size with no LCP role; next/image would
            add a wrapper and a loader for an asset that is already 124KB and
            never resized. */}
        <img className={styles.robot} src="/redesign/voyager-robot.png" alt="" aria-hidden="true" />
      </div>
    </div>
  );
}

/**
 * The fourth card in "Today in 3 minutes".
 *
 * A button rather than a link, because it does not navigate to a page so much
 * as arrive at one with a question already asked. The three cards beside it say
 * what moved, why, and what people are saying; this one is the only place on
 * the row that can answer "so what does that mean for me".
 */
export function AskVoyagerToday() {
  const ask = useAsk();

  return (
    <button className={styles.todayAsk} onClick={() => ask(TODAY_VOYAGER_QUESTION)}>
      <span className={styles.todayAskHead}>
        <Icon name="sparkle" size={18} className={styles.askSparkle} />
        <span className={styles.eyebrow}>Voyager</span>
      </span>
      <span className={styles.todayAskCta}>
        Ask Voyager what this means for you
        <Icon name="arrowRight" size={14} strokeWidth={2.2} />
      </span>
    </button>
  );
}
