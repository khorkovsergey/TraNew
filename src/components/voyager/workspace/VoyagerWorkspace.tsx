'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Link } from '@/i18n/navigation';
import { VoyagerOrb } from '@/components/voyager/VoyagerOrb';
import {
  briefingFor,
  PROMPT_CATEGORIES,
  STARTERS,
  type Briefing,
} from '@/lib/voyager/workspace/landing';
import { parsePlan, type VoyagerModule, type VoyagerPlan } from '@/lib/voyager/workspace/contract';
import {
  advance,
  isRunning,
  START,
  statusFor,
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
};

export function VoyagerWorkspace({ personName }: Props) {
  const [stage, setStage] = useState<Stage>('landing');
  const [request, setRequest] = useState('');
  const [draft, setDraft] = useState('');
  const [showCategories, setShowCategories] = useState(false);
  const [plan, setPlan] = useState<VoyagerPlan | null>(null);
  const [refusals, setRefusals] = useState<string[]>([]);
  const [run, setRun] = useState<Run>(START);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  /** The change waiting to be accepted. Nothing happens while this is set. */
  const [pending, setPending] = useState<Confirmation | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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

  const send = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    /*
     * The response goes through `parsePlan` here, exactly as a model response
     * will. Nothing downstream sees a shape that has not been through the gate,
     * and a scenario that produced something unrenderable is refused rather
     * than half-drawn.
     */
    const parsed = parsePlan(responseFor(trimmed));

    setRequest(trimmed);
    setStage('requested');
    setDraft('');
    setPlan(parsed?.plan ?? null);
    setRefusals(parsed?.refusals ?? []);
    setRun(START);
  }, []);

  /*
   * The clock lives here and the rules live in `lifecycle.ts`.
   *
   * Splitting them is what lets the sequence be tested without waiting: the
   * component decides when to step, the module decides what stepping means.
   */
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
    setHistory((current) => applyAction(current, pending, new Date().toISOString()));
    setNotice(`Applied. ${pending.action.undo}`);
    setPending(null);
  }, [pending]);

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
        workspaceName={plan ? `${request.slice(0, 40)}${request.length > 40 ? '…' : ''}` : 'New workspace'}
        autoNamed
        onNew={reset}
        conversation={
          <div className={styles.turn}>
            <p className={styles.userBubble}>{request}</p>

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
                </div>

                {refusals.length > 0 && (
                  <div className={styles.refusalCard} role="status">
                    {refusals.map((refusal, index) => (
                      <p key={index}>{refusal}</p>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className={styles.refusalCard} role="status">
                <p>
                  That scenario is not written yet. Seven of the ten arrive in phase 4; this one
                  returns nothing rather than answering confidently about the wrong subject.
                </p>
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
                />
              ))}

              {run.revealed === 0 && (
                <p className={styles.zoneStubNote}>{statusFor(run, plan)}</p>
              )}
            </>
          ) : (
            <p className={styles.zoneStubNote}>Nothing to build for this request yet.</p>
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
                  Editing these re-runs the result. The editing itself is phase 4.
                </p>
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
