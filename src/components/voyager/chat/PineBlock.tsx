'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { PineArtifact } from '@/lib/voyager/tools/pine';
import type { TradingViewHandoff } from '@/lib/voyager/tools/tradingView';
import styles from './VoyagerChat.module.css';

/**
 * Pine, and where it goes.
 *
 * Both blocks exist because the same sentence has to survive a busy screen:
 * this code has not been run. It is rendered from the artefact rather than from
 * the answer text, so an answer cannot leave it out, and it sits above the code
 * rather than under it, because a caveat below the fold is a caveat nobody read
 * before copying.
 *
 * The handoff is a destination this application built. The link is rendered
 * from `handoff.url`, which came from an allowlisted host and validated parts —
 * there is no path from a sentence a model wrote to an external link somebody
 * can click.
 */

export function PineBlock({ artifact }: { artifact: PineArtifact }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(artifact.source);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard refused — the code is on screen and selectable, which is the
         fallback that always works. */
    }
  };

  const errors = artifact.findings.filter((finding) => finding.severity === 'error');

  return (
    <section className={styles.pine}>
      <header className={styles.pineHead}>
        <span className={styles.pineTitle}>{artifact.title}</span>
        <span className={styles.pineProvenance}>
          {artifact.provenance === 'template'
            ? 'From this platform’s study registry — the same calculation the chart draws'
            : 'Written for this question'}
        </span>
        {/* Text and a tick rather than a new glyph: `Icon.tsx` is shared by every
            section, and a copy icon nobody else needs is a merge conflict
            everybody else pays for. */}
        <button className={styles.pineCopy} onClick={() => void copy()}>
          {copied && <Icon name="check" size={13} strokeWidth={2.4} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </header>

      {/* Above the code, not below it: a caveat under the fold is one nobody
          read before pasting this into a chart. */}
      <p className={styles.pineWarning}>{artifact.notExecuted}</p>

      <pre className={styles.pineSource}>
        <code>{artifact.source}</code>
      </pre>

      <p className={styles.pineStatus}>{artifact.status}</p>

      {errors.length > 0 && (
        <ul className={styles.pineFindings}>
          {errors.slice(0, 6).map((finding) => (
            <li key={`${finding.line}_${finding.message}`}>
              Line {finding.line}: {finding.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function HandoffCard({ handoff }: { handoff: TradingViewHandoff }) {
  return (
    <section className={styles.handoff}>
      <div className={styles.handoffTitle}>
        {handoff.kind === 'pine' ? 'Open the Pine editor on TradingView' : 'Continue on TradingView'}
      </div>

      {handoff.because.length > 0 && (
        <p className={styles.handoffWhy}>{handoff.because.join(' ')}</p>
      )}

      {/*
        * What travels and what does not, from the builder rather than the
        * answer. The URL carries a symbol and a timeframe; it has no field for
        * a study, a drawing or a date range, so those are listed as things to
        * set on arrival instead of described as transferred.
        */}
      {handoff.carried.length > 0 && (
        <p className={styles.handoffCarried}>
          Takes with it:{' '}
          {handoff.carried.map((item) => `${item.label} ${item.value}`).join(' · ')}
        </p>
      )}

      {handoff.manual.length > 0 && (
        <ul className={styles.handoffManual}>
          {handoff.manual.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}

      <a
        className={styles.handoffCta}
        href={handoff.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open TradingView
        <Icon name="arrowUpRight" size={13} strokeWidth={2.2} />
      </a>
    </section>
  );
}
