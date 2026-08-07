'use client';

import { useEffect, useState, useTransition } from 'react';
import { toggleEventBookmarkAction } from '@/app/actions/events';
import { useLoginModal } from '@/components/shell/LoginModalProvider';
import { track } from '@/lib/events/analytics';
import { consumePendingSave, rememberPendingSave } from '@/lib/events/pendingSave';
import styles from './Events.module.css';

/**
 * Saving an event.
 *
 * Anonymous visitors get the login dialogue rather than a dead button, and the
 * event they were trying to save is remembered so the save happens once they are
 * back. Losing the intent is a small thing that reads as the product not paying
 * attention — they pressed a button and nothing came of it.
 */

export function SaveButton({
  eventId,
  slug,
  title,
  saved,
  variant = 'icon',
}: {
  eventId: string;
  slug: string;
  title: string;
  saved?: boolean;
  variant?: 'icon' | 'labelled';
}) {
  const { openLogin, authed } = useLoginModal();
  const [isSaved, setIsSaved] = useState(Boolean(saved));
  const [lastKnown, setLastKnown] = useState(saved);
  const [pending, startTransition] = useTransition();

  /*
   * The button flips immediately on press and the server confirms afterwards, so
   * it keeps its own copy of the state. When the server sends a new one — a
   * re-render after revalidation — that copy has to give way. Adjusted during
   * render rather than in an effect: an effect would paint the stale value first
   * and then correct it, which is a visible flicker on a control whose whole job
   * is to respond instantly.
   */
  if (saved !== lastKnown) {
    setLastKnown(saved);
    setIsSaved(Boolean(saved));
  }

  // Signing in restores the save the person meant to make before they were asked.
  useEffect(() => {
    if (!authed) return;
    if (consumePendingSave() !== eventId) return;

    startTransition(async () => {
      const result = await toggleEventBookmarkAction({ eventId, title });
      if (result.status === 'ok') setIsSaved(result.data.saved);
    });
  }, [authed, eventId, title]);

  const toggle = () => {
    if (!authed) {
      rememberPendingSave(eventId);
      openLogin();
      return;
    }

    // Flipped immediately; put back if the server disagrees.
    const next = !isSaved;
    setIsSaved(next);
    track({ name: 'event_saved', eventId, saved: next });

    startTransition(async () => {
      const result = await toggleEventBookmarkAction({ eventId, title });
      if (result.status === 'ok') setIsSaved(result.data.saved);
      else setIsSaved(!next);
    });
  };

  const label = isSaved ? `Remove ${title} from saved events` : `Save ${title}`;

  if (variant === 'labelled') {
    return (
      <button
        type="button"
        className={`${styles.saveLabelled} ${isSaved ? styles.saveOn : ''}`}
        onClick={toggle}
        aria-pressed={isSaved}
        aria-label={label}
        data-slug={slug}
        disabled={pending}
      >
        <Bookmark filled={isSaved} />
        {isSaved ? 'Saved' : 'Save'}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`${styles.saveIcon} ${isSaved ? styles.saveOn : ''}`}
      onClick={toggle}
      aria-pressed={isSaved}
      aria-label={label}
      data-slug={slug}
      disabled={pending}
    >
      <Bookmark filled={isSaved} />
    </button>
  );
}

/* Filled versus outlined, not colour alone — the state has to survive a
   greyscale screen and colour-blind vision. */
function Bookmark({ filled }: { filled: boolean }) {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
    </svg>
  );
}
