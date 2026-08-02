'use client';

import { diffStates, type CommandPlan, type CommandState } from '@/lib/superchart/commands';
import { applyCommands, selectedCommands } from '@/lib/superchart/commands';
import styles from './Superchart.module.css';

/**
 * The action plan — what Voyager proposes, before any of it happens.
 *
 * The rule the whole phase exists for: no change proposed by Voyager reaches
 * the chart without this card. Every step is listed with its parameters, the
 * Before/After rows are computed from the two states rather than described, and
 * each step can be switched off — so "apply selected" is a real choice and not
 * an all-or-nothing button with a friendlier name.
 *
 * Refusals are shown, not swallowed. Doing four of the five things somebody
 * asked for, silently, is how they end up trusting a chart that is missing the
 * part they wanted.
 */

type Props = {
  plan: CommandPlan;
  liveState: CommandState;
  showBefore: boolean;
  onToggleBefore: (value: boolean) => void;
  onToggleStep: (index: number) => void;
  onApply: () => void;
  onCancel: () => void;
};

export function PlanCard({
  plan,
  liveState,
  showBefore,
  onToggleBefore,
  onToggleStep,
  onApply,
  onCancel,
}: Props) {
  const commands = selectedCommands(plan);
  const after = applyCommands(liveState, commands, { draft: true });
  const rows = diffStates(liveState, after);
  const changed = rows.filter((row) => row.changed);

  return (
    <div className={styles.planCard}>
      <div className={styles.planHead}>
        <span className={styles.planBadge}>Plan</span>
        <strong className={styles.planTitle}>{plan.title}</strong>
      </div>

      <p className={styles.voyagerBecause}>Proposed because {plan.because}.</p>

      {plan.steps.length > 0 && (
        <>
          <div className={styles.dataTitle}>STEPS</div>
          {plan.steps.map((step, index) => (
            <label key={`${step.title}-${index}`} className={styles.planStep}>
              <input
                type="checkbox"
                checked={step.selected}
                onChange={() => onToggleStep(index)}
              />
              <span>
                <strong className={styles.referenceTitle}>{step.title}</strong>
                <span className={styles.referenceDetail}>{step.detail}</span>
              </span>
            </label>
          ))}
        </>
      )}

      {plan.refusals.length > 0 && (
        <div className={styles.planRefusal} role="status">
          <strong>Not done:</strong>
          <ul>
            {plan.refusals.map((refusal) => (
              <li key={refusal}>{refusal}</li>
            ))}
          </ul>
        </div>
      )}

      {plan.steps.length > 0 && (
        <>
          <div className={styles.dataTitle} style={{ marginTop: 12 }}>
            {showBefore ? 'BEFORE' : 'AFTER'}
            <button
              className={styles.planToggle}
              onClick={() => onToggleBefore(!showBefore)}
              aria-pressed={showBefore}
            >
              {showBefore ? 'Show after' : 'Show before'}
            </button>
          </div>

          {changed.length ? (
            changed.map((row) => (
              <div key={row.label} className={styles.diffRow}>
                <span className={styles.diffLabel}>{row.label}</span>
                <span className={styles.diffBefore}>{row.before}</span>
                <span aria-hidden="true">→</span>
                <span className={styles.diffAfter}>{row.after}</span>
              </div>
            ))
          ) : (
            // Nothing selected is a real state, and saying so beats an Apply
            // button that does nothing when pressed.
            <p className={styles.voyagerNote}>
              Nothing is selected, so applying would change nothing.
            </p>
          )}

          <div className={styles.planActions}>
            <button
              className={styles.planApply}
              onClick={onApply}
              disabled={!commands.length}
            >
              {commands.length === plan.steps.length
                ? 'Apply to chart'
                : `Apply ${commands.length} of ${plan.steps.length}`}
            </button>
            <button className={styles.planCancel} onClick={onCancel}>
              Cancel
            </button>
          </div>

          <p className={styles.voyagerNote}>
            Previewed on the chart in dashed lines. Nothing is saved until you apply, and one
            undo puts it all back.
          </p>
        </>
      )}

      {plan.steps.length === 0 && (
        <div className={styles.planActions}>
          <button className={styles.planCancel} onClick={onCancel}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}
