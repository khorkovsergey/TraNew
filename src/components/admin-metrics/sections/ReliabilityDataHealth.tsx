import { VITAL_THRESHOLDS, formatVital } from '@/lib/admin-metrics/webVitals';
import { ago, formatCount, humanize, titleize } from '../format';
import {
  MiniCard,
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
 * A Web Vital's performance rating, which is **not** a provenance state.
 *
 * An earlier version mapped good → `live`, needs-improvement →
 * `insufficient_sample` and poor → `feature_disabled`, purely to reach three
 * colours. That put two false claims on the page: a slow LCP was reported as a
 * switched-off feature, and an INP that merely needed work was reported as a
 * sample too small to publish — while the sample was in fact large enough,
 * which is the only reason a rating was shown at all.
 *
 * The two concepts are now independent and both are rendered. Sample adequacy
 * is the canonical `insufficient_sample`, because that is exactly what it is.
 * The rating beside it is a tone.
 */
type Rating = 'good' | 'needs improvement' | 'poor';

const RATING_TONE: Record<Rating, Tone> = {
  good: 'positive',
  'needs improvement': 'caution',
  poor: 'negative',
};

/** Google's own boundaries, so a rating means what a reader expects. */
function ratingOf(metric: keyof typeof VITAL_THRESHOLDS, stored: number): Rating {
  const { good, poor, unit } = VITAL_THRESHOLDS[metric];
  /* CLS is stored scaled by a thousand; compare in the unit the boundary uses. */
  const raw = unit === 'score' ? stored / 1000 : stored;
  if (raw <= good) return 'good';
  if (raw <= poor) return 'needs improvement';
  return 'poor';
}

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
          <Scroller minWidth={680}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  <th scope="col" className={styles.right}>p50</th>
                  <th scope="col" className={styles.right}>p75</th>
                  <th scope="col" className={styles.right}>p90</th>
                  <th scope="col" className={styles.right}>Poor</th>
                  <th scope="col" className={styles.right}>n</th>
                  <th scope="col">Rating</th>
                  <th scope="col">Sample</th>
                </tr>
              </thead>
              <tbody>
                {vitals.map((vital) => {
                  const unit = VITAL_THRESHOLDS[vital.metric].unit;
                  /*
                   * Two independent judgements, rendered in two columns.
                   *
                   * `p75 === null` is the aggregator withholding percentiles
                   * below the minimum sample — the canonical
                   * `insufficient_sample`, and the only canonical state this
                   * row is entitled to. The rating is a separate question that
                   * only has an answer once the sample is adequate.
                   */
                  const enough = vital.p75 !== null;
                  const rating = enough ? ratingOf(vital.metric, vital.p75!) : null;

                  return (
                    <tr key={vital.metric}>
                      <th scope="row" className={styles.nowrap}>
                        {vital.metric.toUpperCase()} ({unit === 'score' ? 'score' : 'time'})
                      </th>
                      <td className={styles.num}>
                        {vital.p50 === null ? '—' : formatVital(vital.metric, vital.p50)}
                      </td>
                      <td
                        className={`${styles.num} ${rating ? styles.toneText : styles.stateText}`}
                        data-tone={rating ? RATING_TONE[rating] : undefined}
                        data-state={rating ? undefined : 'insufficient_sample'}
                      >
                        {enough ? formatVital(vital.metric, vital.p75!) : 'low n'}
                      </td>
                      <td className={styles.num}>
                        {vital.p90 === null ? '—' : formatVital(vital.metric, vital.p90)}
                      </td>
                      <td className={styles.num}>
                        {vital.poorShare === null ? '—' : `${(vital.poorShare * 100).toFixed(1)}%`}
                      </td>
                      <td className={styles.num}>{formatCount(vital.sample)}</td>
                      <td>
                        {rating ? (
                          <StatusBadge
                            tone={RATING_TONE[rating]}
                            small
                            label={rating}
                            title={`p75 against Google's ${vital.metric.toUpperCase()} boundaries`}
                          />
                        ) : (
                          <span className={styles.rankNote}>no rating yet</span>
                        )}
                      </td>
                      <td>
                        {enough ? (
                          <StatusBadge tone="neutral" small label="sufficient" />
                        ) : (
                          <StateBadge state="insufficient_sample" small />
                        )}
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
          <p className={`${styles.note} ${styles.noteTop}`}>
            <strong className={styles.strong}>Rating and sample are separate columns.</strong> A poor
            LCP is a slow page, not a disabled feature, and a vital that needs work is not a sample
            too small to publish — the sample column is the only one entitled to say that, and it
            uses the canonical state because that is exactly what it means.
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
                    {surface.p75 === null ? (
                      <span className={styles.stateText} data-state="insufficient_sample">
                        low n
                      </span>
                    ) : (
                      <span
                        className={styles.toneText}
                        data-tone={RATING_TONE[ratingOf('lcp', surface.p75)]}
                      >
                        {formatVital('lcp', surface.p75)}
                      </span>
                    )}
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
              tone={market.quotesConfigured ? 'positive' : 'quiet'}
            />
            <Tile
              label="Macro provider"
              value={market.macroConfigured ? 'Configured' : 'Not configured'}
              sub="from runtime configuration"
              tone={market.macroConfigured ? 'positive' : 'quiet'}
            />
            <Tile
              label="Delay policy"
              value="Delayed by design"
              sub="free tier · a delayed price is the product working"
              tone="neutral"
            />
          </div>

          <div className={styles.twoGrid}>
            <MiniCard label="Resolutions" metric={market.requests} sub="market-data client resolutions" />
            <MiniCard
              label="Successful resolutions"
              metric={market.successes}
              sub="may have been served from the Next data cache"
            />
            {/*
              `no_data` is the client finishing without a usable product result.
              It is not evidence that the symbol is unknown, that the provider
              is down, or that the call was rate-limited — the outcome enum does
              not carry that distinction and the copy must not invent it.
            */}
            <MiniCard
              label="No usable result"
              metric={market.noData}
              sub="the operation completed and returned no usable data"
            />
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
                        {/*
                          Only `stale` is canonical here, and only where the
                          freshness logic actually says so — a source with a
                          cadence budget that has overrun it. "Seen" and "never
                          seen" are operational status, not provenance: a
                          request-driven source with no rows means nobody asked,
                          which is a fact about traffic rather than a sample too
                          small to publish.
                        */}
                        {source.stale ? (
                          <StateBadge state="stale" small />
                        ) : (
                          <StatusBadge
                            tone={source.lastSeen ? 'positive' : 'quiet'}
                            small
                            label={source.lastSeen ? 'Seen' : 'Never seen'}
                            title={source.why}
                          />
                        )}
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
