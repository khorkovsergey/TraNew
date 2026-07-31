'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import type {
  VoyagerAnswer,
  VoyagerContext,
  VoyagerResponse,
  VoyagerSource,
  VoyagerTier,
} from '@/lib/voyager/types';
import { routeFor } from './actionRoutes';
import { VoyagerMark } from './VoyagerMark';
import { useVoyagerContext } from './VoyagerProvider';
import styles from './Voyager.module.css';

/**
 * The Voyager widget — one component, four states, present on every page.
 *
 * It knows almost nothing on its own. Tier, sources and limits are fetched from
 * the server, because a widget that decided its own entitlements would be
 * deciding who may read a wealth record. What it owns is the conversation and
 * which sources the person switched off.
 */

type Turn =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; answer: VoyagerAnswer };

type State = {
  tier: VoyagerTier;
  tierLabel: string;
  limits: string;
  sources: VoyagerSource[];
  remaining: number | null;
  signedIn: boolean;
  personalization: boolean | null;
};

const TIER_STYLE: Record<VoyagerTier, { background: string; color: string }> = {
  basic: { background: '#f0f2f7', color: '#8a93a6' },
  personal: { background: '#e8edfd', color: '#2962ff' },
  private: { background: '#efe9fd', color: '#7c4dff' },
};

const STARTERS = [
  { label: 'Ask about this page', question: 'What can I do on this page?' },
  { label: 'Find a tool or feature', question: 'Find a tool for me' },
  { label: 'Tell me what you want to achieve', question: 'I want to plan my investments' },
];


export function VoyagerWidget() {
  const context = useVoyagerContext();
  const router = useRouter();

  const [mode, setMode] = useState<'collapsed' | 'peek' | 'panel'>('collapsed');
  const [full, setFull] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [disabled, setDisabled] = useState<string[]>([]);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [state, setState] = useState<State | null>(null);
  const [draft, setDraft] = useState('');

  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // The server owns tier, sources and limits; refetch when the page changes so the
  // "Using:" line always describes the page the person is actually looking at.
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ screen: context.screen, subject: context.subject });

    fetch(`/api/voyager?${params}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: State | null) => {
        if (!cancelled && data) setState(data);
      })
      .catch(() => {
        /* The widget still works without it — it just shows no source list. */
      });

    return () => {
      cancelled = true;
    };
  }, [context.screen, context.subject]);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [turns, busy]);

  useEffect(() => {
    if (mode === 'panel') inputRef.current?.focus();
  }, [mode]);

  // Escape closes the panel — a fixed overlay that traps people is a bad overlay.
  useEffect(() => {
    if (mode === 'collapsed') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMode('collapsed');
        setSourcesOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  const ask = useCallback(
    async (question: string, currentContext: VoyagerContext) => {
      setMode('panel');
      setBusy(true);
      setTurns((prev) => [...prev, { role: 'user', text: question }]);

      try {
        const response = await fetch('/api/voyager', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question,
            context: currentContext,
            disabledSources: disabled,
            history: turns.map((turn) => ({ role: turn.role, text: turn.text })),
          }),
        });

        if (!response.ok) throw new Error(`Voyager responded ${response.status}`);
        const data = (await response.json()) as VoyagerResponse;

        setTurns((prev) => [
          ...prev,
          { role: 'assistant', text: data.answer.text, answer: data.answer },
        ]);
        setState((prev) => (prev ? { ...prev, remaining: data.remaining, tier: data.tier } : prev));
      } catch {
        setTurns((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: 'I could not reach my analysis service just now. Try again in a moment.',
            answer: {
              contentType: 'AI explanation',
              text: 'I could not reach my analysis service just now. Try again in a moment.',
              bullets: [],
              sources: '',
              confidence: 'low',
              actions: [],
              followUps: [],
            },
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [disabled, turns]
  );

  const submit = () => {
    const value = draft.trim();
    if (!value || busy) return;
    setDraft('');
    void ask(value, context);
  };

  const setPersonalization = async (granted: boolean) => {
    setState((prev) => (prev ? { ...prev, personalization: granted } : prev));
    await fetch('/api/voyager/personalization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ granted }),
    }).catch(() => {
      /* The answer to the question is what matters; a failed write retries next time. */
    });
  };

  const runAction = (actionId: Parameters<typeof routeFor>[0], label: string) => {
    const target = routeFor(actionId, context);
    if (!target) {
      void ask(label, context);
      return;
    }
    setMode('collapsed');
    router.push(target as never);
  };

  const activeSources = (state?.sources ?? []).filter((source) => !disabled.includes(source.id));
  const usingLine =
    activeSources.length === 0
      ? 'No context — general answers only'
      : activeSources.map((source) => source.label.split(':')[0].split(' (')[0]).join(' + ');

  const tierStyle = TIER_STYLE[state?.tier ?? 'basic'];
  const firstRun = turns.length === 0;

  /* -------------------------------------------------------------- Collapsed */

  if (mode === 'collapsed') {
    return (
      <button className={styles.pill} onClick={() => setMode('peek')}>
        <VoyagerMark size={28} className={styles.mark} />
        <span className={styles.pillLabel}>{context.prompt}</span>
      </button>
    );
  }

  /* ------------------------------------------------------------------- Peek */

  if (mode === 'peek') {
    return (
      <>
        <button
          className={styles.scrim}
          onClick={() => setMode('collapsed')}
          aria-label="Close Voyager"
        />
        <div className={styles.peek}>
          <div className={styles.peekHead}>
            <VoyagerMark size={26} className={styles.mark} />
            <span className={styles.nameSmall}>Voyager</span>
            <span className={styles.tier} style={tierStyle}>
              {state?.tierLabel ?? 'Voyager Basic'}
            </span>
          </div>
          <div className={styles.peekQuick}>
            {context.quick.slice(0, 4).map((question) => (
              <button
                key={question}
                className={styles.quick}
                onClick={() => void ask(question, context)}
              >
                {question}
              </button>
            ))}
          </div>
          <button className={styles.openPanel} onClick={() => setMode('panel')}>
            Open Voyager
          </button>
        </div>
      </>
    );
  }

  /* ------------------------------------------------------------------ Panel */

  return (
    <aside
      className={`${styles.panel} ${full ? styles.panelFull : ''}`}
      aria-label="Voyager assistant"
    >
      <div className={styles.head}>
        <VoyagerMark size={28} className={styles.mark} />
        <span className={styles.name}>Voyager</span>
        <span className={styles.tier} style={tierStyle}>
          {state?.tierLabel ?? 'Voyager Basic'}
        </span>
        <div className={styles.spacer} />
        <button className={styles.fullToggle} onClick={() => setFull((value) => !value)}>
          {full ? 'Side panel' : 'Full workspace'}
        </button>
        <button
          className={styles.close}
          onClick={() => {
            setMode('collapsed');
            setSourcesOpen(false);
          }}
          aria-label="Close Voyager"
        >
          ✕
        </button>
      </div>

      <button
        className={styles.sourceRow}
        onClick={() => setSourcesOpen((value) => !value)}
        aria-expanded={sourcesOpen}
      >
        <span
          className={`${styles.dot} ${activeSources.length === 0 ? styles.dotOff : ''}`}
          aria-hidden="true"
        />
        <span className={styles.using}>Using: {usingLine}</span>
        <span className={styles.manage}>manage ▾</span>
      </button>

      {sourcesOpen && (
        <div className={styles.sourceList}>
          {(state?.sources ?? []).map((source) => {
            const off = disabled.includes(source.id);
            return (
              <button
                key={source.id}
                className={`${styles.sourceToggle} ${off ? styles.sourceToggleOff : ''}`}
                onClick={() =>
                  setDisabled((prev) =>
                    off ? prev.filter((id) => id !== source.id) : [...prev, source.id]
                  )
                }
                aria-pressed={!off}
              >
                <span className={`${styles.box} ${off ? styles.boxOff : ''}`} aria-hidden="true">
                  {!off && (
                    <svg
                      width="9"
                      height="9"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </span>
                {source.label}
              </button>
            );
          })}
          <div className={styles.sourceNote}>
            Sources you switch off are not sent with your questions.
          </div>
        </div>
      )}

      <div className={styles.thread} ref={threadRef}>
        {firstRun && (
          <>
            <div className={styles.intro}>
              <div className={styles.introText}>
                I can help you understand markets, use the platform and make better-informed
                investment decisions.
              </div>
              {state?.signedIn && state.personalization === null && (
                <>
                  <div className={styles.persText}>
                    To personalize my answers, I can use your goals, watchlist and activity. You
                    remain in control of what is shared.
                  </div>
                  <div className={styles.persRow}>
                    <button
                      className={styles.persAllow}
                      onClick={() => void setPersonalization(true)}
                    >
                      Allow personalization
                    </button>
                    <button
                      className={styles.persDeny}
                      onClick={() => void setPersonalization(false)}
                    >
                      Use without personalization
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className={styles.starters}>
              {STARTERS.map((starter) => (
                <button
                  key={starter.label}
                  className={styles.starter}
                  onClick={() => void ask(starter.question, context)}
                >
                  {starter.label}
                </button>
              ))}
            </div>
          </>
        )}

        {turns.map((turn, index) =>
          turn.role === 'user' ? (
            <div key={index} className={`${styles.turn} ${styles.turnUser}`}>
              <div className={styles.userBubble}>{turn.text}</div>
            </div>
          ) : (
            <div key={index} className={`${styles.turn} ${styles.turnBot}`}>
              <div className={styles.botBubble}>
                <span
                  className={`${styles.badge} ${
                    turn.answer.contentType === 'Academy context' ? styles.badgeAcademy : ''
                  }`}
                >
                  {turn.answer.contentType}
                </span>
                <div className={styles.botText}>{turn.answer.text}</div>

                {turn.answer.bullets.length > 0 && (
                  <div className={styles.bullets}>
                    {turn.answer.bullets.map((bullet, bulletIndex) => (
                      <div key={bulletIndex} className={styles.bullet}>
                        <span className={styles.bulletMark}>•</span>
                        {bullet}
                      </div>
                    ))}
                  </div>
                )}

                {turn.answer.sources && (
                  <div className={styles.sources}>
                    Sources: {turn.answer.sources} · Confidence: {turn.answer.confidence}
                    {turn.answer.simulated ? ' · simulated answer' : ''}
                  </div>
                )}

                {turn.answer.actions.length > 0 && (
                  <div className={styles.actions}>
                    {turn.answer.actions.map((action, actionIndex) => (
                      <button
                        key={actionIndex}
                        className={`${styles.action} ${
                          action.primary ? styles.actionPrimary : ''
                        }`}
                        onClick={() => runAction(action.action, action.label)}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}

                {turn.answer.upgrade && (
                  <div className={styles.upgrade}>
                    <div className={styles.upgradeText}>{turn.answer.upgrade.text}</div>
                    <div className={styles.upgradeRow}>
                      <button
                        className={styles.upgradeCta}
                        onClick={() => {
                          setMode('collapsed');
                          router.push(
                            turn.answer.upgrade!.intent === 'sign_up'
                              ? '/sign-up'
                              : '/account/settings'
                          );
                        }}
                      >
                        {turn.answer.upgrade.cta}
                      </button>
                      <button className={styles.upgradeSkip} onClick={() => {}}>
                        Continue with general guidance
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {busy && (
          <div className={styles.thinking} aria-live="polite">
            <span className={styles.thinkingDot} />
            <span className={styles.thinkingDot} />
            <span className={styles.thinkingDot} />
            Thinking…
          </div>
        )}

        {!busy && !firstRun && lastFollowUps(turns).length > 0 && (
          <div className={styles.followUps}>
            {lastFollowUps(turns).map((question) => (
              <button
                key={question}
                className={styles.followUp}
                onClick={() => void ask(question, context)}
              >
                {question}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.inputRow}>
        <input
          ref={inputRef}
          className={styles.input}
          value={draft}
          placeholder={`Ask about ${context.subject}…`}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit();
          }}
          aria-label={`Ask Voyager about ${context.subject}`}
        />
        {/* Dimmed only while a question is in flight — an empty field is not an
            error state, and a permanently greyed button reads as broken. */}
        <button className={styles.send} onClick={submit} disabled={busy} aria-label="Send">
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className={styles.limits}>
        {state?.limits ?? 'Basic: limited questions per day, public data only'} · Not investment
        advice — decisions are yours.
      </div>
    </aside>
  );
}

function lastFollowUps(turns: Turn[]): string[] {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (turn.role === 'assistant') return turn.answer.followUps;
  }
  return [];
}
