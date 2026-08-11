import { VITAL_THRESHOLDS, formatVital } from '@/lib/admin-metrics/webVitals';
import { ago, formatCount, humanize, titleize } from '../format';
import { MiniCard, Panel, Scroller, Section, StateBadge, Tile } from '../primitives';
import styles from '../Observatory.module.css';
import type { ObservatoryData } from '../types';

/**
 * 12 — Reliability & data health.
 *
 * The dark operations panel: Core Web Vitals, client runtime failures, market
 * data health and the source-freshness table.
 *
 * Three units of care survive from the current implementation and are load
 * bearing.
 *
 * **CLS is a score.** It shares one integer column with four durations and is
 * stored multiplied by a thousand; `formatVital` is the only inverse, and the
 * column header says `(score)` so nobody quotes a layout shift of 0.08 as
 * eighty milliseconds.
 *
 * **Failures carry their denominator in the label** — per 1,000 page views, not
 * "error rate", because one page can throw several times and a session spans
 * many pages.
 *
 * **Market telemetry counts client resolutions, not upstream requests.** The
 * Next data cache is transparent at that layer, so a success may have been
 * served from cache and no provider uptime is claimed anywhere on this page.
 */
export function ReliabilityDataHealth({ data }: { data: ObservatoryData }) {
  const { reliability } = data;
  const { vitals, failures, market, worstLcpSurfaces, sources } = reliability;

  return (
    <Section
      id="s-reliability"
      number="12"
      title="Reliability &amp; data health"
      lede="Is the portal usable, and can the product get the financial data it claims to show?"
    >
      <div className={styles.twoGridWide}>
        <Panel
          title="Core Web Vitals"
          lede="Nearest-rank percentiles · p75 is the headline, because an average hides the tail people actually experience"
        >
          <Scroller minWidth={560}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  <th scope="col" className={styles.right}>p50</th>
                  <th scope="col" className={styles.right}>p75</th>
                  <th scope="col" className={styles.right}>p90</th>
                  <th scope="col" className={styles.right}>Poor</th>
                  <th scope="col" className={styles.right}>n</th>
                  <th scope="col">State</th>
                </tr>
              </thead>
              <tbody>
                {vitals.map((vital) => {
                  const unit = VITAL_THRESHOLDS[vital.metric].unit;
                  const enough = vital.p75 !== null;
                  const good = VITAL_THRESHOLDS[vital.metric].good;
                  const poor = VITAL_THRESHOLDS[vital.metric].poor;
                  const raw = vital.p75 === null ? null : vital.metric === 'cls' ? vital.p75 / 1000 : vital.p75;
                  const state = !enough
                    ? 'insufficient_sample'
                    : raw! <= good
                      ? 'live'
                      : raw! <= poor
                        ? 'insufficient_sample'
                        : 'feature_disabled';

                  return (
                    <tr key={vital.metric}>
                      <th scope="row" className={styles.nowrap}>
                        {vital.metric.toUpperCase()} ({unit === 'score' ? 'score' : 'time'})
                      </th>
                      <td className={styles.num}>
                        {vital.p50 === null ? '—' : formatVital(vital.metric, vital.p50)}
                      </td>
                      <td className={`${styles.num} ${styles.stateText}`} data-state={state}>
                        {vital.p75 === null ? 'low n' : formatVital(vital.metric, vital.p75)}
                      </td>
                      <td className={styles.num}>
                        {vital.p90 === null ? '—' : formatVital(vital.metric, vital.p90)}
                      </td>
                      <td className={styles.num}>
                        {vital.poorShare === null ? '—' : `${(vital.poorShare * 100).toFixed(1)}%`}
                      </td>
                      <td className={styles.num}>{formatCount(vital.sample)}</td>
                      <td>
                        <StateBadge state={state} small />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Scroller>

          <p className={`${styles.note} ${styles.noteTop}`}>
            CLS is a unitless score around 0.1 and shares one integer column with four durations; it
            is stored scaled by a thousand and divided back out in exactly one place. Thresholds are
            Google&apos;s own, so a rating means what a reader expects.
          </p>
        </Panel>

        <div className={styles.stack}>
          <MiniCard
            label="Client runtime failures"
            metric={failures.total}
            sub="uncaught errors and unhandled rejections reported by the browser"
          />
          <MiniCard
            label="Failures per 1,000 page views"
            metric={failures.perThousandPageViews}
            format="ratio"
            sub="the denominator is stated rather than assumed — one page can throw several times"
          />

          <Panel title="Slowest surfaces by LCP p75" lede="Where a fix would have somewhere to go">
            {worstLcpSurfaces.length === 0 ? (
              <p className={styles.note}>No Web Vital sample has arrived in this window.</p>
            ) : (
              worstLcpSurfaces.slice(0, 6).map((surface) => (
                <div key={surface.area} className={styles.kv}>
                  <span className={styles.kvLabel}>{titleize(surface.area)}</span>
                  <span className={styles.kvValue}>
                    <span className={styles.mono}>{formatCount(surface.sample)}</span>{' '}
                    <span
                      className={styles.stateText}
                      data-state={surface.p75 === null ? 'insufficient_sample' : 'derived'}
                    >
                      {surface.p75 === null ? 'low n' : formatVital('lcp', surface.p75)}
                    </span>
                  </span>
                </div>
              ))
            )}
          </Panel>
        </div>
      </div>

      <div className={`${styles.twoGrid} ${styles.gapTop}`}>
        <Panel
          title="Market data resolutions"
          lede="Client resolutions, not upstream provider requests — the Next data cache is transparent at that layer"
          aside={
            <StateBadge state={market.awaitingEmitter ? 'not_measurable' : 'instrumented_going_forward'} />
          }
        >
          <div className={styles.threeGrid} style={{ marginBottom: 11 }}>
            <Tile
              label="Quotes provider"
              value={market.quotesConfigured ? 'Configured' : 'Not configured'}
              sub="from runtime configuration"
              state={market.quotesConfigured ? 'live' : 'source_not_connected'}
            />
            <Tile
              label="Macro provider"
              value={market.macroConfigured ? 'Configured' : 'Not configured'}
              sub="from runtime configuration"
              state={market.macroConfigured ? 'live' : 'source_not_connected'}
            />
            <Tile
              label="Delay policy"
              value="Delayed by design"
              sub="free tier · a delayed price is the product working"
              state="derived"
            />
          </div>

          <div className={styles.twoGrid}>
            <MiniCard label="Resolutions" metric={market.requests} sub="market-data client resolutions" />
            <MiniCard
              label="Successful resolutions"
              metric={market.successes}
              sub="may have been served from the Next data cache"
            />
            <MiniCard label="No data" metric={market.noData} sub="the provider had nothing for the symbol" />
            <MiniCard label="Provider errors" metric={market.providerErrors} sub="the call failed" />
          </div>

          {market.freshness.length > 0 ? (
            <>
              <div className={`${styles.kicker} ${styles.noteTop}`}>Freshness buckets</div>
              <div className={styles.pillRow}>
                {market.freshness.map((row) => (
                  <span key={row.key} className={styles.pill}>
                    {humanize(row.key)} · {formatCount(row.count)}
                  </span>
                ))}
              </div>
            </>
          ) : null}

          <p className={`${styles.note} ${styles.noteTop}`}>{market.delayedPolicy}</p>
          <p className={`${styles.note} ${styles.noteTop}`}>
            No provider uptime percentage is claimed anywhere here. The portal observes its own
            resolutions and cannot see whether an upstream service was available.
          </p>
        </Panel>

        <div className={styles.stack}>
          <Panel title="Failure classes" lede="What went wrong, and where">
            <div className={styles.twoGrid}>
              <div>
                <div className={styles.kicker}>By class</div>
                {failures.byClass.length === 0 ? (
                  <p className={styles.note}>No client failure in this window.</p>
                ) : (
                  failures.byClass.slice(0, 6).map((row) => (
                    <div key={row.key} className={styles.kv}>
                      <span className={styles.kvLabel}>{humanize(row.key)}</span>
                      <span className={styles.kvValue}>{formatCount(row.count)}</span>
                    </div>
                  ))
                )}
              </div>
              <div>
                <div className={styles.kicker}>By area</div>
                {failures.byArea.length === 0 ? (
                  <p className={styles.note}>No client failure in this window.</p>
                ) : (
                  failures.byArea.slice(0, 6).map((row) => (
                    <div key={row.key} className={styles.kv}>
                      <span className={styles.kvLabel}>{titleize(row.key)}</span>
                      <span className={styles.kvValue}>{formatCount(row.count)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <p className={`${styles.note} ${styles.noteTop}`}>
              Class and area only. No message, no stack and no raw provider payload reaches this
              page — a stack trace is user data as often as it is a bug report.
            </p>
          </Panel>

          <Panel title="Source freshness" lede="Last seen, judged against each source's own cadence">
            <Scroller minWidth={420}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Source</th>
                    <th scope="col" className={styles.right}>Last seen</th>
                    <th scope="col">State</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((source) => (
                    <tr key={source.source}>
                      <th scope="row" className={styles.nowrap} title={source.why}>
                        {titleize(source.source)}
                      </th>
                      <td className={styles.num}>{ago(source.lastSeen, data.queriedAtMs)}</td>
                      <td>
                        <StateBadge
                          state={source.stale ? 'stale' : source.lastSeen ? 'live' : 'insufficient_sample'}
                          small
                          label={source.stale ? 'Delayed' : source.lastSeen ? 'Seen' : 'Never seen'}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Scroller>
            <p className={`${styles.note} ${styles.noteTop}`}>
              Only sources with an expected cadence carry a staleness budget. Web Vitals and market
              telemetry exist only when somebody loads a page or asks for data, so silence there is a
              fact about traffic rather than about the pipeline.
            </p>
          </Panel>
        </div>
      </div>
    </Section>
  );
}
