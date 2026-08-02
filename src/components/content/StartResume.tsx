'use client';

import { useSyncExternalStore } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Link } from '@/i18n/navigation';
import type { StaticPathname } from '@/i18n/routing';
import { usePending } from '@/lib/pendingWork';
import styles from './Content.module.css';

/**
 * What this person already started.
 *
 * The screen was five equal links every time, which made it a menu rather than
 * a start: someone who had answered five of seven questions came back to the
 * same list, with nothing acknowledging that they were part-way through
 * anything. This row appears above it when there is genuinely something to
 * resume, and stays absent otherwise.
 *
 * Rendered on the client because the answer lives in the browser. That means it
 * arrives a beat after the rest of the page, which is the right trade: the five
 * choices are in the server HTML and work without JavaScript, and this is an
 * addition rather than a replacement.
 *
 * Read through a store rather than an effect that sets state, so the extra
 * render React would otherwise warn about does not happen.
 */

type Resume = { href: StaticPathname; label: string };

export function StartResume({
  title,
  hint,
  strategyLabel,
  academyLabel,
}: {
  title: string;
  hint: string;
  strategyLabel: string;
  academyLabel: string;
}) {
  const strategy = usePending<{ answers?: string[][] }>('strategy');

  // Academy keeps its own state under its own key, and has since before this
  // existed — read it rather than duplicating it.
  const academyStage = useSyncExternalStore(
    subscribeToStorage,
    () => {
      try {
        const raw = localStorage.getItem('tn_learn_v2');
        return raw ? (JSON.parse(raw) as { stage?: string }).stage ?? null : null;
      } catch {
        return null;
      }
    },
    () => null
  );

  const rows: Resume[] = [];

  // Any answered step counts: someone who stopped at question two still stopped
  // part-way through something.
  if (strategy?.answers?.some((value) => value.length > 0)) {
    rows.push({ href: '/strategy', label: strategyLabel });
  }

  if (academyStage && academyStage !== 'landing') {
    rows.push({ href: '/academy', label: academyLabel });
  }

  if (!rows.length) return null;

  return (
    <section className={styles.resume}>
      <h2 className={styles.resumeTitle}>{title}</h2>

      <div className={styles.rowLinks}>
        {rows.map((row) => (
          <Link className={styles.rowLink} href={row.href} key={row.href}>
            <span>{row.label}</span>
            <Icon name="arrowRight" size={18} />
          </Link>
        ))}
      </div>

      <p className={styles.resumeHint}>{hint}</p>
    </section>
  );
}

/** Storage changes in another tab are the only thing that moves this. */
function subscribeToStorage(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}
