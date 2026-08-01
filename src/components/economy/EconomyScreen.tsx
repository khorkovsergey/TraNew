'use client';

import { useEffect, useState } from 'react';
import { useLoginModal } from '@/components/shell/LoginModalProvider';
import { TrustLabel } from '@/components/ui/TrustLabel';
import {
  CALENDAR_FULL,
  CALENDAR_PREVIEW,
  VOYAGER_QUESTIONS,
  COUNTRY_GROUPS,
  ECONOMY_TABS,
  ESSENTIAL_INDICATORS,
  INDICATOR,
  INDICATOR_THEMES,
  MACRO_TOOLS,
  MARKET_IMPACT,
  MORE_INDICATORS,
  MORE_INDICATORS_DEFAULT,
  NEWS_CLUSTERS,
  OUTLOOK,
  RECOMMENDED_COUNTRIES,
  THREE_CHANGES,
  WORLD,
  WORLD_METRICS,
  type CalendarRow,
  type EconomyTab,
  type Tone,
  type WorldMetric,
} from '@/content/economy';
import { Link } from '@/i18n/navigation';
import styles from './Economy.module.css';

const TONE_TILE: Record<Tone, string> = {
  good: styles.toneGood,
  warn: styles.toneWarn,
  bad: styles.toneBad,
};

const TONE_TEXT: Record<Tone, string> = {
  good: styles.toneGoodText,
  warn: styles.toneWarnText,
  bad: styles.toneBadText,
};

const TONE_INLINE: Record<Tone | 'info' | 'plain' | 'muted', string> = {
  good: styles.good,
  warn: styles.warn,
  bad: styles.bad,
  info: '',
  plain: '',
  muted: styles.muted,
};

const DOT: Record<CalendarRow['importance'], string> = {
  high: styles.dotHigh,
  med: styles.dotMed,
  low: styles.dotLow,
};

function CalendarTable({ rows, full }: { rows: CalendarRow[]; full: boolean }) {
  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Time (UTC)</th>
            <th>Cty</th>
            <th>Event</th>
            <th>Fcst</th>
            <th>Prev</th>
            {full && <th>Actual</th>}
            {full && <th>Surprise</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.time}-${row.event}`}>
              <td className="tn-num">{row.time}</td>
              <td>{row.country}</td>
              <td>
                <span className={`${styles.dot} ${DOT[row.importance]}`} />
                {row.event}
              </td>
              <td className="tn-num">{row.forecast}</td>
              <td className="tn-num">{row.previous}</td>
              {full && <td className="tn-num">{row.actual ?? '—'}</td>}
              {full && (
                <td
                  className={`tn-num ${row.surpriseTone ? TONE_INLINE[row.surpriseTone] : styles.muted}`}
                >
                  {row.surprise ?? '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EconomyScreen() {
  const { openLogin } = useLoginModal();
  const [tab, setTab] = useState<EconomyTab>('overview');
  const [metric, setMetric] = useState<WorldMetric>('Growth');
  const [mode, setMode] = useState<'level' | 'change'>('level');
  const [theme, setTheme] = useState('Growth');

  /**
   * The header menu deep-links into a tab. Read it from the URL here rather than via
   * useSearchParams, which would opt this whole screen out of prerendering.
   */
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (requested && ECONOMY_TABS.some((item) => item.id === requested)) {
      setTab(requested as EconomyTab);
    }
  }, []);

  const essentials = ESSENTIAL_INDICATORS[theme] ?? ESSENTIAL_INDICATORS.Growth;
  const more = MORE_INDICATORS[theme] ?? MORE_INDICATORS_DEFAULT;

  return (
    <>
      {/* Personal scopes need an account; Global is what an anonymous visitor gets. */}
      <div className={styles.scopes}>
        <button className={`${styles.scope} ${styles.scopeActive}`}>Global</button>
        <button className={styles.scope} onClick={openLogin}>
          My markets
        </button>
        <button className={styles.scope} onClick={openLogin}>
          My portfolio
        </button>
      </div>

      <div className={styles.tabs} role="tablist">
        {ECONOMY_TABS.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            className={`${styles.tab} ${tab === item.id ? styles.tabActive : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Every one of these still opens the placeholder screen, so they say so
          here for the same reason the header menu does — before the click, not
          after it. */}
      <div className={styles.toolsRow}>
        <span className={styles.toolsLabel}>Macro tools</span>
        {MACRO_TOOLS.map((tool) => (
          <Link
            className={styles.tool}
            key={tool.slug}
            href={{ pathname: '/tool/[slug]', params: { slug: tool.slug } }}
          >
            {tool.label}
            <span className={styles.soon}>Soon</span>
          </Link>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>Global Economic Outlook</h2>
            <span className={`${styles.badge} ${styles.badgeRegime}`}>
              Economic regime: Slowdown
            </span>
            <TrustLabel kind="marketData" />
            <span className={styles.clusterMeta}>09:45 UTC</span>
          </div>

          {/* Four separate readings — a single blended score would hide disagreement. */}
          <div className={styles.outlookGrid}>
            {OUTLOOK.map((item) => (
              <div className={styles.card} key={item.key}>
                <div className={styles.outlookKey}>{item.key}</div>
                <div className={styles.outlookState} style={{ color: item.color }}>
                  {item.state}
                </div>
                <div className={styles.outlookNote}>{item.note}</div>
              </div>
            ))}
          </div>

          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>Three changes that matter this week</h2>
          </div>
          <div className={styles.changeGrid}>
            {THREE_CHANGES.map((change) => (
              <Link
                className={styles.changeCard}
                key={change.title}
                href={
                  change.target.kind === 'indicator'
                    ? {
                        pathname: '/economy/indicators/[slug]',
                        params: { slug: INDICATOR.slug },
                      }
                    : {
                        pathname: '/economy/countries/[id]',
                        params: { id: change.target.id },
                      }
                }
              >
                <div className={styles.changeTitle}>{change.title}</div>
                <div className={styles.changeSurprise}>{change.surprise}</div>
                <div className={styles.changeWhy}>{change.why}</div>
                <div className={styles.chips}>
                  {change.assets.map((asset) => (
                    <span className={styles.chip} key={asset}>
                      {asset}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>

          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>What it may mean for markets</h2>
          </div>
          <div className={styles.card} style={{ marginTop: 18 }}>
            {MARKET_IMPACT.map((row) => (
              <div className={styles.impactRow} key={row.k}>
                <span className={styles.impactKey}>{row.k}</span>
                <span className={styles.impactValue}>{row.v}</span>
              </div>
            ))}
            <div className={styles.note}>Possible effects, not investment advice.</div>
          </div>

          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>Key upcoming events</h2>
          </div>
          <CalendarTable rows={CALENDAR_PREVIEW} full={false} />
          <button className={styles.linkRow} onClick={() => setTab('calendar')}>
            Full calendar →
          </button>

          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>Explore the world economy</h2>
          </div>
          <div className={styles.controls}>
            {WORLD_METRICS.map((item) => (
              <button
                key={item}
                className={`${styles.control} ${metric === item ? styles.controlActive : ''}`}
                onClick={() => setMetric(item)}
              >
                {item}
              </button>
            ))}
            <span className={styles.modeGroup}>
              {(['level', 'change'] as const).map((item) => (
                <button
                  key={item}
                  className={`${styles.control} ${mode === item ? styles.controlActive : ''}`}
                  onClick={() => setMode(item)}
                >
                  {item === 'level' ? 'Level' : 'Change'}
                </button>
              ))}
            </span>
          </div>
          <div className={styles.worldGrid}>
            {WORLD.map((row) => {
              const [level, change, tone] = row[metric];
              return (
                <Link
                  className={`${styles.worldTile} ${TONE_TILE[tone]}`}
                  key={row.id}
                  href={{ pathname: '/economy/countries/[id]', params: { id: row.id } }}
                >
                  <div className={styles.worldName}>{row.name}</div>
                  <div className={`${styles.worldValue} ${TONE_TEXT[tone]} tn-num`}>
                    {mode === 'level' ? level : change}
                  </div>
                </Link>
              );
            })}
          </div>

          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>News &amp; Insights</h2>
          </div>
          <div className={styles.clusterGrid}>
            {NEWS_CLUSTERS.map((cluster) => (
              <button
                className={styles.card}
                key={cluster.id}
                style={{ textAlign: 'left' }}
                onClick={() => setTab('news')}
              >
                <div className={styles.changeTitle}>{cluster.title}</div>
                <div className={styles.clusterMeta}>{cluster.meta}</div>
              </button>
            ))}
          </div>

          <div className={styles.voyager}>
            <div className={styles.voyagerTitle}>Voyager AI: ask about the economy</div>
            <div className={styles.chips} style={{ marginTop: 14 }}>
              {VOYAGER_QUESTIONS.map((question) => (
                <Link
                  className={styles.chipPurple}
                  key={question}
                  href={{ pathname: '/research', query: { q: question } }}
                >
                  {question}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'countries' && (
        <>
          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>Recommended for you</h2>
          </div>
          <div className={styles.recGrid}>
            {RECOMMENDED_COUNTRIES.map((country) => (
              <Link
                className={styles.recCard}
                key={country.id}
                href={{ pathname: '/economy/countries/[id]', params: { id: country.id } }}
              >
                <div className={styles.recName}>{country.name}</div>
                {/* Every recommendation states why it is being recommended. */}
                <div className={styles.recReason}>{country.reason}</div>
              </Link>
            ))}
          </div>

          <div className={styles.groupGrid}>
            {COUNTRY_GROUPS.map((group) => (
              <div key={group.title}>
                <div className={styles.groupTitle}>{group.title}</div>
                {group.items.map((item) =>
                  item.id ? (
                    <Link
                      className={styles.groupItem}
                      key={item.label}
                      href={{ pathname: '/economy/countries/[id]', params: { id: item.id } }}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <Link
                      className={styles.groupItem}
                      key={item.label}
                      href={{
                        pathname: '/tool/[slug]',
                        params: { slug: `economy-${item.label.toLowerCase()}` },
                      }}
                    >
                      {item.label}
                    </Link>
                  )
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'indicators' && (
        <>
          <div className={styles.controls} style={{ marginTop: 26 }}>
            {INDICATOR_THEMES.map((item) => (
              <button
                key={item}
                className={`${styles.control} ${theme === item ? styles.controlActive : ''}`}
                onClick={() => setTheme(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>Essential indicators</h2>
          </div>
          <div className={styles.essentialGrid}>
            {essentials.map((item) => (
              <Link
                className={styles.card}
                key={item.k}
                href={{ pathname: '/economy/indicators/[slug]', params: { slug: INDICATOR.slug } }}
              >
                <div className={styles.essentialKey}>{item.k}</div>
                <div className={`${styles.essentialValue} tn-num`}>{item.v}</div>
                <div className={`${styles.essentialTrend} ${TONE_INLINE[item.tone]}`}>
                  {item.trend}
                </div>
              </Link>
            ))}
          </div>

          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>More indicators</h2>
          </div>
          <div className={styles.chips}>
            {more.map((item) => (
              <Link
                className={styles.chipLink}
                key={item}
                href={{ pathname: '/economy/indicators/[slug]', params: { slug: INDICATOR.slug } }}
              >
                {item}
              </Link>
            ))}
          </div>
          <Link
            className={styles.linkRow}
            href={{ pathname: '/tool/[slug]', params: { slug: 'indicator-catalog' } }}
          >
            All data — full professional catalog →
          </Link>
        </>
      )}

      {tab === 'calendar' && (
        <>
          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>Economic calendar</h2>
            <TrustLabel kind="marketData" />
          </div>
          <CalendarTable rows={CALENDAR_FULL} full />
          <button className={styles.linkRow} onClick={openLogin}>
            Log in to filter by your countries, watchlist, portfolio and asset classes
          </button>
        </>
      )}

      {tab === 'news' && (
        <>
          {NEWS_CLUSTERS.map((cluster) => (
            <div className={styles.card} key={cluster.id} style={{ marginTop: 20 }}>
              <div className={styles.changeTitle}>{cluster.title}</div>
              <div className={styles.clusterMeta}>{cluster.meta}</div>

              <div className={styles.clusterBlock}>
                <span className={`${styles.clusterLabel} ${styles.labelAi}`}>AI summary</span>
                <div className={styles.clusterText}>{cluster.summary}</div>
              </div>

              <div className={styles.clusterBlock}>
                <span className={`${styles.clusterLabel} ${styles.labelFacts}`}>
                  Confirmed facts
                </span>
                <div className={styles.clusterText}>{cluster.facts}</div>
              </div>

              <div className={styles.clusterBlock}>
                <span className={`${styles.clusterLabel} ${styles.labelInterp}`}>
                  Market interpretation
                </span>
                <div className={styles.clusterText}>{cluster.interpretation}</div>
              </div>

              <div className={styles.chips}>
                {cluster.assets.map((asset) => (
                  <span className={styles.chip} key={asset}>
                    {asset}
                  </span>
                ))}
              </div>

              <Link className={styles.linkRow} href="/news">
                Original sources →
              </Link>
            </div>
          ))}
        </>
      )}
    </>
  );
}
