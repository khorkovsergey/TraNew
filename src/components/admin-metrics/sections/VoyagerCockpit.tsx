import { formatNumber, formatCount, humanize, share } from '../format';
import { EmptyRow, Meter, MiniCard, Panel, Scroller, Section, StateBadge, Tile } from '../primitives';
import styles from '../Observatory.module.css';
import type { ObservatoryData } from '../types';

/**
 * 08 — Voyager · product & AI operations.
 *
 * The design's dense cockpit, with every Phase 4 semantic intact.
 *
 * Three of them shape the layout rather than sitting in a footnote.
 *
 * **A real answer and a scripted fallback are never merged.** They are separate
 * cards, separate funnel rows and separate latency columns, because merging
 * them turns a provider outage into a healthy engagement number.
 *
 * **A quota refusal is outside the executed denominator.** The real-answer rate
 * is over requests that reached the model; the refusal rate is over every
 * request. Both denominators are printed on the card that uses them.
 *
 * **`serverRequests` is not every Voyager interaction.** It counts questions
 * that reach `POST /api/voyager`, and the research workspace answers some
 * scripted scenarios without ever getting there. The limitation is on the page,
 * not only in the dictionary.
 */
export function VoyagerCockpit({ data }: { data: ObservatoryData }) {
  const { voyager } = data;
  const { counts, headline, integrity, latency, tools, capability } = voyager;

  const ms = (value: number | null) => (value === null ? 'low n' : formatNumber(value, 'milliseconds'));

  return (
    <Section
      id="s-voyager"
      number="08"
      title="Voyager · product &amp; AI operations"
      lede="What the server actually did · no prompt or answer text is ever stored or rendered"
    >
      {voyager.awaitingEmitter ? (
        <div className={`${styles.subPanel} ${styles.gapTop}`} style={{ marginBottom: 12, borderStyle: 'dashed' }}>
          <div className={styles.kicker}>Awaiting emitter</div>
          <p className={styles.note}>
            The <code className={styles.mono}>voyager_request_completed</code> emitter belongs to the
            Voyager section and has not shipped, so no request has ever been recorded. Every figure
            below is <strong className={styles.strong}>not measurable</strong> rather than zero — a
            zero would assert that nobody uses the product&apos;s headline feature.
          </p>
        </div>
      ) : null}

      <div className={styles.fourGrid}>
        <MiniCard
          label="Server requests"
          metric={headline.serverRequests}
          sub="questions reaching POST /api/voyager"
        />
        <MiniCard
          label="Real model answers"
          metric={headline.realAnswers}
          sub={`${formatCount(counts.executed)} requests reached the model`}
        />
        <MiniCard
          label="Simulated fallbacks"
          metric={headline.simulatedFallbacks}
          sub="the scripted layer standing in — not a success"
        />
        <MiniCard
          label="Quota refusals"
          metric={headline.quotaRefusals}
          sub="never reached the model, refunded"
        />
        <MiniCard
          label="Real answer rate"
          metric={headline.realAnswerRate}
          format="percent"
          sub="of executed requests, refusals excluded"
        />
        <MiniCard
          label="Simulated fallback rate"
          metric={headline.simulatedFallbackRate}
          format="percent"
          sub="same denominator as the real answer rate"
        />
        <MiniCard
          label="Quota refusal rate"
          metric={headline.quotaRefusalRate}
          format="percent"
          sub="of every request — a refusal happened to one"
        />
        <MiniCard
          label="Server failures"
          metric={headline.serverFailures}
          sub="produced no answer, quota refunded"
        />
      </div>

      <div className={`${styles.twoGrid} ${styles.gapTop}`}>
        <Panel
          title="Request disposition"
          lede="Every server request, by what actually happened to it"
        >
          <div className={styles.stackTight}>
            <Meter label="Requests" value={counts.requests} total={counts.requests} state="derived" caption="100%" />
            <Meter
              label="Reached the model (executed)"
              value={counts.executed}
              total={counts.requests}
              state="derived"
            />
            <Meter label="Real model answer" value={counts.realAnswers} total={counts.requests} state="live" />
            <Meter
              label="Simulated fallback"
              value={counts.simulatedFallbacks}
              total={counts.requests}
              state="insufficient_sample"
            />
            <Meter
              label="Refused over the daily limit"
              value={counts.quotaRefusals}
              total={counts.requests}
              state="feature_disabled"
            />
            <Meter
              label="Server failure"
              value={counts.serverFailures}
              total={counts.requests}
              state="feature_disabled"
            />
          </div>

          <p className={`${styles.note} ${styles.noteTop}`}>
            A fallback despite a configured model —{' '}
            <strong className={styles.strong}>{formatCount(counts.fallbacksWithModel)}</strong> — is
            the operational question worth asking of this row: the server knows a model was present
            and still did not answer, and does not guess why.
          </p>
        </Panel>

        <div className={styles.stack}>
          <Panel
            title="Quota integrity"
            lede="One intentional question moves the counter by one; a refusal and an answerless attempt are refunded"
            aside={<StateBadge state={integrity.healthy ? 'live' : 'feature_disabled'} label={integrity.healthy ? 'Consistent' : 'Violations'} />}
          >
            <div className={styles.fourGrid}>
              <Tile label="Charged" value={formatCount(counts.charged)} state="derived" />
              <Tile label="Released" value={formatCount(counts.released)} state="derived" />
              <Tile label="Refused &amp; released" value={formatCount(counts.refusedReleased)} state="derived" />
              <Tile label="Unmetered" value={formatCount(counts.unmetered)} state="derived" />
            </div>

            {integrity.violations > 0 ? (
              <>
                <div className={`${styles.kicker} ${styles.noteTop}`}>Contract violations</div>
                {integrity.detail.map((row) => (
                  <div key={`${row.outcome}-${row.disposition}`} className={styles.kv}>
                    <span className={styles.kvLabel}>
                      {humanize(row.outcome)} that stayed {humanize(row.disposition)}
                    </span>
                    <span className={`${styles.kvValue} ${styles.stateText}`} data-state="feature_disabled">
                      {formatCount(row.rows)}
                    </span>
                  </div>
                ))}
                <p className={`${styles.note} ${styles.noteTop}`}>
                  A data-health failure, not a rate. It means the refund did not run and somebody paid
                  for an answer they never received. Reported with its shape and never averaged.
                </p>
              </>
            ) : (
              <p className={`${styles.note} ${styles.noteTop}`}>
                {formatCount(integrity.checked)} requests checked against the quota contract, no
                contradiction found.
              </p>
            )}
          </Panel>

          <Panel title="Latency" lede="Server elapsed time, nearest-rank percentiles over executed requests">
            <Scroller minWidth={360}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Population</th>
                    <th scope="col" className={styles.right}>p50</th>
                    <th scope="col" className={styles.right}>p75</th>
                    <th scope="col" className={styles.right}>p90</th>
                    <th scope="col" className={styles.right}>n</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ['All executed', latency.all],
                      ['Real answers', latency.realAnswer],
                      ['Simulated fallbacks', latency.simulated],
                    ] as const
                  ).map(([label, summary]) => (
                    <tr key={label}>
                      <th scope="row" className={styles.nowrap}>{label}</th>
                      <td className={styles.num}>{ms(summary.median)}</td>
                      <td className={styles.num}>{ms(summary.p75)}</td>
                      <td className={styles.num}>{ms(summary.p90)}</td>
                      <td className={styles.num}>{formatCount(summary.sample)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Scroller>
            <p className={`${styles.note} ${styles.noteTop}`}>
              Refusals are excluded: a refusal is a database round trip, and including it would
              report the product getting faster as more people hit their limit.
            </p>
          </Panel>
        </div>
      </div>

      <div className={`${styles.twoGridWide} ${styles.gapTop}`}>
        <Panel title="Tool operations" lede="Which tools ran inside the orchestrator loop, and whether they worked">
          <div className={styles.threeGrid} style={{ marginBottom: 11 }}>
            <Tile label="Executions" value={formatCount(tools.executions)} state="derived" />
            <Tile label="Successes" value={formatCount(tools.successes)} state="live" />
            <Tile
              label="Failures"
              value={formatCount(tools.failures)}
              state={tools.failures > 0 ? 'feature_disabled' : 'derived'}
            />
          </div>

          <Scroller minWidth={440}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Tool</th>
                  <th scope="col" className={styles.right}>Executions</th>
                  <th scope="col" className={styles.right}>Failures</th>
                  <th scope="col" className={styles.right}>Median</th>
                </tr>
              </thead>
              <tbody>
                {tools.byTool.length === 0 ? (
                  <EmptyRow span={4}>
                    No tool execution has been recorded. The emitter lives inside the orchestrator
                    tool loop and belongs to the Voyager section.
                  </EmptyRow>
                ) : (
                  tools.byTool.map((row) => (
                    <tr key={row.tool}>
                      <th scope="row"><code className={styles.mono}>{row.tool}</code></th>
                      <td className={styles.num}>{formatCount(row.executions)}</td>
                      <td className={styles.num}>{formatCount(row.failures)}</td>
                      <td className={styles.num}>{ms(row.medianMs)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Scroller>

          {tools.topFailureCodes.length > 0 ? (
            <>
              <div className={`${styles.kicker} ${styles.noteTop}`}>Top failure codes</div>
              <div className={styles.pillRow}>
                {tools.topFailureCodes.map((code) => (
                  <span key={code.code} className={styles.pill}>
                    <code className={styles.mono}>{code.code || 'unknown'}</code> · {code.count}
                  </span>
                ))}
              </div>
            </>
          ) : null}

          <p className={`${styles.note} ${styles.noteTop}`}>
            Tool id and failure code only. Neither tool input nor tool output ever travels, and the
            registry&apos;s own call signature carries a ticker that is dropped before the event is
            queued. A tool round is not a question — the quota charges once however many tools ran.
          </p>
        </Panel>

        <div className={styles.stack}>
          <Panel title="Capability mix" lede="What the answers contained — a mix, never a fulfilment rate">
            <div className={styles.twoGrid}>
              <MiniCard label="Answers with a chart" metric={capability.answersWithChart} />
              <MiniCard label="Answers with a study" metric={capability.answersWithStudy} />
              <MiniCard label="Answers offering actions" metric={capability.answersWithActions} />
              <MiniCard label="Tool-assisted answers" metric={capability.toolAssistedAnswers} />
            </div>
            <p className={`${styles.note} ${styles.noteTop}`}>
              Not every question asks for a chart, so &ldquo;chart answers ÷ requests&rdquo; says how
              often Voyager draws, not how often it succeeds at drawing. The denominator that would
              make it a fulfilment rate — questions that wanted one — is not observable.
            </p>
          </Panel>

          <Panel title="Context availability" lede="How much grounding the model had, never what was in it">
            <div>
              <div className={styles.kv}>
                <span className={styles.kvLabel}>Requests with a configured model</span>
                <span className={styles.kvValue}>{formatCount(counts.modelConfiguredRequests)}</span>
              </div>
              <div className={styles.kv}>
                <span className={styles.kvLabel}>Fallbacks despite a configured model</span>
                <span className={styles.kvValue}>{formatCount(counts.fallbacksWithModel)}</span>
              </div>
              <div className={styles.kv}>
                <span className={styles.kvLabel}>Executed share of all requests</span>
                <span className={styles.kvValue}>{share(counts.executed, counts.requests)}</span>
              </div>
              <div className={styles.kv}>
                <span className={styles.kvLabel}>Wealth context granted</span>
                <span className={styles.kvValue}>
                  {formatCount(
                    'value' in data.families.wealth.metrics.voyagerContextGranted
                      ? data.families.wealth.metrics.voyagerContextGranted.value
                      : 0
                  )}
                </span>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <div className={`${styles.subPanel} ${styles.gapTop}`}>
        <div className={styles.kicker}>Scope and denominators</div>
        <p className={styles.note}>
          <strong className={styles.strong}>Server requests counts questions that reach POST
          /api/voyager.</strong> The <code className={styles.mono}>/voyager/research</code> workspace
          answers some scripted scenarios locally and those never reach the route.{' '}
          <strong className={styles.strong}>This is not a count of every Voyager interaction</strong>{' '}
          and must not be read as one. Closing the gap needs instrumentation inside the workspace,
          which belongs to the Voyager section.
        </p>
        {/*
          The denominator rule is stated here as well as on each card, because a
          card whose metric is absent renders its absence reason in the subline
          slot — so the rule would disappear from the page in exactly the state
          where somebody is most likely to misread what is missing.
        */}
        <p className={`${styles.note} ${styles.noteTop}`}>
          The real answer rate and the fallback rate are over{' '}
          <strong className={styles.strong}>executed requests, refusals excluded</strong> — a refusal
          never reached the model, so counting it would make the AI look worse as more people hit
          their daily limit. The refusal rate is over{' '}
          <strong className={styles.strong}>every request</strong>, because a refusal is a thing that
          happened to one.
        </p>
      </div>
    </Section>
  );
}
