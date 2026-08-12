'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import styles from './Observatory.module.css';

/**
 * The right-side drawer, and the only one.
 *
 * Replaces the collapsed `<details>` the previous implementation used for
 * drill-downs. A `<details>` cannot be a dialog: it does not trap focus, it
 * does not close on Escape, and it pushes the page around as it opens, which on
 * a dense grid moves whatever the reader was looking at.
 *
 * What it does for accessibility, since a hand-rolled dialog usually does none
 * of it: `role="dialog"` with `aria-modal`, focus moved into the panel on open
 * and restored to the trigger on close, Escape to dismiss, a focus loop across
 * the panel's own tabbables, and the background scroll locked so the page
 * underneath does not drift while a modal is over it.
 */
export function Drawer({
  title,
  kicker,
  subtitle,
  narrow,
  onClose,
  children,
}: {
  title: string;
  kicker: string;
  subtitle?: string;
  narrow?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnTo.current = document.activeElement as HTMLElement | null;
    panel.current?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !panel.current) return;

      /*
       * The focus loop. Queried on every Tab rather than cached, because the
       * drawer's content changes as a reader switches between a metric and the
       * dictionary and a stale list would send focus to a removed node.
       */
      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = overflow;
      returnTo.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div className={styles.drawerLayer}>
      <button type="button" className={styles.drawerBackdrop} aria-label="Close panel" onClick={onClose} />

      <aside
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`${styles.drawer}${narrow ? ` ${styles.drawerNarrow}` : ''}`}
        data-drawer
      >
        <div className={styles.drawerHead}>
          <div style={{ minWidth: 0 }}>
            <div className={styles.drawerKicker}>{kicker}</div>
            <h2 className={styles.drawerTitle}>{title}</h2>
            {subtitle ? <p className={styles.drawerSub}>{subtitle}</p> : null}
          </div>
          <button type="button" className={styles.drawerClose} aria-label="Close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className={styles.drawerBody}>{children}</div>
      </aside>
    </div>
  );
}

/** A titled block inside a drawer. The design's only content unit there. */
export function DrawerBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.drawerGroup}>
      <div className={styles.drawerBlockTitle}>{title}</div>
      {children}
    </div>
  );
}
