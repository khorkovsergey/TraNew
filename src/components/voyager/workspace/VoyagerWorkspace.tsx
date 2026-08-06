'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Link } from '@/i18n/navigation';
import { VoyagerOrb } from '@/components/voyager/VoyagerOrb';
import {
  briefingFor,
  PROMPT_CATEGORIES,
  STARTERS,
  type Briefing,
} from '@/lib/voyager/workspace/landing';
import { takeDraft } from '@/components/voyager/AskEntry';
import { GENERIC_CONTEXT } from '@/lib/voyager/context';
import { contextLabel, parseContext } from '@/lib/voyager/session';
import type { VoyagerAnswer } from '@/lib/voyager/types';
import { conversationalPlan, failurePlan } from '@/lib/voyager/workspace/conversational';
import { parsePlan, type VoyagerModule, type VoyagerPlan } from '@/lib/voyager/workspace/contract';
import {
  advance,
  isRunning,
  START,
  statusFor,
  fail as failRun,
  FAILURES,
  stop as stopRun,
  type Run,
} from '@/lib/voyager/workspace/lifecycle';
import { responseFor } from '@/lib/voyager/workspace/scenarios';
import {
  applyAction,
  confirmationFor,
  undoAction,
  type Confirmation,
  type HistoryEntry,
} from '@/lib/voyager/workspace/actions';
import {
  parseLibrary,
  serializeLibrary,
  suggestName,
  upsert,
  WORKSPACE_STORAGE_KEY,
  type SavedWorkspace,
} from '@/lib/voyager/workspace/record';
import { saveLibraryAction } from '@/app/actions/voyagerWorkspace';
import { WorkspaceLibrary } from './WorkspaceLibrary';
import {
  capabilities,
  grantFrom,
  revoke as revokeGrant,
  SCOPES,
  statusLabel as wealthStatusLabel,
  type Grant,
} from '@/lib/voyager/workspace/scopes';
import {
  allowanceFor,
  canAsk,
  meterLabel,
  meterState,
  PLANS,
  SIGNUP_PERKS,
  SIGNUP_TOKENS,
} from '@/lib/voyager/workspace/credits';
import { ModuleCard } from './ModuleCard';
import { WorkspaceShell } from './WorkspaceShell';
import styles from './VoyagerWorkspace.module.css';

/**
 * The AI Voyager workspace.
 *
 * The rule this screen exists to hold: **simple by default, complex only after
 * somebody asks for something.** With no request in flight the canvas is the
 * only zone that renders — no conversation panel, no inspector, no toolbar, no
 * floating call to action. They are not hidden with CSS; they are not mounted.
 * That is what makes the transition from a bare page to a working workspace
 * legible instead of feeling like a page that was busy all along.
 *
 * Phase 1 builds the landing and the transition out of it. The zones it
 * transitions *into* arrive in Phase 2, and until then the workspace stage says
 * plainly what is not built yet rather than showing an empty frame that looks
 * broken.
 */

type Stage = 'landing' | 'requested';

type Props = {
  /** From the session on the server; the prototype's persona switch is not product. */
  personName: string | null;
  /**
   * A question carried in from elsewhere — the home page's Ask Voyager box.
   *
   * It seeds the composer and nothing else. Sending it automatically would mean
   * a link could put words in somebody's mouth, and the state it would have to
   * set is the state of an answer having been asked for.
   */
  seedQuestion?: string | null;
  /** `symbol:TSLA`, `explore:bonds` — the page the question came from. */
  pageContext?: string | null;
};

/**
 * The answer to a question that arrived in the URL, computed rather than sent.
 *
 * It used to only pre-fill the composer, on the argument that a link should not
 * be able to ask something on somebody's behalf. That was the wrong trade: the
 * chips on the home page promise an answer and delivered a text box, and every
 * one of them dead-ended. The protection is kept by a different means — the
 * answer opens with "You asked" and the question verbatim, so nothing is put in
 * a person's mouth out of sight.
 *
 * Built in the initialiser rather than an effect, so the answer is in the first
 * render — including the server's — instead of arriving after a blank landing.
 */
function seeded(question: string | null) {
  const trimmed = question?.trim();
  if (!trimmed) return null;

  const parsed = parsePlan(responseFor(trimmed));
  return {
    request: trimmed,
    plan: parsed?.plan ?? null,
    refusals: parsed?.refusals ?? [],
    name: suggestName(trimmed),
  };
}

export function VoyagerWorkspace({
  personName,
  seedQuestion = null,
  pageContext = null,
}: Props) {
  /*
   * A question typed on another page arrives through storage rather than the
   * URL, and is consumed on read: a draft that survived being sent would be
   * re-sent on the next visit, and a question asked twice is a question the
   * person did not ask.
   */
  const opening = useMemo(
    () => seeded(seedQuestion ?? (typeof window === 'undefined' ? null : takeDraft())),
    [seedQuestion]
  );

  const context = useMemo(() => parseContext(pageContext), [pageContext]);

  const [stage, setStage] = useState<Stage>(opening ? 'requested' : 'landing');
  const [request, setRequest] = useState(opening?.request ?? '');
  const [draft, setDraft] = useState('');
  const [showCategories, setShowCategories] = useState(false);
  const [plan, setPlan] = useState<VoyagerPlan | null>(opening?.plan ?? null);
  const [refusals, setRefusals] = useState<string[]>(opening?.refusals ?? []);
  const [run, setRun] = useState<Run>(START);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  /** The change waiting to be accepted. Nothing happens while this is set. */
  const [pending, setPending] = useState<Confirmation | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedWorkspace[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [name, setName] = useState<string | null>(opening?.name ?? null);
  /*
   * The grant for this workspace. Null means nothing has been shared, which is
   * the state every workspace starts in and returns to on New.
   */
  const [grant, setGrant] = useState<Grant | null>(null);
  const [ticked, setTicked] = useState<string[]>([]);
  // The seeded question counts as asked; it produced an answer.
  const [asked, setAsked] = useState(opening ? 1 : 0);
  const [ctaDismissed, setCtaDismissed] = useState(false);
  /** Waiting on the model. The canvas says so rather than showing an empty plan. */
  const [asking, setAsking] = useState(false);
  /** The request already sent to the model, so it is never sent twice. */
  const askingRef = useRef<string | null>(null);
  const [modal, setModal] = useState<'signup' | 'plans' | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);

  /*
   * The hour is read when a request starts, not during render.
   *
   * A greeting computed in the render body is an impure call that the server
   * and the browser can disagree about — the server says "Good morning" at
   * 11:59 and hydration says "Good afternoon" a second later, and React
   * replaces the tree. Held in state, set once.
   */
  const [briefing] = useState<Briefing | null>(() =>
    personName ? briefingFor(personName, new Date().getHours()) : null
  );

  /**
   * One call to the API the widget already uses. History is not sent yet — the
   * canvas keeps a plan rather than a transcript, and inventing turns to fill
   * the field would tell the model a conversation happened that did not.
   */
  const askModel = useCallback(async (question: string) => {
    /*
     * A bounded wait.
     *
     * Without it a request that never returns leaves the canvas saying "asking"
     * for as long as the tab is open, which is the worst of the failure states:
     * it looks like the product is working. Forty seconds is longer than a slow
     * answer and shorter than anybody's patience.
     */
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 40_000);

    try {
      const response = await fetch('/api/voyager', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question,
          context: GENERIC_CONTEXT,
          disabledSources: [],
          history: [],
        }),
        signal: abort.signal,
      });

      if (!response.ok) throw new Error(`voyager ${response.status}`);

      const payload = (await response.json()) as { answer?: VoyagerAnswer };
      if (!payload.answer?.text) throw new Error('empty answer');

      return conversationalPlan(question, payload.answer, new Date().toISOString());
    } finally {
      clearTimeout(timer);
    }
  }, []);

  const send = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    /*
     * The response goes through `parsePlan` here, exactly as a model response
     * will. Nothing downstream sees a shape that has not been through the gate,
     * and a scenario that produced something unrenderable is refused rather
     * than half-drawn.
     */
    /*
     * The count is checked, and the first request passes whatever it says.
     * Somebody arriving with a spent allowance still gets to see what this does
     * before being asked for anything.
     */
    const allowance = allowanceFor(personName ? 'free' : 'guest', asked);
    if (!canAsk(allowance, asked === 0)) {
      setNotice('That is the last of the free messages. An account adds 3 000 tokens.');
      setModal('signup');
      return;
    }

    setAsked((count) => count + 1);

    /*
     * A failure anybody can reach.
     *
     * Written as a routed request rather than left to a network fault, because
     * the failure states are part of the design and cannot be reviewed if the
     * only way to see one is to unplug something.
     */
    const forced = /\bfail\b|\bbreak\b/.test(trimmed.toLowerCase())
      ? FAILURES.provider
      : /\beverything\b.*\bcompan/.test(trimmed.toLowerCase())
        ? FAILURES.tooBroad
        : null;

    const parsed = parsePlan(responseFor(trimmed));

    setRequest(trimmed);
    setStage('requested');
    setDraft('');
    // Named on arrival, from the request, and marked as a suggestion until
    // somebody renames it.
    setName(suggestName(trimmed));
    setPlan(parsed?.plan ?? null);
    setRefusals(parsed?.refusals ?? []);
    setRun(forced ? failRun(START, forced) : START);
  }, [asked, personName]);

  /*
   * The clock lives here and the rules live in `lifecycle.ts`.
   *
   * Splitting them is what lets the sequence be tested without waiting: the
   * component decides when to step, the module decides what stepping means.
   */
  /*
   * A request with no built analysis behind it goes to the model.
   *
   * An effect rather than a branch inside `send`, because a question can also
   * arrive already asked — from the home page, a chip, or a link with `?q=` —
   * and that path builds its opening state in an initialiser and never passes
   * through `send` at all. Both routes end here.
   */
  useEffect(() => {
    if (stage !== 'requested' || plan || !request) return;
    /*
     * The guard is a ref, not state.
     *
     * With `asking` in the dependency array, setting it re-ran the effect, and
     * the cleanup from the previous run cancelled the request that had just
     * been sent — the fetch completed and its answer was thrown away, so the
     * canvas sat empty forever. A ref changes without re-running anything.
     */
    if (askingRef.current === request) return;
    askingRef.current = request;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAsking(true);

    askModel(request)
      .then((next) => setPlan(parsePlan(next)?.plan ?? null))
      .catch(() =>
        setPlan(parsePlan(failurePlan(request, new Date().toISOString()))?.plan ?? null)
      )
      .finally(() => setAsking(false));
  }, [stage, plan, request, askModel]);

  /*
   * The library, restored once. Through the parser, like everything else read
   * back out of a browser.
   */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (!raw) return;
      const restored = parseLibrary(JSON.parse(raw));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (restored) setSaved(restored);
    } catch {
      /* Unreadable storage means an empty library, which is recoverable. */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback((next: SavedWorkspace[]) => {
    setSaved(next);

    /*
     * The browser copy is written first and unconditionally: it is what makes
     * the library survive a reload for somebody who is not signed in, and it
     * must not depend on a request succeeding.
     */
    try {
      localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(serializeLibrary(next)));
    } catch {
      /* Private mode. The account copy below may still work. */
    }

    void saveLibraryAction({ library: serializeLibrary(next) }).catch(() => null);
  }, []);

  const saveWorkspace = useCallback(() => {
    if (!plan || !request) return;

    const at = new Date().toISOString();
    persist(
      upsert(saved, {
        id: `ws_${request.length}_${at.slice(0, 19)}`,
        name: name ?? suggestName(request),
        autoNamed: true,
        kind:
          plan.mode === 'screen'
            ? 'screener'
            : plan.mode === 'build'
              ? 'chart'
              : plan.mode === 'monitor'
                ? 'wealth'
                : 'research',
        request,
        summary: `${plan.modules.length} modules · ${plan.sources.length} sources`,
        pinned: false,
        createdAt: at,
        updatedAt: at,
      })
    );

    setNotice('Saved to your workspaces.');
  }, [plan, request, name, saved, persist]);

  useEffect(() => {
    if (!plan || !isRunning(run)) return;

    const pause = run.stage === 'understanding' ? 500 : run.stage === 'planning' ? 420 : 320;
    const timer = setTimeout(() => setRun((current) => advance(current, plan)), pause);
    return () => clearTimeout(timer);
  }, [plan, run]);

  /** "New" returns to the bare screen, which is the other half of the rule. */
  const reset = useCallback(() => {
    setStage('landing');
    setRequest('');
    setDraft('');
    setShowCategories(false);
    setPlan(null);
    setRefusals([]);
    setRun(START);
    setHistory([]);
    setPending(null);
    setNotice(null);
    setName(null);
    // A grant is for one workspace. Starting a new one starts with nothing
    // shared, rather than carrying a decision into a question it was not made
    // about.
    setGrant(null);
    setTicked([]);
  }, []);

  /*
   * Actions are declared by the module and resolved against a closed set.
   *
   * Nothing is inferred from a label, and a mutating action stops here for a
   * confirmation rather than doing anything.
   */
  const onAction = useCallback((module: VoyagerModule, actionId: string) => {
    const outcome = confirmationFor(module, actionId);

    if ('refused' in outcome) {
      setNotice(outcome.refused);
      return;
    }

    if ('navigate' in outcome) {
      setNotice(`${outcome.navigate.title} — ${outcome.navigate.where}.`);
      return;
    }

    setPending(outcome.confirmation);
  }, []);

  const accept = useCallback(() => {
    if (!pending) return;

    /*
     * Granting is not a generic action: it produces a scoped, workspace-bound
     * grant rather than an entry that merely says permission was given.
     */
    if (pending.action.id === 'grant') {
      const at = new Date().toISOString();
      setGrant(grantFrom(`ws_${request.length}`, ticked, at));
      setHistory((current) => applyAction(current, pending, at));
      setNotice('Shared for this workspace only. Revoke it in the context panel at any time.');
      setPending(null);
      return;
    }

    setHistory((current) => applyAction(current, pending, new Date().toISOString()));
    setNotice(`Applied. ${pending.action.undo}`);
    setPending(null);
  }, [pending, request, ticked]);

  const undo = useCallback((entryId: string) => {
    setHistory((current) => undoAction(current, entryId));
    setNotice('Undone. The record of it stays in the history.');
  }, []);

  if (stage === 'requested') {
    /*
     * The zones exist; what goes inside them does not yet. Each says which
     * phase brings it rather than showing a convincing empty frame — an empty
     * panel that looks finished is harder to judge than one that says what it
     * is waiting for.
     */
    return (
      <WorkspaceShell
        workspaceName={name ?? 'New workspace'}
        autoNamed
        onNew={reset}
        conversation={
          <div className={styles.turn}>
            <p className={styles.userBubble}>{request}</p>

            {/*
              The follow-up composer.
              *
              * Without it a workspace answers one question and then has to be
              * thrown away to ask another, which is not a conversation. Same
              * control as the landing, sized for a 348px column.
            */}
            <form
              className={styles.followUpForm}
              onSubmit={(event) => {
                event.preventDefault();
                send(draft);
              }}
            >
              <textarea
                className={styles.followUpInput}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    send(draft);
                  }
                }}
                rows={1}
                placeholder="Ask something else"
                aria-label="Ask Voyager"
              />
              <button
                type="submit"
                className={styles.composerSend}
                title="Send"
                aria-label="Send"
                disabled={!draft.trim()}
              >
                <Icon name="arrowRight" size={15} />
              </button>
            </form>

            {plan ? (
              <>
                <span className={styles.modeChip}>
                  {plan.mode} — {plan.because}
                </span>

                <div className={styles.planCard}>
                  <div className={styles.planHead}>
                    <span className={styles.planStatus}>{statusFor(run, plan)}</span>
                    {isRunning(run) && <span className={styles.spinner} aria-hidden="true" />}
                  </div>

                  <ol className={styles.planSteps}>
                    {plan.steps.map((step, index) => (
                      <li
                        key={step}
                        className={`${styles.planStep} ${
                          run.revealed > 0 || run.stage === 'complete' || index < 2
                            ? styles.planStepDone
                            : ''
                        }`}
                      >
                        {step}
                      </li>
                    ))}
                  </ol>

                  {/* Work items, named. What was done — never the reasoning
                      that chose to do it. */}
                  {run.stage === 'working' && (
                    <ul className={styles.workList}>
                      {plan.work.map((item, index) => (
                        <li
                          key={item.id}
                          className={index <= run.workIndex ? styles.workDone : styles.workPending}
                        >
                          {item.label}
                        </li>
                      ))}
                    </ul>
                  )}

                  {isRunning(run) && (
                    <button
                      className={styles.stopButton}
                      onClick={() => setRun((current) => stopRun(current))}
                    >
                      Stop and keep what is ready
                    </button>
                  )}

                  {/*
                    A failure names its cause and offers the way out. Keeping
                    whatever was already built: half an answer with an
                    explanation beats an empty canvas with the same explanation.
                  */}
                  {run.stage === 'failed' && run.failure && (
                    <div className={styles.failureCard} role="alert">
                      <p className={styles.failureCause}>{run.failure.cause}</p>
                      <p className={styles.failureRecovery}>{run.failure.recovery}</p>
                      <button
                        className={styles.stopButton}
                        onClick={() => {
                          if (run.failure?.action === 'connect') {
                            setNotice('Connect the Wealth Hub from the context panel.');
                            return;
                          }
                          send(request);
                        }}
                      >
                        {run.failure.action === 'retry'
                          ? 'Try again'
                          : run.failure.action === 'narrow'
                            ? 'Add a constraint and run again'
                            : run.failure.action === 'connect'
                              ? 'Connect the Wealth Hub'
                              : 'Sign in'}
                      </button>
                    </div>
                  )}
                </div>

                {refusals.length > 0 && (
                  <div className={styles.refusalCard} role="status">
                    {refusals.map((refusal, index) => (
                      <p key={index}>{refusal}</p>
                    ))}
                  </div>
                )}
              </>
            ) : asking ? null : (
              /*
               * Only reachable if the model neither answered nor failed, which
               * the effect does not allow — kept as the honest thing to say if
               * it ever happens rather than the old copy, which claimed the
               * scenario was unwritten and was shown for several seconds every
               * time the model was simply being asked.
               */
              <div className={styles.refusalCard} role="status">
                <p>Nothing came back for that. Try asking again.</p>
              </div>
            )}
          </div>
        }
        canvas={
          plan ? (
            <>
              {plan.modules.slice(0, run.revealed).map((module) => (
                <ModuleCard
                  key={module.id}
                  module={module}
                  sources={plan.sources}
                  onAction={onAction}
                  scopeState={module.kind === 'permission-request' ? { ticked, setTicked } : undefined}
                />
              ))}

              {run.revealed === 0 && (
                <p className={styles.zoneStubNote}>{statusFor(run, plan)}</p>
              )}
            </>
          ) : (
            <p className={styles.zoneStubNote} role="status">
              {asking ? 'Asking Voyager…' : 'Nothing to build for this request yet.'}
            </p>
          )
        }
        inspector={
          plan ? (
            <>
              <div className={styles.inspectorSection}>
                <h4 className={styles.inspectorLabel}>Context in use</h4>
                <p className={styles.zoneStubNote}>
                  {request}
                </p>
              </div>

              <div className={styles.inspectorSection}>
                <h4 className={styles.inspectorLabel}>Sources and timestamps</h4>
                <ul className={styles.sourceList}>
                  {plan.sources.map((source) => (
                    <li key={source.id}>
                      <span>
                        <strong>{source.kind}</strong> · {source.provider} ·{' '}
                        {source.at.slice(0, 16).replace('T', ' ')} UTC
                        {source.delayed && ' · delayed'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={styles.inspectorSection}>
                <h4 className={styles.inspectorLabel}>Assumptions</h4>
                {plan.assumptions.map((assumption) => (
                  <div key={assumption.id} className={styles.assumptionRow}>
                    <span>{assumption.label}</span>
                    <span className={styles.assumptionValue}>{assumption.value}</span>
                  </div>
                ))}
                <p className={styles.zoneStubNote}>
                  {/* A note to the team that shipped to the reader. What it
                      said stopped being true, and "phase 4" was never a thing
                      anybody outside this repository could interpret. */}
                  These are the assumptions the answer rests on. Changing one re-runs the
                  result.
                </p>
              </div>

              <div className={styles.inspectorSection}>
                <h4 className={styles.inspectorLabel}>Wealth Hub</h4>
                <p className={styles.wealthStatus}>
                  {wealthStatusLabel(
                    grant ? (grant.revokedAt ? 'revoked' : 'granted') : 'not-connected'
                  )}
                </p>

                {grant && !grant.revokedAt ? (
                  <>
                    <ul className={styles.scopeSummary}>
                      {SCOPES.filter((scope) => grant.scopes.includes(scope.id)).map((scope) => (
                        <li key={scope.id}>{scope.label}</li>
                      ))}
                    </ul>

                    <p className={styles.zoneStubNote}>
                      {capabilities(grant.scopes).cannot.length === 0
                        ? 'Everything the analysis can use is shared.'
                        : `Not shared: ${capabilities(grant.scopes).cannot.join('; ')}.`}
                    </p>

                    {/* One click, and it takes effect immediately. */}
                    <button
                      className={styles.revokeButton}
                      onClick={() => {
                        setGrant((current) =>
                          current ? revokeGrant(current, new Date().toISOString()) : current
                        );
                        setNotice('Revoked. Nothing further is read, and nothing read was kept.');
                      }}
                    >
                      Revoke access
                    </button>
                  </>
                ) : (
                  <p className={styles.zoneStubNote}>
                    Nothing from your wealth record has been read. A question that needs it will
                    ask first, and name exactly what it wants.
                  </p>
                )}
              </div>

              <div className={styles.inspectorSection}>
                <h4 className={styles.inspectorLabel}>Workspace history</h4>
                {history.length === 0 ? (
                  <p className={styles.zoneStubNote}>
                    Nothing has been changed outside this canvas.
                  </p>
                ) : (
                  history.map((entry) => (
                    <div key={entry.id} className={styles.historyRow}>
                      <span className={styles.historyTitle}>
                        {entry.title}
                        {!entry.active && <span className={styles.historyUndone}> · undone</span>}
                      </span>
                      <span className={styles.historyWhere}>
                        {entry.where} · {entry.at.slice(11, 16)} UTC
                      </span>
                      {entry.active && (
                        <button className={styles.historyUndo} onClick={() => undo(entry.id)}>
                          Undo
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Standing, on every workspace, not shown once and dismissed. */}
              <p className={styles.standingNote}>
                This is educational analysis, not personalised advice.
              </p>
            </>
          ) : (
            <p className={styles.zoneStubNote}>No context yet.</p>
          )
        }
        confirmation={
          pending && (
            /*
             * The gate. It states what changes, where, and what it costs —
             * built from the action rather than from the label that offered it,
             * so a button cannot describe itself more kindly than it behaves.
             */
            <div className={styles.confirmScrim} role="dialog" aria-modal="true" aria-label="Confirm this change">
              <div className={styles.confirmCard}>
                <h3 className={styles.confirmTitle}>{pending.action.title}</h3>
                <p className={styles.confirmWhere}>{pending.action.where}</p>
                <p className={styles.confirmCaveat}>{pending.action.caveat}</p>
                <p className={styles.confirmUndo}>{pending.action.undo}</p>

                <div className={styles.confirmActions}>
                  <button className={styles.primaryAction} onClick={accept}>
                    Apply
                  </button>
                  <button className={styles.topAction} onClick={() => setPending(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )
        }
        library={
          libraryOpen && (
            <WorkspaceLibrary
              workspaces={saved}
              onChange={persist}
              onOpen={(workspace) => {
                setLibraryOpen(false);
                send(workspace.request);
              }}
              onClose={() => setLibraryOpen(false)}
            />
          )
        }
        onOpenLibrary={() => setLibraryOpen(true)}
        onSave={saveWorkspace}
        meter={
          <button
            className={`${styles.meter} ${
              meterState(allowanceFor(personName ? 'free' : 'guest', asked)) === 'low'
                ? styles.meterLow
                : ''
            }`}
            onClick={() => setModal('plans')}
            title="What each plan is for"
          >
            {meterLabel(allowanceFor(personName ? 'free' : 'guest', asked))}
          </button>
        }
        cta={
          /*
           * Only for guests, and only until it is dismissed. The canvas reserves
           * matching space below, so this never covers the last card — nothing
           * floats over content without an allowance for it.
           */
          !personName && !ctaDismissed ? (
            <div className={styles.cta}>
              <span className={styles.ctaTile} aria-hidden="true">
                <Icon name="sparkle" size={15} />
              </span>
              <span className={styles.ctaText}>
                <strong>{SIGNUP_TOKENS.toLocaleString('en-US')} free tokens</strong>
                <span className={styles.ctaSub}>≈ 40 questions · no card required</span>
              </span>
              <button className={styles.ctaButton} onClick={() => setModal('signup')}>
                Sign up free
              </button>
              <button
                className={styles.noticeClose}
                onClick={() => setCtaDismissed(true)}
                title="Dismiss"
                aria-label="Dismiss"
              >
                <Icon name="close" size={13} />
              </button>
            </div>
          ) : null
        }
        modal={
          modal && (
            <div
              className={styles.confirmScrim}
              role="dialog"
              aria-modal="true"
              aria-label={modal === 'signup' ? 'Free account' : 'Plans'}
            >
              <div className={styles.libraryCard}>
                <header className={styles.libraryHead}>
                  <h2 className={styles.confirmTitle}>
                    {modal === 'signup'
                      ? `${SIGNUP_TOKENS.toLocaleString('en-US')} tokens with a free account`
                      : 'What each plan is for'}
                  </h2>
                  <span className={styles.spacer} />
                  <button
                    className={styles.noticeClose}
                    onClick={() => setModal(null)}
                    title="Close"
                    aria-label="Close"
                  >
                    <Icon name="close" size={14} />
                  </button>
                </header>

                {modal === 'signup' ? (
                  <>
                    <ul className={styles.perkList}>
                      {SIGNUP_PERKS.map((perk) => (
                        <li key={perk}>{perk}</li>
                      ))}
                    </ul>
                    <div className={styles.confirmActions}>
                      <Link className={styles.primaryLink} href="/sign-up">
                        Create a free account
                      </Link>
                      <Link className={styles.topAction} href="/sign-in">
                        I already have an account
                      </Link>
                    </div>
                  </>
                ) : (
                  <div className={styles.planGrid}>
                    {PLANS.map((offer) => (
                      <section key={offer.id} className={styles.planCardOffer}>
                        <h3 className={styles.planName}>
                          {offer.name}
                          <span className={styles.planPrice}>{offer.price}</span>
                        </h3>
                        {/* What it is for, before what it contains. */}
                        <p className={styles.planSummary}>{offer.summary}</p>
                        <ul className={styles.perkList}>
                          {offer.points.map((point) => (
                            <li key={point}>{point}</li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        }
        notice={notice}
        onDismissNotice={() => setNotice(null)}
      />
    );
  }

  return (
    <div className={styles.landing}>
      <div className={`${styles.column} ${showCategories ? styles.columnWide : ''}`}>
        {briefing ? (
          <>
            <VoyagerOrb size={42} />
            <h1 className={styles.greeting}>{briefing.greeting}</h1>
            <p className={styles.supporting}>{briefing.summary}</p>

            <div className={styles.briefingGrid}>
              {briefing.cards.map((card) => (
                <button
                  key={card.id}
                  className={styles.briefingCard}
                  onClick={() => send(card.title)}
                >
                  <span className={styles.briefingKind}>{card.kind}</span>
                  <span className={styles.briefingTitle}>{card.title}</span>
                  {/* Why this card is here. Required, not decorative. */}
                  <span className={styles.briefingWhy}>{card.because}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 className={styles.headline}>
              What would you like to understand, build or monitor?
            </h1>
            <p className={styles.supporting}>
              Ask a question, build a chart, analyse an asset or create a financial workspace.
              Voyager shows the data it used and asks before it changes anything.
            </p>

            {/*
              * What it can see, named. The value is parsed against a closed set
              * rather than echoed from the URL — a line that repeats whatever a
              * link put in it could be used to tell somebody their private data
              * is in the conversation.
              */}
            <p className={styles.contextLine}>Voyager sees: {contextLabel(context)}</p>
          </>
        )}

        <form
          className={styles.composer}
          onSubmit={(event) => {
            event.preventDefault();
            send(draft);
          }}
        >
          <textarea
            ref={composer}
            className={styles.composerInput}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends; Shift+Enter is a newline. A composer that needs a
              // mouse to submit is a composer people abandon mid-sentence.
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                send(draft);
              }
            }}
            rows={1}
            placeholder="Ask anything about markets, a company or your own plan"
            aria-label="Ask Voyager"
          />

          <button
            type="button"
            className={styles.composerIcon}
            title="Dictate (not built yet)"
            aria-label="Dictate — not built yet"
            disabled
          >
            <Icon name="bubble" size={17} />
          </button>
          <button
            type="button"
            className={styles.composerIcon}
            title="Attach a file (not built yet)"
            aria-label="Attach a file — not built yet"
            disabled
          >
            <Icon name="arrowUpRight" size={17} />
          </button>
          <button
            type="submit"
            className={styles.composerSend}
            title="Send"
            aria-label="Send"
            disabled={!draft.trim()}
          >
            <Icon name="arrowRight" size={17} />
          </button>
        </form>

        <div className={styles.starters}>
          {STARTERS.map((starter) => (
            <button
              key={starter.id}
              className={styles.starter}
              onClick={() => send(starter.text)}
            >
              <Icon name={starter.icon as IconName} size={15} className={styles.starterIcon} />
              <span className={styles.starterText}>{starter.text}</span>
              <Icon name="chevronDown" size={15} className={styles.starterChevron} />
            </button>
          ))}
        </div>

        <div className={styles.quietRow}>
          <button
            className={styles.quietLink}
            onClick={() => setShowCategories((value) => !value)}
            aria-expanded={showCategories}
          >
            {showCategories ? 'Hide examples' : 'More things I can do'}
          </button>

          {!personName && (
            <Link className={styles.quietSignup} href="/sign-up">
              Sign up and get <strong>3 000</strong> free tokens →
            </Link>
          )}
        </div>

        {showCategories && (
          <div className={styles.categories}>
            {PROMPT_CATEGORIES.map((category) => (
              <section key={category.id} className={styles.category}>
                <div className={styles.categoryHead}>
                  <span className={styles.categoryIcon}>
                    <Icon name={category.icon as IconName} size={14} />
                  </span>
                  <span>
                    <h2 className={styles.categoryTitle}>{category.title}</h2>
                    <p className={styles.categorySubtitle}>{category.subtitle}</p>
                  </span>
                </div>

                <div className={styles.categoryCards}>
                  {category.cards.map((card) => (
                    <button
                      key={card.text}
                      className={styles.promptCard}
                      onClick={() => send(card.text)}
                    >
                      <span>{card.text}</span>
                      {/* Said before the click, not after. */}
                      {card.pro && <span className={styles.proBadge}>Pro</span>}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
