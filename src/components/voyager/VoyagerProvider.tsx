'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { GENERIC_CONTEXT } from '@/lib/voyager/context';
import type { StudyId, StudySpec } from '@/lib/studies/registry';
import type { VoyagerContext } from '@/lib/voyager/types';

/**
 * Carries the current page's context package to the widget.
 *
 * The widget lives in the layout and outlives any single page, so pages announce
 * themselves rather than the widget inspecting the URL. A page that says nothing
 * falls back to the generic package — Voyager is then honest about only knowing
 * it is on TradingNew.
 */

type Store = {
  context: VoyagerContext;
  setContext: (context: VoyagerContext | null) => void;

  /*
   * Studies Voyager has applied, and the chart's own chips, in one place.
   *
   * The chart is a page and the widget is in the layout, so neither can own this
   * — it lives where both can reach it. Applying a study straight from an answer
   * is safe by the same test used for `create_alert`: it is visible and it is
   * reversible in one click. Nothing here writes to an account.
   */
  studies: StudySpec[];
  applyStudy: (spec: StudySpec) => void;
  removeStudy: (id: StudyId) => void;

  /** A counter, not a flag: asking twice in a row has to register twice. */
  pineRequested: number;
  requestPine: () => void;
};

const VoyagerStore = createContext<Store | null>(null);

export function VoyagerProvider({ children }: { children: React.ReactNode }) {
  const [context, setContext] = useState<VoyagerContext | null>(null);
  const [studies, setStudies] = useState<StudySpec[]>([]);
  const [pineRequested, setPineRequested] = useState(0);

  // One study of each kind. Asking for RSI(21) after RSI(14) means changing your
  // mind about the length, not asking for two RSIs.
  const applyStudy = useCallback((spec: StudySpec) => {
    setStudies((current) => [...current.filter((entry) => entry.id !== spec.id), spec]);
  }, []);

  const removeStudy = useCallback((id: StudyId) => {
    setStudies((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const requestPine = useCallback(() => setPineRequested((count) => count + 1), []);

  const value = useMemo<Store>(
    () => ({
      context: context ?? GENERIC_CONTEXT,
      setContext,
      studies,
      applyStudy,
      removeStudy,
      pineRequested,
      requestPine,
    }),
    [context, studies, applyStudy, removeStudy, pineRequested, requestPine]
  );

  return <VoyagerStore.Provider value={value}>{children}</VoyagerStore.Provider>;
}

export function useVoyagerContext(): VoyagerContext {
  return useContext(VoyagerStore)?.context ?? GENERIC_CONTEXT;
}

/** What the chart reads, and what the widget writes to when an answer carries a study. */
export function useChartStudies() {
  const store = useContext(VoyagerStore);

  return {
    studies: store?.studies ?? [],
    applyStudy: store?.applyStudy ?? (() => {}),
    removeStudy: store?.removeStudy ?? (() => {}),
    pineRequested: store?.pineRequested ?? 0,
    requestPine: store?.requestPine ?? (() => {}),
  };
}

/**
 * Declares this page's context for as long as it is mounted, and clears it on the
 * way out so a stale subject never follows the person to the next page.
 */
export function VoyagerPageContext({ context }: { context: VoyagerContext }) {
  const store = useContext(VoyagerStore);
  const key = JSON.stringify(context);

  useEffect(() => {
    if (!store) return;
    store.setContext(JSON.parse(key) as VoyagerContext);
    return () => store.setContext(null);
    // `key` is the serialized context: it changes exactly when the context does,
    // which avoids re-running on every render for an identical object literal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return null;
}
