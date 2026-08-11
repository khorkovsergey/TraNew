'use client';

import { useMemo, useState } from 'react';
import { DICTIONARY_BY_ID, METRIC_DICTIONARY_ALL } from '@/lib/admin-metrics/dictionary';
import type { MetricValue } from '@/lib/analytics/states';
import { Drawer, DrawerBlock } from './Drawer';
import { STATE_LABEL, STATE_MEANING, ago, display, formatCount, humanize, utcClock } from './format';
import { StateBadge, StatusBadge } from './primitives';
import { buildProductAreas } from './sections/productAreaModel';
import styles from './Observatory.module.css';
import type { DrawerRequest, ObservatoryData } from './types';
import { FILTER_GROUPS, type FilterState } from './filters';

/**
 * The four drawers.
 *
 * All of them read state already on the page — no drawer fetches anything, and
 * none of them can show a number the section behind it did not already have.
 *
 * The privacy contract holds inside a drawer exactly as it does outside one:
 * definitions, populations, exclusions, sources and counts. **No raw telemetry
 * row, no session, no user.** A drill-down that could return "which sessions"
 * is a behavioural inspection tool, and this product's own contract rules one
 * out — which is why the metric drawer shows a formula rather than a sample.
 */

/* ============================================================ Metric drawer */

export function MetricDrawer({
  metricId,
  label,
  metric,
  anchor,
  onClose,
  onOpenDictionary,
}: {
  metricId: string;
  label: string;
  metric: MetricValue | undefined;
  anchor: number;
  onClose: () => void;
  onOpenDictionary: () => void;
}) {
  const definition = DICTIONARY_BY_ID.get(metricId);
  const shown = metric
    ? display(metric, definition?.formula.includes('÷') || metricId.includes('rate') ? 'percent' : 'count')
    : null;

  return (
    <Drawer
      kicker="Metric drill-down"
      title={definition?.label ?? label}
      subtitle={definition ? `${humanize(definition.sourceType)} · grain: ${definition.grain}` : 'Count — no formula required'}
      onClose={onClose}
    >
      {metric && shown ? (
        <div className={styles.drawerHero} data-state={shown.state}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 11, flexWrap: 'wrap' }}>
            <span
              className={`${shown.kind === 'value' ? styles.drawerHeroValue : styles.drawerHeroAbsent} ${styles.stateText}`}
              data-state={shown.state}
            >
              {shown.text}
            </span>
            <StateBadge state={shown.state} />
          </div>
          <p className={styles.drawerHeroDenom}>
            {shown.kind === 'value'
              ? `n = ${formatCount(shown.sample)} · ${STATE_MEANING[shown.state]}`
              : shown.detail}
          </p>
        </div>
      ) : null}

      {/*
        No comparison block. There is no previous-period source in the query
        layer, so a "vs previous" row here would be the same invention the KPI
        card refuses to make, just one click deeper.
      */}
      <DrawerBlock title="Comparison">
        <p className={styles.drawerText}>
          No previous-period comparison exists. The query layer returns one aggregate per window and
          keeps no historical snapshot, so there is nothing to compare this against — and a delta
          computed from a second live query over an adjacent window would move with traffic volume
          rather than with the metric.
        </p>
      </DrawerBlock>

      {definition ? (
        <>
          <DrawerBlock title="Formula">
            <div className={styles.drawerCode}>{definition.formula}</div>
          </DrawerBlock>

          <DrawerBlock title="Numerator">
            <p className={styles.drawerText}>{definition.numerator}</p>
          </DrawerBlock>

          <DrawerBlock title="Denominator">
            <p className={styles.drawerText}>{definition.denominator}</p>
          </DrawerBlock>

          <DrawerBlock title="Eligible population">
            <p className={styles.drawerText}>{definition.eligiblePopulation}</p>
          </DrawerBlock>

          {definition.exclusions.length > 0 ? (
            <DrawerBlock title="Exclusions">
              <ul className={styles.drawerList}>
                {definition.exclusions.map((exclusion) => (
                  <li key={exclusion}>{exclusion}</li>
                ))}
              </ul>
            </DrawerBlock>
          ) : null}

          <DrawerBlock title="Time semantics">
            <p className={styles.drawerText}>{definition.timeSemantics}</p>
          </DrawerBlock>

          {definition.sourceEvents.length > 0 ? (
            <DrawerBlock title="Source events">
              <div className={styles.pillRow}>
                {definition.sourceEvents.map((event) => (
                  <span key={event} className={`${styles.pill} ${styles.mono}`}>
                    {event}
                  </span>
                ))}
              </div>
            </DrawerBlock>
          ) : null}

          <DrawerBlock title="Limitations">
            <ul className={styles.drawerList}>
              {definition.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </DrawerBlock>

          <DrawerBlock title="Minimum sample">
            <p className={styles.drawerText}>
              {definition.minimumSample > 0
                ? `${definition.minimumSample}. Below it the count shows and the rate is withheld — a rate over a smaller population describes individuals rather than a pattern.`
                : 'None. This is a count or an integrity check rather than a rate.'}
            </p>
          </DrawerBlock>
        </>
      ) : (
        <DrawerBlock title="Definition">
          <p className={styles.drawerText}>
            No dictionary entry. This is a count rather than a derived rate —{' '}
            <code className={styles.mono}>{metric?.source ?? 'its source'}</code> is its own
            definition, and its caveats travel with the family it belongs to. Sixty near-identical
            entries would bury the ones that state something a reader could get wrong.
          </p>
        </DrawerBlock>
      )}

      {metric ? (
        <DrawerBlock title="Provenance">
          <div>
            <div className={styles.kv}>
              <span className={styles.kvLabel}>Metric id</span>
              <span className={`${styles.kvValue} ${styles.mono}`}>{metric.metricId}</span>
            </div>
            <div className={styles.kv}>
              <span className={styles.kvLabel}>Source</span>
              <span className={`${styles.kvValue} ${styles.mono}`}>{metric.source}</span>
            </div>
            <div className={styles.kv}>
              <span className={styles.kvLabel}>Evidence kind</span>
              <span className={styles.kvValue}>{humanize(metric.sourceType)}</span>
            </div>
            <div className={styles.kv}>
              <span className={styles.kvLabel}>Queried at</span>
              <span className={styles.kvValue}>{utcClock(metric.queriedAt)}</span>
            </div>
            {metric.freshestAt ? (
              <div className={styles.kv}>
                <span className={styles.kvLabel}>Newest event behind it</span>
                <span className={styles.kvValue}>{ago(metric.freshestAt, anchor)}</span>
              </div>
            ) : null}
            {definition ? (
              <div className={styles.kv}>
                <span className={styles.kvLabel}>Owner</span>
                <span className={styles.kvValue}>{definition.owner}</span>
              </div>
            ) : null}
          </div>
        </DrawerBlock>
      ) : null}

      <DrawerBlock title="Privacy">
        <p className={styles.drawerText}>
          Aggregates only. No telemetry row, session id, user id, prompt, answer or search text is
          available at this level or any other — a drill-down that could name individuals would be a
          behavioural inspection tool rather than a dashboard.
        </p>
      </DrawerBlock>

      <button type="button" className={styles.drawerReset} onClick={onOpenDictionary}>
        Open the full metric dictionary
      </button>
    </Drawer>
  );
}

/* ======================================================== Dictionary drawer */

export function DictionaryDrawer({
  onClose,
  onOpenMetric,
}: {
  onClose: () => void;
  onOpenMetric: (metricId: string, label: string) => void;
}) {
  const [query, setQuery] = useState('');

  const entries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return METRIC_DICTIONARY_ALL;
    return METRIC_DICTIONARY_ALL.filter(
      (entry) =>
        entry.label.toLowerCase().includes(needle) ||
        entry.id.includes(needle) ||
        entry.owner.includes(needle)
    );
  }, [query]);

  return (
    <Drawer
      kicker="Reference"
      title="Metric dictionary"
      subtitle={`${METRIC_DICTIONARY_ALL.length} definitions · the same entries the queries read, not a copy of them`}
      onClose={onClose}
    >
      <label className={styles.searchBox} style={{ width: '100%' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4c6076" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <input
          className={styles.searchInput}
          style={{ width: '100%' }}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search definitions"
          aria-label="Search the metric dictionary"
          type="search"
        />
      </label>

      {entries.length === 0 ? (
        <p className={styles.drawerText}>No definition matches that search.</p>
      ) : (
        entries.map((entry) => (
          <div key={entry.id} className={styles.subPanel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
              <button
                type="button"
                className={styles.panelTitle}
                onClick={() => onOpenMetric(entry.id, entry.label)}
                style={{ color: 'var(--obs-link)' }}
              >
                {entry.label}
              </button>
              <span className={styles.pill}>{entry.owner}</span>
            </div>
            <p className={`${styles.note} ${styles.noteTop}`}>{entry.formula}</p>
            <p className={styles.note} style={{ marginTop: 6, color: 'var(--obs-faint)' }}>
              <code className={styles.mono}>{entry.id}</code> · {humanize(entry.sourceType)} · grain{' '}
              {entry.grain}
              {entry.minimumSample > 0 ? ` · min n ${entry.minimumSample}` : ''}
            </p>
          </div>
        ))
      )}
    </Drawer>
  );
}

/* ============================================================ Source drawer */

export function SourceDrawer({ data, onClose }: { data: ObservatoryData; onClose: () => void }) {
  const { reliability, coverage, voyager, families } = data;

  return (
    <Drawer
      kicker="Data sources"
      title="What is connected, and what is not"
      subtitle="Source state — never raw events"
      onClose={onClose}
    >
      <DrawerBlock title="Telemetry sources">
        <div>
          {reliability.sources.map((source) => (
            <div key={source.source} className={styles.kv}>
              <span className={styles.kvLabel} title={source.why}>
                {source.source}
              </span>
              <span className={styles.kvValue}>
                {ago(source.lastSeen, data.queriedAtMs)}{' '}
                {/* `stale` only where the freshness budget actually overran.
                    Never-seen is operational status, not a small sample. */}
                {source.stale ? (
                  <StateBadge state="stale" small />
                ) : (
                  <StatusBadge
                    tone={source.lastSeen ? 'positive' : 'quiet'}
                    small
                    label={source.lastSeen ? 'Seen' : 'Never seen'}
                  />
                )}
              </span>
            </div>
          ))}
        </div>
        <p className={`${styles.note} ${styles.noteTop}`}>
          Only sources with an expected cadence carry a staleness budget. The rest report their
          last-seen time and claim nothing about health, because silence there means nobody asked
          rather than that the pipeline broke.
        </p>
      </DrawerBlock>

      <DrawerBlock title="Durable tables">
        <div className={styles.pillRow}>
          {[...new Set(Object.values(families).flatMap((family) =>
            family && typeof family === 'object' && 'sources' in family ? (family as { sources: string[] }).sources : []
          ))].map((source) => (
            <span key={source} className={`${styles.pill} ${styles.mono}`}>
              {source}
            </span>
          ))}
        </div>
        <p className={`${styles.note} ${styles.noteTop}`}>
          Read as counts and grouped columns only — no adapter selects a row. Several of these tables
          hold names, emails, encrypted notes and financial values a column away from the fields the
          aggregates need.
        </p>
      </DrawerBlock>

      <DrawerBlock title="Not connected">
        <ul className={styles.drawerList}>
          <li>
            <strong className={styles.strong}>Payment provider.</strong> No provider-confirmed
            transaction exists, so confirmed revenue has no source. A `paid` row is an application
            record and `externalRef` — the reconciliation hook — is never populated.
          </li>
          <li>
            <strong className={styles.strong}>Search Console.</strong> No organic impression, click
            or position data. Awareness stays a lifecycle stage with no source rather than a zero.
          </li>
          <li>
            <strong className={styles.strong}>AI-citation monitoring.</strong> No way to see an
            assistant recommending the portal without sending a click.
          </li>
          <li>
            <strong className={styles.strong}>Anonymous identity.</strong> No cross-session anonymous
            key exists and none was invented. The only anonymous key the portal has is a day-scoped
            HMAC of an IP that rate-limits Voyager, and reusing it would turn a rate limiter into a
            behavioural history.
          </li>
        </ul>
      </DrawerBlock>

      <DrawerBlock title="Awaiting an emitter from another section">
        <div>
          <div className={styles.kv}>
            <span className={styles.kvLabel}>
              <code className={styles.mono}>voyager_request_completed</code>
            </span>
            <span className={styles.kvValue}>
              <StateBadge state={voyager.awaitingEmitter ? 'not_measurable' : 'live'} small />
            </span>
          </div>
          <div className={styles.kv}>
            <span className={styles.kvLabel}>
              <code className={styles.mono}>market_data_request_completed</code>
            </span>
            <span className={styles.kvValue}>
              <StateBadge state={reliability.market.awaitingEmitter ? 'not_measurable' : 'live'} small />
            </span>
          </div>
          <div className={styles.kv}>
            <span className={styles.kvLabel}>
              <code className={styles.mono}>superchart_capability_completed</code>
            </span>
            <span className={styles.kvValue}>
              <StateBadge
                state={reliability.supercharts.awaitingCapabilityEmitter ? 'not_measurable' : 'live'}
                small
              />
            </span>
          </div>
        </div>
        <p className={`${styles.note} ${styles.noteTop}`}>
          An unshipped emitter is not an absence of usage, and every metric behind one reports{' '}
          <strong className={styles.strong}>not measurable</strong> rather than zero.
        </p>
      </DrawerBlock>

      <DrawerBlock title="Collection">
        <div>
          <div className={styles.kv}>
            <span className={styles.kvLabel}>First row ever received</span>
            <span className={styles.kvValue}>{coverage.collectingSince ?? 'never'}</span>
          </div>
          <div className={styles.kv}>
            <span className={styles.kvLabel}>Events declared</span>
            <span className={styles.kvValue}>{coverage.totals.declared}</span>
          </div>
          <div className={styles.kv}>
            <span className={styles.kvLabel}>Queried at</span>
            <span className={styles.kvValue}>{utcClock(coverage.queriedAt)}</span>
          </div>
        </div>
      </DrawerBlock>
    </Drawer>
  );
}

/* ============================================================== Area drawer */

export function AreaDrawer({
  data,
  areaKey,
  onClose,
}: {
  data: ObservatoryData;
  areaKey: string;
  onClose: () => void;
}) {
  const area = useMemo(() => buildProductAreas(data).find((row) => row.key === areaKey), [data, areaKey]);

  if (!area) {
    return (
      <Drawer kicker="Product area" title="Unknown area" onClose={onClose}>
        <p className={styles.drawerText}>That surface is not in the registry.</p>
      </Drawer>
    );
  }

  const events = data.coverage.rows.filter(
    (row) => row.surface === area.key && row.lifecycle === 'current'
  );

  return (
    <Drawer
      kicker={`Product area · ${area.category}`}
      title={area.name}
      subtitle={area.routes.join('  ·  ') || 'no route of its own'}
      onClose={onClose}
    >
      <div className={styles.drawerHero} data-state={area.state}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap' }}>
          <span className={`${styles.drawerHeroAbsent} ${styles.stateText}`} data-state={area.state}>
            {STATE_LABEL[area.state]}
          </span>
          <StateBadge state={area.state} />
        </div>
        <p className={styles.drawerHeroDenom}>{area.note}</p>
      </div>

      <DrawerBlock title="Instrumentation">
        <div>
          <div className={styles.kv}>
            <span className={styles.kvLabel}>Events declared</span>
            <span className={styles.kvValue}>{area.declared}</span>
          </div>
          <div className={styles.kv}>
            <span className={styles.kvLabel}>Events observed</span>
            <span className={styles.kvValue}>{area.observed}</span>
          </div>
          <div className={styles.kv}>
            <span className={styles.kvLabel}>Last seen</span>
            <span className={styles.kvValue}>{ago(area.lastSeen, data.queriedAtMs)}</span>
          </div>
        </div>
      </DrawerBlock>

      {events.length > 0 ? (
        <DrawerBlock title="Declared events">
          <div>
            {events.map((event) => (
              <div key={event.event} className={styles.kv}>
                <span className={`${styles.kvLabel} ${styles.mono}`}>{event.event}</span>
                <span className={styles.kvValue}>
                  {formatCount(event.count)}{' '}
                  {/* Coverage status, matching section 13 — a tone, except
                      where a flag genuinely makes the event unreachable. */}
                  {event.status === 'unexposed' ? (
                    <StateBadge state="feature_disabled" small />
                  ) : (
                    <StatusBadge
                      tone={event.status === 'observed' ? 'positive' : 'caution'}
                      small
                      label={humanize(event.status)}
                    />
                  )}
                </span>
              </div>
            ))}
          </div>
        </DrawerBlock>
      ) : null}

      {area.metrics.length > 0 ? (
        <DrawerBlock title="Durable facts">
          <div>
            {area.metrics.map(({ label, metric }) => {
              const shown = display(metric);
              return (
                <div key={label} className={styles.kv}>
                  <span className={styles.kvLabel}>{label}</span>
                  <span className={`${styles.kvValue} ${styles.stateText}`} data-state={shown.state}>
                    {shown.text}
                  </span>
                </div>
              );
            })}
          </div>
        </DrawerBlock>
      ) : null}

      {area.family ? (
        <DrawerBlock title="Limitations">
          <ul className={styles.drawerList}>
            {area.family.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </DrawerBlock>
      ) : null}
    </Drawer>
  );
}

/* =========================================================== Filters drawer */

export function FiltersDrawer({
  filters,
  onChange,
  onReset,
  onClose,
}: {
  filters: FilterState;
  onChange: (group: string, option: string) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <Drawer
      kicker="Segmentation"
      title="Filters"
      subtitle="A dimension the query layer cannot segment on is disabled rather than hidden"
      narrow
      onClose={onClose}
    >
      {FILTER_GROUPS.map((group) => (
        <DrawerBlock key={group.key} title={group.label}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {group.options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={styles.drawerFilterOption}
                aria-pressed={filters[group.key] === option.value}
                disabled={!group.supported && option.value !== 'All'}
                title={group.supported ? undefined : 'Segmentation not available in the current query layer'}
                onClick={() => onChange(group.key, option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {!group.supported ? (
            <p className={`${styles.note} ${styles.noteTop}`}>{group.why}</p>
          ) : null}
        </DrawerBlock>
      ))}

      <button type="button" className={styles.drawerReset} onClick={onReset}>
        Reset all filters
      </button>
    </Drawer>
  );
}

/** Re-exported so the shell can pick a drawer without importing five modules. */
export type { DrawerRequest };
