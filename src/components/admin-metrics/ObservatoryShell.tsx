'use client';

import { useEffect, useState } from 'react';
import styles from './Observatory.module.css';

/**
 * The shell: presentation mode, and the range control.
 *
 * Presentation mode is a **lens over the same markup**, not a second
 * dashboard. The server renders every section once; this toggles a `data-mode`
 * attribute on the wrapper and the stylesheet does the rest — collapsing
 * detail tables, enlarging the primary grid, quieting implementation notes.
 *
 * That shape is deliberate. Two dashboards would mean two sets of formulas and
 * eventually two different answers to the same question, which is the specific
 * failure this whole project has been built to avoid. It also means presentation
 * mode cannot accidentally hide a bad number: it has no access to the values, so
 * the only thing it can change is emphasis.
 *
 * State is local and per-session. There is no server round trip, so switching
 * cannot alter a figure — and `Escape` always leaves, so somebody who lands in
 * it on a keyboard is never trapped.
 */
export function ObservatoryShell({
  range,
  ranges,
  queriedAt,
  children,
}: {
  range: string;
  ranges: readonly string[];
  queriedAt: string;
  children: React.ReactNode;
}) {
  const [presenting, setPresenting] = useState(false);

  useEffect(() => {
    if (!presenting) return;

    const leave = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPresenting(false);
    };

    addEventListener('keydown', leave);
    return () => removeEventListener('keydown', leave);
  }, [presenting]);

  return (
    <div className={styles.shell} data-mode={presenting ? 'presentation' : 'detail'}>
      <header className={styles.topBar}>
        <div>
          <h1 className={styles.title}>Product Observatory</h1>
          <p className={styles.subtitle}>
            {/*
              The period is stated rather than implied, and the query time is
              exact. There is no "vs previous period" anywhere on this page,
              because no previous-period source exists — a decorative delta
              would be the easiest lie on the screen.
            */}
            Period: {range} · queried {queriedAt} · no previous-period comparison exists
          </p>
        </div>

        <div className={styles.controls}>
          <nav aria-label="Reporting period" className={styles.rangeGroup}>
            {ranges.map((option) => (
              <a
                key={option}
                href={`?range=${option}`}
                className={styles.rangeOption}
                aria-current={option === range ? 'page' : undefined}
              >
                {option}
              </a>
            ))}
          </nav>

          <button
            type="button"
            className={styles.modeButton}
            onClick={() => setPresenting((value) => !value)}
            aria-pressed={presenting}
          >
            {presenting ? 'Exit presentation' : 'Presentation mode'}
          </button>
        </div>
      </header>

      {presenting ? (
        <p className={styles.modeHint} role="status">
          Presentation mode — detail tables are collapsed and implementation notes are quieted.
          Values, states and limitations are unchanged. Press <kbd>Esc</kbd> to leave.
        </p>
      ) : null}

      {children}
    </div>
  );
}
