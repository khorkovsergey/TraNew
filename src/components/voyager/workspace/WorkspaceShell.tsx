'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { VoyagerMark } from '@/components/voyager/VoyagerMark';
import {
  DEFAULT_ZONES,
  MOBILE_TAB_LABEL,
  MOBILE_TABS,
  parseZones,
  serializeZones,
  ZONE_STORAGE_KEY,
  type MobileTab,
  type ZoneState,
} from '@/lib/voyager/workspace/state';
import styles from './VoyagerWorkspace.module.css';

/**
 * The three-zone shell, once a request exists.
 *
 * Conversation on the left at 348px collapsing to a 46px rail, canvas in the
 * middle taking whatever is left, inspector on the right at 312px which becomes
 * an overlay below 1180px. Below 760px there is one zone at a time behind a tab
 * bar.
 *
 * The breakpoints are CSS, not JavaScript. A width measured during render is a
 * width the server does not have, and the markup would not match on hydration —
 * so the same tree is always rendered and the stylesheet decides which parts of
 * it are on screen. The one exception is the inspector overlay, which needs a
 * scrim and a focus trap and therefore has to know; that is read after mount.
 */

type Props = {
  workspaceName: string;
  /** True until the person saves or renames, which is what the badge means. */
  autoNamed: boolean;
  conversation: ReactNode;
  canvas: ReactNode;
  inspector: ReactNode;
  onNew: () => void;
  /** The confirmation gate, when one is open. Rendered above everything. */
  confirmation?: ReactNode;
  notice?: string | null;
  onDismissNotice?: () => void;
  library?: ReactNode;
  modal?: ReactNode;
  meter?: ReactNode;
  cta?: ReactNode;
  onOpenLibrary?: () => void;
  onSave?: () => void;
  /**
   * The chat list. Omitted until there is more than one conversation, so the
   * column appears when it has something to say rather than on arrival.
   */
  history?: ReactNode;
  /** What Save currently means here — drives the label and the tooltip. */
  saveState?: 'saved' | 'unsaved' | 'empty';
};

export function WorkspaceShell({
  workspaceName,
  autoNamed,
  conversation,
  canvas,
  inspector,
  onNew,
  confirmation,
  notice,
  onDismissNotice,
  library,
  modal,
  meter,
  cta,
  onOpenLibrary,
  onSave,
  history,
  saveState = 'empty',
}: Props) {
  const [zones, setZones] = useState<ZoneState>(DEFAULT_ZONES);
  const [narrow, setNarrow] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);

  /*
   * Restored once, on arrival, and through the parser rather than straight into
   * state. Read in an effect because the server has no localStorage: reading it
   * during render would build markup hydration then disagrees with.
   */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ZONE_STORAGE_KEY);
      if (!raw) return;
      const restored = parseZones(JSON.parse(raw));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (restored) setZones(restored);
    } catch {
      /* Unreadable storage means the default arrangement, which is fine. */
    }
    // Once, deliberately: a starting point, not a subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * Whether the inspector is an overlay.
   *
   * Followed rather than read once, because a window that is resized across the
   * breakpoint has to change behaviour — a scrim left behind on a wide screen
   * would block the canvas.
   */
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1180px)');
    const sync = () => setNarrow(query.matches);

    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const update = useCallback((patch: Partial<ZoneState>) => {
    setZones((current) => {
      const next = { ...current, ...patch };
      try {
        localStorage.setItem(ZONE_STORAGE_KEY, JSON.stringify(serializeZones(next)));
      } catch {
        /* Private mode. The arrangement still works for this visit. */
      }
      return next;
    });
  }, []);

  // Escape closes the overlay. A panel over the content that traps somebody is
  // a worse panel than one that is simply shut.
  useEffect(() => {
    if (!narrow || !zones.inspectorOpen) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') update({ inspectorOpen: false });
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [narrow, zones.inspectorOpen, update]);

  const inspectorAsOverlay = narrow && zones.inspectorOpen;

  return (
    <div className={styles.shell}>
      <header className={styles.topBar}>
        <span className={styles.brand}>
          <VoyagerMark size={20} />
          <span className={styles.wordmark}>AI Voyager</span>
        </span>

        <span className={styles.titleGroup}>
          <span className={styles.workspaceTitle}>{workspaceName}</span>
          {/* Says who named it, until somebody takes ownership by renaming. */}
          {autoNamed && <span className={styles.namedBadge}>Named by Voyager</span>}
        </span>

        <span className={styles.spacer} />

        <button
          className={styles.topAction}
          onClick={() => update({ inspectorOpen: !zones.inspectorOpen })}
          aria-pressed={zones.inspectorOpen}
          title="Context, sources and assumptions"
        >
          Context
        </button>
        <button className={styles.topAction} onClick={onOpenLibrary}>
          Workspaces
        </button>
        {/*
          * The label reports where the conversation actually lives.
          *
          * "Saved" while an unsaved answer sits on screen is the one thing this
          * button must never say — somebody closes the tab on the strength of
          * it. It goes back to "Save" the moment a new turn arrives.
          */}
        <button
          className={styles.topAction}
          onClick={onSave}
          title={
            saveState === 'saved'
              ? 'This chat is saved to your account'
              : 'Save this chat to your account'
          }
        >
          {saveState === 'saved' ? 'Saved' : 'Save'}
        </button>
        <button className={styles.topAction} onClick={onNew}>
          New
        </button>
      </header>

      <div className={styles.zones}>
        {/*
          * Zone 0. Present only once there is more than one conversation to
          * choose between — a history sidebar holding a single chat is a column
          * of furniture, and it costs the dialogue 264px to say nothing.
          */}
        {history && (
          <aside
            className={`${styles.history} ${historyOpen ? '' : styles.historyRail}`}
            aria-label="Chat history"
          >
            {historyOpen ? (
              <>
                <div className={styles.zoneHead}>
                  <span className={styles.zoneLabel}>Chat history</span>
                  <button
                    className={styles.zoneIcon}
                    onClick={() => setHistoryOpen(false)}
                    title="Collapse the history"
                    aria-label="Collapse the history"
                  >
                    <Icon name="close" size={14} />
                  </button>
                </div>
                {history}
              </>
            ) : (
              <button
                className={styles.railButton}
                onClick={() => setHistoryOpen(true)}
                title="Open the chat history"
                aria-label="Open the chat history"
              >
                {/*
                  * Layers, not a speech bubble. Collapsed, this rail sits
                  * directly beside the conversation's rail, and when both wore
                  * a bubble the pair said "message" twice and gave no way to
                  * tell which one opened what. This one is a stack of things;
                  * that one is a thing being said.
                  */}
                <Icon name="layers" size={16} />
              </button>
            )}
          </aside>
        )}

        <aside
          className={`${styles.conversation} ${zones.conversationOpen ? '' : styles.conversationRail} ${
            zones.mobileTab === 'chat' ? styles.mobileActive : ''
          }`}
          aria-label="Conversation"
        >
          {zones.conversationOpen ? (
            <>
              <div className={styles.zoneHead}>
                <span className={styles.zoneLabel}>Conversation</span>
                <button
                  className={styles.zoneIcon}
                  onClick={onNew}
                  title="Start a new workspace"
                  aria-label="Start a new workspace"
                >
                  <Icon name="sparkle" size={14} />
                </button>
                <button
                  className={styles.zoneIcon}
                  onClick={() => update({ conversationOpen: false })}
                  title="Collapse the conversation"
                  aria-label="Collapse the conversation"
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
              <div className={styles.zoneBody}>{conversation}</div>
              {/* The meter sits under the conversation, where the composer is,
                  rather than in the header — it is about what is left to ask. */}
              {meter && <div className={styles.meterRow}>{meter}</div>}
            </>
          ) : (
            /* The rail keeps the zone reachable at 46px rather than removing it,
               so reopening is one click and not a hunt through a menu. */
            <button
              className={styles.railButton}
              onClick={() => update({ conversationOpen: true })}
              title="Open the conversation"
              aria-label="Open the conversation"
            >
              <Icon name="bubble" size={16} />
            </button>
          )}
        </aside>

        <main
          className={`${styles.canvas} ${zones.mobileTab === 'canvas' ? styles.mobileActive : ''} ${
            cta ? styles.canvasWithCta : ''
          }`}
          aria-label="Canvas"
        >
          <div className={styles.canvasColumn}>{canvas}</div>
        </main>

        {/*
          The scrim exists only when the inspector is an overlay. On a wide
          screen the inspector is a column and nothing should be dimmed behind
          it.
        */}
        {inspectorAsOverlay && (
          <button
            className={styles.scrim}
            onClick={() => update({ inspectorOpen: false })}
            aria-label="Close the context panel"
          />
        )}

        <aside
          className={`${styles.inspector} ${zones.inspectorOpen ? styles.inspectorOpen : ''} ${
            inspectorAsOverlay ? styles.inspectorOverlay : ''
          } ${
            zones.mobileTab === 'context' || zones.mobileTab === 'sources'
              ? styles.mobileActive
              : ''
          }`}
          aria-label="Context and sources"
        >
          <div className={styles.zoneHead}>
            <span className={styles.zoneLabel}>Context</span>
            <span className={styles.spacer} />
            <button
              className={styles.zoneIcon}
              onClick={() => update({ inspectorOpen: false })}
              title="Close the context panel"
              aria-label="Close the context panel"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
          <div className={styles.zoneBody}>{inspector}</div>
        </aside>
      </div>

      {confirmation}
      {library}
      {modal}
      {cta}

      {/*
        A notice, not a toast that vanishes: it says what was applied and how to
        reverse it, which somebody may want to read twice.
      */}
      {notice && (
        <div className={styles.notice} role="status">
          <span>{notice}</span>
          <button
            className={styles.noticeClose}
            onClick={onDismissNotice}
            aria-label="Dismiss"
            title="Dismiss"
          >
            <Icon name="close" size={13} />
          </button>
        </div>
      )}

      {/*
        The phone tab bar. Rendered at every width and hidden above the
        breakpoint by CSS, for the same reason the zones are: a width read
        during render is a width the server does not have.
      */}
      <nav className={styles.tabBar} aria-label="Workspace zones">
        {MOBILE_TABS.map((tab: MobileTab) => (
          <button
            key={tab}
            className={`${styles.tab} ${zones.mobileTab === tab ? styles.tabOn : ''}`}
            aria-pressed={zones.mobileTab === tab}
            onClick={() => update({ mobileTab: tab, inspectorOpen: tab !== 'canvas' })}
          >
            {MOBILE_TAB_LABEL[tab]}
          </button>
        ))}
      </nav>
    </div>
  );
}
