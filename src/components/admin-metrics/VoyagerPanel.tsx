import type { VoyagerReport } from '@/lib/admin-metrics/families/voyager';
import { MetricCard } from './MetricCard';
import styles from './Observatory.module.css';

const ms = (value: number | null) => (value === null ? '—' : `${(value / 1000).toFixed(1)} s`);

/**
 * Voyager as an AI product rather than a click surface.
 *
 * The layout carries one argument: **a real model answer and a scripted
 * fallback are different things.** They sit in the same row, labelled, never
 * summed into "answered" — a fallback is graceful degradation and reporting it
 * as success would turn a provider outage into a healthy engagement number.
 *
 * Client behaviour is presented separately from server outcome elsewhere on the
 * page, and the two are never added: a click says somebody tried, and only the
 * server knows what happened next.
 */
export function VoyagerPanel({ report }: { report: VoyagerReport }) {
  return (
    <section>
      <h2 className={styles.sectionTitle}>Voyager — what the server actually did</h2>

      {report.awaitingEmitter ? (
        <p className={styles.notice}>
          <strong>Contract ready, emitter awaited.</strong> The two server events are declared,
          validated and queryable, and the <code>voyager</code> section has not shipped the emitters
          yet — see <code>docs/admin-metrics/voyager-instrumentation-request.md</code>. Every figure
          below therefore reads <em>not measurable</em> rather than zero: nobody has decided Voyager
          is unused, the wiring simply is not finished. The moment a first row arrives these become
          real numbers with no change here.
        </p>
      ) : null}

      <p className={styles.subtitle}>
        <strong>Scope.</strong> Server requests counts questions that reach{' '}
        <code>POST /api/voyager</code>. The <code>/voyager/research</code> workspace answers some
        scripted scenarios locally and those never reach the route, so this is not a count of every
        Voyager interaction and must not be read as one.
      </p>

      <div className={styles.grid}>
        <MetricCard label="Server requests" metric={report.headline.serverRequests} />
        <MetricCard label="Real AI answer rate" metric={report.headline.realAnswerRate} format="percent" />
        <MetricCard label="Simulated fallback rate" metric={report.headline.simulatedFallbackRate} format="percent" />
        <MetricCard label="Quota refusal rate" metric={report.headline.quotaRefusalRate} format="percent" />
      </div>

      <div className={styles.grid}>
        <MetricCard label="Real AI answers" metric={report.headline.realAnswers} />
        <MetricCard label="Simulated fallbacks (not answers)" metric={report.headline.simulatedFallbacks} />
        <MetricCard label="Fallbacks despite a configured model" metric={report.headline.fallbacksDespiteConfiguredModel} />
        <MetricCard label="Server failures" metric={report.headline.serverFailures} />
      </div>

      <h3 className={styles.sectionTitle}>Quota and latency</h3>
      <div className={styles.grid}>
        <MetricCard label="Charged" metric={report.quota.charged} />
        <MetricCard label="Released" metric={report.quota.released} />
        <MetricCard label="Refused and released" metric={report.quota.refusedAndReleased} />
        <MetricCard label="Unmetered" metric={report.quota.unmetered} />
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Latency (server elapsed)</th>
            <th>Median</th>
            <th>p75</th>
            <th>p90</th>
            <th>Sample</th>
          </tr>
        </thead>
        <tbody>
          {[
            ['All executed requests', report.latency.all],
            ['Real answers', report.latency.realAnswer],
            ['Simulated fallbacks', report.latency.simulated],
          ].map(([label, summary]) => {
            const value = summary as VoyagerReport['latency']['all'];
            return (
              <tr key={label as string}>
                <td>{label as string}</td>
                <td>{ms(value.median)}</td>
                <td>{ms(value.p75)}</td>
                <td>{ms(value.p90)}</td>
                <td>{value.sample}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className={report.integrity.healthy ? styles.subtitle : styles.notice}>
        {report.integrity.healthy ? (
          <>
            Quota integrity: no contradiction between outcome and charge across{' '}
            {report.integrity.checked} recorded requests. The product charges once before the model
            and refunds when nothing was answered.
          </>
        ) : (
          <>
            <strong>Quota integrity failure.</strong> {report.integrity.violations} of{' '}
            {report.integrity.checked} requests contradict the product contract —{' '}
            {report.integrity.detail
              .map((row) => `${row.outcome} stayed ${row.disposition} (${row.rows})`)
              .join(', ')}
            . A simulated fallback that stayed charged means somebody paid for an answer they never
            received. This is a data-health failure and is deliberately not averaged into any rate.
          </>
        )}
      </p>

      <h3 className={styles.sectionTitle}>Tools</h3>
      {report.tools.executions === 0 ? (
        <p className={styles.subtitle}>
          No tool execution recorded{report.awaitingEmitter ? ' — the emitter has not landed' : ' in this window'}.
        </p>
      ) : (
        <>
          <div className={styles.grid}>
            <MetricCard
              label="Tool executions"
              metric={{
                state: 'instrumented_going_forward',
                value: report.tools.executions,
                sample: report.tools.executions,
                metricId: 'voyager_tool_executions',
                source: 'product_telemetry_event · voyager_tool_completed',
                sourceType: 'telemetry',
                queriedAt: report.queriedAt,
              }}
            />
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Tool</th>
                <th>Executions</th>
                <th>Failures</th>
                <th>Median</th>
              </tr>
            </thead>
            <tbody>
              {report.tools.byTool.map((tool) => (
                <tr key={tool.tool}>
                  <td>
                    <code>{tool.tool}</code>
                  </td>
                  <td>{tool.executions}</td>
                  <td>{tool.failures}</td>
                  <td>{ms(tool.medianMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.tools.topFailureCodes.length ? (
            <p className={styles.subtitle}>
              Failure codes: {report.tools.topFailureCodes.map((row) => `${row.code} (${row.count})`).join(' · ')}
            </p>
          ) : null}
        </>
      )}

      <h3 className={styles.sectionTitle}>Capability mix</h3>
      <div className={styles.grid}>
        <MetricCard label="Answers with a chart" metric={report.capability.answersWithChart} />
        <MetricCard label="Answers with a study" metric={report.capability.answersWithStudy} />
        <MetricCard label="Answers offering actions" metric={report.capability.answersWithActions} />
        <MetricCard label="Tool-assisted answers" metric={report.capability.toolAssistedAnswers} />
      </div>
      <p className={styles.subtitle}>
        A mix, not a fulfilment rate. Not every question asks for a chart, so this says how often
        Voyager draws — not how often it succeeds at drawing.
      </p>
    </section>
  );
}
