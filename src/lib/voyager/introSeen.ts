'use client';

/**
 * Whether this person has already seen the Voyager introduction.
 *
 * Two stores, on purpose:
 *
 * - **localStorage** is the one consulted at click time. It answers instantly, so
 *   the widget never flashes a video at someone who has already watched it while
 *   waiting on a network round-trip.
 * - **A stored preference**, when signed in, so the film does not replay on their
 *   next device. It is written fire-and-forget and read back with the widget's
 *   other server state; if that write fails the worst case is watching it once
 *   more, which is not worth blocking the interface for.
 *
 * `prefers-reduced-motion` counts as seen. Someone who has asked their system for
 * less motion should not be handed a full-screen film, and there is no reading of
 * that setting under which a 58-second autoplaying video is what they meant.
 */

const KEY = 'tn_voyager_intro_v1';

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function hasSeenIntro(): boolean {
  if (prefersReducedMotion()) return true;
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    // Storage blocked: treat it as seen rather than replaying the film on every
    // single click, which is the worse of the two failures.
    return true;
  }
}

export function markIntroSeen(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* Nothing to do — the video simply may play again in this browser. */
  }

  // Mirror to the account so a second device does not start from the beginning.
  void fetch('/api/voyager/intro', { method: 'POST' }).catch(() => {});
}
