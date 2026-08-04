'use client';

import { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import {
  cellLabel,
  COMPARISON_CATEGORIES,
  isSameEverywhere,
  type ComparisonValue,
} from '@/content/subscriptionComparison';
import {
  annualSaving,
  bestSavingPercent,
  FAIR_USE_NOTE,
  formatPrice,
  monthlyPrice,
  PLAN_ORDER,
  PRIVATE_CAPABILITIES,
  SUBSCRIPTION_PLANS,
  type BillingPeriod,
  type SubscriptionPlan,
  type SubscriptionPlanId,
} from '@/content/subscriptions';
import styles from './Subscriptions.module.css';

/**
 * The subscriptions page.
 *
 * Presentation only, and the scope says so plainly: no checkout, no billing, no
 * entitlement gating, and none of the private capabilities behind the top plan
 * are built. The page has to be judgeable as a product decision — do the five
 * plans read as a progression, and is the private tier a different thing rather
 * than a bigger one — without pretending anything is wired.
 *
 * Every number comes from `content/subscriptions.ts`. The annual saving is
 * computed there rather than written down, so editing a price cannot leave a
 * saving line claiming the old one.
 */

const PLAN_NAMES = SUBSCRIPTION_PLANS.map((plan) => plan.name);

function Cell({ value, planName, isPrivate }: { value: ComparisonValue; planName: string; isPrivate: boolean }) {
  return (
    <div className={`${styles.cell} ${isPrivate ? styles.cellPrivate : ''}`}>
      {value === true ? (
        <span className={styles.tick} aria-hidden="true">
          ✓
        </span>
      ) : value === null ? (
        /* A dash, never a padlock. A plan not having something is a fact. */
        <span className={styles.dash} aria-hidden="true">
          —
        </span>
      ) : (
        <span aria-hidden="true">{value}</span>
      )}
      <span className={styles.srOnly}>{cellLabel(value, planName)}</span>
    </div>
  );
}

export function Subscriptions() {
  const [period, setPeriod] = useState<BillingPeriod>('annual');
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const [fairUseOpen, setFairUseOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(COMPARISON_CATEGORIES.map((c) => [c.id, Boolean(c.openByDefault)]))
  );

  /* Two plans at a time on a phone; the five-column grid does not shrink. */
  const [mobilePair, setMobilePair] = useState<[SubscriptionPlanId, SubscriptionPlanId]>([
    'premium',
    'voyager_private',
  ]);

  const categories = useMemo(
    () =>
      COMPARISON_CATEGORIES.map((category) => ({
        ...category,
        rows: differencesOnly ? category.rows.filter((row) => !isSameEverywhere(row)) : category.rows,
      })).filter((category) => category.rows.length > 0),
    [differencesOnly]
  );

  const choose = (plan: SubscriptionPlan) => {
    // No checkout exists, and inventing one would be the opposite of the scope.
    setToast('Subscription checkout is coming soon.');
    window.setTimeout(() => setToast(null), 2600);
  };

  const mobileIndexes = mobilePair.map((id) => PLAN_ORDER.indexOf(id)) as [number, number];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>TradingNew Subscriptions</p>
        <h1 className={styles.h1}>Plans for every level of market ambition</h1>
        <p className={styles.lead}>
          Start with the tools you need today. Upgrade as your research, strategy and financial
          context become more advanced.
        </p>
        <p className={styles.subLead}>
          Every plan includes Voyager AI. Higher plans unlock deeper analysis, longer context and
          more advanced research capabilities.
        </p>
      </header>

      <div className={styles.billingRow}>
        <div className={styles.segmented} role="group" aria-label="Billing period">
          {(['monthly', 'annual'] as BillingPeriod[]).map((option) => (
            <button
              key={option}
              className={`${styles.segment} ${period === option ? styles.segmentOn : ''}`}
              aria-pressed={period === option}
              onClick={() => setPeriod(option)}
            >
              {option === 'monthly' ? 'Monthly' : 'Annually'}
            </button>
          ))}
        </div>
        <span className={styles.savingChip}>Save up to {bestSavingPercent()}%</span>
      </div>

      {/* Secondary by design: it explains the shape of the range, it does not sell. */}
      <p className={styles.progression} aria-label="How Voyager grows across the plans">
        {SUBSCRIPTION_PLANS.map((plan, index) => (
          <span key={plan.id}>
            <span className={plan.privateTier ? styles.progressionLast : undefined}>
              {plan.progression}
            </span>
            {index < SUBSCRIPTION_PLANS.length - 1 && (
              <span className={styles.arrow} aria-hidden="true"> → </span>
            )}
          </span>
        ))}
      </p>

      <div className={styles.grid}>
        {SUBSCRIPTION_PLANS.map((plan) => {
          const price = monthlyPrice(plan, period);
          const saving = annualSaving(plan);

          return (
            <article
              key={plan.id}
              className={`${styles.card} ${plan.featured ? styles.cardFeatured : ''} ${
                plan.privateTier ? styles.cardPrivate : ''
              }`}
            >
              {/* Fixed-height slot, so plan names line up across cards that have
                  no badge. */}
              <div className={styles.badgeSlot}>
                {plan.badge && (
                  <span
                    className={`${styles.badge} ${plan.featured ? styles.badgeFeatured : ''} ${
                      plan.privateTier ? styles.badgePrivate : ''
                    }`}
                  >
                    {plan.badge}
                  </span>
                )}
              </div>

              <h2 className={`${styles.planName} ${plan.privateTier ? styles.planNamePrivate : ''}`}>
                {plan.name}
              </h2>
              <p className={styles.tagline}>{plan.tagline}</p>

              <p className={styles.price}>
                <span className="tn-num">{formatPrice(price)}</span>
                <span className={styles.perMonth}> / month</span>
              </p>
              <p className={styles.billingNote}>
                {period === 'annual' ? 'Billed annually' : 'Billed monthly'}
              </p>
              {/* Reserved height, so the cards do not jump when the line empties
                  on monthly. */}
              <p className={styles.saving}>
                {period === 'annual' ? `Save €${saving} per year` : ''}
              </p>

              <button
                className={`${styles.cta} ${plan.featured ? styles.ctaFeatured : ''} ${
                  plan.privateTier ? styles.ctaPrivate : ''
                } ${!plan.featured && !plan.privateTier && plan.id !== 'ultimate' ? styles.ctaOutline : ''} ${
                  plan.id === 'ultimate' ? styles.ctaDark : ''
                }`}
                onClick={() => choose(plan)}
              >
                Choose {plan.name}
              </button>

              {plan.privateTier && (
                <a className={styles.secondaryLink} href="#why-private">
                  Learn about Voyager Private
                </a>
              )}

              <div className={styles.divider} />

              <div className={plan.privateTier ? styles.voyagerBlockPrivate : undefined}>
                <p className={styles.voyagerTier}>
                  <span className={styles.orb} aria-hidden="true" />
                  {plan.voyagerTier}
                </p>
                <p className={styles.voyagerDescription}>{plan.voyagerDescription}</p>

                <ul className={styles.featureList}>
                  {plan.aiHighlights.map((item) => (
                    <li key={item} className={styles.feature}>
                      <Icon name="check" size={14} strokeWidth={2.5} className={styles.checkAi} />
                      <span className={item.startsWith('Everything in') ? styles.inherits : undefined}>
                        {item}
                        {item === 'Unlimited Voyager AI' && (
                          <>
                            {' '}
                            <button
                              className={styles.info}
                              aria-label="Fair-use policy details"
                              aria-expanded={fairUseOpen}
                              onClick={() => setFairUseOpen((value) => !value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Escape') setFairUseOpen(false);
                              }}
                            >
                              i
                            </button>
                            {fairUseOpen && (
                              <span className={styles.tooltip} role="tooltip">
                                {FAIR_USE_NOTE}
                              </span>
                            )}
                          </>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={styles.divider} />

              <p className={styles.blockLabel}>Platform</p>
              <ul className={styles.featureList}>
                {plan.platformHighlights.map((item) => (
                  <li key={item} className={styles.feature}>
                    <Icon name="check" size={14} strokeWidth={2.5} className={styles.checkPlatform} />
                    <span className={item.startsWith('Everything in') ? styles.inherits : undefined}>
                      {item}
                    </span>
                  </li>
                ))}
              </ul>

              <a className={styles.seeAll} href="#compare">
                See all features →
              </a>
            </article>
          );
        })}
      </div>

      {/* ------------------------------------------------ Why the private tier */}

      <section className={styles.whyPrivate} id="why-private">
        <h2 className={styles.whyHeading}>Why Voyager Private is different</h2>
        <p className={styles.whyBody}>
          Ultimate provides the platform’s most advanced professional tools. Voyager Private adds a
          persistent private intelligence layer that can understand your approved portfolio, goals,
          documents, research and financial context.
        </p>

        <div className={styles.whyGrid}>
          {PRIVATE_CAPABILITIES.map((capability) => (
            <div key={capability.title} className={styles.whyTile}>
              <h3 className={styles.whyTileTitle}>{capability.title}</h3>
              <p className={styles.whyTileBody}>{capability.body}</p>
            </div>
          ))}

          {/*
            Said plainly rather than left to be discovered: these are plan
            contents on a page about plans, and none of them is built yet.
          */}
          <div className={`${styles.whyTile} ${styles.whyTileNote}`}>
            <p className={styles.whyTileBody}>
              These capabilities are presented as plan contents. Availability is announced
              separately as each one ships.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- Comparison */}

      <section className={styles.compare} id="compare">
        <div className={styles.compareHead}>
          <div>
            <h2 className={styles.compareHeading}>Compare all plans</h2>
            <p className={styles.compareSub}>
              See how platform limits and Voyager AI capabilities change across subscriptions.
            </p>
          </div>

          <button
            className={`${styles.diffToggle} ${differencesOnly ? styles.diffToggleOn : ''}`}
            aria-pressed={differencesOnly}
            onClick={() => setDifferencesOnly((value) => !value)}
          >
            Show differences only
          </button>
        </div>

        {/* The phone picks two plans; the five-column grid does not shrink. */}
        <div className={styles.planPicker} role="group" aria-label="Plans to compare">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const selected = mobilePair.includes(plan.id);
            return (
              <button
                key={plan.id}
                className={`${styles.planChip} ${selected ? styles.planChipOn : ''} ${
                  selected && plan.privateTier ? styles.planChipPrivate : ''
                }`}
                aria-pressed={selected}
                onClick={() =>
                  setMobilePair(([first, second]) =>
                    plan.id === first || plan.id === second
                      ? [first, second]
                      : [second, plan.id]
                  )
                }
              >
                {plan.privateTier ? 'Private' : plan.name}
              </button>
            );
          })}
        </div>

        <div className={styles.table}>
          <div className={`${styles.row} ${styles.tableHead}`} role="row">
            <div className={styles.featureCell}>Feature</div>
            {SUBSCRIPTION_PLANS.map((plan, index) => (
              /*
               * The visibility class goes on a wrapper, never on the cell: it
               * is `display: contents`, which dissolves the element it is on
               * and takes its padding and alignment with it.
               */
              <div
                key={plan.id}
                className={mobileIndexes.includes(index) ? styles.mobileShown : styles.mobileHidden}
              >
                <div
                  className={`${styles.headCell} ${plan.featured ? styles.headFeatured : ''} ${
                    plan.privateTier ? styles.headPrivate : ''
                  }`}
                >
                  {plan.name}
                </div>
              </div>
            ))}
          </div>

          {categories.map((category) => (
            <div key={category.id}>
              <button
                className={`${styles.groupHead} ${
                  category.id === 'private' ? styles.groupHeadPrivate : ''
                }`}
                aria-expanded={open[category.id] ?? false}
                onClick={() => setOpen((current) => ({ ...current, [category.id]: !current[category.id] }))}
              >
                <span
                  className={`${styles.caret} ${open[category.id] ? '' : styles.caretClosed}`}
                  aria-hidden="true"
                >
                  ▾
                </span>
                {category.label}
              </button>

              {open[category.id] &&
                category.rows.map((row) => (
                  <div key={row.id} className={styles.row}>
                    <div className={styles.featureName}>
                      {row.label}
                      {row.description && (
                        <span className={styles.featureDescription}>{row.description}</span>
                      )}
                    </div>

                    {row.values.map((value, index) => (
                      <div
                        key={PLAN_ORDER[index]}
                        className={
                          mobileIndexes.includes(index) ? styles.mobileShown : styles.mobileHidden
                        }
                      >
                        <Cell
                          value={value}
                          planName={PLAN_NAMES[index]}
                          isPrivate={index === PLAN_ORDER.length - 1}
                        />
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          ))}
        </div>

        <div className={`${styles.row} ${styles.ctaRow}`}>
          <div className={styles.featureName}>Ready to choose?</div>
          {SUBSCRIPTION_PLANS.map((plan, index) => (
            <div
              key={plan.id}
              className={mobileIndexes.includes(index) ? styles.mobileShown : styles.mobileHidden}
            >
              <button
                className={`${styles.rowCta} ${plan.featured ? styles.ctaFeatured : ''} ${
                  plan.privateTier ? styles.ctaPrivate : ''
                } ${plan.id === 'ultimate' ? styles.ctaDark : ''} ${
                  !plan.featured && !plan.privateTier && plan.id !== 'ultimate'
                    ? styles.ctaOutline
                    : ''
                }`}
                onClick={() => choose(plan)}
              >
                {plan.privateTier ? 'Choose Private' : `Choose ${plan.name}`}
              </button>
            </div>
          ))}
        </div>

        <p className={styles.legal}>
          Prices are shown in euros and exclude any applicable tax. Voyager provides research
          assistance and analytical tools; it does not provide personalized financial, legal or tax
          advice.
        </p>
      </section>

      {toast && (
        <div className={styles.toast} role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
