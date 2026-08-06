'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { VOYAGER_SUGGESTIONS } from '@/content/homeV2';
import { useRouter } from '@/i18n/navigation';
import styles from './HomeV2.module.css';

/**
 * The Ask Voyager card in the hero.
 *
 * It carries the question to the workspace rather than answering here. The
 * workspace is where an answer can show its sources, its refusals and its
 * consent state, and an answer without those is the thing this product exists
 * not to give.
 *
 * The question arrives in the composer, focused, rather than already sent. One
 * keystroke, and in exchange the person sees what is about to be asked on their
 * behalf before it is.
 */
export function AskVoyager() {
  const router = useRouter();
  const [draft, setDraft] = useState('');

  const ask = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    router.push({ pathname: '/voyager', query: { q: trimmed } });
  };

  return (
    <div className={styles.askCard}>
      {/* Decoration: a glow and three stars, none of which carry meaning. */}
      <span className={styles.askGlow} aria-hidden="true" />

      <div className={styles.askBody}>
        <div className={styles.askText}>
          <div className={styles.askHead}>
            <Icon name="sparkle" size={20} className={styles.askSparkle} />
            <span className={styles.askTitle}>Ask Voyager</span>
          </div>
          <p className={styles.askSub}>Your friendly guide to markets and investing.</p>

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
              placeholder="Ask anything about investing or the markets…"
              aria-label="Ask Voyager"
            />
            <button className={styles.askSend} type="submit" aria-label="Ask Voyager">
              <Icon name="send" size={15} strokeWidth={2.2} />
            </button>
          </form>

          <div className={styles.askTryLabel}>Try asking</div>
          <div className={styles.askChips}>
            {VOYAGER_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion.text}
                className={styles.askChip}
                onClick={() => ask(suggestion.text)}
              >
                <Icon
                  name={suggestion.icon}
                  size={13}
                  className={styles[`accent_${suggestion.accent}`]}
                />
                {suggestion.text}
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
