'use client';

import { useState, useTransition } from 'react';
import { addAssetAction } from '@/app/actions/wealth';
import { useLoginModal } from '@/components/shell/LoginModalProvider';
import { Icon } from '@/components/ui/Icon';
import {
  ADD_VOYAGER_EXAMPLE,
  ADD_VOYAGER_NOTE,
  ADD_VOYAGER_RECOGNIZED,
  ADD_HOW,
  ADD_SAVED_TOAST,
  ADD_WHAT,
  ASSETS_NOTE,
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

/** Matches the categories the wealth service accepts. */
const ASSET_CATEGORIES = [
  { id: 'property', label: 'Property' },
  { id: 'securities', label: 'Securities' },
  { id: 'cash', label: 'Cash' },
  { id: 'deposit', label: 'Deposit' },
  { id: 'business', label: 'Business' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'other', label: 'Other' },
];

const STATE_CLASS = {
  good: styles.stateGood,
  warn: styles.stateWarn,
  bad: styles.stateBad,
};

export type WealthAssetView = {
  id: string;
  category: string;
  name: string;
  /** Pre-formatted for display; the raw number stays on the server. */
  value: string;
  currency: string;
  /** Freshness of the figure, so a stale estimate never reads as a live price. */
  status: DataStatus;
  sub: string;
};

export function WealthScreen({ assets = [] }: { assets?: WealthAssetView[] }) {
  const router = useRouter();
  const { openLogin } = useLoginModal();

  /*
   * The record itself comes from the server, encrypted at rest and decrypted per
   * request. Only view state lives here — and it is still never written to
   * localStorage: a net-worth breakdown is not something to leave lying around in
   * browser storage on a shared machine.
   */
  const [tab, setTab] = useState<WealthTab>('overview');
  const [view, setView] = useState<StructureView>('type');
  const [scenarioType, setScenarioType] = useState<string | null>(null);
  const [scenarioAsset, setScenarioAsset] = useState('apt');
  const [addStage, setAddStage] = useState<'what' | 'how' | 'manual' | 'voyager'>('what');
  const [saved, setSaved] = useState(false);
  const [question, setQuestion] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    category: 'property',
    name: '',
    value: '',
    currency: 'EUR',
    country: '',
  });

  const onSaveAsset = () =>
    startTransition(async () => {
      setError(null);
      const result = await addAssetAction(draft);

      if (result.status === 'sign_in_required') {
        openLogin();
        return;
      }
      if (result.status === 'invalid') {
        setError(result.message);
        return;
      }

      setSaved(true);
      setDraft({ category: 'property', name: '', value: '', currency: 'EUR', country: '' });
      // The server re-renders the record; this brings the new row onto the page.
      router.refresh();
    });

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

  const askVoyager = () => {
    if (!question.trim()) return;
    router.push({ pathname: '/research', query: { q: question } });
  };

  // The demo constant is gone from this path: an empty record shows an empty
  // record. Filling it with someone else's sample assets would be the same lie the
  // mocks told, just with a database behind it.
  const grouped = assets.reduce<Record<string, WealthAssetView[]>>((acc, asset) => {
    (acc[asset.category] ??= []).push(asset);
    return acc;
  }, {});

  const totalsByCurrency = assets.reduce<Record<string, number>>((totals, asset) => {
    const amount = Number(asset.value.replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(amount)) return totals;
    totals[asset.currency] = (totals[asset.currency] ?? 0) + amount;
    return totals;
  }, {});

  return (
    <>
      <div className={styles.head}>
        <div className={styles.headLeft}>
          <h1 className={styles.h1}>My Wealth</h1>
          <div className={styles.headChips}>
            <span className={styles.privateChip}>Private — visible only to you</span>
            <span className={styles.profileChip}>Profile: Partial</span>
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
            Ask Voyager
          </Link>
        </div>
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
                <div className={styles.voyagerField}>
                  <input
                    className={styles.voyagerInput}
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') askVoyager();
                    }}
                    placeholder="What happens to my liquidity if I sell the apartment?"
                    aria-label="Ask Voyager about your wealth"
                  />
                  <button className={styles.voyagerSubmit} onClick={askVoyager} aria-label="Ask">
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
                {rows.map((asset) => (
                  <div className={styles.assetRow} key={asset.id}>
                    <span>
                      <span className={styles.assetName}>{asset.name}</span>
                      <span className={styles.assetSub}>{asset.sub}</span>
                    </span>
                    <span className={styles.assetRight}>
                      <span className={`${styles.assetValue} tn-num`}>{asset.value}</span>
                      {/* Every figure states how it was obtained. A typed estimate
                          and a connected price are both useful and are not the
                          same kind of number. */}
                      <span className={`${styles.statusChip} ${STATUS_CLASS[asset.status]}`}>
                        {DATA_STATUS_LABEL[asset.status]}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            ))}
            {assets.length === 0 && (
              <div className={styles.note}>
                Your record is empty. Add what you own — a property, a deposit, a holding — and
                this becomes a picture of your capital that only you can read.
              </div>
            )}
            {/* Totals stay split by currency. Summing across them needs a rate, and
                a rate applied silently turns an estimate into what looks like a fact. */}
            {Object.entries(totalsByCurrency).map(([currency, amount]) => (
              <div className={styles.total} key={currency}>
                <span>Total ({currency})</span>
                <span className="tn-num">
                  {amount.toLocaleString('en-GB', { style: 'currency', currency })}
                </span>
              </div>
            ))}
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
              <Link className={styles.chip} href="/account/voyager">
                Manage Voyager permissions
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
                        else setAddStage(item.id as 'manual' | 'voyager');
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
                  Add an asset
                </h2>
                <select
                  className={styles.field}
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  aria-label="Asset type"
                >
                  {ASSET_CATEGORIES.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  className={styles.field}
                  placeholder="Name — something you will recognise"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
                <input
                  className={styles.field}
                  placeholder="Estimated value"
                  inputMode="decimal"
                  value={draft.value}
                  onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                />
                <input
                  className={styles.field}
                  placeholder="Currency — EUR"
                  value={draft.currency}
                  onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
                />
                <input
                  className={styles.field}
                  placeholder="Country (optional)"
                  value={draft.country}
                  onChange={(e) => setDraft({ ...draft, country: e.target.value })}
                />
                <div className={styles.quickActions}>
                  <button className={styles.primary} onClick={onSaveAsset} disabled={pending}>
                    {pending ? 'Saving…' : 'Save to my Wealth Record'}
                  </button>
                  <button className={styles.ghost} onClick={() => setAddStage('how')}>
                    Back
                  </button>
                </div>
                {/* Says what was actually stored: a figure someone typed is manual,
                    and the record will keep saying so until a source confirms it. */}
                {error && <div className={styles.note}>{error}</div>}
                {saved && <div className={styles.toast}>{ADD_SAVED_TOAST}</div>}
              </>
            )}

            {addStage === 'voyager' && (
              <>
                <h2 className={styles.sectionTitle} style={{ marginTop: 0 }}>
                  Describe it in your own words
                </h2>
                <div className={styles.example}>“{ADD_VOYAGER_EXAMPLE}”</div>

                {/* Voyager proposes; the record only changes after an explicit confirm. */}
                <div className={styles.recognized}>
                  <div className={styles.recognizedTitle}>Voyager recognized — please confirm</div>
                  <div style={{ marginTop: 12 }}>
                    {ADD_VOYAGER_RECOGNIZED.map(([k, v]) => (
                      <div className={styles.kv} key={k}>
                        <span className={styles.kvKey}>{k}</span>
                        <span className={styles.kvValue}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className={styles.note}>{ADD_VOYAGER_NOTE}</div>
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
