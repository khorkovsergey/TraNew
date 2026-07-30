'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import {
  ASSET_TABS,
  DATA_STATUS_LABEL,
  LIQUIDITY_DIMENSIONS_NOTE,
  type AssetDetail as AssetDetailData,
  type DataStatus,
} from '@/content/wealth';
import { Link } from '@/i18n/navigation';
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
};

export function AssetDetail({ asset }: { asset: AssetDetailData }) {
  const [tab, setTab] = useState<(typeof ASSET_TABS)[number]['id']>('overview');
  const [contextOff, setContextOff] = useState<Record<number, boolean>>({});
  const [valuationToast, setValuationToast] = useState(false);

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1 className={styles.h1}>{asset.name}</h1>
          <div className={styles.assetSub}>{asset.type}</div>
          <div className={styles.headChips}>
            <span className={`${styles.statusChip} ${STATUS_CLASS[asset.status]}`}>
              {DATA_STATUS_LABEL[asset.status]}
            </span>
          </div>
        </div>
        <button className={styles.ghost} onClick={() => setValuationToast(true)}>
          Update valuation
        </button>
      </div>

      {valuationToast && (
        <div className={styles.toast}>
          ✓ Valuation request recorded — the previous value is kept, with its source and date.
        </div>
      )}

      <div className={styles.statGrid}>
        {asset.stats.map((stat) => (
          <div className={styles.statCard} key={stat.k}>
            <div className={styles.statKey}>{stat.k}</div>
            <div className={`${styles.statValue} ${TONE[stat.tone]} tn-num`}>{stat.v}</div>
          </div>
        ))}
      </div>

      <div className={styles.tabs} role="tablist">
        {ASSET_TABS.map((item) => (
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

      <div className={styles.detailGrid}>
        <div>
          {tab === 'overview' && (
            <section className={styles.card}>
              {asset.facts.map(([k, v]) => (
                <div className={styles.kv} key={k}>
                  <span className={styles.kvKey}>{k}</span>
                  <span className={styles.kvValue}>{v}</span>
                </div>
              ))}
              {asset.liability && (
                <div className={styles.linkedLiability}>
                  <strong>Linked liability.</strong> {asset.liability}
                </div>
              )}
            </section>
          )}

          {tab === 'cash' && (
            <section className={styles.card}>
              {asset.cashFlow.map((row) => (
                <div className={styles.kv} key={row.k}>
                  <span className={styles.kvKey}>{row.k}</span>
                  <span className={`${styles.kvValue} ${TONE[row.tone]} tn-num`}>{row.v}</span>
                </div>
              ))}
            </section>
          )}

          {tab === 'liquidity' && (
            <section className={styles.card}>
              {asset.liquidity.map(([k, v]) => (
                <div className={styles.kv} key={k}>
                  <span className={styles.kvKey}>{k}</span>
                  <span className={styles.kvValue}>{v}</span>
                </div>
              ))}
              {/* Six dimensions, not one score — they can disagree. */}
              <div className={styles.note}>{LIQUIDITY_DIMENSIONS_NOTE}</div>
            </section>
          )}

          {tab === 'risk' && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Risks</h2>
              <div className={styles.chips}>
                {asset.risks.map((risk) => (
                  <span className={`${styles.chip} ${styles.chipRisk}`} key={risk}>
                    {risk}
                  </span>
                ))}
              </div>
            </section>
          )}

          {tab === 'options' && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Explore my options</h2>
              <div className={styles.optionTree}>
                {asset.options.map((option) => {
                  const leadsToScenario = option.startsWith('Sell');
                  return leadsToScenario ? (
                    <Link
                      className={`${styles.option} ${styles.optionActive}`}
                      key={option}
                      href="/account/wealth"
                    >
                      {option} →
                    </Link>
                  ) : (
                    <div className={styles.option} key={option}>
                      {option}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Nothing is fed to Copilot silently: the context is listed and switchable. */}
        <aside className={styles.contextPanel}>
          <div className={styles.contextTitle}>Copilot is using:</div>
          <div style={{ marginTop: 10 }}>
            {asset.copilotContext.map((item, index) => {
              const on = !contextOff[index];
              return (
                <button
                  className={`${styles.contextRow} ${on ? '' : styles.contextOff}`}
                  key={item}
                  role="checkbox"
                  aria-checked={on}
                  onClick={() =>
                    setContextOff((current) => ({ ...current, [index]: !current[index] }))
                  }
                >
                  <span className={`${styles.checkbox} ${on ? styles.checkboxOn : ''}`}>
                    {on && <Icon name="check" size={12} strokeWidth={3} />}
                  </span>
                  <span>{item}</span>
                </button>
              );
            })}
          </div>

          <div className={styles.chips}>
            {asset.questions.map((question) => (
              <Link
                className={styles.chip}
                key={question}
                href={{ pathname: '/research', query: { q: question } }}
              >
                {question}
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
