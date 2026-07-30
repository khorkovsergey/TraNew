'use client';

import { useState } from 'react';
import {
  ACADEMY_SUMMARY,
  ACTIVITY_FILTERS,
  ACTIVITY_NOTE,
  COLLECTIONS_NOTE,
  COPILOT_TABS,
  MEMORY_NOTE,
  PURCHASE_TABS,
  SAVED_FILTERS,
  SETTINGS_TABS,
  WORKSPACE_TABS,
} from '@/content/account';
import { Link } from '@/i18n/navigation';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import {
  getActivity,
  getAlerts,
  getCollections,
  getContinueItems,
  getConversations,
  getCopilotInsights,
  getMemory,
  getPermissions,
  getProfileFields,
  getPurchases,
  getReports,
  getResearchItems,
  getSavedInsights,
  getSavedItems,
  getSavedViews,
  getSettingsNote,
  getSettingsRows,
  getUsage,
  getUser,
  getWealthPreview,
} from '@/lib/accountService';
import styles from './Account.module.css';

/* ---------------------------------------------------------------- Overview */

export function AccountOverview() {
  const user = getUser();
  const preview = getWealthPreview();

  return (
    <>
      <h1 className={styles.h1}>Welcome back, {user.shortName.split(' ')[0]}</h1>
      <p className={styles.context}>
        You have 3 new insights and a consultation tomorrow.
      </p>
      {/* One primary action, not a wall of equal-weight buttons. */}
      <Link className={styles.primary} href="/academy/dashboard">
        Continue learning
      </Link>

      <h2 className={styles.sectionTitle}>Continue where you left off</h2>
      <div className={styles.grid3}>
        {getContinueItems().map((item) => (
          <div className={styles.card} key={item.title}>
            <div className={styles.eyebrow}>{item.type}</div>
            <div className={styles.itemTitle}>{item.title}</div>
            <div className={styles.itemMeta}>{item.meta}</div>
          </div>
        ))}
      </div>

      <h2 className={styles.sectionTitle}>Copilot insights</h2>
      <div className={styles.grid3}>
        {getCopilotInsights().map((insight) => (
          <div className={styles.insightCard} key={insight.title}>
            <div className={styles.insightTitle}>{insight.title}</div>
            {/* Each card says why it appeared. */}
            <div className={styles.insightBody}>{insight.body}</div>
            <Link className={styles.insightCta} href="/account/workspace">
              {insight.cta} →
            </Link>
          </div>
        ))}
      </div>

      <h2 className={styles.sectionTitle}>Wealth Hub</h2>
      {FEATURE_FLAGS.wealthHubEnabled ? (
        <Link className={styles.wealthCard} href="/account/wealth">
          <div className={styles.wealthTitle}>{preview.enabled.title}</div>
          <div className={`${styles.wealthStats} tn-num`}>{preview.enabled.stats}</div>
          <div className={styles.insightCta}>{preview.enabled.cta}</div>
        </Link>
      ) : (
        <div className={styles.wealthCard}>
          <div className={styles.wealthTitle}>{preview.disabled.title}</div>
          <div className={styles.wealthStats}>{preview.disabled.body}</div>
          <button className={styles.insightCta}>{preview.disabled.cta}</button>
        </div>
      )}

      <div className={styles.grid2}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>My Workspace</div>
          <div className={styles.itemMeta}>
            3 collections · 6 saved items · 3 saved views · 3 alerts
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Learning progress</div>
          <div className={styles.barTrack}>
            <div className={styles.barFill} style={{ width: `${ACADEMY_SUMMARY.percent}%` }} />
          </div>
          <div className={styles.itemMeta}>Next: {ACADEMY_SUMMARY.nextLesson}</div>
        </div>
      </div>

      <h2 className={styles.sectionTitle}>Upcoming</h2>
      <Link className={styles.card} href="/account/purchases" style={{ display: 'block' }}>
        <div className={styles.cardTitle}>Consultation with Anna Keller</div>
        <div className={styles.itemMeta}>Booking #TN-8347 · Thu, Jul 31 · 14:00</div>
      </Link>
    </>
  );
}

/* --------------------------------------------------------------- Workspace */

export function AccountWorkspace() {
  const [tab, setTab] = useState<(typeof WORKSPACE_TABS)[number]['id']>('collections');
  const [savedFilter, setSavedFilter] = useState('All');
  const [extraCollections, setExtraCollections] = useState(0);
  const [paused, setPaused] = useState<Record<string, boolean>>({});
  const [deleted, setDeleted] = useState<Record<string, boolean>>({});

  const collections = [
    ...getCollections(),
    ...Array.from({ length: extraCollections }, (_, index) => ({
      name: `New collection ${index + 1}`,
      meta: '0 items · just created · Private',
    })),
  ];

  return (
    <>
      <h1 className={styles.h1}>My Workspace</h1>

      <div className={styles.tabs} role="tablist">
        {WORKSPACE_TABS.map((item) => (
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

      {tab === 'collections' && (
        <>
          <div className={styles.grid3}>
            {collections.map((collection) => (
              <div className={styles.card} key={collection.name}>
                <div className={styles.cardTitle}>{collection.name}</div>
                <div className={styles.itemMeta}>{collection.meta}</div>
              </div>
            ))}
          </div>
          <button
            className={styles.primary}
            onClick={() => setExtraCollections((value) => value + 1)}
          >
            + Create collection
          </button>
          <div className={styles.note}>{COLLECTIONS_NOTE}</div>
        </>
      )}

      {tab === 'saved' && (
        <>
          <div className={styles.filters}>
            {SAVED_FILTERS.map((filter) => (
              <button
                key={filter}
                className={`${styles.filter} ${savedFilter === filter ? styles.filterActive : ''}`}
                onClick={() => setSavedFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
          <div className={styles.stack}>
            {getSavedItems(savedFilter).map((item) => (
              <div className={styles.row} key={item.title}>
                <span>
                  <span className={styles.typeChip}>{item.type}</span>
                  <span className={styles.itemTitle}>{item.title}</span>
                  <span className={styles.itemMeta}>{item.meta}</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'views' && (
        <div className={styles.stack}>
          {getSavedViews().map((view) => (
            <div className={styles.row} key={view.name}>
              <span>
                <span className={styles.itemTitle}>{view.name}</span>
                <span className={styles.itemMeta}>{view.meta}</span>
              </span>
              <span className={styles.rowActions}>
                <button className={styles.ghost}>Open</button>
                <button className={styles.ghost}>Duplicate</button>
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === 'research' && (
        <div className={styles.stack}>
          {getResearchItems().map((item) => (
            <div className={styles.row} key={item.title}>
              <span>
                <span
                  className={`${styles.typeChip} ${
                    item.tone === 'blue'
                      ? styles.chipBlue
                      : item.tone === 'purple'
                        ? styles.chipPurple
                        : styles.chipGrey
                  }`}
                >
                  {item.tag}
                </span>
                <span className={styles.itemTitle}>{item.title}</span>
                <span className={styles.itemMeta}>{item.meta}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === 'reports' && (
        <div className={styles.stack}>
          {getReports().map((report) => (
            <div className={styles.row} key={report.title}>
              <span>
                <span className={styles.itemTitle}>{report.title}</span>
                <span className={styles.itemMeta}>{report.meta}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === 'alerts' && (
        <div className={styles.stack}>
          {getAlerts()
            .filter((alert) => !deleted[alert.id])
            .map((alert) => {
              const isPaused = paused[alert.id];
              return (
                <div className={styles.row} key={alert.id}>
                  <span>
                    <span
                      className={`${styles.typeChip} ${
                        isPaused ? styles.statusPaused : styles.statusActive
                      }`}
                    >
                      {isPaused ? 'Paused' : 'Active'}
                    </span>
                    <span className={styles.itemTitle}>{alert.name}</span>
                    {/* Delivery channel lives in the meta line, per the design. */}
                    <span className={styles.itemMeta}>{alert.meta}</span>
                  </span>
                  <span className={styles.rowActions}>
                    <button
                      className={styles.linkAction}
                      onClick={() =>
                        setPaused((current) => ({ ...current, [alert.id]: !current[alert.id] }))
                      }
                    >
                      {isPaused ? 'Resume' : 'Pause'}
                    </button>
                    <button
                      className={styles.dangerAction}
                      onClick={() => setDeleted((current) => ({ ...current, [alert.id]: true }))}
                    >
                      Delete
                    </button>
                  </span>
                </div>
              );
            })}
        </div>
      )}
    </>
  );
}

/* ----------------------------------------------------------------- Copilot */

export function AccountCopilot() {
  const [tab, setTab] = useState<(typeof COPILOT_TABS)[number]['id']>('conversations');
  const [memoryOff, setMemoryOff] = useState<Record<string, boolean>>({});
  const [memoryDeleted, setMemoryDeleted] = useState<Record<string, boolean>>({});
  const [permissionsOff, setPermissionsOff] = useState<Record<number, boolean>>({});
  const usage = getUsage();

  return (
    <>
      <h1 className={styles.h1}>Copilot</h1>

      <div className={styles.tabs} role="tablist">
        {COPILOT_TABS.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            className={`${styles.tab} ${tab === item.id ? styles.tabActivePurple : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'conversations' && (
        <div className={styles.stack}>
          {getConversations().map((conversation) => (
            <Link
              className={styles.row}
              key={conversation.title}
              href={{ pathname: '/research', query: { q: conversation.title } }}
            >
              <span>
                <span className={styles.itemTitle}>
                  {conversation.pinned ? '📌 ' : ''}
                  {conversation.title}
                </span>
                {/* Context badges show what the answer was grounded in. */}
                <span className={styles.badges}>
                  {conversation.badges.map((badge) => (
                    <span className={styles.badge} key={badge}>
                      {badge}
                    </span>
                  ))}
                </span>
                <span className={styles.itemMeta}>{conversation.meta}</span>
              </span>
            </Link>
          ))}
        </div>
      )}

      {tab === 'insights' && (
        <div className={styles.stack}>
          {getSavedInsights().map((insight) => (
            <div className={styles.card} key={insight.title}>
              <div className={styles.cardTitle}>{insight.title}</div>
              <div className={styles.insightBody}>{insight.body}</div>
              <div className={styles.itemMeta}>{insight.meta}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'memory' && (
        <>
          <div className={styles.note} style={{ marginTop: 18 }}>
            {MEMORY_NOTE}
          </div>
          <div className={styles.stack}>
            {getMemory()
              .filter((item) => !memoryDeleted[item.id])
              .map((item) => {
                const off = memoryOff[item.id];
                return (
                  <div className={styles.row} key={item.id}>
                    <span>
                      <span className={styles.itemTitle}>
                        {item.k}: {item.v}
                      </span>
                      <span className={styles.itemMeta}>{item.src}</span>
                    </span>
                    <span className={styles.rowActions}>
                      <button
                        className={off ? styles.settingSub : styles.linkAction}
                        onClick={() =>
                          setMemoryOff((current) => ({ ...current, [item.id]: !current[item.id] }))
                        }
                      >
                        {off ? 'Not used' : 'Do not use'}
                      </button>
                      <button
                        className={styles.dangerAction}
                        onClick={() =>
                          setMemoryDeleted((current) => ({ ...current, [item.id]: true }))
                        }
                      >
                        Delete
                      </button>
                    </span>
                  </div>
                );
              })}
          </div>
        </>
      )}

      {tab === 'permissions' && (
        <div className={styles.card} style={{ marginTop: 18 }}>
          {getPermissions().map((permission, index) => {
            const on = !permissionsOff[index];
            return (
              <div className={styles.settingRow} key={permission}>
                <span className={styles.settingKey}>{permission}</span>
                <button
                  className={`${styles.toggle} ${styles.togglePurple} ${on ? styles.toggleOn : ''}`}
                  role="switch"
                  aria-checked={on}
                  aria-label={permission}
                  onClick={() =>
                    setPermissionsOff((current) => ({ ...current, [index]: !current[index] }))
                  }
                >
                  <span className={styles.toggleKnob} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'usage' && (
        <div className={styles.card} style={{ marginTop: 18 }}>
          <div className={styles.cardTitle}>
            <span className="tn-num">
              {usage.used} / {usage.limit}
            </span>{' '}
            messages this month
          </div>
          <div className={styles.barTrack}>
            <div
              className={styles.barFill}
              style={{ width: `${(usage.used / usage.limit) * 100}%` }}
            />
          </div>
          <div className={styles.itemMeta}>{usage.reset}</div>
          <Link
            className={styles.insightCta}
            href={{ pathname: '/tool/[slug]', params: { slug: 'ai-private' } }}
          >
            {usage.cta} →
          </Link>
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- Activity */

export function AccountActivity() {
  const [filter, setFilter] = useState('All');

  return (
    <>
      <h1 className={styles.h1}>Activity</h1>

      <div className={styles.filters}>
        {ACTIVITY_FILTERS.map((item) => (
          <button
            key={item}
            className={`${styles.filter} ${filter === item ? styles.filterActive : ''}`}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className={styles.stack}>
        {getActivity(filter).map((event) => (
          <div className={styles.row} key={event.title}>
            <span>
              <span className={styles.typeChip}>{event.type}</span>
              <span className={styles.itemTitle}>{event.title}</span>
            </span>
            <span className={styles.itemMeta}>{event.time}</span>
          </div>
        ))}
      </div>

      <div className={styles.note}>{ACTIVITY_NOTE}</div>
    </>
  );
}

/* ----------------------------------------------------------------- Academy */

export function AccountAcademy() {
  return (
    <>
      <h1 className={styles.h1}>Academy</h1>

      <div className={styles.card} style={{ marginTop: 18 }}>
        <div className={styles.cardTitle}>Your learning path</div>
        <div className={styles.itemMeta}>Level: {ACADEMY_SUMMARY.level}</div>
        <div className={styles.barTrack}>
          <div className={styles.barFill} style={{ width: `${ACADEMY_SUMMARY.percent}%` }} />
        </div>
        <div className={styles.itemMeta}>Next lesson: {ACADEMY_SUMMARY.nextLesson}</div>
        {/* Recommendations explain themselves. */}
        <div className={styles.note}>{ACADEMY_SUMMARY.reason}</div>
        <Link className={styles.primary} href="/academy/dashboard">
          Open Academy
        </Link>
      </div>

      <div className={styles.grid3}>
        {ACADEMY_SUMMARY.counters.map((counter) => (
          <div className={styles.card} key={counter.k}>
            <div className={styles.cardTitle}>{counter.v}</div>
            <div className={styles.itemMeta}>{counter.k}</div>
          </div>
        ))}
      </div>
    </>
  );
}

/* --------------------------------------------------------------- Purchases */

export function AccountPurchases() {
  const [tab, setTab] = useState<(typeof PURCHASE_TABS)[number]['id']>('expert');
  const purchases = getPurchases();

  return (
    <>
      <h1 className={styles.h1}>Purchases</h1>

      <div className={styles.tabs} role="tablist">
        {PURCHASE_TABS.map((item) => (
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

      {tab === 'expert' && (
        <div className={styles.row} style={{ marginTop: 18 }}>
          <span>
            <span className={styles.itemTitle}>{purchases.expert.title}</span>
            <span className={styles.itemMeta}>{purchases.expert.meta}</span>
          </span>
          <span className={styles.rowActions}>
            <Link
              className={styles.ghost}
              href={{ pathname: '/marketplace/consultations/[id]', params: { id: 'tn-8347' } }}
            >
              Open workspace
            </Link>
            <button className={styles.ghost}>Reschedule</button>
          </span>
        </div>
      )}

      {/* Empty states say what would be here and how to get there. */}
      {tab === 'tools' && (
        <>
          <div className={styles.emptyState}>{purchases.toolsEmpty}</div>
          <Link className={styles.primary} href="/marketplace">
            Browse Marketplace
          </Link>
        </>
      )}

      {tab === 'learning' && (
        <div className={styles.row} style={{ marginTop: 18 }}>
          <span>
            <span className={styles.itemTitle}>{purchases.learning.title}</span>
            <span className={styles.itemMeta}>{purchases.learning.meta}</span>
          </span>
        </div>
      )}

      {tab === 'merch' && <div className={styles.emptyState}>{purchases.merchEmpty}</div>}

      {tab === 'payments' && (
        <div className={styles.row} style={{ marginTop: 18 }}>
          <span>
            <span className={`${styles.itemTitle} tn-num`}>{purchases.payment.amount}</span>
            <span className={styles.itemMeta}>
              {purchases.payment.method} · {purchases.payment.date}
            </span>
          </span>
          <button className={styles.linkAction}>{purchases.payment.receipt}</button>
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- Settings */

export function AccountSettings() {
  const [tab, setTab] = useState<(typeof SETTINGS_TABS)[number]['id']>('profile');
  const [toggles, setToggles] = useState<Record<string, boolean>>({});

  const rows = getSettingsRows(tab);
  const note = getSettingsNote(tab);

  return (
    <>
      <h1 className={styles.h1}>Settings &amp; Billing</h1>

      <div className={styles.filters}>
        {SETTINGS_TABS.map((item) => (
          <button
            key={item.id}
            className={`${styles.filter} ${tab === item.id ? styles.filterActive : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'profile' ? (
        <div className={styles.card} style={{ marginTop: 18 }}>
          {getProfileFields().map((field) => (
            <div key={field.label}>
              <div className={styles.fieldLabel}>{field.label}</div>
              <input className={styles.field} defaultValue={field.value} />
            </div>
          ))}
          <button className={styles.primary}>Save changes</button>
        </div>
      ) : (
        <div className={styles.card} style={{ marginTop: 18 }}>
          {rows.map((row) => (
            <div className={styles.settingRow} key={row.k}>
              <span>
                <span className={styles.settingKey}>{row.k}</span>
                {row.sub && <span className={styles.settingSub}>{row.sub}</span>}
              </span>

              {row.kind === 'toggle' ? (
                <button
                  className={`${styles.toggle} ${
                    (toggles[row.id] ?? row.on) ? styles.toggleOn : ''
                  }`}
                  role="switch"
                  aria-checked={toggles[row.id] ?? row.on}
                  aria-label={row.k}
                  onClick={() =>
                    setToggles((current) => ({
                      ...current,
                      [row.id]: !(current[row.id] ?? row.on),
                    }))
                  }
                >
                  <span className={styles.toggleKnob} />
                </button>
              ) : (
                <span
                  className={`${styles.settingValue} ${
                    row.tone === 'link'
                      ? styles.valueLink
                      : row.tone === 'danger'
                        ? styles.valueDanger
                        : row.tone === 'good'
                          ? styles.valueGood
                          : row.tone === 'muted'
                            ? styles.valueMuted
                            : ''
                  }`}
                >
                  {row.v}
                </span>
              )}
            </div>
          ))}

          {note && <div className={styles.note}>{note}</div>}
        </div>
      )}
    </>
  );
}
