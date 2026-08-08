'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'tn_expert_v2';

/**
 * Production booking lifecycle. The prototype exercises the first three; the rest
 * exist so the model is not reshaped later when refunds and disputes land.
 */
export type BookingStatus =
  | 'none'
  | 'slot_held'
  | 'payment_pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'no_show'
  | 'disputed';

export type ExpertFlowState = {
  /** Intake answers keyed by question key. */
  answers: Record<string, string>;
  step: number;
  briefReady: boolean;
  saved: string[];
  expertId: string | null;
  /** Context-sharing toggles. Absent means off — nothing is shared implicitly. */
  shares: Record<string, boolean>;
  packageId: string | null;
  slot: string | null;
  consents: Record<string, boolean>;
  booking: BookingStatus;
  rating: number;
};

export const EXPERT_FLOW_DEFAULTS: ExpertFlowState = {
  answers: {},
  step: 0,
  briefReady: false,
  saved: [],
  expertId: null,
  shares: {},
  packageId: null,
  slot: null,
  consents: {},
  booking: 'none',
  rating: 0,
};

function load(): ExpertFlowState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EXPERT_FLOW_DEFAULTS;
    return { ...EXPERT_FLOW_DEFAULTS, ...(JSON.parse(raw) as Partial<ExpertFlowState>) };
  } catch {
    return EXPERT_FLOW_DEFAULTS;
  }
}

function save(state: ExpertFlowState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Session storage being unavailable must not block booking.
  }
}

/**
 * Booking state is deliberately session-scoped, not persisted like learning
 * progress: a half-finished booking should not resurface days later as if it
 * were still valid.
 */
export function useExpertFlow() {
  const [state, setState] = useState<ExpertFlowState | null>(null);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect --
       session storage does not exist during the server render, so this state
       cannot be produced any earlier than the first client effect. `null`
       until then is deliberate: it is "not read yet", and a component that
       renders the defaults instead would flash an empty booking over a real
       one. */
    setState(load());
  }, []);

  const update = useCallback((patch: Partial<ExpertFlowState>) => {
    setState((current) => {
      const next = { ...(current ?? EXPERT_FLOW_DEFAULTS), ...patch };
      save(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setState(EXPERT_FLOW_DEFAULTS);
    save(EXPERT_FLOW_DEFAULTS);
  }, []);

  return { state, update, reset };
}
