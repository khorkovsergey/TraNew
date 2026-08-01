'use client';

import { useEffect, useRef } from 'react';
import styles from './Events.module.css';

/**
 * The dialogue shell used by registration, leaving-the-site and reporting.
 *
 * Four behaviours, all of which are the difference between a dialogue and a box
 * that happens to float: focus moves into it on open and returns to whatever
 * opened it on close, Tab is trapped inside it, Escape closes it, and the page
 * behind it does not scroll. Written once here rather than three times badly.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  title,
  description,
  onClose,
  children,
  footer,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnTo.current = document.activeElement as HTMLElement | null;

    const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !panel.current) return;

      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;

      const first = items[0];
      const last = items[items.length - 1];

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
      document.body.style.overflow = previousOverflow;
      returnTo.current?.focus();
    };
  }, [onClose]);

  return (
    <div className={styles.overlay}>
      <button className={styles.overlayScrim} onClick={onClose} aria-label="Close" tabIndex={-1} />

      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={description ? 'dialog-description' : undefined}
        ref={panel}
        tabIndex={-1}
      >
        <div className={styles.dialogHead}>
          <h2 className={styles.dialogTitle} id="dialog-title">
            {title}
          </h2>
          <button type="button" className={styles.dialogClose} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {description && (
          <p className={styles.dialogText} id="dialog-description">
            {description}
          </p>
        )}

        <div className={styles.dialogBody}>{children}</div>

        {footer && <div className={styles.dialogFoot}>{footer}</div>}
      </div>
    </div>
  );
}
