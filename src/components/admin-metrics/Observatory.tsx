'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { METRIC_STATES } from '@/lib/analytics/states';
import { STATE_LABEL, STATE_MEANING, ago, utcClock } from './format';

import { indexMetrics } from './metricIndex';
import { AreaDrawer, DictionaryDrawer, FiltersDrawer, MetricDrawer, SourceDrawer } from './drawers';
import { DEFAULT_FILTERS, FILTER_GROUPS, activeFilterCount, type FilterState } from './filters';
import { ExecutiveOverview } from './sections/ExecutiveOverview';
import { StrategyObservability } from './sections/StrategyObservability';
import { LifecycleFunnel } from './sections/LifecycleFunnel';
import { ContinuationJourneys } from './sections/ContinuationJourneys';
import { NextStepSection } from './sections/NextStepSection';
import { RetentionCohorts } from './sections/RetentionCohorts';
import { ProductAreas } from './sections/ProductAreas';
import { VoyagerCockpit } from './sections/VoyagerCockpit';
import { SuperchartsCockpit } from './sections/SuperchartsCockpit';
import { MonetizationSection } from './sections/MonetizationSection';
import { AcquisitionSection } from './sections/AcquisitionSection';
import { ReliabilityDataHealth } from './sections/ReliabilityDataHealth';
import { InstrumentationCoverage } from './sections/InstrumentationCoverage';
import { PanelStates } from './sections/PanelStates';
import styles from './Observatory.module.css';
import type { DrawerRequest, ObservatoryData } from './types';

/**
 * The Observatory shell.
 *
 * One client component over a server-rendered payload. The page queries once,
 * hands the whole bundle across, and everything interactive — the drawers, the
 * product-area search, the filter chips, presentation mode — is local state
 * over data that is already here. **Nothing in this file can fetch, and nothing
 * can compute a rate**, which is what makes presentation mode and the filter
 * strip safe: neither has access to a value, so the most either can change is
 * emphasis.
 *
 * The range control is the one exception and it is a link, not state. It is a
 * server round trip through `?range=`, because a different window is a
 * different query and pretending otherwise would mean holding four windows in
 * memory and picking between them.
 */

/** The rail, and the section order. One entry per section, numbered as drawn. */
const SECTIONS = [
  { id: 's-exec', num: '01', label: 'Executive', presenter: true },
  { id: 's-strategy', num: '02', label: 'Strategy map', presenter: true },
  { id: 's-lifecycle', num: '03', label: 'Lifecycle', presenter: true },
  { id: 's-continuation', num: '04', label: 'Continuation', presenter: false },
  { id: 's-start', num: '05', label: 'Next Step', presenter: false },
  { id: 's-retention', num: '06', label: 'Retention', presenter: false },
  { id: 's-areas', num: '07', label: 'Product areas', presenter: false },
  { id: 's-voyager', num: '08', label: 'Voyager', presenter: true },
  { id: 's-charts', num: '09', label: 'Supercharts', presenter: false },
  { id: 's-money', num: '10', label: 'Monetization', presenter: false },
  { id: 's-acq', num: '11', label: 'Acquisition', presenter: false },
  { id: 's-reliability', num: '12', label: 'Reliability', presenter: true },
  { id: 's-coverage', num: '13', label: 'Coverage', presenter: false },
  { id: 's-states', num: '14', label: 'Panel states', presenter: false },
] as const;

/** The eight states the rail legend shows. The full eleven are in section 14. */
const LEGEND_STATES = [
  'live',
  'derived',
  'instrumented_going_forward',
  'insufficient_sample',
  'source_not_connected',
  'feature_disabled',
  'coming_soon',
  'legacy',
] as const;

const RANGE_LABEL: Record<string, string> = {
  today: 'Today',
  '7d': '7D',
  '30d': '30D',
  '90d': '90D',
};

export function Observatory({ data }: { data: ObservatoryData }) {
  const [presenting, setPresenting] = useState(false);
  const [drawer, setDrawer] = useState<DrawerRequest | null>(null);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const metrics = useMemo(() => indexMetrics(data), [data]);

  const close = useCallback(() => setDrawer(null), []);
  const open = useCallback((request: DrawerRequest) => setDrawer(request), []);

  /*
   * Escape leaves presentation mode. The drawer swallows Escape first via a
   * capturing listener of its own, so a reader in a drawer inside presentation
   * mode leaves the drawer, not the mode.
   */
  useEffect(() => {
    if (!presenting) return;
    const leave = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPresenting(false);
    };
    addEventListener('keydown', leave);
    return () => removeEventListener('keydown', leave);
  }, [presenting]);

  const freshness = freshnessChip(data);
  const filterCount = activeFilterCount(filters);

  const hidden = (presenter: boolean) =>
    presenting && !presenter ? styles.presentationHidden : undefined;

  return (
    <div className={styles.root} data-mode={presenting ? 'presentation' : 'detail'} data-observatory>
      <div className={styles.backdrop} aria-hidden="true" />

      {/* ================================================================ Header */}
      <header className={styles.header} data-observatory-header>
        <div className={styles.headerTop}>
          <div className={styles.brand}>
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden="true" className={styles.brandMark}>
              <path d="M4 22 L12 13 L18 18 L28 7" stroke="#2ee6a8" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 7h7v7" stroke="#38bdf8" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div style={{ minWidth: 0 }}>
              <h1 className={styles.title}>TradingU Product Observatory</h1>
              <p className={styles.subtitle}>Live product, growth, AI and reliability metrics</p>
            </div>
          </div>

          <div className={styles.chips}>
            <span className={styles.freshChip} data-tone={freshness.tone}>
              <span className={styles.freshDot} aria-hidden="true" />
              {freshness.label}
            </span>
            {/*
              No build identifier. The application exposes none, and a made-up
              hash beside a real environment is the kind of detail that gets
              quoted back in an incident review.
            */}
            <span className={styles.chip}>{data.environment.toUpperCase()}</span>
            <span className={styles.chip}>{data.route}</span>
          </div>

          <div className={styles.headerSpacer} />

          <div className={styles.headerControls}>
            <nav aria-label="Time range" className={styles.rangeGroup}>
              {data.ranges.map((option) => (
                <a
                  key={option}
                  href={`?range=${option}`}
                  className={styles.rangeOption}
                  aria-current={option === data.range ? 'page' : undefined}
                >
                  {RANGE_LABEL[option] ?? option}
                </a>
              ))}
            </nav>

            {/*
              The comparison control is kept for design parity and is locked to
              None with every other option disabled. No previous-period source
              exists, so a selectable "Previous week" would promise a delta the
              page can never compute.
            */}
            <label className={styles.compare}>
              Compare
              <select
                className={styles.compareSelect}
                value="None"
                disabled
                aria-label="Comparison basis — no previous-period comparison exists"
                title="no previous-period comparison exists in the current query layer, so every option but None is unavailable"
                onChange={() => undefined}
              >
                <option value="None">None available</option>
              </select>
            </label>

            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => setPresenting((value) => !value)}
              aria-pressed={presenting}
            >
              Presentation
            </button>

            <button
              type="button"
              className={`${styles.ghostButton} ${styles.filterButton}`}
              onClick={() => open({ kind: 'filters' })}
            >
              Filters <span className={styles.filterCount}>{filterCount}</span>
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------ Filter chips */}
        {!presenting ? (
          <div className={styles.filterStrip} data-filter-strip>
            {FILTER_GROUPS.map((group) => (
              <div key={group.key} className={styles.filterGroup}>
                <span className={styles.filterLabel}>{group.label}</span>
                <div className={styles.filterOptions}>
                  {group.options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={styles.filterOption}
                      aria-pressed={filters[group.key] === option.value}
                      disabled={!group.supported && option.value !== 'All'}
                      title={group.supported ? option.label : `Segmentation not available — ${group.why}`}
                      onClick={() => setFilters((current) => ({ ...current, [group.key]: option.value }))}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button type="button" className={styles.resetLink} onClick={() => setFilters(DEFAULT_FILTERS)}>
              Reset
            </button>
          </div>
        ) : null}

        {/* ------------------------------------------------------ System strip */}
        <div className={styles.systemStrip}>
          <SystemItem tone="ok" label="Environment" value={data.environment} />
          <SystemItem
            tone={data.portal.freshestAt ? 'ok' : 'warn'}
            label="Last telemetry"
            value={ago(data.portal.freshestAt, data.queriedAtMs)}
          />
          <SystemItem tone="ok" label="Queried" value={utcClock(data.overview.queriedAt)} />
          <SystemItem
            tone="ok"
            label="Coverage"
            value={`${data.coverage.totals.observed}/${data.coverage.totals.declared} events seen`}
          />
          <SystemItem
            tone={data.reliability.sources.some((source) => source.stale) ? 'warn' : 'ok'}
            label="Sources"
            value={`${data.reliability.sources.filter((source) => source.lastSeen).length}/${data.reliability.sources.length} reporting`}
          />
          <SystemItem
            tone="none"
            label="Collecting since"
            value={data.portal.collectingSince ? data.portal.collectingSince.slice(0, 10) : 'never'}
          />
          <button type="button" className={styles.linkButton} onClick={() => open({ kind: 'sources' })}>
            Data sources →
          </button>
        </div>
      </header>

      {/* ================================================================= Shell */}
      <div className={styles.shell}>
        <nav className={styles.rail} aria-label="Sections">
          {SECTIONS.map((section) => (
            <a key={section.id} href={`#${section.id}`} className={styles.railLink}>
              <span className={styles.railNum}>{section.num}</span>
              {section.label}
            </a>
          ))}

          <div className={styles.railLegend}>
            <div className={styles.railLegendTitle}>Provenance states</div>
            {LEGEND_STATES.map((state) => (
              <div key={state} className={styles.legendRow} title={STATE_MEANING[state]}>
                <span
                  className={`${styles.legendDot} ${styles.stateText}`}
                  data-state={state}
                  style={{ background: 'currentColor' }}
                  aria-hidden="true"
                />
                {STATE_LABEL[state]}
              </div>
            ))}
            <button type="button" className={styles.railAction} onClick={() => open({ kind: 'dictionary' })}>
              Metric dictionary
            </button>
          </div>
        </nav>

        <main className={styles.main} id="observatory-main">
          <ExecutiveOverview data={data} onOpen={open} />
          <StrategyObservability data={data} />
          <LifecycleFunnel data={data} onOpen={open} />

          <div className={hidden(false)}>
            <ContinuationJourneys data={data} />
          </div>
          <div className={hidden(false)}>
            <NextStepSection data={data} />
          </div>
          <div className={hidden(false)}>
            <RetentionCohorts data={data} onOpen={open} />
          </div>
          <div className={hidden(false)}>
            <ProductAreas data={data} onOpen={open} />
          </div>

          <VoyagerCockpit data={data} />

          <div className={hidden(false)}>
            <SuperchartsCockpit data={data} />
          </div>
          <div className={hidden(false)}>
            <MonetizationSection data={data} onOpen={open} />
          </div>
          <div className={hidden(false)}>
            <AcquisitionSection data={data} />
          </div>

          <ReliabilityDataHealth data={data} />

          <div className={hidden(false)}>
            <InstrumentationCoverage data={data} />
          </div>
          <div className={hidden(false)}>
            <PanelStates data={data} />
          </div>

          {/*
            The caveats that must survive presentation mode, because they qualify
            metrics that stay on screen in it. Presentation mode hides sections;
            it is never allowed to hide the reason a visible number is what it is.
          */}
          {presenting ? (
            <div className={styles.subPanel} role="status">
              <div className={styles.kicker}>Caveats for what is on screen</div>
              <ul className={styles.drawerList}>
                <li>
                  Confirmed revenue has no source: no payment provider is connected, so it is absent
                  rather than zero.
                </li>
                <li>
                  Voyager server requests count questions reaching{' '}
                  <code className={styles.mono}>POST /api/voyager</code>; the research workspace
                  answers some scripted scenarios without reaching it.
                </li>
                <li>
                  A simulated fallback is never counted as a real model answer, and a quota refusal is
                  outside the executed denominator.
                </li>
                <li>
                  Anonymous cross-session return is not measurable. Retention is authenticated only.
                </li>
                <li>
                  No previous-period comparison and no historical series exist, so no delta or trend
                  is drawn anywhere on this page.
                </li>
                <li>
                  Press <kbd>Esc</kbd> to leave presentation mode. Values are identical in both modes.
                </li>
              </ul>
            </div>
          ) : null}

          <footer className={styles.footer}>
            <span>
              Private observability surface · not in the header, footer, account menu or sitemap · no
              names, emails, IPs, prompts, answers, search text, holdings or portfolio values are
              rendered here.
            </span>
            <button type="button" className={styles.linkButton} onClick={() => open({ kind: 'dictionary' })}>
              Metric dictionary
            </button>
          </footer>
        </main>
      </div>

      {/* =============================================================== Drawers */}
      {drawer?.kind === 'metric' ? (
        <MetricDrawer
          metricId={drawer.metricId}
          label={drawer.label}
          metric={metrics.get(drawer.metricId)}
          anchor={data.queriedAtMs}
          onClose={close}
          onOpenDictionary={() => setDrawer({ kind: 'dictionary' })}
        />
      ) : null}

      {drawer?.kind === 'dictionary' ? (
        <DictionaryDrawer
          onClose={close}
          onOpenMetric={(metricId, label) => setDrawer({ kind: 'metric', metricId, label })}
        />
      ) : null}

      {drawer?.kind === 'sources' ? <SourceDrawer data={data} onClose={close} /> : null}

      {drawer?.kind === 'area' ? (
        <AreaDrawer data={data} areaKey={drawer.areaKey} onClose={close} />
      ) : null}

      {drawer?.kind === 'filters' ? (
        <FiltersDrawer
          filters={filters}
          onChange={(group, option) => setFilters((current) => ({ ...current, [group]: option }))}
          onReset={() => setFilters(DEFAULT_FILTERS)}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- Fragments */

function SystemItem({
  tone,
  label,
  value,
}: {
  tone: 'ok' | 'warn' | 'bad' | 'none';
  label: string;
  value: string;
}) {
  return (
    <span className={styles.systemItem} data-tone={tone}>
      <span className={styles.systemDot} aria-hidden="true" />
      {label} <strong className={styles.systemValue}>{value}</strong>
    </span>
  );
}

/**
 * The freshness chip.
 *
 * Green only when an event actually arrived inside the budget — the design's
 * own instruction, and the difference between a health indicator and a
 * decoration. "The React page rendered" is not freshness, so a page with no
 * telemetry at all gets the dashed no-source treatment rather than a grey dot.
 *
 * Measured against query time, so it reads "9s before query" the way the design
 * intends rather than ticking upward while somebody looks at it.
 */
function freshnessChip(data: ObservatoryData): { tone: 'ok' | 'warn' | 'none'; label: string } {
  if (!data.portal.freshestAt) return { tone: 'none', label: 'NO TELEMETRY YET' };

  const age = (data.queriedAtMs - Date.parse(data.portal.freshestAt)) / 1000;
  if (!Number.isFinite(age)) return { tone: 'none', label: 'FRESHNESS UNKNOWN' };

  /* The same fifteen-minute budget `portal.ts` applies to the session read. */
  if (age <= 900) return { tone: 'ok', label: `FRESH · ${Math.max(0, Math.round(age))}S BEFORE QUERY` };
  return {
    tone: 'warn',
    label: `DELAYED · ${ago(data.portal.freshestAt, data.queriedAtMs).toUpperCase()}`,
  };
}

/** Exported for the verifier, so the canonical list has one home. */
export const OBSERVATORY_SECTIONS = SECTIONS;
export const OBSERVATORY_STATES = METRIC_STATES;
