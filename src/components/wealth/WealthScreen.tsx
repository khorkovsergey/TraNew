'use client';

import { useState } from 'react';
import { useLoginModal } from '@/components/shell/LoginModalProvider';
import { Icon } from '@/components/ui/Icon';
import {
  ADD_COPILOT_EXAMPLE,
  ADD_COPILOT_NOTE,
  ADD_COPILOT_RECOGNIZED,
  ADD_HOW,
  ADD_SAVED_TOAST,
  ADD_WHAT,
  ASSETS,
  ASSETS_NOTE,
  ASSETS_TOTAL,
  ATTENTION,
  DATA_SOURCES,
  DATA_STATUS_LABEL,
  GOALS,
  GOALS_SUMMARY,
  GOAL_CONFLICT,
  LIABILITIES,
  LIABILITIES_NOTE,
  LIQUIDITY_LADDER,
  LIQUIDITY_NOTE,
  MANUAL_FIELDS,
  OPPORTUNITIES,
  SCENARIOS,
  SCENARIO_ASSETS,
  SCENARIO_DISCLAIMER,
  SCENARIO_EMPTY,
  SCENARIO_TYPES,
  SCENARIO_UNMODELLED,
  SNAPSHOT,
  SNAPSHOT_CONFIDENCE,
  SOURCE_NOTE,
  STRUCTURE,
  STRUCTURE_VIEWS,
  WEALTH_HEALTH,
  WEALTH_TABS,
  WHAT_CHANGED,
  type DataStatus,
  type StructureView,
  type WealthTab,
} from '@/content/wealth';
import { Link, useRouter } from '@/i18n/navigation';
import styles from './Wealth.module.css';

const STATUS_CLASS: Record<DataStatus, string> = {
  verified: styles.stVerified,
  connected: styles.stConnected,
  manual: styles.stManual,
  estimated: styles.stEstimated,
  outdated: styles.stOutdated,
};

const TONE: Record<string, string> = {
  plain: styles.plain,
  good: styles.good,
  warn: styles.warn,
  bad: styles.bad,
  muted: styles.muted,
  info: styles.info,
};

const STATE_CLASS = {
  good: styles.stateGood,
  warn: styles.stateWarn,
  bad: styles.stateBad,
};

export function WealthScreen() {
  const router = useRouter();
  const { openLogin } = useLoginModal();

  /**
   * Wealth state is in-memory only. It is deliberately not persisted to
   * localStorage — a net-worth breakdown is not something to leave lying around in
   * browser storage on a shared machine.
   */
  const [tab, setTab] = useState<WealthTab>('overview');
  const [view, setView] = useState<StructureView>('type');
  const [scenarioType, setScenarioType] = useState<string | null>(null);
  const [scenarioAsset, setScenarioAsset] = useState('apt');
  const [addStage, setAddStage] = useState<'what' | 'how' | 'manual' | 'copilot'>('what');
  const [saved, setSaved] = useState(false);
  const [question, setQuestion] = useState('');

  const goTarget = (target: (typeof ATTENTION)[number]['target']) => {
    if (target.assetId) {
      router.push({
        pathname: '/account/wealth/assets/[id]',
        params: { id: target.assetId },
      });
      return;
    }
    if (target.scenario) setScenarioType(target.scenario);
    setTab(target.tab);
  };

  const scenarioKey =
    scenarioType === 'Sell' ? `Sell|${scenarioAsset}` : scenarioType ? `${scenarioType}|*` : null;
  const scenario = scenarioKey ? SCENARIOS[scenarioKey] : null;

  const askCopilot = () => {
    if (!question.trim()) return;
    router.push({ pathname: '/research', query: { q: question } });
  };

  const grouped = ASSETS.reduce<Record<string, typeof ASSETS>>((acc, asset) => {
    (acc[asset.category] ??= []).push(asset);
    return acc;
  }, {});

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1 className={styles.h1}>My Wealth</h1>
          <div className={styles.headChips}>
            <span className={styles.privateChip}>Private — visible only to you</span>
            <span className={styles.privateChip}>Profile: Partial</span>
          </div>
        </div>
      </div>

      <div className={styles.quickActions}>
        <button
          className={styles.primary}
          onClick={() => {
            setAddStage('what');
            setSaved(false);
            setTab('add');
          }}
        >
          Add to My Wealth
        </button>
        <button className={styles.ghost} onClick={() => setTab('scenarios')}>
          Run scenario
        </button>
        <Link
          className={`${styles.ghost} ${styles.ghostAi}`}
          href={{ pathname: '/research', query: { q: 'Review my capital structure' } }}
        >
          Ask Copilot
        </Link>
      </div>

      <div className={styles.layout}>
      <nav className={styles.sidebar}>
        {WEALTH_TABS.map((item) => (
          <button
            key={item.id}
            className={`${styles.navItem} ${tab === item.id ? styles.navItemActive : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div>
        {tab === 'overview' && (
          <>
            <div className={styles.snapshot}>
              {SNAPSHOT.map((item) => (
                <div className={styles.card} key={item.k}>
                  <div className={styles.snapKey}>{item.k}</div>
                  <div className={`${styles.snapValue} ${TONE[item.tone]} tn-num`}>{item.v}</div>
                </div>
              ))}
            </div>
            <div className={styles.confidence}>{SNAPSHOT_CONFIDENCE}</div>

            <div className={styles.stack}>
              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Capital structure</h2>
                <div className={styles.viewSwitch}>
                  {STRUCTURE_VIEWS.map((item) => (
                    <button
                      key={item.id}
                      className={`${styles.viewButton} ${view === item.id ? styles.viewButtonActive : ''}`}
                      onClick={() => setView(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                {STRUCTURE[view].map((row) => (
                  <div className={styles.barRow} key={row.k}>
                    <div className={styles.barHead}>
                      <span>{row.k}</span>
                      <span className={`${styles.barValue} tn-num`}>{row.v}</span>
                    </div>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFill}
                        style={{ width: `${row.width}%`, background: row.color }}
                      />
                    </div>
                  </div>
                ))}
              </section>

              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Liquidity ladder</h2>
                <div style={{ marginTop: 12 }}>
                  {LIQUIDITY_LADDER.map((row) => (
                    <div className={styles.ladderRow} key={row.k}>
                      <span>{row.k}</span>
                      <span className={`${styles.ladderValue} ${TONE[row.tone]} tn-num`}>
                        {row.v}
                      </span>
                    </div>
                  ))}
                </div>
                {/* The headline number invites this misreading, so answer it here. */}
                <div className={styles.note}>{LIQUIDITY_NOTE}</div>
              </section>

              <section className={styles.attention}>
                <h2 className={styles.attentionTitle}>Attention required</h2>
                <div style={{ marginTop: 8 }}>
                  {ATTENTION.map((item) => (
                    <div className={styles.attentionRow} key={item.text}>
                      <span>{item.text}</span>
                      <button
                        className={styles.attentionCta}
                        onClick={() => goTarget(item.target)}
                      >
                        {item.cta}
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className={styles.card}>
                <h2 className={styles.cardTitle}>What changed since your last visit</h2>
                <div className={styles.bullets}>
                  {WHAT_CHANGED.map((line) => (
                    <div className={styles.bullet} key={line}>
                      <span>•</span>
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Goals</h2>
                {GOALS_SUMMARY.map((goal) => (
                  <div className={styles.barRow} key={goal.k}>
                    <div className={styles.barHead}>
                      <span>{goal.k}</span>
                      <span className="tn-num">{goal.percent}%</span>
                    </div>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFill}
                        style={{ width: `${goal.percent}%`, background: goal.color }}
                      />
                    </div>
                  </div>
                ))}
              </section>

              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Opportunities</h2>
                {/* Named honestly: these are scenarios from your own data, not ads. */}
                <div className={styles.note} style={{ marginTop: 4 }}>
                  Personal scenarios, not ads — each one comes from your own record.
                </div>
                <div className={styles.chips}>
                  {OPPORTUNITIES.map((item) => (
                    <button
                      className={styles.chip}
                      key={item.label}
                      onClick={() => goTarget(item.target)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Ask anything about your wealth</h2>
                <div className={styles.copilotField}>
                  <input
                    className={styles.copilotInput}
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') askCopilot();
                    }}
                    placeholder="What happens to my liquidity if I sell the apartment?"
                    aria-label="Ask Copilot about your wealth"
                  />
                  <button className={styles.copilotSubmit} onClick={askCopilot} aria-label="Ask">
                    <Icon name="arrowRight" size={18} strokeWidth={2.2} />
                  </button>
                </div>
              </section>
            </div>
          </>
        )}

        {tab === 'assets' && (
          <>
            {Object.entries(grouped).map(([category, rows]) => (
              <div key={category}>
                <div className={styles.assetGroup}>{category}</div>
                {rows.map((asset) =>
                  asset.hasDetail ? (
                    <Link
                      className={`${styles.assetRow} ${styles.assetRowLink}`}
                      key={asset.id}
                      href={{
                        pathname: '/account/wealth/assets/[id]',
                        params: { id: asset.id },
                      }}
                    >
                      <span>
                        <span className={styles.assetName}>{asset.name}</span>
                        <span className={styles.assetSub}>{asset.sub}</span>
                      </span>
                      <span className={styles.assetRight}>
                        <span className={`${styles.assetValue} tn-num`}>{asset.value}</span>
                        <span className={`${styles.statusChip} ${STATUS_CLASS[asset.status]}`}>
                          {DATA_STATUS_LABEL[asset.status]}
                        </span>
                      </span>
                    </Link>
                  ) : (
                    <div className={styles.assetRow} key={asset.id}>
                      <span>
                        <span className={styles.assetName}>{asset.name}</span>
                        <span className={styles.assetSub}>{asset.sub}</span>
                      </span>
                      <span className={styles.assetRight}>
                        <span className={`${styles.assetValue} tn-num`}>{asset.value}</span>
                        <span className={`${styles.statusChip} ${STATUS_CLASS[asset.status]}`}>
                          {DATA_STATUS_LABEL[asset.status]}
                        </span>
                      </span>
                    </div>
                  )
                )}
              </div>
            ))}
            <div className={styles.total}>
              <span>Total</span>
              <span className="tn-num">{ASSETS_TOTAL}</span>
            </div>
            <div className={styles.note}>{ASSETS_NOTE}</div>
          </>
        )}

        {tab === 'liabilities' && (
          <>
            <div className={styles.stack}>
              {LIABILITIES.map((item) => (
                <section className={styles.card} key={item.name}>
                  <div className={styles.barHead}>
                    <h2 className={styles.cardTitle}>{item.name}</h2>
                    <span className={`${styles.assetValue} tn-num`}>{item.balance}</span>
                  </div>
                  <div className={styles.assetSub}>{item.terms}</div>
                  {item.linked && (
                    <div className={styles.linkedLiability}>Linked asset: {item.linked}</div>
                  )}
                </section>
              ))}
            </div>
            <div className={styles.note}>{LIABILITIES_NOTE}</div>
          </>
        )}

        {tab === 'goals' && (
          <>
            <div className={styles.stack}>
              {GOALS.map((goal) => (
                <section className={styles.card} key={goal.name}>
                  <div className={styles.barHead}>
                    <h2 className={styles.cardTitle}>{goal.name}</h2>
                    <span className="tn-num">{goal.percent}%</span>
                  </div>
                  <div className={styles.assetSub}>{goal.meta}</div>
                  <div className={styles.barTrack} style={{ marginTop: 12 }}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${goal.percent}%`, background: goal.color }}
                    />
                  </div>
                  <div className={styles.kv} style={{ marginTop: 14 }}>
                    <span className={styles.kvKey}>Funded</span>
                    <span className={styles.kvValue}>{goal.funded}</span>
                  </div>
                  <div className={styles.kv}>
                    <span className={styles.kvKey}>Linked assets</span>
                    <span className={styles.kvValue}>{goal.assets}</span>
                  </div>
                </section>
              ))}
            </div>
            {/* One pool of capital cannot fund two goals at once — flag it, don't hide it. */}
            <section className={styles.attention} style={{ marginTop: 18 }}>
              <h2 className={styles.attentionTitle}>Two goals, one pool of capital</h2>
              <div className={styles.attentionRow} style={{ borderBottom: 'none' }}>
                {GOAL_CONFLICT}
              </div>
            </section>
          </>
        )}

        {tab === 'scenarios' && (
          <>
            <div className={styles.viewSwitch}>
              {SCENARIO_TYPES.map((type) => (
                <button
                  key={type}
                  className={`${styles.viewButton} ${scenarioType === type ? styles.viewButtonActive : ''}`}
                  onClick={() => setScenarioType(type)}
                >
                  {type}
                </button>
              ))}
            </div>

            {scenarioType === 'Sell' && (
              <div className={styles.chips}>
                {SCENARIO_ASSETS.map((asset) => (
                  <button
                    key={asset.id}
                    className={styles.chip}
                    style={
                      scenarioAsset === asset.id
                        ? { background: 'var(--tn-blue-tint)', color: 'var(--tn-blue)' }
                        : undefined
                    }
                    onClick={() => setScenarioAsset(asset.id)}
                  >
                    {asset.label}
                  </button>
                ))}
              </div>
            )}

            {!scenarioType && <div className={styles.note}>{SCENARIO_EMPTY}</div>}
            {scenarioType && !scenario && <div className={styles.note}>{SCENARIO_UNMODELLED}</div>}

            {scenario && (
              <div className={styles.scenarioResult}>
                <h2 className={styles.sectionTitle} style={{ marginTop: 0 }}>
                  {scenario.title}
                </h2>
                <div className={styles.badges}>
                  <span className={styles.badgeDraft}>Draft scenario</span>
                  <span className={styles.badgeDraft}>Data as of Jul 30, 2026</span>
                </div>

                <section className={styles.card} style={{ marginTop: 18 }}>
                  {scenario.deltas.map(([k, v]) => (
                    <div className={styles.kv} key={k}>
                      <span className={styles.kvKey}>{k}</span>
                      <span className={styles.kvValue}>{v}</span>
                    </div>
                  ))}
                </section>

                <div className={styles.caseGrid}>
                  <div className={`${styles.caseCard} ${styles.caseAssumptions}`}>
                    <div className={styles.caseLabel}>Assumptions</div>
                    <div className={styles.caseText}>{scenario.assumptions}</div>
                  </div>
                  <div className={`${styles.caseCard} ${styles.caseNegative}`}>
                    <div className={styles.caseLabel}>Negative case</div>
                    <div className={styles.caseText}>{scenario.negative}</div>
                  </div>
                  <div className={`${styles.caseCard} ${styles.casePositive}`}>
                    <div className={styles.caseLabel}>Positive case</div>
                    <div className={styles.caseText}>{scenario.positive}</div>
                  </div>
                </div>

                <div className={styles.note}>{SCENARIO_DISCLAIMER}</div>
              </div>
            )}
          </>
        )}

        {tab === 'insights' && (
          <>
            <h2 className={styles.sectionTitle} style={{ marginTop: 0 }}>
              Wealth health
            </h2>
            <div className={styles.healthGrid}>
              {WEALTH_HEALTH.map((item) => (
                <div className={styles.healthRow} key={item.k}>
                  <span>
                    <span className={styles.assetName}>{item.k}</span>
                    <span className={`${styles.assetSub} tn-num`}>{item.v}</span>
                  </span>
                  <span className={`${styles.healthState} ${STATE_CLASS[item.tone]}`}>
                    {item.state}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'data' && (
          <>
            <div className={styles.stack}>
              {DATA_SOURCES.map((source) => (
                <section className={styles.card} key={source.name}>
                  <div className={styles.barHead}>
                    <h2 className={styles.cardTitle}>{source.name}</h2>
                    <span className={`${styles.statusChip} ${TONE[source.tone]}`}>
                      {source.status}
                    </span>
                  </div>
                  <div className={styles.assetSub}>{source.sub}</div>
                </section>
              ))}
            </div>
            {/* A source is not the asset it created. */}
            <div className={styles.note}>{SOURCE_NOTE}</div>

            <h2 className={styles.sectionTitle}>Privacy</h2>
            <div className={styles.chips}>
              <button className={styles.chip}>Export my data</button>
              <Link className={styles.chip} href="/account/copilot">
                Manage Copilot permissions
              </Link>
              <Link
                className={styles.chip}
                href={{ pathname: '/marketplace/experts/[id]/sharing', params: { id: 'ak' } }}
              >
                Create expert snapshot
              </Link>
            </div>
            <div style={{ marginTop: 16 }}>
              <button className={styles.danger}>Delete Wealth Profile</button>
            </div>
          </>
        )}

        {tab === 'add' && (
          <>
            {addStage === 'what' && (
              <>
                <h2 className={styles.sectionTitle} style={{ marginTop: 0 }}>
                  What would you like to add?
                </h2>
                <div className={styles.addGrid}>
                  {ADD_WHAT.map((item) => (
                    <button
                      className={styles.addCard}
                      key={item.title}
                      onClick={() => setAddStage('how')}
                    >
                      <div className={styles.addTitle}>{item.title}</div>
                      <div className={styles.addSub}>{item.sub}</div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {addStage === 'how' && (
              <>
                <h2 className={styles.sectionTitle} style={{ marginTop: 0 }}>
                  How would you like to add it?
                </h2>
                <div className={styles.addGrid}>
                  {ADD_HOW.map((item) => (
                    <button
                      className={styles.addCard}
                      key={item.title}
                      onClick={() => {
                        if (item.id === 'auth') openLogin();
                        else setAddStage(item.id as 'manual' | 'copilot');
                      }}
                    >
                      <div className={styles.addTitle}>{item.title}</div>
                      <div className={styles.addSub}>{item.sub}</div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {addStage === 'manual' && (
              <>
                <h2 className={styles.sectionTitle} style={{ marginTop: 0 }}>
                  Add a property
                </h2>
                {MANUAL_FIELDS.map((field) => (
                  <input className={styles.field} key={field} placeholder={field} />
                ))}
                <div className={styles.quickActions}>
                  <button className={styles.primary} onClick={() => setSaved(true)}>
                    Save to my Wealth Record
                  </button>
                  <button className={styles.ghost} onClick={() => setAddStage('how')}>
                    Back
                  </button>
                </div>
                {saved && <div className={styles.toast}>{ADD_SAVED_TOAST}</div>}
              </>
            )}

            {addStage === 'copilot' && (
              <>
                <h2 className={styles.sectionTitle} style={{ marginTop: 0 }}>
                  Describe it in your own words
                </h2>
                <div className={styles.example}>“{ADD_COPILOT_EXAMPLE}”</div>

                {/* Copilot proposes; the record only changes after an explicit confirm. */}
                <div className={styles.recognized}>
                  <div className={styles.recognizedTitle}>Copilot recognized — please confirm</div>
                  <div style={{ marginTop: 12 }}>
                    {ADD_COPILOT_RECOGNIZED.map(([k, v]) => (
                      <div className={styles.kv} key={k}>
                        <span className={styles.kvKey}>{k}</span>
                        <span className={styles.kvValue}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className={styles.note}>{ADD_COPILOT_NOTE}</div>
                  <div className={styles.quickActions}>
                    <button className={styles.primary} onClick={() => setSaved(true)}>
                      Confirm
                    </button>
                    <button className={styles.ghost} onClick={() => setAddStage('how')}>
                      Edit
                    </button>
                  </div>
                </div>

                {saved && <div className={styles.toast}>{ADD_SAVED_TOAST}</div>}
              </>
            )}
          </>
        )}
        </div>
      </div>
    </>
  );
}
