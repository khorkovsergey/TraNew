import type { ReliabilityReport } from '@/lib/admin-metrics/families/reliability';
import { formatVital, VITAL_THRESHOLDS } from '@/lib/admin-metrics/webVitals';
import { MetricCard } from './MetricCard';
import styles from './Observatory.module.css';

const pct = (value: number | null) => (value === null ? '—' : `${(value * 100).toFixed(1)}%`);

/**
 * Reliability, market data health and Supercharts.
 *
 * Three blocks with three different provenances, and the page says which is
 * which. Web Vitals and runtime failures are this section's own telemetry and
 * arrive today; provider outcomes wait on the Markets section; chart capability
 * outcomes wait on Superchart. A zero that means "nobody has wired it" is
 * labelled differently from a zero that means "nothing went wrong".
 *
 * There is deliberately **no single health score**. A green light hides which
 * of a dozen things is degraded, and the only useful answer to "is the portal
 * healthy" is the list.
 */
export function ReliabilityPanel({ report }: { report: ReliabilityReport }) {
  return (
    <section>
      <h2 className={styles.sectionTitle}>Reliability &amp; data health</h2>

      <h3 className={styles.sectionTitle}>Core Web Vitals — p75 is the headline</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Metric</th>
            <th>p50</th>
            <th>p75</th>
            <th>p90</th>
            <th>Poor</th>
            <th>Needs work</th>
            <th>Sample</th>
          </tr>
        </thead>
        <tbody>
          {report.vitals.map((vital) => (
            <tr key={vital.metric}>
              <td>
                {vital.metric.toUpperCase()}{' '}
                <span className={styles.cardAbsent}>
                  ({VITAL_THRESHOLDS[vital.metric].unit === 'score' ? 'score' : 'time'})
                </span>
              </td>
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
      <p className={styles.subtitle}>
        An em dash means the sample is below the minimum, not that the page is fast. A percentile
        over a handful of loads describes a handful of loads.
      </p>

      <h3 className={styles.sectionTitle}>Runtime failures</h3>
      <div className={styles.grid}>
        <MetricCard label="Client failures" metric={report.failures.total} />
        <MetricCard label="Failures per 1,000 page views" metric={report.failures.perThousandPageViews} />
      </div>
      <p className={styles.subtitle}>
        Counted by class and surface. No message, no stack, no URL — error text is written by
        whoever threw it and routinely carries an id or a fragment of somebody&apos;s input, and
        there is no dependable way to sanitise it.{' '}
        {report.failures.byClass.length
          ? report.failures.byClass.map((row) => `${row.key}: ${row.count}`).join(' · ')
          : 'Nothing recorded in this window.'}
      </p>

      <h3 className={styles.sectionTitle}>Market data health</h3>
      <p className={styles.subtitle}>
        Quotes provider {report.market.quotesConfigured ? 'configured' : 'not configured'} · macro
        provider {report.market.macroConfigured ? 'configured' : 'not configured'} — read from
        runtime configuration, not by calling a provider. {report.market.delayedPolicy}
      </p>
      {report.market.awaitingEmitter ? (
        <p className={styles.notice}>
          <strong>Resolution outcomes await the Markets emitter.</strong> Configuration above is
          known; outcomes are not, and the cards say so rather than showing zero failures — which
          would claim nothing has ever gone wrong.
        </p>
      ) : null}
      <div className={styles.grid}>
        <MetricCard label="Market data resolutions" metric={report.market.requests} />
        <MetricCard label="Successful resolutions" metric={report.market.successes} />
        <MetricCard label="No data returned" metric={report.market.noData} />
        <MetricCard label="Provider/configuration failures seen by the client" metric={report.market.providerErrors} />
      </div>
      {report.market.freshness.length ? (
        <p className={styles.subtitle}>
          Freshness:{' '}
          {report.market.freshness.map((row) => `${row.key.replace(/_/g, ' ')} ${row.count}`).join(' · ')}
        </p>
      ) : null}

      <h3 className={styles.sectionTitle}>Supercharts</h3>
      <p className={styles.subtitle}>
        {report.supercharts.opens} opens · {report.supercharts.sessionsWithStudy} sessions used a
        study, {report.supercharts.sessionsWithPaneStudy} of them a study on its own pane ·{' '}
        {report.supercharts.overlayActivations} overlay activations ·{' '}
        {report.supercharts.paneActivations} pane activations · {report.supercharts.drawings}{' '}
        drawings · {report.supercharts.layoutsSaved} layouts saved ·{' '}
        {report.supercharts.scriptsGenerated} scripts generated,{' '}
        {report.supercharts.scriptsExported} exported.
      </p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Study</th>
            <th>Placement</th>
            <th>Activations</th>
          </tr>
        </thead>
        <tbody>
          {report.supercharts.studyMix.length === 0 ? (
            <tr>
              <td colSpan={3}>No study activated in this window.</td>
            </tr>
          ) : (
            report.supercharts.studyMix.map((row) => (
              <tr key={row.study}>
                <td>
                  <code>{row.study}</code>
                </td>
                <td>{row.placement}</td>
                <td>{row.activations}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <p className={styles.subtitle}>
        Native separate panes —{' '}
        {report.supercharts.nativePaneMix.map((row) => `${row.study} ${row.activations}`).join(' · ')}.
        RSI, MACD and Volume render on their own axis in this product; none of them is a TradingView
        handoff, and Supercharts has no handoff at all.
        {report.supercharts.awaitingCapabilityEmitter ? (
          <>
            {' '}
            Capability outcomes — fulfilled, no data, unsupported — await the Superchart emitter, so
            the study figures above are what people <em>asked</em> for rather than what rendered.
          </>
        ) : null}
      </p>
      {report.supercharts.previewOutcomes.length ? (
        <p className={styles.subtitle}>
          Pine preview outcomes:{' '}
          {report.supercharts.previewOutcomes.map((row) => `${row.outcome} ${row.count}`).join(' · ')}.
          Pine is generated, exported and previewed — never executed or backtested, which this
          product does not do.
        </p>
      ) : null}

      <h3 className={styles.sectionTitle}>Observability sources</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Source</th>
            <th>Last seen</th>
            <th>Stale</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          {report.sources.map((source) => (
            <tr key={source.source}>
              <td>{source.source}</td>
              <td>{source.lastSeen ?? 'never'}</td>
              <td>{source.stale ? 'yes' : 'no'}</td>
              <td>{source.why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
