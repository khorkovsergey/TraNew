import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { AccessBootstrap } from '@/components/admin-metrics/AccessBootstrap';
import { Breakdown } from '@/components/admin-metrics/Breakdown';
import { MetricCard } from '@/components/admin-metrics/MetricCard';
import styles from '@/components/admin-metrics/Observatory.module.css';
import type { Locale } from '@/i18n/routing';
import { authorizeMetrics, directLinkEnabled } from '@/lib/admin-metrics/access';
import { instrumentationCoverage } from '@/lib/admin-metrics/coverage';
import { MARKETPLACE_MIN_SAMPLE } from '@/lib/admin-metrics/dictionary';
import { overview } from '@/lib/admin-metrics/overview';
import { portalMetrics } from '@/lib/admin-metrics/portal';
import { rangeFrom } from '@/lib/admin-metrics/range';
import { cohortRetention, dayKey } from '@/lib/admin-metrics/retention';
import { readUserDays } from '@/lib/admin-metrics/telemetryQuery';
import { explain, isNumeric } from '@/lib/analytics/states';

/**
 * The Product Observatory.
 *
 * Private, and private by access control rather than by address. The route name
 * is deliberate and is not a security measure: `access.ts` is what stops a
 * request, and it runs here before any query does.
 *
 * Three things are deliberately absent and must stay absent. There is no
 * navigation entry pointing here. There is no sitemap entry — `sitemap.ts`
 * enumerates its routes explicitly and this one is not among them. And there is
 * **no `robots.txt` disallow**: a disallow line is a public list of the paths
 * worth trying, so the route stays unmentioned there and carries `noindex`
 * instead, which is a header rather than an advertisement.
 *
 * Phase 2 adds the global measurement layer — continuation, time to first
 * action, second action, authenticated retention and the journey breakdowns
 * that explain them. It is still not the dashboard: correct numbers and legible
 * definitions, not visual density. The fourteen-section design is Phase 6.
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

export default async function ObservatoryPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const auth = await authorizeMetrics();

  /*
   * The unauthorized shell says as little as it can. It does not confirm that a
   * dashboard exists here, it does not say which of the two access paths
   * failed, and it renders no data of any kind — the queries below have not run
   * at this point and will not.
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

  const [numbers, portal, coverage, userDays] = await Promise.all([
    overview(window.since),
    portalMetrics(window.since),
    instrumentationCoverage(window.since),
    readUserDays(window.since),
  ]);

  const retention = cohortRetention(userDays, {
    today: now,
    telemetryStartedOn: portal.collectingSince ? dayKey(new Date(portal.collectingSince)) : null,
    minimumCohort: MARKETPLACE_MIN_SAMPLE,
    provenance: (metricId) => ({
      metricId,
      source: 'product_telemetry_event',
      queriedAt: now.toISOString(),
    }),
    state: 'instrumented_going_forward',
  });

  const journeys = portal.journeys;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Product Observatory</h1>
        <p className={styles.subtitle}>
          {window.key} · queried {numbers.queriedAt} · authorized via {auth.via.replace('_', ' ')}
        </p>
      </header>

      <p className={styles.notice}>
        <strong>Phase 2 — global observability.</strong> Production analytics was a no-op until
        Phase 1 shipped, so every event-derived figure starts from
        {portal.collectingSince ? ` ${portal.collectingSince}` : ' — nothing has arrived yet'}.
        Durable facts from the application tables are the exception and are real from day one.
        Nothing here is a placeholder: a card with no number has no number, and every card can say
        where its number came from.
      </p>

      <section>
        <h2 className={styles.sectionTitle}>Continuation</h2>
        <div className={styles.grid}>
          <MetricCard label="PMCR" metric={numbers.meaningfulContinuation} format="percent" />
          <MetricCard label="Internal continuation" metric={numbers.internalContinuation} format="percent" />
          <MetricCard label="External continuation" metric={numbers.externalContinuation} format="percent" />
          <MetricCard label="Second meaningful action" metric={numbers.secondActionRate} format="percent" />
          <MetricCard label="TTFA — median" metric={numbers.ttfaMedian} format="seconds" />
          <MetricCard label="TTFA — p75" metric={numbers.ttfaP75} format="seconds" />
          <MetricCard label="TTFA — p90" metric={numbers.ttfaP90} format="seconds" />
          <MetricCard label="Eligible sessions without an action" metric={numbers.sessionsWithoutAction} />
        </div>
        <p className={styles.subtitle}>
          {portal.continuation.continuedSessions.toLocaleString('en')} of{' '}
          {portal.continuation.eligibleSessions.toLocaleString('en')} eligible sessions continued ·{' '}
          internal only {journeys.internalVsExternal.internalOnly} · external only{' '}
          {journeys.internalVsExternal.externalOnly} · both {journeys.internalVsExternal.both} · neither{' '}
          {journeys.internalVsExternal.neither}
        </p>
      </section>

      <section>
        <h2 className={styles.sectionTitle}>Authenticated retention</h2>
        <div className={styles.grid}>
          {retention.horizons.map((horizon) => (
            <MetricCard
              key={horizon.horizon}
              label={`D${horizon.horizon} return · cohort ${horizon.cohortSize}`}
              metric={horizon.returned}
              format="percent"
            />
          ))}
          <MetricCard label="Anonymous return" metric={retention.anonymous} format="percent" />
        </div>
        <p className={styles.subtitle}>
          Cumulative windows, not anniversaries · UTC days from received_at ·{' '}
          {retention.usersWithEligiblePortalDay} users with an eligible portal day ·{' '}
          {retention.horizons.map((h) => `D${h.horizon} excludes ${h.immatureUsers} immature`).join(' · ')}
        </p>
      </section>

      <section>
        <h2 className={styles.sectionTitle}>Journeys — what explains the rate</h2>
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
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Reason</th>
              <th>Sessions</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(journeys.exclusions).length === 0 ? (
              <tr>
                <td colSpan={2}>Nothing was excluded in this window.</td>
              </tr>
            ) : (
              Object.entries(journeys.exclusions).map(([reason, n]) => (
                <tr key={reason}>
                  <td>{reason.replace(/_/g, ' ')}</td>
                  <td>{n}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className={styles.sectionTitle}>Can these numbers be trusted?</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Verdict</th>
              <th>Observed</th>
              <th>Awaiting</th>
              <th>Unexposed</th>
              <th>Missing</th>
            </tr>
          </thead>
          <tbody>
            {coverage.kpis.map((kpi) => (
              <tr key={kpi.metricId}>
                <td>{kpi.label}</td>
                <td>{kpi.verdict.replace(/_/g, ' ')}</td>
                <td>{kpi.observed.length}</td>
                <td>{kpi.awaiting.join(', ') || '—'}</td>
                <td>{kpi.unexposed.join(', ') || '—'}</td>
                <td>{kpi.missing.join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className={styles.sectionTitle}>Portal facts</h2>
        <div className={styles.grid}>
          <MetricCard label="Registered users" metric={numbers.registeredUsers} />
          <MetricCard label="New registrations" metric={numbers.newRegistrations} />
          <MetricCard label="Telemetry events" metric={numbers.telemetryEvents} />
          <MetricCard label="Sessions" metric={numbers.sessions} />
          <MetricCard label="Eligible sessions" metric={numbers.eligibleSessions} />
          <MetricCard label="Confirmed revenue" metric={numbers.confirmedRevenue} />
          <MetricCard label="Alert adoption" metric={numbers.alertAdoption} format="percent" />
        </div>
      </section>

      <section>
        <h2 className={styles.sectionTitle}>
          Instrumentation coverage — {coverage.totals.observed} observed of {coverage.totals.declared} declared
          {coverage.totals.unexposed > 0 ? `, ${coverage.totals.unexposed} unexposed` : null}
          {coverage.totals.legacy > 0 ? `, ${coverage.totals.legacy} legacy` : null}
        </h2>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Event</th>
              <th>Surface</th>
              <th>Kind</th>
              <th>Feature</th>
              <th>Count</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {coverage.rows.map((row) => (
              <tr key={row.event}>
                <td>
                  <code>{row.event}</code>
                </td>
                <td>{row.surface}</td>
                <td>{row.kind}</td>
                <td>{row.featureState}</td>
                <td>{row.count}</td>
                <td>{row.status.replace(/_/g, ' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {isNumeric(numbers.meaningfulContinuation) ? null : (
        <p className={styles.notice}>{explain(numbers.meaningfulContinuation)}</p>
      )}
    </main>
  );
}
