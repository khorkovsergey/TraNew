import type { ReactNode } from 'react';
import type { MetricState, MetricValue } from '@/lib/analytics/states';
import {
  STATE_LABEL,
  STATE_MEANING,
  display,
  formatCount,
  widthOf,
  type ValueFormat,
} from './format';
import styles from './Observatory.module.css';

/**
 * The Observatory's component kit.
 *
 * Everything a section is allowed to draw with. Built before the sections, in
 * the order the design handoff's README asks for — the provenance states first,
 * then the containers, then the charts — because a state invented locally in
 * section nine is exactly how a dashboard ends up with two visual languages for
 * the same fact.
 *
 * These are plain functions rather than client components. They render inside
 * the client shell, so they compile into that bundle, and none of them holds
 * state: interactivity lives in `Observatory.tsx` and arrives here as a
 * callback.
 */

/* ============================================================ StateBadge */

/**
 * The pill that names a metric's provenance.
 *
 * The single most important component on the page, and the reason it is a
 * component rather than a span: the state has to be **legible without colour**.
 * The badge always carries the word, `data-state` drives the hue from the
 * stylesheet, and the `title` carries the meaning — so a reader who cannot tell
 * amber from gold still reads "Low n" and "Legacy".
 */
export function StateBadge({
  state,
  small,
  label,
}: {
  state: MetricState;
  small?: boolean;
  label?: string;
}) {
  return (
    <span
      className={`${styles.badge}${small ? ` ${styles.badgeSmall}` : ''}`}
      data-state={state}
      title={STATE_MEANING[state]}
    >
      {label ?? STATE_LABEL[state]}
    </span>
  );
}

/* ============================================================ StatusBadge */

/**
 * Health, outcome, category and operational status — everything that is *not*
 * provenance.
 *
 * The reason it exists is a bug it would have prevented. A chart capability
 * that reported `fulfilled` was being rendered with `feature_disabled`, because
 * the outcome check compared against a value the enum does not contain and the
 * fallback branch had been chosen for its red. A poor LCP wore the same badge.
 * Neither had anything to do with a feature flag.
 *
 * `StateBadge` makes a claim about where a number came from and whether it can
 * be believed. `StatusBadge` makes a claim about the thing the number
 * describes. Sharing one component meant a colour choice in one panel silently
 * became a provenance assertion, and the palette is close enough that nobody
 * reading the page would catch it.
 *
 * The two are visually of a piece and semantically disjoint, and `tone` is a
 * closed set that cannot be widened into `MetricState` by accident.
 */
export type Tone = 'positive' | 'info' | 'caution' | 'negative' | 'neutral' | 'quiet';

export function StatusBadge({
  tone,
  label,
  title,
  small,
}: {
  tone: Tone;
  label: string;
  title?: string;
  small?: boolean;
}) {
  return (
    <span
      className={`${styles.statusBadge}${small ? ` ${styles.badgeSmall}` : ''}`}
      data-tone={tone}
      title={title}
    >
      {label}
    </span>
  );
}

/* ================================================================ Layout */

export function Panel({
  title,
  lede,
  aside,
  flush,
  className,
  children,
}: {
  title?: string;
  lede?: string;
  aside?: ReactNode;
  flush?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`${styles.panel}${flush ? ` ${styles.panelFlush}` : ''}${className ? ` ${className}` : ''}`}
    >
      {title ? (
        <div className={aside ? styles.panelHead : undefined}>
          <div>
            <h3 className={styles.panelTitle}>{title}</h3>
            {lede ? <p className={styles.panelLede}>{lede}</p> : null}
          </div>
          {aside}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function Section({
  id,
  number,
  title,
  lede,
  children,
}: {
  id: string;
  number: string;
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <div className={styles.sectionHead}>
        <h2 id={`${id}-title`} className={styles.sectionTitle}>
          <span className={styles.railNum} aria-hidden="true">
            {number}{' '}
          </span>
          {title}
        </h2>
        <p className={styles.sectionLede}>{lede}</p>
      </div>
      {children}
    </section>
  );
}

/* ============================================================= KPI cards */

/**
 * The executive KPI card.
 *
 * The sparkline slot the design draws is deliberately absent: no
 * previous-period or daily series exists in the current query layer, and a
 * shaped path with no data behind it would be the most persuasive lie on the
 * page. The same applies to the delta — a card renders one only if a real
 * comparison is ever passed, and nothing passes one today.
 */
export function KpiCard({
  label,
  metric,
  format = 'count',
  denominator,
  onOpen,
}: {
  label: string;
  metric: MetricValue;
  format?: ValueFormat;
  denominator?: string;
  onOpen?: () => void;
}) {
  const shown = display(metric, format);

  const body = (
    <>
      <span className={`${styles.kpiAccent} ${styles.accent}`} data-state={shown.state} aria-hidden="true" />
      <div className={styles.kpiHead}>
        <span className={styles.kpiLabel}>{label}</span>
        <StateBadge state={shown.state} />
      </div>
      <div className={styles.kpiValueRow}>
        {shown.kind === 'value' ? (
          <span className={`${styles.kpiValue} ${styles.stateText}`} data-state={shown.state}>
            {shown.text}
          </span>
        ) : (
          <span className={`${styles.kpiAbsent} ${styles.stateText}`} data-state={shown.state}>
            {shown.text}
          </span>
        )}
      </div>
      <span className={styles.kpiDenom}>
        {shown.kind === 'value' ? (denominator ?? `n = ${formatCount(shown.sample)}`) : shown.detail}
      </span>
      <span className={styles.kpiFoot}>{metric.source}</span>
    </>
  );

  if (!onOpen) {
    return (
      <div className={styles.kpiCard} data-state={shown.state}>
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={styles.kpiCard}
      data-state={shown.state}
      onClick={onOpen}
      title={`${label} — open the definition, population and limitations`}
    >
      {body}
    </button>
  );
}

/** The denser card the cockpit sections use — same rules, smaller type. */
export function MiniCard({
  label,
  metric,
  format = 'count',
  sub,
}: {
  label: string;
  metric: MetricValue;
  format?: ValueFormat;
  sub?: string;
}) {
  const shown = display(metric, format);

  return (
    <div className={styles.miniCard} data-state={shown.state}>
      <div className={styles.miniHead}>
        <span className={styles.miniLabel}>{label}</span>
        <StateBadge state={shown.state} small />
      </div>
      {shown.kind === 'value' ? (
        <span className={`${styles.miniValue} ${styles.stateText}`} data-state={shown.state}>
          {shown.text}
        </span>
      ) : (
        <span className={`${styles.miniAbsent} ${styles.stateText}`} data-state={shown.state}>
          {shown.text}
        </span>
      )}
      <span className={styles.miniSub}>{shown.kind === 'value' ? (sub ?? '') : shown.detail}</span>
    </div>
  );
}

/**
 * A plain figure with no provenance of its own — a component of one above it.
 *
 * Takes a `tone`, not a state. A tile is a decomposition of a metric that has
 * already declared its provenance on the card above, so colouring one with a
 * `MetricState` would restate a claim it is not making.
 */
export function Tile({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
}) {
  return (
    <div className={styles.tile}>
      <div className={styles.tileLabel}>{label}</div>
      <div className={`${styles.tileValue} ${styles.toneText}`} data-tone={tone}>
        {value}
      </div>
      {sub ? <div className={styles.tileSub}>{sub}</div> : null}
    </div>
  );
}

/* ================================================================== Bars */

/**
 * The inline bar that sits beside a rate in a table cell.
 *
 * A bar is a shape, not a claim, so it takes a tone. It used to take a
 * `MetricState` purely to reach a colour, which meant a row wanting an amber
 * bar had to assert `insufficient_sample` about data that was nothing of the
 * kind.
 */
export function CellBar({
  value,
  total,
  tone = 'info',
}: {
  value: number;
  total: number;
  tone?: Tone;
}) {
  return (
    <div className={`${styles.barTrack} ${styles.barCell} ${styles.toneFill}`} data-tone={tone}>
      <span className={styles.barFill} style={{ width: widthOf(value, total) }} aria-hidden="true" />
    </div>
  );
}

/** A labelled progress row — the funnel primitive the cockpits are built from. */
export function Meter({
  label,
  value,
  total,
  tone = 'info',
  caption,
}: {
  label: string;
  value: number;
  total: number;
  tone?: Tone;
  caption?: string;
}) {
  return (
    <div className={styles.meter}>
      <div className={styles.meterHead}>
        <span className={styles.meterLabel}>{label}</span>
        <span className={styles.meterFigures}>
          <span className={styles.meterN}>{formatCount(value)}</span>
          <span className={styles.meterPct}>
            {caption ?? (total > 0 ? `${((value / total) * 100).toFixed(1)}%` : '—')}
          </span>
        </span>
      </div>
      <div className={`${styles.meterTrack} ${styles.toneFill}`} data-tone={tone}>
        <span className={styles.meterFill} style={{ width: widthOf(value, total) }} aria-hidden="true" />
      </div>
    </div>
  );
}

/* ================================================================ Tables */

export function Scroller({ children, minWidth }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className={styles.scroller}>
      <div style={minWidth ? { minWidth } : undefined}>{children}</div>
    </div>
  );
}

/**
 * A row that stands in for a table body with nothing in it.
 *
 * Never "0 rows". An empty table on this page has a reason, and the reason is
 * the finding — an unstyled blank would read as a rendering bug and get
 * ignored, which is how a missing emitter survives a demo.
 */
export function EmptyRow({ span, children }: { span: number; children: ReactNode }) {
  return (
    <tr>
      <td className={styles.emptyRow} colSpan={span}>
        {children}
      </td>
    </tr>
  );
}

export { styles as observatoryStyles };
