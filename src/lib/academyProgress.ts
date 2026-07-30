'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'tn_learn_v1';

export type AcademyMode = 'beginner' | 'standard' | 'pro';

export type AcademyState = {
  /** Furthest screen reached in the learning flow. */
  stage: 'landing' | 'diagnostic' | 'path' | 'dashboard' | 'lesson' | 'done';
  /** Answers to the five diagnostic questions; each entry is a list of option ids. */
  diag: string[][];
  diagStep: number;
  pathReady: boolean;
  /** In-lesson interactive: chosen option index and whether it was right. */
  inter: { i: number; ok: boolean } | null;
  practiced: boolean;
  quick: { i: number; ok: boolean } | null;
  watch: string[];
  terms: string[];
  qs: number;
  mode: AcademyMode;
  done: boolean;
};

export const ACADEMY_DEFAULTS: AcademyState = {
  stage: 'landing',
  diag: [[], [], [], [], []],
  diagStep: 0,
  pathReady: false,
  inter: null,
  practiced: false,
  quick: null,
  watch: [],
  terms: [],
  qs: 0,
  mode: 'beginner',
  done: false,
};

export function loadAcademy(): AcademyState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return ACADEMY_DEFAULTS;
    return { ...ACADEMY_DEFAULTS, ...(JSON.parse(raw) as Partial<AcademyState>) };
  } catch {
    return ACADEMY_DEFAULTS;
  }
}

function saveAcademy(state: AcademyState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Guest progress is a convenience; storage being unavailable must not break the flow.
  }
}

/** How many of the five diagnostic questions have an answer. */
export function answeredCount(state: AcademyState): number {
  return state.diag.filter((answers) => answers.length > 0).length;
}

/** Coarse completion percentage shown on the home card and the dashboard. */
export function academyPercent(state: AcademyState): number {
  if (state.done) return 100;
  let percent = 0;
  if (answeredCount(state) === 5) percent += 20;
  if (state.pathReady) percent += 10;
  if (state.inter?.ok) percent += 20;
  if (state.practiced) percent += 20;
  if (state.quick?.ok) percent += 20;
  return Math.min(percent, 95);
}

export type AcademyCardState = 'new' | 'setup' | 'continue' | 'done';

export function academyCardState(state: AcademyState): AcademyCardState {
  if (state.done) return 'done';
  if (state.pathReady) return 'continue';
  if (answeredCount(state) > 0) return 'setup';
  return 'new';
}

/**
 * Reads and writes the guest learning record. Returns `null` on the first render so
 * server and client markup match — callers must handle the not-yet-hydrated case.
 */
export function useAcademy() {
  const [state, setState] = useState<AcademyState | null>(null);

  useEffect(() => {
    setState(loadAcademy());
  }, []);

  const update = useCallback((patch: Partial<AcademyState>) => {
    setState((current) => {
      const next = { ...(current ?? ACADEMY_DEFAULTS), ...patch };
      saveAcademy(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setState(ACADEMY_DEFAULTS);
    saveAcademy(ACADEMY_DEFAULTS);
  }, []);

  return { state, update, reset };
}
