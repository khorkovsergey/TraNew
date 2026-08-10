import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { AccessBootstrap } from '@/components/admin-metrics/AccessBootstrap';
import { MetricCard } from '@/components/admin-metrics/MetricCard';
import styles from '@/components/admin-metrics/Observatory.module.css';
import type { Locale } from '@/i18n/routing';
import { authorizeMetrics, directLinkEnabled } from '@/lib/admin-metrics/access';
import { instrumentationCoverage } from '@/lib/admin-metrics/coverage';
import { overview } from '@/lib/admin-metrics/overview';
import { rangeFrom } from '@/lib/admin-metrics/range';

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
 * Phase 1 renders the foundation, not the dashboard: one card of each data
 * class, and the coverage table. The fourteen-section design lands in Phase 6.
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

  const [numbers, coverage] = await Promise.all([
    overview(window.since),
    instrumentationCoverage(window.since),
  ]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Product Observatory</h1>
        <p className={styles.subtitle}>
          {window.key} · queried {numbers.queriedAt} · authorized via {auth.via.replace('_', ' ')}
        </p>
      </header>

      <p className={styles.notice}>
        <strong>Phase 1 — foundation.</strong> Production analytics was a no-op until this
        section shipped, so every event-derived figure below starts from the moment the sink
        was connected{numbers.collectingSince ? ` (${numbers.collectingSince})` : ' and nothing has arrived yet'}.
        Durable facts from the application tables are the exception and are real from day one.
        Nothing on this page is a placeholder value: a card with no number has no number.
      </p>

      <section>
        <h2 className={styles.sectionTitle}>Overview</h2>
        <div className={styles.grid}>
          <MetricCard label="Registered users" metric={numbers.registeredUsers} />
          <MetricCard label="New registrations" metric={numbers.newRegistrations} />
          <MetricCard label="Telemetry events" metric={numbers.telemetryEvents} />
          <MetricCard label="Sessions" metric={numbers.sessions} />
          <MetricCard label="Meaningful continuation" metric={numbers.meaningfulContinuation} format="percent" />
          <MetricCard label="Confirmed revenue" metric={numbers.confirmedRevenue} />
          <MetricCard label="Alert adoption" metric={numbers.alertAdoption} format="percent" />
          <MetricCard label="Anonymous D7 return" metric={numbers.anonymousReturn} format="percent" />
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
    </main>
  );
}
