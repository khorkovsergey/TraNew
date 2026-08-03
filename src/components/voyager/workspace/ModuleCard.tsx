'use client';

import { Icon } from '@/components/ui/Icon';
import {
  PROVENANCE_LABEL,
  sourcesFor,
  type Source,
  type VoyagerModule,
} from '@/lib/voyager/workspace/contract';
import styles from './VoyagerWorkspace.module.css';

/**
 * One card family, per-kind bodies.
 *
 * The card is the same everywhere — title, optional sub-line, a body, the
 * provenance labels, the sources it cites and its own actions — because the
 * handoff asks for one family rather than fourteen designs. What changes is the
 * middle.
 *
 * Two things are structural rather than decorative. Every card states where its
 * content came from, and a card mixing measurement with interpretation carries
 * both labels; the difference between "the market did this" and "Voyager thinks
 * this" is the one a reader most needs and most easily loses. And every source
 * is shown with its provider and its time, because the contract already refused
 * any source without them.
 *
 * A kind whose body is not built yet says so by name. It is not left blank and
 * it is not approximated with a different kind, because a card that renders as
 * something else is a card that misreports what Voyager found.
 */

type Props = {
  module: VoyagerModule;
  sources: Source[];
  onAction: (module: VoyagerModule, actionId: string) => void;
  /** Only the permission card gets this: the boxes are a decision, not display. */
  scopeState?: { ticked: string[]; setTicked: (next: string[]) => void };
};

function Row({ label, value, sign }: { label: string; value: string; sign?: number }) {
  /*
   * Direction is a glyph and a word as well as a colour. Somebody who cannot
   * separate the green from the red still reads the arrow and the sign.
   */
  const glyph = sign === undefined ? '' : sign >= 0 ? '▲' : '▼';
  const tone = sign === undefined ? '' : sign >= 0 ? styles.up : styles.down;

  return (
    <div className={styles.metricRow}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={`${styles.metricValue} ${tone}`}>
        {glyph && <span aria-hidden="true">{glyph} </span>}
        {value}
      </span>
    </div>
  );
}

function Body({ module, scopeState }: { module: VoyagerModule; scopeState?: Props['scopeState'] }) {
  const data = (module.data ?? {}) as Record<string, unknown>;

  switch (module.kind) {
    case 'text-insight':
      return <p className={styles.cardBody}>{String(data.body ?? '')}</p>;

    case 'metric-row': {
      const metrics = Array.isArray(data.metrics) ? data.metrics : [];
      return (
        <div className={styles.metricGrid}>
          {metrics.map((item, index) => {
            const metric = (item ?? {}) as Record<string, unknown>;
            return (
              <Row
                key={index}
                label={String(metric.label ?? '')}
                value={String(metric.value ?? '')}
                sign={typeof metric.sign === 'number' ? metric.sign : undefined}
              />
            );
          })}
        </div>
      );
    }

    case 'ranked-rows': {
      const rows = Array.isArray(data.rows) ? data.rows : [];
      return (
        <ol className={styles.rankedList}>
          {rows.map((item, index) => {
            const row = (item ?? {}) as Record<string, unknown>;
            const sign = typeof row.sign === 'number' ? row.sign : undefined;
            return (
              <li key={index} className={styles.rankedRow}>
                <span className={styles.rankedName}>{String(row.name ?? '')}</span>
                <span className={styles.rankedNote}>{String(row.note ?? '')}</span>
                <span
                  className={`${styles.rankedValue} ${
                    sign === undefined ? '' : sign >= 0 ? styles.up : styles.down
                  }`}
                >
                  {sign !== undefined && <span aria-hidden="true">{sign >= 0 ? '▲' : '▼'} </span>}
                  {String(row.value ?? '')}
                </span>
              </li>
            );
          })}
        </ol>
      );
    }

    case 'comparison-table': {
      const columns = Array.isArray(data.columns) ? data.columns.map(String) : [];
      const rows = Array.isArray(data.rows) ? data.rows : [];

      return (
        /* Real header cells. A table of divs is a table a screen reader cannot
           navigate, and a comparison is the one place that matters most. */
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Metric</th>
                {columns.map((column) => (
                  <th scope="col" key={column}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((item, index) => {
                const row = (item ?? {}) as Record<string, unknown>;
                const cells = Array.isArray(row.cells) ? row.cells.map(String) : [];
                return (
                  <tr key={index}>
                    <th scope="row">{String(row.label ?? '')}</th>
                    {cells.map((cell, cellIndex) => (
                      <td key={cellIndex}>{cell}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    case 'interpreted-filters': {
      const filters = Array.isArray(data.filters) ? data.filters : [];
      return (
        <>
          <div className={styles.filterRow}>
            {filters.map((item, index) => {
              const filter = (item ?? {}) as Record<string, unknown>;
              return (
                <span key={index} className={styles.filterChip}>
                  {String(filter.label ?? '')}
                </span>
              );
            })}
          </div>
          {/* The person can say the interpretation is wrong, which is the whole
              point of showing it. */}
          <p className={styles.cardNote}>
            This is how the request was read. If it is not what you meant, say so and it is read
            again.
          </p>
        </>
      );
    }

    case 'next-actions': {
      const items = Array.isArray(data.items) ? data.items.map(String) : [];
      return (
        <ul className={styles.nextList}>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    }

    case 'error':
      return (
        <>
          <p className={styles.cardBody}>{String(data.cause ?? 'Something did not finish.')}</p>
          {/* Naming the cause without offering a way forward leaves somebody
              stuck with an accurate description of being stuck. */}
          {data.recovery ? <p className={styles.cardNote}>{String(data.recovery)}</p> : null}
        </>
      );

    case 'heatmap': {
      const cells = Array.isArray(data.cells) ? data.cells : [];
      return (
        <div className={styles.heatGrid}>
          {cells.map((item, index) => {
            const cell = (item ?? {}) as Record<string, unknown>;
            const sign = typeof cell.sign === 'number' ? cell.sign : 0;
            return (
              /* Sign and label, never colour alone: the tile is tinted, but the
                 arrow and the signed number carry the same fact. */
              <div
                key={index}
                className={`${styles.heatCell} ${sign >= 0 ? styles.heatUp : styles.heatDown}`}
              >
                <span className={styles.heatLabel}>{String(cell.label ?? '')}</span>
                <span className={styles.heatValue}>
                  <span aria-hidden="true">{sign >= 0 ? '▲' : '▼'} </span>
                  {String(cell.value ?? '')}
                </span>
              </div>
            );
          })}
        </div>
      );
    }

    case 'monitoring-rule': {
      const rows = Array.isArray(data.rows) ? data.rows : [];
      return (
        <dl className={styles.ruleGrid}>
          {rows.map((item, index) => {
            const row = (item ?? {}) as Record<string, unknown>;
            return (
              <div key={index} className={styles.ruleRow}>
                <dt className={styles.ruleLabel}>{String(row.label ?? '')}</dt>
                <dd className={styles.ruleValue}>{String(row.value ?? '')}</dd>
              </div>
            );
          })}
        </dl>
      );
    }

    case 'permission-request': {
      const scopes = Array.isArray(data.scopes) ? data.scopes : [];
      return (
        <>
          <ul className={styles.scopeList}>
            {scopes.map((item, index) => {
              const scope = (item ?? {}) as Record<string, unknown>;
              return (
                <li key={index} className={styles.scopeRow}>
                  {/* Checked and disabled where the analysis genuinely cannot
                      run without it; optional otherwise, and the note says what
                      is still possible when it is withheld. */}
                  {/*
                    Controlled, because what is ticked here is what gets read.
                    An uncontrolled box would let the dialog and the grant
                    disagree, and the grant is the thing that matters.
                  */}
                  <input
                    type="checkbox"
                    checked={
                      scope.required === true ||
                      (scopeState?.ticked ?? []).includes(String(scope.id ?? ''))
                    }
                    disabled={scope.required === true}
                    onChange={(event) => {
                      if (!scopeState) return;
                      const id = String(scope.id ?? '');
                      scopeState.setTicked(
                        event.target.checked
                          ? [...scopeState.ticked, id]
                          : scopeState.ticked.filter((item) => item !== id)
                      );
                    }}
                    aria-label={String(scope.label ?? '')}
                  />
                  <span>{String(scope.label ?? '')}</span>
                  {scope.required === true && <span className={styles.scopeTag}>Needed</span>}
                  {/* What refusing it costs, said while deciding rather than
                      discovered in the answer. */}
                  {scope.required !== true && scope.note ? (
                    <span className={styles.scopeNote}>{String(scope.note)}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {data.note ? <p className={styles.cardNote}>{String(data.note)}</p> : null}
        </>
      );
    }

    case 'guided-questions': {
      const questions = Array.isArray(data.questions) ? data.questions : [];
      return (
        <ol className={styles.questionList}>
          {questions.map((item, index) => {
            const question = (item ?? {}) as Record<string, unknown>;
            return <li key={index}>{String(question.text ?? '')}</li>;
          })}
        </ol>
      );
    }

    case 'news-timeline': {
      const items = Array.isArray(data.items) ? data.items : [];
      return (
        <ol className={styles.timeline}>
          {items.map((item, index) => {
            const entry = (item ?? {}) as Record<string, unknown>;
            return (
              <li key={index}>
                <span className={styles.timelineWhen}>{String(entry.when ?? '')}</span>
                <span>{String(entry.headline ?? '')}</span>
              </li>
            );
          })}
        </ol>
      );
    }

    case 'pine-editor':
      return (
        <>
          <pre className={styles.codeBlock}>{String(data.source ?? '')}</pre>
          <p className={styles.cardNote}>
            Checked, not executed — these checks read the source. Opening it in Script Lab gives
            the diagnostics, the version history and the restricted preview runtime that are
            already built there.
          </p>
        </>
      );

    case 'chart':
      return (
        <p className={styles.cardNote}>
          The chart renders through the Supercharts engine rather than a second one, so this card
          is wired when the two are joined in phase 5. Its parameters —{' '}
          <strong>{String(data.symbol ?? '')} {String(data.interval ?? '')}</strong> — are already
          decided and shown in the assumptions.
        </p>
      );

    default:
      return (
        <p className={styles.cardNote}>
          The <strong>{module.kind}</strong> module is declared by this response but its body is
          not built yet. It is named rather than approximated with another kind, because a card
          rendering as something else misreports what Voyager found.
        </p>
      );
  }
}

export function ModuleCard({ module, sources, onAction, scopeState }: Props) {
  const cited = sourcesFor(module, sources);

  return (
    <article className={styles.moduleCard}>
      <header className={styles.moduleHead}>
        <div className={styles.moduleTitleGroup}>
          <h3 className={styles.moduleTitle}>{module.title}</h3>
          {module.subtitle && <p className={styles.moduleSubtitle}>{module.subtitle}</p>}
        </div>
        {module.tag && <span className={styles.moduleTag}>{module.tag}</span>}
      </header>

      <Body module={module} scopeState={scopeState} />

      {module.actions.length > 0 && (
        <div className={styles.moduleActions}>
          {module.actions.map((action) => (
            <button
              key={action.id}
              className={styles.moduleAction}
              onClick={() => onAction(module, action.id)}
            >
              {action.label}
              {/* Marked, so somebody can see which buttons change something
                  before they press one. */}
              {action.mutates && <span className={styles.mutatesDot} aria-hidden="true" />}
              {action.mutates && <span className={styles.srOnly}> — asks before applying</span>}
            </button>
          ))}
        </div>
      )}

      <footer className={styles.moduleFoot}>
        <div className={styles.provenanceRow}>
          {module.provenance.map((label) => (
            <span key={label} className={`${styles.provenance} ${styles[`prov_${label}`] ?? ''}`}>
              {PROVENANCE_LABEL[label]}
            </span>
          ))}
        </div>

        {cited.length > 0 && (
          <ul className={styles.sourceList}>
            {cited.map((source) => (
              <li key={source.id}>
                <Icon name="check" size={11} />
                <span>
                  {source.kind} · {source.provider} · {source.at.slice(0, 16).replace('T', ' ')} UTC
                  {source.delayed && ' · delayed'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </footer>
    </article>
  );
}
