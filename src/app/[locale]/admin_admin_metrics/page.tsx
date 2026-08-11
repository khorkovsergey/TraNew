import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { AccessBootstrap } from '@/components/admin-metrics/AccessBootstrap';
import { Breakdown } from '@/components/admin-metrics/Breakdown';
import { MetricCard } from '@/components/admin-metrics/MetricCard';
import { ObservatoryShell } from '@/components/admin-metrics/ObservatoryShell';
import { ProductArea } from '@/components/admin-metrics/ProductArea';
import {
  MarketBlock,
  MarketDetail,
  SourceFreshness,
  SuperchartsBlock,
  SuperchartsDetail,
  VitalsBlock,
  VitalsDetail,
} from '@/components/admin-metrics/ReliabilityPanel';
import { Section } from '@/components/admin-metrics/Section';
import { StageTable } from '@/components/admin-metrics/StageTable';
import { VoyagerPanel } from '@/components/admin-metrics/VoyagerPanel';
import styles from '@/components/admin-metrics/Observatory.module.css';
import type { Locale } from '@/i18n/routing';
import { authorizeMetrics, directLinkEnabled } from '@/lib/admin-metrics/access';
import {
  coverageConclusion,
  journeyConclusion,
  marketConclusion,
  monetizationConclusion,
  pulseConclusion,
  reliabilityConclusion,
  superchartsConclusion,
  voyagerConclusion,
} from '@/lib/admin-metrics/conclusions';
import { instrumentationCoverage } from '@/lib/admin-metrics/coverage';
import { MARKETPLACE_MIN_SAMPLE } from '@/lib/admin-metrics/dictionary';
import { productFamilies } from '@/lib/admin-metrics/families';
import { reliabilityReport } from '@/lib/admin-metrics/families/reliability';
import { voyagerReport } from '@/lib/admin-metrics/families/voyager';
import { overview } from '@/lib/admin-metrics/overview';
import { portalMetrics } from '@/lib/admin-metrics/portal';
import { RANGES, rangeFrom } from '@/lib/admin-metrics/range';
import { cohortRetention, dayKey } from '@/lib/admin-metrics/retention';
import { readUserDays } from '@/lib/admin-metrics/telemetryQuery';
import type { MetricValue } from '@/lib/analytics/states';

/**
 * The Product Observatory.
 *
 * Private by access control rather than by address: `access.ts` runs before any
 * query does. No navigation entry, no sitemap entry, and deliberately **no
 * `robots.txt` disallow** — a disallow line is a public list of the paths worth
 * trying, so the route carries `noindex` instead.
 *
 * ## Phase 6 — the order is the argument
 *
 * The page reads outcome → journey → product → AI → reliability → measurement.
 * Earlier phases built it bottom-up and it showed: a reader met telemetry
 * plumbing before they met a product. Instrumentation is still here and still
 * honest; it is simply last, because somebody evaluating this should see
 * behaviour before they see how it was collected.
 *
 * Every section is a heading, a **one-sentence factual conclusion**, the
 * evidence, and a collapsed drawer holding whatever a sceptic would ask next.
 * The conclusions are deterministic restatements of numbers already on the page
 * — they say what is true and never why, because "users love this" is a story
 * about people the data cannot see.
 *
 * Presentation mode is a lens over this same markup, not a second dashboard. It
 * has no access to a value, so the only thing it can change is emphasis.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Product Observatory',
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ range?: string }>;
};

/** Counts each canonical state across the metrics a reader can actually see. */
function tallyStates(metrics: readonly MetricValue[]) {
  const counts = new Map<string, number>();
  for (const metric of metrics) counts.set(metric.state, (counts.get(metric.state) ?? 0) + 1);
  return [...counts.entries()]
    .map(([state, count]) => ({ state, metrics: count }))
    .sort((a, b) => b.metrics - a.metrics);
}

export default async function ObservatoryPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const auth = await authorizeMetrics();

  /*
   * The unauthorized shell says as little as it can: it does not confirm a
   * dashboard exists, does not say which access path failed, and renders no
   * data — the queries below have not run and will not.
   */
  if (!auth.authorized) {
    return (
      <main className={styles.page}>
        <div className={styles.gate}>
          <p>Not available.</p>
          <AccessBootstrap enabled={directLinkEnabled()} />
        </div>
      </main>
    );
  }

  const { range } = await searchParams;
  const window = rangeFrom(range ?? null) ?? rangeFrom(null)!;
  const now = new Date();

  const [numbers, portal, coverage, userDays, families, voyager, reliability] = await Promise.all([
    overview(window.since),
    portalMetrics(window.since),
    instrumentationCoverage(window.since),
    readUserDays(window.since),
    productFamilies(window.since),
    voyagerReport(window.since),
    reliabilityReport(window.since),
  ]);

  const retention = cohortRetention(userDays, {
    today: now,
    telemetryStartedOn: portal.collectingSince ? dayKey(new Date(portal.collectingSince)) : null,
    minimumCohort: MARKETPLACE_MIN_SAMPLE,
    provenance: (metricId) => ({
      metricId,
      source: 'product_telemetry_event',
      sourceType: 'derived' as const,
      queriedAt: now.toISOString(),
    }),
    state: 'instrumented_going_forward',
  });

  const journeys = portal.journeys;
  const d7 = retention.horizons.find((horizon) => horizon.horizon === 7)!;

  /*
   * Every metric a reader can see, for the credibility tally at the bottom.
   * Counting them is how a product manager tells "this number is bad" from
   * "there is no number", which is the point of that whole section.
   */
  const allStates = tallyStates([
    numbers.meaningfulContinuation,
    numbers.internalContinuation,
    numbers.externalContinuation,
    numbers.secondActionRate,
    numbers.ttfaMedian,
    numbers.confirmedRevenue,
    numbers.alertAdoption,
    numbers.anonymousReturn,
    ...retention.horizons.map((horizon) => horizon.returned),
    ...Object.values(voyager.headline),
    ...Object.values(voyager.quota),
    ...Object.values(voyager.capability),
    reliability.failures.total,
    reliability.failures.perThousandPageViews,
    reliability.market.requests,
    reliability.market.providerErrors,
    ...Object.values(families.commerce.metrics),
    ...Object.values(families.wealth.metrics),
  ]);

  return (
    <main>
      <ObservatoryShell range={window.key} ranges={Object.keys(RANGES)} queriedAt={numbers.queriedAt}>
        {/* ------------------------------------------------------ A. Pulse */}
        <Section
          id="pulse"
          title="Product pulse"
          conclusion={pulseConclusion({
            eligibleSessions: numbers.eligibleSessions,
            pmcr: numbers.meaningfulContinuation,
            collectingSince: portal.collectingSince,
          })}
        >
          <div className={styles.headline}>
            <MetricCard label="Eligible sessions" metric={numbers.eligibleSessions} emphasis />
            <MetricCard
              label="Meaningful continuation"
              metric={numbers.meaningfulContinuation}
              format="percent"
              of="of eligible sessions"
              emphasis
            />
            <MetricCard
              label="Second meaningful action"
              metric={numbers.secondActionRate}
              format="percent"
              of="of sessions that acted once"
            />
            <MetricCard
              label="Authenticated D7 return"
              metric={d7.returned}
              format="percent"
              of={`of ${d7.cohortSize} mature cohort members`}
            />
            <MetricCard
              label="Real AI answer rate"
              metric={voyager.headline.realAnswerRate}
              format="percent"
              of="of executed Voyager requests"
            />
            <MetricCard label="Time to first action" metric={numbers.ttfaMedian} format="seconds" />
          </div>

          <p className={styles.note}>
            Confirmed revenue is deliberately absent from this row: no payment provider is
            connected, so it has no source and a headline figure would be an invention.
          </p>
        </Section>

        {/* --------------------------------------------------- B. Journeys */}
        <Section
          id="journeys"
          title="User journeys"
          conclusion={journeyConclusion({
            byLandingSurface: journeys.byLandingSurface,
            exclusions: journeys.exclusions,
            eligibleSessions: journeys.eligibleSessions,
          })}
          detailLabel="Journey breakdowns, exclusions and the Start funnel"
          detail={
            <>
              <div className={styles.tables}>
                <Breakdown title="Landing surface" rows={journeys.byLandingSurface} minimum={journeys.minimumCohort} />
                <Breakdown title="Acquisition" rows={journeys.byAcquisition} minimum={journeys.minimumCohort} />
                <Breakdown title="Auth state" rows={journeys.byAuthState} minimum={journeys.minimumCohort} />
                <Breakdown title="Entitlement" rows={journeys.byEntitlement} minimum={journeys.minimumCohort} />
                <Breakdown title="Device" rows={journeys.byDevice} minimum={journeys.minimumCohort} />
                <Breakdown
                  title="First continuation surface"
                  rows={journeys.firstContinuationSurface}
                  minimum={journeys.minimumCohort}
                />
              </div>

              <h3 className={styles.sectionTitle}>Why sessions left the denominator</h3>
              <div className={styles.scroller}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Reason</th>
                      <th scope="col">Sessions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(journeys.exclusions).length === 0 ? (
                      <tr>
                        <td colSpan={2}>Nothing was excluded in this period.</td>
                      </tr>
                    ) : (
                      Object.entries(journeys.exclusions).map(([reason, count]) => (
                        <tr key={reason}>
                          <th scope="row">{reason.replace(/_/g, ' ')}</th>
                          <td>{count}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <h3 className={styles.sectionTitle}>Find my next step</h3>
              <StageTable
                stages={families.start.funnel.stages.map((stage) => ({
                  stage: stage.stage,
                  sessions: stage.sessions,
                  ofPrevious: stage.ofPrevious,
                }))}
              />
              <p className={styles.note}>
                Sequential within a session: a stage counts only where the stage before it happened
                earlier in the same session. Clarification is optional and never a denominator —
                not every route asks.
              </p>
            </>
          }
        >
          <div className={styles.grid}>
            <MetricCard
              label="Internal continuation"
              metric={numbers.internalContinuation}
              format="percent"
              of="of eligible sessions"
            />
            <MetricCard
              label="External continuation"
              metric={numbers.externalContinuation}
              format="percent"
              of="of eligible sessions"
            />
            <MetricCard label="Sessions without an action" metric={numbers.sessionsWithoutAction} />
            {retention.horizons.map((horizon) => (
              <MetricCard
                key={horizon.horizon}
                label={`D${horizon.horizon} return`}
                metric={horizon.returned}
                format="percent"
                of={`of ${horizon.cohortSize} mature`}
              />
            ))}
          </div>
          <p className={styles.note}>
            Retention is authenticated only, in cumulative windows from the first eligible portal
            day. Anonymous cross-session return stays not measurable: the portal has no
            cross-session anonymous identity, and none was invented to produce a number.
          </p>
        </Section>

        {/* -------------------------------------------------- C. Surfaces */}
        <Section
          id="surfaces"
          title="Product surfaces"
          conclusion="Behaviour and durable facts are reported side by side and never merged — a funnel event says a flow reported success, a table row says an outcome exists."
          detailLabel="Per-surface facts and funnels"
          detail={
            <>
              <ProductArea title="Events" facts={families.events}>
                <StageTable
                  stages={families.events.funnel.stages.map((stage) => ({
                    stage: stage.stage,
                    sessions: stage.sessions,
                    ofPrevious: stage.ofPrevious,
                  }))}
                />
              </ProductArea>
              <ProductArea title="Academy — current state" facts={families.academy} />
              <ProductArea title="Expert services — current pipeline" facts={families.experts} />
              <ProductArea title="Saves & collections" facts={families.saves} />
              <ProductArea title="Wealth Hub — adoption only" facts={families.wealth} />
              <ProductArea title="Accounts" facts={families.accounts} />
            </>
          }
        >
          <div className={styles.grid}>
            <MetricCard label="Registered users" metric={numbers.registeredUsers} />
            <MetricCard label="New registrations" metric={numbers.newRegistrations} />
            <MetricCard label="Telemetry events" metric={numbers.telemetryEvents} />
            <MetricCard label="Sessions seen" metric={numbers.sessions} />
          </div>
        </Section>

        {/* ---------------------------------------------------- D. Voyager */}
        <Section
          id="voyager"
          title="Voyager — what the server actually did"
          conclusion={voyagerConclusion({
            awaitingEmitter: voyager.awaitingEmitter,
            requests: voyager.headline.serverRequests,
            realAnswerRate: voyager.headline.realAnswerRate,
            realAnswers: voyager.headline.realAnswers,
            simulatedFallbacks: voyager.headline.simulatedFallbacks,
            integrityViolations: voyager.integrity.violations,
          })}
        >
          <VoyagerPanel report={voyager} />
        </Section>

        {/* ------------------------------------------------- E. Supercharts */}
        <Section
          id="supercharts"
          title="Supercharts"
          conclusion={superchartsConclusion({
            opens: reliability.supercharts.opens,
            sessionsWithStudy: reliability.supercharts.sessionsWithStudy,
            paneActivations: reliability.supercharts.paneActivations,
            awaitingCapabilityEmitter: reliability.supercharts.awaitingCapabilityEmitter,
            renderedStudies: reliability.supercharts.capability.length,
          })}
          detailLabel="Study mix, capability outcomes and Pine"
          detail={<SuperchartsDetail report={reliability} />}
        >
          <SuperchartsBlock report={reliability} />
        </Section>

        {/* ------------------------------------------------- F. Market data */}
        <Section
          id="market-data"
          title="Market data health"
          conclusion={marketConclusion({
            quotesConfigured: reliability.market.quotesConfigured,
            macroConfigured: reliability.market.macroConfigured,
            awaitingEmitter: reliability.market.awaitingEmitter,
            requests: reliability.market.requests,
            providerErrors: reliability.market.providerErrors,
          })}
          detailLabel="Provider configuration, delay policy and freshness"
          detail={<MarketDetail report={reliability} />}
        >
          <MarketBlock report={reliability} />
        </Section>

        {/* -------------------------------------------------- G. Reliability */}
        <Section
          id="reliability"
          title="Experience reliability"
          conclusion={reliabilityConclusion({
            vitals: reliability.vitals,
            failures: reliability.failures.total,
          })}
          detailLabel="Units, thresholds and failure classes"
          detail={<VitalsDetail report={reliability} />}
        >
          <VitalsBlock report={reliability} />
        </Section>

        {/* ------------------------------------------------- H. Monetization */}
        <Section
          id="monetization"
          title="Subscriptions & purchases"
          conclusion={monetizationConclusion({
            paidRecords: families.commerce.metrics.paidStatusRecords,
            demoRecords: families.commerce.metrics.demoEntitlements,
            reconciled: families.commerce.metrics.providerReconciledRecords,
          })}
          detailLabel="Purchase and subscription facts"
          detail={<ProductArea title="Commerce" facts={families.commerce} />}
        >
          <div className={styles.grid}>
            <MetricCard label="Confirmed revenue" metric={numbers.confirmedRevenue} />
            <MetricCard label="Paid-status records" metric={families.commerce.metrics.paidStatusRecords} />
            <MetricCard label="Demo entitlements" metric={families.commerce.metrics.demoEntitlements} />
            <MetricCard
              label="Reconciled against a provider"
              metric={families.commerce.metrics.providerReconciledRecords}
            />
          </div>
          <p className={styles.note}>
            A paid row is an application record, not a provider-confirmed transaction, and a demo
            entitlement is one granted without money. Neither is revenue, and the placeholder prices
            on the subscriptions screen are not realized income. Entitlement counts come from the
            server model at runtime rather than from any written-down plan list.
          </p>
        </Section>

        {/* ---------------------------------------------------- I. Coverage */}
        <Section
          id="coverage"
          title="Measurement coverage"
          conclusion={coverageConclusion(allStates)}
          detailLabel="Per-family coverage, every event, and source freshness"
          detail={
            <>
              <div className={styles.scroller}>
                <table className={styles.table}>
                  <caption className={styles.tableCaption}>
                    Per product family: behaviour and durable facts, counted apart. A table with
                    rows does not prove the funnel is instrumented, and an event does not prove the
                    outcome happened.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Family</th>
                      <th scope="col">Verdict</th>
                      <th scope="col">Telemetry observed</th>
                      <th scope="col">Durable sources</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coverage.families.map((family) => (
                      <tr key={family.family}>
                        <th scope="row">{family.family}</th>
                        <td>{family.verdict.replace(/_/g, ' ')}</td>
                        <td>
                          {family.telemetryObserved} / {family.telemetryEvents}
                        </td>
                        <td>{family.durableSources.join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.scroller}>
                <table className={styles.table}>
                  <caption className={styles.tableCaption}>
                    Every declared event and whether it has been seen.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Event</th>
                      <th scope="col">Surface</th>
                      <th scope="col">Kind</th>
                      <th scope="col">Feature</th>
                      <th scope="col">Count</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coverage.rows.map((row) => (
                      <tr key={row.event}>
                        <th scope="row">
                          <code>{row.event}</code>
                        </th>
                        <td>{row.surface}</td>
                        <td>{row.kind}</td>
                        <td>{row.featureState}</td>
                        <td>{row.count}</td>
                        <td>{row.status.replace(/_/g, ' ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <SourceFreshness report={reliability} />
            </>
          }
        >
          <div className={styles.scroller}>
            <table className={styles.table}>
              <caption className={styles.tableCaption}>
                How many visible metrics are in each state. This is the difference between a bad
                number and no measurement.
              </caption>
              <thead>
                <tr>
                  <th scope="col">State</th>
                  <th scope="col">Metrics</th>
                </tr>
              </thead>
              <tbody>
                {allStates.map((row) => (
                  <tr key={row.state}>
                    <th scope="row">{row.state.replace(/_/g, ' ')}</th>
                    <td>{row.metrics}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.scroller}>
            <table className={styles.table}>
              <caption className={styles.tableCaption}>
                Voyager instrumentation, by layer. A zero here can mean four different things.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Layer</th>
                  <th scope="col">Status</th>
                  <th scope="col">Observed</th>
                  <th scope="col">What it answers</th>
                </tr>
              </thead>
              <tbody>
                {coverage.voyagerLayers.map((layer) => (
                  <tr key={layer.layer}>
                    <th scope="row">{layer.layer.replace(/_/g, ' ')}</th>
                    <td>{layer.status.replace(/_/g, ' ')}</td>
                    <td>
                      {layer.observed} / {layer.events.length}
                    </td>
                    <td>{layer.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className={styles.note}>
            Production analytics was a no-op until Phase 1 shipped, so every event-derived figure
            starts from
            {portal.collectingSince ? ` ${portal.collectingSince}` : ' — nothing has arrived yet'}.
            Durable facts from the application tables are the exception and are real from day one.
          </p>
        </Section>
      </ObservatoryShell>
    </main>
  );
}
