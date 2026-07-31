'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { GENERIC_CONTEXT } from '@/lib/voyager/context';
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
};

const VoyagerStore = createContext<Store | null>(null);

export function VoyagerProvider({ children }: { children: React.ReactNode }) {
  const [context, setContext] = useState<VoyagerContext | null>(null);

  const value = useMemo<Store>(
    () => ({ context: context ?? GENERIC_CONTEXT, setContext }),
    [context]
  );

  return <VoyagerStore.Provider value={value}>{children}</VoyagerStore.Provider>;
}

export function useVoyagerContext(): VoyagerContext {
  return useContext(VoyagerStore)?.context ?? GENERIC_CONTEXT;
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
