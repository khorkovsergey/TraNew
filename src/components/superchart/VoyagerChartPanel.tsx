'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChartHighlight } from '@/lib/superchart/chart-engine/types';
import {
  chipsFor,
  contextSize,
  type ChartContext,
  type ContextChipId,
} from '@/lib/superchart/context';
import {
  answerFor,
  chooseMode,
  QUICK_COMMANDS,
  type ChartAnswer,
} from '@/lib/superchart/context/answers';
import { planFor } from '@/lib/superchart/commands/planner';
import type { CommandPlan, CommandState } from '@/lib/superchart/commands';
import { PlanCard } from './PlanCard';
import { track } from '@/lib/events/analytics';
import styles from './Superchart.module.css';

/**
 * Voyager, reading the chart.
 *
 * Two things here are not decoration. The chips are the actual payload: what
 * they list is what gets sent, and switching one off removes that section from
 * the context rather than hiding a row — so a person can see the answer change
 * and learn what the answer depended on.
 *
 * The references are the other. Each sentence about a bar carries a number, the
 * chart draws the same number over the same bars, and hovering either end lights
 * up the other. An explanation that says "there was a sharp drop" and leaves you
 * to find it is not an explanation of *this* chart.
 */

type Props = {
  /** Built on demand so the context is the chart as it is when asked. */
  buildContext: (excluded: ContextChipId[]) => ChartContext | null;
  onHighlights: (highlights: ChartHighlight[], activeId: string | null) => void;
  /** Set by the chart when the pointer crosses a zone, for the reverse hover. */
  hoveredFromChart: string | null;
  /*
   * The plan lives in the workspace, not here, because the preview has to reach
   * the chart. The panel proposes and displays; it never applies.
   */
  plan: CommandPlan | null;
  onPlan: (plan: CommandPlan | null) => void;
  liveState: CommandState;
  showBefore: boolean;
  onToggleBefore: (value: boolean) => void;
  onApply: (plan: CommandPlan) => void;
  activity: Array<{ id: string; title: string; at: string }>;
};

type PanelState =
  | { status: 'idle' }
  | { status: 'thinking'; question: string }
  | { status: 'planned'; question: string }
  | { status: 'answered'; question: string; answer: ChartAnswer; because: string }
  | { status: 'error'; message: string };

export function VoyagerChartPanel({
  buildContext,
  onHighlights,
  hoveredFromChart,
  plan,
  onPlan,
  liveState,
  showBefore,
  onToggleBefore,
  onApply,
  activity,
}: Props) {
  const [state, setState] = useState<PanelState>({ status: 'idle' });
  const [question, setQuestion] = useState('');
  const [excluded, setExcluded] = useState<ContextChipId[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Previewed live, so the chips describe the chart in front of the person
  // rather than the chart as it was when they last asked.
  const preview = useMemo(() => buildContext(excluded), [buildContext, excluded]);
  const chips = useMemo(() => (preview ? chipsFor(preview, excluded) : []), [preview, excluded]);

  const active = hoveredFromChart ?? hovered;
  const references = state.status === 'answered' ? state.answer.references : null;

  // The chart is told about the references and about which one is lit. Pushed
  // from here because the panel is what knows the answer.
  useEffect(() => {
    onHighlights(
      references?.map((reference) => ({
        id: reference.id,
        number: reference.number,
        fromIndex: reference.fromIndex,
        toIndex: reference.toIndex,
        kind: reference.kind,
      })) ?? [],
      active
    );
  }, [references, active, onHighlights]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const ask = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const context = buildContext(excluded);
      if (!context) {
        setState({
          status: 'error',
          message: 'The chart has no data loaded yet, so there is nothing to read.',
        });
        return;
      }

      /*
       * A request that would change the chart becomes a plan, not an answer.
       * Checked before the thinking state so the two paths do not race, and
       * before anything is applied — which is the rule this whole layer exists
       * to enforce.
       */
      /*
       * Counted with the shape of the request, never its text. What somebody
       * asks about a chart names the position they hold.
       */
      track({
        name: 'superchart_voyager_asked',
        mode: chooseMode(trimmed, context).mode,
        contextKb: Math.round(contextSize(context) / 1024),
        chipsRemoved: excluded.length,
      });

      const proposed = planFor({ question: trimmed, context });
      if (proposed) {
        track({
          name: 'superchart_plan_proposed',
          steps: proposed.steps.length,
          refusals: proposed.refusals.length,
        });
        onPlan(proposed);
        setState({ status: 'planned', question: trimmed });
        setQuestion('');
        return;
      }

      setState({ status: 'thinking', question: trimmed });
      setQuestion('');

      /*
       * The pause is real work, not theatre: the answer is computed from the
       * context in `answerFor`, and this is where a model request will go when
       * the model layer lands. Showing the thinking state for a beat keeps the
       * two paths looking the same to the person using it.
       */
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const { because } = chooseMode(trimmed, context);
        setState({
          status: 'answered',
          question: trimmed,
          answer: answerFor(trimmed, context),
          because,
        });
      }, 450);
    },
    [buildContext, excluded, onPlan]
  );

  const toggleChip = useCallback((id: ContextChipId) => {
    setExcluded((current) =>
      current.includes(id) ? current.filter((chip) => chip !== id) : [...current, id]
    );
  }, []);

  return (
    <div className={styles.voyagerPanel}>
      <div className={styles.voyagerContext}>
        <div className={styles.dataTitle}>
          VOYAGER SEES
          {preview ? (
            <span className={styles.voyagerSize}>{Math.round(contextSize(preview) / 1024)} KB</span>
          ) : null}
        </div>

        <div className={styles.chipRow}>
          {chips.map((chip) => (
            <button
              key={chip.id}
              className={styles.chip}
              onClick={() => toggleChip(chip.id)}
              title="Remove this from what is sent"
            >
              {chip.label}
              <span aria-hidden="true">×</span>
              <span className={styles.srOnly}>— remove from context</span>
            </button>
          ))}

          {excluded.map((id) => (
            <button
              key={id}
              className={`${styles.chip} ${styles.chipOff}`}
              onClick={() => toggleChip(id)}
              title="Put this back into what is sent"
            >
              {id} <span aria-hidden="true">+</span>
            </button>
          ))}
        </div>

        {excluded.length > 0 && (
          <p className={styles.voyagerNote}>
            {excluded.length} item{excluded.length === 1 ? ' is' : 's are'} being withheld. Ask again
            to see the difference.
          </p>
        )}
      </div>

      <div className={styles.voyagerBody}>
        {state.status === 'idle' && (
          <>
            <p className={styles.voyagerNote}>
              Voyager reads the bars in view — the statistics are computed here, not guessed at.
            </p>
            {QUICK_COMMANDS.map((command) => (
              <button
                key={command.text}
                className={styles.quickCommand}
                onClick={() => ask(command.text)}
              >
                {command.text}
              </button>
            ))}
          </>
        )}

        {state.status === 'planned' && plan && (
          <>
            <p className={styles.voyagerQuestion}>{state.question}</p>
            <PlanCard
              plan={plan}
              liveState={liveState}
              showBefore={showBefore}
              onToggleBefore={onToggleBefore}
              onToggleStep={(index) =>
                onPlan({
                  ...plan,
                  steps: plan.steps.map((step, i) =>
                    i === index ? { ...step, selected: !step.selected } : step
                  ),
                })
              }
              onApply={() => {
                onApply(plan);
                setState({ status: 'idle' });
              }}
              onCancel={() => {
                onPlan(null);
                setState({ status: 'idle' });
              }}
            />
          </>
        )}

        {state.status === 'thinking' && (
          <div className={styles.voyagerThinking} role="status">
            <span className={styles.voyagerDot} />
            Reading {preview?.visibleBarsSummary?.barCount ?? 0} bars…
          </div>
        )}

        {state.status === 'error' && (
          <p className={styles.voyagerError} role="status">
            {state.message}
          </p>
        )}

        {state.status === 'answered' && (
          <>
            <p className={styles.voyagerQuestion}>{state.question}</p>
            <p className={styles.voyagerBecause}>Answered as an analysis — {state.because}.</p>
            <p className={styles.voyagerAnswer}>{state.answer.summary}</p>

            {state.answer.references.map((reference) => (
              <button
                key={reference.id}
                className={`${styles.reference} ${active === reference.id ? styles.referenceOn : ''}`}
                onMouseEnter={() => setHovered(reference.id)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(reference.id)}
                onBlur={() => setHovered(null)}
              >
                <span className={styles.referenceNumber}>{reference.number}</span>
                <span>
                  <strong className={styles.referenceTitle}>{reference.title}</strong>
                  <span className={styles.referenceDetail}>{reference.detail}</span>
                </span>
              </button>
            ))}

            <p className={styles.voyagerSources}>{state.answer.sources}</p>

            <div className={styles.dataTitle} style={{ marginTop: 12 }}>
              NEXT
            </div>
            {state.answer.followUps.map((followUp) => (
              <button key={followUp} className={styles.quickCommand} onClick={() => ask(followUp)}>
                {followUp}
              </button>
            ))}
          </>
        )}
        {activity.length > 0 && (
          <>
            <div className={styles.dataTitle} style={{ marginTop: 14 }}>
              VOYAGER ACTIVITY
            </div>
            {activity.map((entry) => (
              <div key={`${entry.id}-${entry.at}`} className={styles.activityRow}>
                <span>{entry.title}</span>
                <span className={styles.activityTime}>{entry.at.slice(11, 16)}</span>
              </div>
            ))}
            <p className={styles.voyagerNote}>
              Each of these is one press of undo, in the order they were applied.
            </p>
          </>
        )}
      </div>

      <form
        className={styles.voyagerForm}
        onSubmit={(event) => {
          event.preventDefault();
          ask(question);
        }}
      >
        <input
          className={styles.voyagerInput}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about what is on the chart"
          aria-label="Ask Voyager about this chart"
        />
        <button className={styles.voyagerSend} type="submit" disabled={!question.trim()}>
          Ask
        </button>
      </form>
    </div>
  );
}
