/**
 * Which zones are open, and where that survives.
 *
 * The workspace has three zones and a person arranges them once. Losing that on
 * every reload is the kind of small rudeness that makes a tool feel borrowed
 * rather than theirs — so it is stored, and stored as untrusted input like every
 * other thing this project reads back out of a browser.
 *
 * Deliberately narrow: this holds the *arrangement*, not the work. Conversation
 * turns, modules and sources are the workspace itself and belong in the
 * workspace record, which is phase 6.
 *
 * Import-free, so the harness compiles it alone.
 */

export const ZONE_STORAGE_KEY = 'tn_voyager_zones_v1';
export const ZONE_SCHEMA_VERSION = 1;

/** The four panes a phone shows one at a time. */
export type MobileTab = 'chat' | 'canvas' | 'context' | 'sources';

export const MOBILE_TABS: MobileTab[] = ['chat', 'canvas', 'context', 'sources'];

export type ZoneState = {
  /** Zone A. Collapsed means the 46px rail, not gone. */
  conversationOpen: boolean;
  /** Zone C. Below 1180px this becomes an overlay rather than a column. */
  inspectorOpen: boolean;
  mobileTab: MobileTab;
};

export const DEFAULT_ZONES: ZoneState = {
  conversationOpen: true,
  /*
   * The inspector starts closed.
   *
   * It holds context, sources and assumptions — everything that answers "where
   * did this come from", which is a question people ask *after* reading the
   * answer, not before. Opening it by default puts provenance in front of the
   * thing it is provenance for.
   */
  inspectorOpen: false,
  mobileTab: 'canvas',
};

/** Below this the inspector stops being a column and becomes an overlay. */
export const INSPECTOR_OVERLAY_BELOW = 1180;

/** Below this the workspace shows one zone at a time behind the tab bar. */
export const MOBILE_BELOW = 760;

export type StoredZones = {
  schemaVersion: number;
  zones: ZoneState;
};

export function serializeZones(zones: ZoneState): StoredZones {
  return { schemaVersion: ZONE_SCHEMA_VERSION, zones };
}

/**
 * A stored arrangement, or nothing.
 *
 * A version from the future is refused rather than guessed at, the same as
 * `parseLayout`: reading a shape written by newer code produces a half-restored
 * workspace, which is harder to recognise as broken than a default one.
 */
export function parseZones(input: unknown): ZoneState | null {
  if (!input || typeof input !== 'object') return null;

  const raw = input as Record<string, unknown>;
  if (typeof raw.schemaVersion !== 'number' || raw.schemaVersion > ZONE_SCHEMA_VERSION) return null;

  const zones = raw.zones;
  if (!zones || typeof zones !== 'object') return null;

  const value = zones as Record<string, unknown>;
  const tab = value.mobileTab;

  return {
    // Missing or wrong-typed fields take the default rather than failing the
    // whole read: an arrangement is a preference, and losing one field should
    // not cost the other two.
    conversationOpen:
      typeof value.conversationOpen === 'boolean'
        ? value.conversationOpen
        : DEFAULT_ZONES.conversationOpen,
    inspectorOpen:
      typeof value.inspectorOpen === 'boolean' ? value.inspectorOpen : DEFAULT_ZONES.inspectorOpen,
    mobileTab: MOBILE_TABS.includes(tab as MobileTab)
      ? (tab as MobileTab)
      : DEFAULT_ZONES.mobileTab,
  };
}

/**
 * What each mobile tab is called, and what it holds.
 *
 * Named here rather than in the component so the tab bar and any future deep
 * link agree about what "context" means.
 */
export const MOBILE_TAB_LABEL: Record<MobileTab, string> = {
  chat: 'Chat',
  canvas: 'Canvas',
  context: 'Context',
  sources: 'Sources',
};
