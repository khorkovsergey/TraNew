import { formatCount, share, titleize } from '../format';
import { CellBar, EmptyRow, Panel, Scroller, Section, StateBadge } from '../primitives';
import styles from '../Observatory.module.css';
import type { ObservatoryData } from '../types';

/**
 * 11 — Acquisition & discovery.
 *
 * What the portal can see about where people came from, and — occupying the
 * same visual weight — what it cannot.
 *
 * The acquisition breakdown is real: sessions carry a coarse acquisition bucket
 * and the continuation rate within each is a genuine comparison. Organic search
 * volume, impressions, positions and AI-assistant citations are not: no Search
 * Console property is connected and no citation monitor exists. Those get
 * `source_not_connected` cards of the same size rather than a plausible number,
 * which is exactly what the design's provenance system is for.
 */

const UNCONNECTED = [
  {
    title: 'Organic search',
    source: 'Google Search Console',
    body: 'Impressions, clicks, average position and the queries the portal actually ranks for. No property is connected and nothing is inferred from referrer strings — a referrer says a browser arrived from a search page, not what was searched for or where the portal placed.',
  },
  {
    title: 'AI assistant citations',
    source: 'AI-citation monitoring',
    body: 'How often an assistant recommends or cites the portal. No monitor exists. This cannot be approximated from traffic: an assistant that cites the product without sending a click is invisible to every source the portal has.',
  },
  {
    title: 'Paid acquisition',
    source: 'ad platform reporting',
    body: 'Spend, impressions and cost per continued session. No ad account is connected, and no campaign parameter is recorded on the session.',
  },
  {
    title: 'Referral partners',
    source: 'partner attribution',
    body: 'Which partners send sessions that continue. The acquisition bucket below is coarse and carries no partner identity, so nothing here can be attributed to a named source.',
  },
] as const;

export function AcquisitionSection({ data }: { data: ObservatoryData }) {
  const journeys = data.portal.journeys;
  const acquisition = journeys.byAcquisition;
  const devices = journeys.byDevice;
  const auth = journeys.byAuthState;

  return (
    <Section
      id="s-acq"
      number="11"
      title="Acquisition &amp; discovery"
      lede="Source quality by continuation · and the discovery sources nobody has connected"
    >
      <div className={styles.twoGridWide}>
        <Panel
          title="Continuation by acquisition bucket"
          lede={`The coarse bucket carried on the session · rows under ${journeys.minimumCohort} sessions withhold the rate`}
        >
          <Scroller minWidth={520}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Source</th>
                  <th scope="col" className={styles.right}>Sessions</th>
                  <th scope="col" className={styles.right}>Continued</th>
                  <th scope="col" className={styles.right}>PMCR</th>
                  <th scope="col">State</th>
                </tr>
              </thead>
              <tbody>
                {acquisition.length === 0 ? (
                  <EmptyRow span={5}>
                    No eligible session has been recorded in this window.
                  </EmptyRow>
                ) : (
                  acquisition.map((row) => (
                    <tr key={row.key}>
                      <th scope="row" className={styles.nowrap}>{titleize(row.key)}</th>
                      <td className={styles.num}>{formatCount(row.sessions)}</td>
                      <td className={styles.num}>{formatCount(row.continued)}</td>
                      <td>
                        <div className={styles.barRowEnd}>
                          {row.rate === null ? null : <CellBar value={row.continued} total={row.sessions} />}
                          <span
                            className={`${styles.barValue} ${styles.stateText}`}
                            data-state={row.rate === null ? 'insufficient_sample' : 'derived'}
                          >
                            {row.rate === null ? 'low n' : share(row.continued, row.sessions)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <StateBadge state={row.suppressed ? 'insufficient_sample' : 'derived'} small />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Scroller>

          <p className={`${styles.note} ${styles.noteTop}`}>
            The bucket is derived from the referrer class at session start and carries no campaign,
            partner or query. It is enough to compare direct against referred traffic and not enough
            to attribute anything to a named source.
          </p>
        </Panel>

        <div className={styles.stack}>
          <Panel title="By device" lede="Continuation within each device class">
            {devices.length === 0 ? (
              <p className={styles.note}>No eligible session in this window.</p>
            ) : (
              devices.map((row) => (
                <div key={row.key} className={styles.kv}>
                  <span className={styles.kvLabel}>{titleize(row.key)}</span>
                  <span className={styles.kvValue}>
                    <span className={styles.mono}>{formatCount(row.sessions)}</span>{' '}
                    <span
                      className={styles.stateText}
                      data-state={row.rate === null ? 'insufficient_sample' : 'derived'}
                    >
                      {row.rate === null ? 'low n' : share(row.continued, row.sessions)}
                    </span>
                  </span>
                </div>
              ))
            )}
          </Panel>

          <Panel title="By auth state" lede="Signed in against anonymous, at the session level">
            {auth.length === 0 ? (
              <p className={styles.note}>No eligible session in this window.</p>
            ) : (
              auth.map((row) => (
                <div key={row.key} className={styles.kv}>
                  <span className={styles.kvLabel}>{titleize(row.key)}</span>
                  <span className={styles.kvValue}>
                    <span className={styles.mono}>{formatCount(row.sessions)}</span>{' '}
                    <span
                      className={styles.stateText}
                      data-state={row.rate === null ? 'insufficient_sample' : 'derived'}
                    >
                      {row.rate === null ? 'low n' : share(row.continued, row.sessions)}
                    </span>
                  </span>
                </div>
              ))
            )}
          </Panel>
        </div>
      </div>

      <div className={`${styles.fourGrid} ${styles.gapTop}`}>
        {UNCONNECTED.map((card) => (
          <div key={card.title} className={styles.stateCard} data-dashed="true">
            <span className={`${styles.stateTag} ${styles.stateText}`} data-state="source_not_connected">
              Source not connected
            </span>
            <h4 className={styles.stateTitle}>{card.title}</h4>
            <p className={styles.stateBody}>{card.body}</p>
            <span className={`${styles.stateAction} ${styles.stateText}`} data-state="source_not_connected">
              Requires {card.source}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}
