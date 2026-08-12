import { SURFACE_BY_KEY } from '@/lib/analytics/surfaces';
import { ago, formatCount, humanize, share } from '../format';
import {
  CellBar,
  EmptyRow,
  Panel,
  Scroller,
  Section,
  StateBadge,
  StatusBadge,
  Tile,
  type Tone,
} from '../primitives';
import styles from '../Observatory.module.css';
import type { ObservatoryData } from '../types';

/**
 * 13 — Instrumentation coverage.
 *
 * The design's surface × expected/observed/coverage/last-seen/status matrix,
 * built by folding the per-event coverage rows up to their surface.
 *
 * The distinction the whole section exists to make: **never received has four
 * different meanings**, and collapsing them into one coverage percentage is how
 * a product decides to delete a feature nobody could reach. Uninstrumented,
 * unexposed, unused and awaiting-first-event are four statuses here, and the
 * legend names all of them.
 *
 * Coverage percentages exclude unexposed events from the denominator. An event
 * behind a flag that is off cannot arrive, and counting it as a miss would make
 * every flagged surface look under-instrumented rather than switched off.
 *
 * ## Why these are tones and not MetricStates
 *
 * Coverage status, KPI readiness and layer status are three vocabularies
 * belonging to this section, and none of them is a metric's provenance.
 * Mapping them onto `MetricState` to reach a colour produced a false claim
 * immediately: `unused` — declared, reachable and nothing arrived — was being
 * rendered as `insufficient_sample`, which says a rate was withheld because n
 * was too small. There is no rate and no n. It is a finding about users.
 *
 * `feature_disabled` survives as a canonical state in exactly one place: a
 * surface where every declared event sits behind a flag that is off. That is
 * genuinely what the state means.
 */

const COVERAGE_TONE: Record<string, Tone> = {
  observed: 'positive',
  awaiting_first_event: 'caution',
  unexposed: 'negative',
  unused: 'quiet',
  legacy_silent: 'neutral',
  legacy_still_emitting: 'negative',
};

const VERDICT_TONE: Record<string, Tone> = {
  trustworthy: 'positive',
  partial: 'caution',
  awaiting_data: 'caution',
  not_instrumented: 'quiet',
};

const LAYER_TONE: Record<string, Tone> = {
  observed: 'positive',
  awaiting_emitter: 'quiet',
  awaiting_first_event: 'caution',
};

export function InstrumentationCoverage({ data }: { data: ObservatoryData }) {
  const { coverage } = data;

  /* Fold the event rows up to their surface. */
  const bySurface = new Map<
    string,
    { expected: number; observed: number; unexposed: number; rows: number; lastSeen: string | null }
  >();

  for (const row of coverage.rows) {
    if (row.lifecycle === 'legacy') continue;

    const bucket = bySurface.get(row.surface) ?? {
      expected: 0,
      observed: 0,
      unexposed: 0,
      rows: 0,
      lastSeen: null as string | null,
    };

    bucket.expected += 1;
    bucket.rows += row.count;
    if (row.status === 'observed') bucket.observed += 1;
    if (row.status === 'unexposed') bucket.unexposed += 1;
    if (row.lastSeen && (!bucket.lastSeen || row.lastSeen > bucket.lastSeen)) {
      bucket.lastSeen = row.lastSeen;
    }

    bySurface.set(row.surface, bucket);
  }

  const surfaces = [...bySurface.entries()]
    .map(([key, bucket]) => {
      /* Reachable events only. An unexposed event cannot arrive. */
      const reachable = bucket.expected - bucket.unexposed;
      return {
        key,
        label: SURFACE_BY_KEY.get(key)?.label ?? humanize(key),
        ...bucket,
        reachable,
        coverage: reachable > 0 ? bucket.observed / reachable : null,
      };
    })
    .sort((a, b) => (b.coverage ?? -1) - (a.coverage ?? -1) || b.expected - a.expected);

  const legend: Array<[string, Tone]> = [
    ['Observed', 'positive'],
    ['Awaiting first event', 'caution'],
    ['Unused', 'quiet'],
    ['Unexposed', 'negative'],
    ['Legacy', 'neutral'],
  ];

  return (
    <Section
      id="s-coverage"
      number="13"
      title="Instrumentation coverage"
      lede="No usage, not instrumented, not exposed and legacy are four different things"
    >
      <div className={styles.sixGrid}>
        <Tile label="Events declared" value={formatCount(coverage.totals.declared)} sub="in the registry" tone="neutral" />
        <Tile
          label="Observed"
          value={formatCount(coverage.totals.observed)}
          sub={`${share(coverage.totals.observed, coverage.totals.declared)} of declared`}
          tone="positive"
        />
        <Tile
          label="Unexposed"
          value={formatCount(coverage.totals.unexposed)}
          sub="behind a flag that is off"
          tone="negative"
        />
        <Tile
          label="Unused"
          value={formatCount(coverage.totals.unused)}
          sub="reachable and nothing arrived"
          tone="quiet"
        />
        <Tile
          label="Legacy"
          value={formatCount(coverage.totals.legacy)}
          sub="retired, never in a current funnel"
          tone="neutral"
        />
        <Tile
          label="Collecting since"
          value={coverage.collectingSince ? coverage.collectingSince.slice(0, 10) : 'never'}
          sub="the first row ever received"
          tone={coverage.collectingSince ? 'positive' : 'caution'}
        />
      </div>

      <div className={styles.gapTop}>
        <Panel
          title="Coverage matrix"
          lede="Expected against observed, per surface · unexposed events are excluded from the denominator"
          aside={
            <div className={styles.chips}>
              {legend.map(([label, tone]) => (
                <StatusBadge key={label} tone={tone} small label={label} />
              ))}
            </div>
          }
        >
          <Scroller minWidth={760}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Surface</th>
                  <th scope="col" className={styles.right}>Expected</th>
                  <th scope="col" className={styles.right}>Observed</th>
                  <th scope="col">Coverage</th>
                  <th scope="col" className={styles.right}>Rows</th>
                  <th scope="col" className={styles.right}>Last seen</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {surfaces.map((surface) => {
                  /*
                   * A surface whose every declared event sits behind a flag
                   * that is off really is `feature_disabled` — the canonical
                   * state, used because it is true. Everything else here is a
                   * coverage ratio and takes a tone.
                   */
                  const unreachable = surface.reachable === 0;
                  const tone: Tone = unreachable
                    ? 'negative'
                    : surface.coverage === 1
                      ? 'positive'
                      : surface.observed > 0
                        ? 'info'
                        : 'caution';

                  return (
                    <tr key={surface.key}>
                      <th scope="row" className={styles.nowrap}>{surface.label}</th>
                      <td className={styles.num}>
                        {surface.expected}
                        {surface.unexposed > 0 ? (
                          <span style={{ color: 'var(--obs-faint)' }}> ({surface.unexposed} off)</span>
                        ) : null}
                      </td>
                      <td className={styles.num}>{surface.observed}</td>
                      <td>
                        <div className={styles.barRow}>
                          <CellBar value={surface.observed} total={Math.max(1, surface.reachable)} tone={tone} />
                          <span className={`${styles.barValue} ${styles.toneText}`} data-tone={tone}>
                            {surface.coverage === null ? 'n/a' : `${Math.round(surface.coverage * 100)}%`}
                          </span>
                        </div>
                      </td>
                      <td className={styles.num}>{formatCount(surface.rows)}</td>
                      <td className={styles.num}>{ago(surface.lastSeen, data.queriedAtMs)}</td>
                      <td>
                        {unreachable ? (
                          <StateBadge state="feature_disabled" small />
                        ) : (
                          <StatusBadge
                            tone={tone}
                            small
                            label={
                              surface.coverage === 1
                                ? 'full'
                                : surface.observed > 0
                                  ? 'partial'
                                  : 'none yet'
                            }
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Scroller>
        </Panel>
      </div>

      <div className={`${styles.twoGrid} ${styles.gapTop}`}>
        <Panel
          title="KPI readiness"
          lede="Whether a headline number's inputs are instrumented well enough to believe it"
        >
          <Scroller minWidth={420}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  <th scope="col">Requires</th>
                  <th scope="col">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {coverage.kpis.map((kpi) => (
                  <tr key={kpi.metricId}>
                    <th scope="row">{kpi.label}</th>
                    <td>
                      <div className={styles.pillRow}>
                        {kpi.requires.map((event) => (
                          <span
                            key={event}
                            className={`${styles.pill} ${styles.mono}`}
                            style={{
                              color: kpi.observed.includes(event)
                                ? 'var(--obs-mint)'
                                : kpi.unexposed.includes(event)
                                  ? 'var(--obs-red-soft)'
                                  : 'var(--obs-amber)',
                            }}
                          >
                            {event}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {/* A trust verdict over a metric's inputs. Its own
                          vocabulary, so its own tones. */}
                      <StatusBadge
                        tone={VERDICT_TONE[kpi.verdict] ?? 'quiet'}
                        small
                        label={humanize(kpi.verdict)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroller>
        </Panel>

        <Panel
          title="Voyager instrumentation, by layer"
          lede="A zero on this family can mean four different things, and one observed/declared pair cannot say which"
        >
          <Scroller minWidth={420}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Layer</th>
                  <th scope="col" className={styles.right}>Observed</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {coverage.voyagerLayers.map((layer) => (
                  <tr key={layer.layer}>
                    <th scope="row" title={layer.note}>
                      {humanize(layer.layer)}
                      <div className={styles.rankNote}>{layer.note}</div>
                    </th>
                    <td className={styles.num}>
                      {layer.observed} / {layer.events.length}
                    </td>
                    <td>
                      <StatusBadge
                        tone={LAYER_TONE[layer.status] ?? 'quiet'}
                        small
                        label={humanize(layer.status)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroller>
        </Panel>
      </div>

      <div className={styles.gapTop}>
        <Panel
          title="Every declared event"
          lede="And whether it has been seen — the raw material every panel above is folded from"
        >
          <Scroller minWidth={860}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Surface</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Feature</th>
                  <th scope="col" className={styles.right}>Count</th>
                  <th scope="col" className={styles.right}>Last seen</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {coverage.rows.length === 0 ? (
                  <EmptyRow span={7}>The event registry is empty.</EmptyRow>
                ) : (
                  coverage.rows.map((row) => (
                    <tr key={row.event}>
                      <th scope="row">
                        <code className={styles.mono}>{row.event}</code>
                      </th>
                      <td className={styles.nowrap}>{row.surface}</td>
                      <td>{row.kind}</td>
                      <td>{humanize(row.featureState)}</td>
                      <td className={styles.num}>{formatCount(row.count)}</td>
                      <td className={styles.num}>{ago(row.lastSeen, data.queriedAtMs)}</td>
                      <td>
                        <StatusBadge
                          tone={COVERAGE_TONE[row.status] ?? 'quiet'}
                          small
                          label={humanize(row.status)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Scroller>
        </Panel>
      </div>
    </Section>
  );
}
