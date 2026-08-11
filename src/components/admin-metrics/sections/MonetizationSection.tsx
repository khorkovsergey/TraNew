import { formatCount, titleize } from '../format';
import { EmptyRow, MiniCard, Panel, Scroller, Section, StateBadge } from '../primitives';
import styles from '../Observatory.module.css';
import type { DrawerRequest, ObservatoryData } from '../types';

/**
 * 10 — Monetization.
 *
 * The design's rule, and the only structure this section is allowed to have:
 * **four commercial facts that must never be combined.**
 *
 *   1. offer exposure — somebody saw a price
 *   2. entitlement — somebody has access
 *   3. purchase record — the application wrote a row
 *   4. provider-confirmed transaction — money actually moved
 *
 * Each is a separate column with its own source, and the last one is
 * `source_not_connected` because no payment provider exists to confirm
 * anything. A dashboard that added the third to the fourth would report a
 * demo-seeded database as revenue, which is the single most misleading number
 * this product could publish.
 *
 * Plan names are read from the entitlement distribution at runtime. Nothing
 * here writes a lineup down — the current vocabulary is Free, Plus, Pro and
 * Private, and hardcoding it is how the retired five-plan list survived in
 * three places for a month after it was replaced.
 */
export function MonetizationSection({
  data,
  onOpen,
}: {
  data: ObservatoryData;
  onOpen: (request: DrawerRequest) => void;
}) {
  const commerce = data.families.commerce;
  const metrics = commerce.metrics;
  const entitlement = commerce.distributions.entitlement ?? [];
  const plans = commerce.distributions.subscriptionPlan ?? [];
  const status = commerce.distributions.purchaseStatus ?? [];

  const offerEvents = data.coverage.rows.filter(
    (row) => row.surface === 'subscriptions' && row.lifecycle === 'current'
  );
  const offerViews = offerEvents.reduce((sum, row) => sum + row.count, 0);

  return (
    <Section
      id="s-money"
      number="10"
      title="Monetization"
      lede="Four commercial facts that are never combined: offer exposure, entitlement, purchase record, provider-confirmed transaction"
    >
      <div className={styles.fourGrid}>
        <div className={styles.miniCard}>
          <div className={styles.miniHead}>
            <span className={styles.miniLabel}>1 · Offer exposure</span>
            <StateBadge
              state={offerEvents.length === 0 ? 'not_measurable' : offerViews > 0 ? 'live' : 'instrumented_going_forward'}
              small
            />
          </div>
          <span className={`${styles.miniValue} ${styles.stateText}`} data-state="live">
            {formatCount(offerViews)}
          </span>
          <span className={styles.miniSub}>
            events on the subscriptions surface · somebody saw a price, which is not intent to buy
          </span>
        </div>

        <MiniCard
          label="2 · Entitlement"
          metric={metrics.entitledUsers}
          sub="people the server model grants a plan — proves nothing about payment"
        />

        <MiniCard
          label="3 · Purchase record"
          metric={metrics.paidStatusRecords}
          sub="rows the application wrote with status `paid` — not a transaction"
        />

        <div className={styles.miniCard} data-state="source_not_connected">
          <div className={styles.miniHead}>
            <span className={styles.miniLabel}>4 · Provider-confirmed transaction</span>
            <StateBadge state="source_not_connected" small />
          </div>
          <button
            type="button"
            className={`${styles.miniAbsent} ${styles.stateText}`}
            data-state="source_not_connected"
            onClick={() => onOpen({ kind: 'metric', metricId: 'confirmed_revenue', label: 'Confirmed revenue' })}
          >
            Source not connected
          </button>
          <span className={styles.miniSub}>
            no payment provider is connected and <code className={styles.mono}>externalRef</code> is
            never populated, so there is nothing to reconcile against
          </span>
        </div>
      </div>

      <div className={`${styles.twoGrid} ${styles.gapTop}`}>
        <Panel title="Entitlement, by plan" lede="Read from the entitlement model at runtime — no lineup is written down">
          <Scroller minWidth={340}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Plan</th>
                  <th scope="col" className={styles.right}>People</th>
                  <th scope="col">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {entitlement.length === 0 ? (
                  <EmptyRow span={3}>No entitlement row exists.</EmptyRow>
                ) : (
                  entitlement.map((row) => (
                    <tr key={row.key}>
                      <th scope="row">{titleize(row.key)}</th>
                      <td className={styles.num}>{formatCount(row.count)}</td>
                      <td>
                        <StateBadge state="live" small label="user.plan" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Scroller>
          <p className={`${styles.note} ${styles.noteTop}`}>
            An entitlement is access, not money. A plan the server model does not recognise is
            labelled rather than charted beside the real ones.
          </p>
        </Panel>

        <Panel title="Purchase records, by status" lede="What the application wrote, not what a provider confirmed">
          <Scroller minWidth={340}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Status</th>
                  <th scope="col" className={styles.right}>Records</th>
                  <th scope="col">Is it money?</th>
                </tr>
              </thead>
              <tbody>
                {status.length === 0 ? (
                  <EmptyRow span={3}>No purchase row exists.</EmptyRow>
                ) : (
                  status.map((row) => (
                    <tr key={row.key}>
                      <th scope="row">{titleize(row.key)}</th>
                      <td className={styles.num}>{formatCount(row.count)}</td>
                      <td>
                        <StateBadge
                          state={row.key === 'demo' ? 'legacy' : 'source_not_connected'}
                          small
                          label={row.key === 'demo' ? 'Granted without money' : 'Unconfirmed'}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Scroller>
        </Panel>
      </div>

      <div className={`${styles.fourGrid} ${styles.gapTop}`}>
        <MiniCard label="Demo entitlements" metric={metrics.demoEntitlements} sub="granted without money — never revenue" />
        <MiniCard
          label="Reconciled against a provider"
          metric={metrics.providerReconciledRecords}
          sub="purchase rows carrying an external reference"
        />
        <MiniCard label="Active subscriptions" metric={metrics.activeSubscriptions} sub="current state, not a renewal outcome" />
        <MiniCard
          label="Subscriptions with a provider ref"
          metric={metrics.subscriptionsWithProviderRef}
          sub="the reconciliation hook, unpopulated"
        />
      </div>

      {plans.length > 0 ? (
        <div className={styles.gapTop}>
          <Panel title="Subscription rows, by plan" lede="A subscription row is an application record and is counted apart from entitlement">
            <div className={styles.pillRow}>
              {plans.map((row) => (
                <span key={row.key} className={styles.pill}>
                  {titleize(row.key)} · {formatCount(row.count)}
                </span>
              ))}
            </div>
          </Panel>
        </div>
      ) : null}

      <div className={`${styles.subPanel} ${styles.gapTop}`}>
        <div className={styles.kicker}>Why confirmed revenue is absent</div>
        <ul className={styles.drawerList}>
          {commerce.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
