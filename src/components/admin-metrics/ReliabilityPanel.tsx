import type { ReliabilityReport } from '@/lib/admin-metrics/families/reliability';
import { formatVital, VITAL_THRESHOLDS } from '@/lib/admin-metrics/webVitals';
import { MetricCard } from './MetricCard';
import styles from './Observatory.module.css';

const pct = (value: number | null) => (value === null ? '—' : `${(value * 100).toFixed(1)}%`);

/**
 * Three blocks that used to be one panel.
 *
 * Split for Phase 6 because they answer different questions and belong in
 * different places in the story — reliability is about the page, market data is
 * about the product's inputs, and Supercharts is a feature. They still read
 * from one report and one query, so nothing was duplicated to separate them.
 */

/* ------------------------------------------------------------- Web Vitals */

export function VitalsBlock({ report }: { report: ReliabilityReport }) {
  return (
    <>
      <div className={styles.scroller}>
        <table className={styles.table}>
          <caption className={styles.tableCaption}>
            Core Web Vitals. p75 is the number to read — an average hides the tail people actually
            experience.
          </caption>
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col">p50</th>
              <th scope="col">p75</th>
              <th scope="col">p90</th>
              <th scope="col">Poor</th>
              <th scope="col">Needs work</th>
              <th scope="col">Sample</th>
            </tr>
          </thead>
          <tbody>
            {report.vitals.map((vital) => (
              <tr key={vital.metric}>
                <th scope="row">
                  {vital.metric.toUpperCase()}{' '}
                  <span className={styles.cardAbsent}>
                    {VITAL_THRESHOLDS[vital.metric].unit === 'score' ? '(score)' : '(time)'}
                  </span>
                </th>
                <td>{vital.p50 === null ? '—' : formatVital(vital.metric, vital.p50)}</td>
                <td>{vital.p75 === null ? '—' : formatVital(vital.metric, vital.p75)}</td>
                <td>{vital.p90 === null ? '—' : formatVital(vital.metric, vital.p90)}</td>
                <td>{pct(vital.poorShare)}</td>
                <td>{pct(vital.needsImprovementShare)}</td>
                <td>{vital.sample}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.grid}>
        <MetricCard label="Client failures" metric={report.failures.total} />
        <MetricCard
          label="Failures per 1,000 page views"
          metric={report.failures.perThousandPageViews}
          of="per 1,000 eligible page views"
        />
      </div>
    </>
  );
}

export function VitalsDetail({ report }: { report: ReliabilityReport }) {
  return (
    <>
      <p className={styles.note}>
        A dash means the sample is below the minimum — not that the page is fast. CLS is a unitless
        score and the four others are times; the units are per row rather than assumed.
      </p>
      <p className={styles.note}>
        Failures are counted by class and surface and nothing else. No message, no stack, no URL:
        error text is written by whoever threw it and routinely carries an id or a fragment of
        somebody&apos;s input, and there is no dependable way to sanitise it.{' '}
        {report.failures.byClass.length
          ? report.failures.byClass.map((row) => `${row.key}: ${row.count}`).join(' · ')
          : 'Nothing recorded in this period.'}
      </p>
    </>
  );
}

/* ------------------------------------------------------------ Market data */

export function MarketBlock({ report }: { report: ReliabilityReport }) {
  return (
    <div className={styles.grid}>
      <MetricCard label="Market data resolutions" metric={report.market.requests} />
      <MetricCard label="Successful resolutions" metric={report.market.successes} />
      <MetricCard label="No data returned" metric={report.market.noData} />
      <MetricCard
        label="Failures seen by the client"
        metric={report.market.providerErrors}
        of="provider or configuration"
      />
    </div>
  );
}

export function MarketDetail({ report }: { report: ReliabilityReport }) {
  return (
    <>
      <p className={styles.note}>
        Quotes provider {report.market.quotesConfigured ? 'configured' : 'not configured'} · macro
        provider {report.market.macroConfigured ? 'configured' : 'not configured'} — read from
        runtime configuration, not by calling a provider.
      </p>
      <p className={styles.note}>{report.market.delayedPolicy}</p>
      <p className={styles.note}>
        A resolution is one completed invocation of a market-data client function reporting what the
        product saw. It is not a count of upstream network calls: the client fetches through the
        Next data cache, which is transparent at that layer, so a success may have been served
        without anything leaving the machine. An empty batch request resolves nothing and therefore
        emits nothing, so this is not literally every invocation either.
      </p>
      {report.market.freshness.length ? (
        <p className={styles.note}>
          Freshness:{' '}
          {report.market.freshness.map((row) => `${row.key.replace(/_/g, ' ')} ${row.count}`).join(' · ')}
          . Judged against the cadence of the data — a Friday close is not stale on a Saturday, and a
          monthly macro series has no meaningful staleness at all.
        </p>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------ Supercharts */

export function SuperchartsBlock({ report }: { report: ReliabilityReport }) {
  const charts = report.supercharts;

  return (
    <>
      <div className={styles.grid}>
        <MetricCard
          label="Chart opens"
          metric={{
            state: 'instrumented_going_forward',
            value: charts.opens,
            sample: charts.opens,
            metricId: 'supercharts_opens',
            source: 'product_telemetry_event · superchart_opened',
            sourceType: 'telemetry',
            queriedAt: report.queriedAt,
          }}
        />
        <MetricCard
          label="Sessions using a study"
          metric={{
            state: 'instrumented_going_forward',
            value: charts.sessionsWithStudy,
            sample: charts.sessionsWithStudy,
            metricId: 'supercharts_study_sessions',
            source: 'product_telemetry_event · superchart_study_toggled',
            sourceType: 'telemetry',
            queriedAt: report.queriedAt,
          }}
        />
        <MetricCard
          label="Separate-pane activations"
          metric={{
            state: 'instrumented_going_forward',
            value: charts.paneActivations,
            sample: charts.paneActivations,
            metricId: 'supercharts_pane_activations',
            source: 'product_telemetry_event · superchart_study_toggled',
            sourceType: 'telemetry',
            queriedAt: report.queriedAt,
          }}
        />
        <MetricCard
          label="Overlay activations"
          metric={{
            state: 'instrumented_going_forward',
            value: charts.overlayActivations,
            sample: charts.overlayActivations,
            metricId: 'supercharts_overlay_activations',
            source: 'product_telemetry_event · superchart_study_toggled',
            sourceType: 'telemetry',
            queriedAt: report.queriedAt,
          }}
        />
      </div>

      <p className={styles.note}>
        <strong>Intent and outcome are different rows.</strong>{' '}
        {charts.awaitingCapabilityEmitter
          ? 'The figures above come from the toggle, which fires before the engine acts — so they are what people asked for. Rendered outcomes and capability results are instrumented going forward and appear here automatically once the first event arrives.'
          : 'Rendered outcomes are recorded separately from the toggle, so a click is never reported as a render.'}
      </p>
    </>
  );
}

export function SuperchartsDetail({ report }: { report: ReliabilityReport }) {
  const charts = report.supercharts;

  return (
    <>
      <div className={styles.scroller}>
        <table className={styles.table}>
          <caption className={styles.tableCaption}>
            Study mix. Placement comes from the canonical indicator registry.
          </caption>
          <thead>
            <tr>
              <th scope="col">Study</th>
              <th scope="col">Placement</th>
              <th scope="col">Activations</th>
            </tr>
          </thead>
          <tbody>
            {charts.studyMix.length === 0 ? (
              <tr>
                <td colSpan={3}>No study activated in this period.</td>
              </tr>
            ) : (
              charts.studyMix.map((row) => (
                <tr key={row.study}>
                  <th scope="row">
                    <code>{row.study}</code>
                  </th>
                  <td>{row.placement}</td>
                  <td>{row.activations}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className={styles.note}>
        Native separate panes —{' '}
        {charts.nativePaneMix.map((row) => `${row.study} ${row.activations}`).join(' · ')}. RSI, MACD
        and Volume render on their own axis in this product. None of them is a TradingView handoff,
        and Supercharts has no handoff at all — so there is no handoff metric here.
      </p>

      {charts.capability.length ? (
        <p className={styles.note}>
          Capability outcomes: {charts.capability.map((row) => `${row.outcome} ${row.count}`).join(' · ')}.
          A data gap and an unsupported capability are separate outcomes, because collapsing them
          would make a provider limitation look like a missing feature.
        </p>
      ) : null}

      {charts.previewOutcomes.length ? (
        <p className={styles.note}>
          Pine preview outcomes: {charts.previewOutcomes.map((row) => `${row.outcome} ${row.count}`).join(' · ')}.
          Pine is generated, exported and previewed — never executed or backtested, which this
          product does not do.
        </p>
      ) : null}

      <p className={styles.note}>
        {charts.drawings} drawings · {charts.layoutsSaved} layouts saved · {charts.scriptsGenerated}{' '}
        scripts generated, {charts.scriptsExported} exported.
      </p>
    </>
  );
}

/* -------------------------------------------------------- Source freshness */

export function SourceFreshness({ report }: { report: ReliabilityReport }) {
  return (
    <div className={styles.scroller}>
      <table className={styles.table}>
        <caption className={styles.tableCaption}>
          Observability sources. Only a source with an expected cadence can be stale — silence
          elsewhere means nobody used the feature, which is a fact about traffic rather than about
          the pipeline.
        </caption>
        <thead>
          <tr>
            <th scope="col">Source</th>
            <th scope="col">Last seen</th>
            <th scope="col">Stale</th>
            <th scope="col">Why</th>
          </tr>
        </thead>
        <tbody>
          {report.sources.map((source) => (
            <tr key={source.source}>
              <th scope="row">{source.source}</th>
              <td>{source.lastSeen ?? 'never'}</td>
              <td>{source.stale ? 'yes' : 'no'}</td>
              <td>{source.why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
