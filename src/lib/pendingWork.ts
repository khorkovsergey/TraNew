/**
 * Work an anonymous person has started, kept in their browser.
 *
 * The product's rule is that an account is asked for only to save something.
 * That rule was being kept and quietly broken at the same time: the interview
 * that produces a research plan held its seven answers in React state, so a
 * reload destroyed them before anyone could be asked. The offer to keep the plan
 * was never made because there was never a plan left to keep.
 *
 * So this exists to make the offer possible. It is not a substitute for an
 * account — it is the thing that survives long enough for the account to be
 * worth offering, and the copy on screen says exactly that.
 *
 * Deliberately local and deliberately small. Nothing here is sent anywhere until
 * a person asks for it to be: an anonymous visitor answering questions about
 * their money has not agreed to those answers leaving the machine.
 */

import { useSyncExternalStore } from 'react';

export type PendingKind = 'strategy' | 'startPath' | 'academy';

const KEY: Record<PendingKind, string> = {
  strategy: 'tn_pending_strategy_v1',
  startPath: 'tn_pending_start_v1',
  academy: 'tn_pending_academy_v1',
};

/** Older than this and it is not "where you left off", it is a stale surprise. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type Envelope<T> = { at: number; data: T };

export function readPending<T>(kind: PendingKind): T | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(KEY[kind]);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Envelope<T>;
    if (typeof parsed?.at !== 'number') return null;

    if (Date.now() - parsed.at > MAX_AGE_MS) {
      localStorage.removeItem(KEY[kind]);
      return null;
    }

    return parsed.data;
  } catch {
    // Unreadable storage, private mode, a shape from an older version — all the
    // same answer: there is nothing to resume, and the flow starts fresh.
    return null;
  }
}

export function writePending<T>(kind: PendingKind, data: T): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(KEY[kind], JSON.stringify({ at: Date.now(), data } satisfies Envelope<T>));
    notifyPendingChanged();
  } catch {
    /* Not being able to remember is not a reason to interrupt what someone is doing. */
  }
}

export function clearPending(kind: PendingKind): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(KEY[kind]);
    notifyPendingChanged();
  } catch {
    /* Nothing to do — the value expires on its own. */
  }
}

/* ------------------------------------------------------------ Reading it in React */

/**
 * Reads pending work without a render cascade.
 *
 * The obvious version is `useState(null)` plus an effect that reads storage and
 * sets it, which is what the two older flows in this repository do. It works and
 * it renders twice, and React's own rule flags it. `useSyncExternalStore` is
 * built for precisely this shape — an external source that the server cannot
 * see — and its server snapshot is null, so the markup the server sent and the
 * markup the browser first produces agree.
 *
 * The snapshot is cached because the hook compares by reference: parsing the
 * JSON afresh on every call would return a new object each time and re-render
 * for ever.
 */
const listeners = new Set<() => void>();
const snapshots = new Map<PendingKind, { raw: string | null; value: unknown }>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Another tab writing to the same key is the one case where this changes
  // underneath us without our doing it.
  const onStorage = () => onChange();
  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

export function notifyPendingChanged(): void {
  snapshots.clear();
  for (const listener of listeners) listener();
}

export function usePending<T>(kind: PendingKind): T | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      const raw = typeof window === 'undefined' ? null : localStorage.getItem(KEY[kind]);
      const cached = snapshots.get(kind);
      if (cached && cached.raw === raw) return cached.value as T | null;

      const value = readPending<T>(kind);
      snapshots.set(kind, { raw, value });
      return value;
    },
    () => null
  );
}
