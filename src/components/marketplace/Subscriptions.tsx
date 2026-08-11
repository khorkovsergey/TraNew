'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/ui/Icon';
import { Link } from '@/i18n/navigation';
import {
  cellLabel,
  COMPARISON_GROUPS,
  type ComparisonRow,
} from '@/content/subscriptionComparison';
import {
  ANNUAL_SAVING_PERCENT,
  CAPABILITY_BOUNDARY,
  COMPARE,
  DIMENSIONS,
  HERO,
  INSIDE_VOYAGER,
  MARKETPLACE_NOTE,
  PLAN_ORDER,
  PLAN_PROGRESSION,
  PLANS_BY_ID,
  planPrice,
  planPriceNote,
  planPriceUnit,
  PRICE_DISCLAIMER,
  PRIVATE_CAPABILITIES,
  PRIVATE_DIALOG,
  SUBSCRIPTION_PLANS,
  TRADINGVIEW_CARD_LINE,
  TRADINGVIEW_DEFAULT,
  TRADINGVIEW_DRAWER,
  TRADINGVIEW_OPTIONS,
  USAGE_LIMIT,
  type BillingPeriod,
  type SubscriptionPlan,
} from '@/content/subscriptions';
import styles from './Subscriptions.module.css';

/**
 * Marketplace → Subscriptions.
 *
 * The product argument the screen makes: TradingNew is the platform and Voyager
 * is the intelligence you upgrade. Every plan is framed as how much Voyager
 * does for you — depth of analysis, reach of research, amount of private
 * context — never as "more pages unlocked". That is why there is no platform
 * limit anywhere on this page and no chart-count table.
 *
 * Presentation only, and it says so rather than leaving it to be discovered:
 * prices are placeholders, no checkout exists, and selecting a TradingView plan
 * in the drawer provisions nothing. Every CTA that cannot complete says what it
 * cannot do instead of pretending.
 *
 * The two "Inside Voyager" panels are a preview of a Voyager surface rendered
 * here for review, not a live one. Their inert controls are spans rather than
 * buttons — a button that does nothing is a lie the eye believes.
 */

const PLAN_ACCENT_CLASS = {
  neutral: styles.accentNeutral,
  mint: styles.accentMint,
  blue: styles.accentBlue,
  violet: styles.accentViolet,
} as const;

const CTA_VARIANT_CLASS = {
  neutral: styles.ctaNeutral,
  solid: styles.ctaSolid,
  outline: styles.ctaOutline,
  violet: styles.ctaViolet,
} as const;

/** A tick, a dash, or a short string — and what a screen reader hears instead. */
function Cell({ row, index, planName }: { row: ComparisonRow; index: number; planName: string }) {
  const value = row.values[index];

  return (
    <div className={styles.matrixCell}>
      {value === true ? (
        <span className={styles.tick} aria-hidden="true">
          ✓
        </span>
      ) : value === null ? (
        <span className={styles.dash} aria-hidden="true">
          —
        </span>
      ) : (
        <span aria-hidden="true">{value}</span>
      )}
      <span className="tn-sr-only">{cellLabel(row, index, planName)}</span>
    </div>
  );
}

export function Subscriptions() {
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [compareOpen, setCompareOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [privateOpen, setPrivateOpen] = useState(false);
  const [tradingView, setTradingView] = useState(TRADINGVIEW_DEFAULT);
  const [notice, setNotice] = useState<string | null>(null);

  const compareRef = useRef<HTMLElement | null>(null);
  const plansRef = useRef<HTMLElement | null>(null);

  /*
   * Overlays go to `document.body`, not into the page.
   *
   * `.tn-app` is `position: relative; z-index: 0`, so it is a stacking context
   * and nothing rendered inside it can paint above the floating Voyager
   * launcher, which is a sibling of `.tn-app` at z-index 70. Raising the
   * drawer's own z-index does nothing about that — the pill sat on top of the
   * drawer's confirm button and ate the click. A portal is the only fix that
   * does not reach into shell's layout.
   *
   * No "have I mounted yet" flag guards these: all three open only from a
   * click, so `document` is never touched during the server render, and the
   * first client render agrees with it.
   */

  const closeOverlays = useCallback(() => {
    setDrawerOpen(false);
    setPrivateOpen(false);
  }, []);

  /* One key for both overlays: only one of them is ever open. */
  useEffect(() => {
    if (!drawerOpen && !privateOpen) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeOverlays();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen, privateOpen, closeOverlays]);

  /*
   * A notice, not a toast that claims success. Every path that reaches it is a
   * path this release cannot complete, so it says which one and why.
   */
  const say = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 4200);
  }, []);

  const scrollTo = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    const top = element.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: 'smooth' });
  }, []);

  const openComparison = useCallback(() => {
    setCompareOpen(true);
    closeOverlays();
    // After the state that expands it, so the target has its final height.
    window.setTimeout(() => scrollTo(compareRef.current), 0);
  }, [closeOverlays, scrollTo]);

  const choosePlan = (plan: SubscriptionPlan) => {
    if (plan.id === 'private') {
      setPrivateOpen(true);
      return;
    }

    say(`Checkout is not connected yet — ${plan.name} cannot be purchased from this page.`);
  };

  const confirmTradingView = () => {
    const option = TRADINGVIEW_OPTIONS.find((item) => item.id === tradingView);
    setDrawerOpen(false);

    say(
      option && option.id !== TRADINGVIEW_DEFAULT
        ? `Nothing was provisioned. ${option.name} is an independent commercial choice and is not sold from TradingNew.`
        : 'Nothing changed. Continuing in TradingView works on every Voyager plan.'
    );
  };

  const selectedTradingView = TRADINGVIEW_OPTIONS.find((item) => item.id === tradingView);

  return (
    <div className={styles.page}>
      {/* ------------------------------------------------------------ Hero */}

      <section className={styles.hero}>
        <p className={styles.eyebrow}>
          <span className={styles.eyebrowIcon} aria-hidden="true">
            <Icon name="sparkle" size={12} strokeWidth={2} />
          </span>
          {HERO.eyebrow}
        </p>

        <h1 className={styles.h1}>
          {HERO.headingLead}
          <br />
          <span className={styles.h1Accent}>{HERO.headingAccent}</span> {HERO.headingTail}
        </h1>

        <p className={styles.lead}>{HERO.body}</p>

        <p className={styles.trust}>
          <Icon name="shieldCheck" size={14} strokeWidth={1.8} className={styles.trustIcon} />
          {HERO.trust}
        </p>
      </section>

      {/* ----------------------------------------------------- Progression */}

      <section className={styles.progressionRow} aria-label="How the plans progress">
        <ol className={styles.progression}>
          {PLAN_PROGRESSION.map((entry, index) => (
            <li key={entry.step} className={styles.progressionStep}>
              <span className={styles.progressionText}>
                <span className={styles.progressionLabel}>
                  <span
                    className={`${styles.progressionDot} ${PLAN_ACCENT_CLASS[entry.accent]}`}
                    aria-hidden="true"
                  />
                  {entry.step}
                </span>
                <span className={styles.progressionPlan}>{entry.plan}</span>
              </span>

              {index < PLAN_PROGRESSION.length - 1 && (
                <Icon
                  name="arrowRight"
                  size={16}
                  strokeWidth={2}
                  className={styles.progressionArrow}
                />
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* --------------------------------------------------------- Billing */}

      <section className={styles.billingRow}>
        <div className={styles.segmented} role="group" aria-label="Billing period">
          {(['monthly', 'annual'] as BillingPeriod[]).map((option) => (
            <button
              key={option}
              type="button"
              className={`${styles.segment} ${period === option ? styles.segmentOn : ''}`}
              aria-pressed={period === option}
              onClick={() => setPeriod(option)}
            >
              {option === 'monthly' ? 'Monthly' : 'Annual'}
            </button>
          ))}
        </div>

        {/* Labelled illustrative, because it is: no annual rate is approved. */}
        <span className={styles.savingChip}>
          Illustrative annual saving {ANNUAL_SAVING_PERCENT}%
        </span>
      </section>

      {/* ----------------------------------------------------------- Plans */}

      <section
        className={styles.plans}
        ref={plansRef}
        aria-label="Voyager plans"
      >
        {SUBSCRIPTION_PLANS.map((plan) => (
          <article
            key={plan.id}
            className={`${styles.card} ${PLAN_ACCENT_CLASS[plan.accent]}`}
          >
            <div className={styles.cardTop}>
              <span className={styles.tierLabel}>
                <span className={styles.tierDot} aria-hidden="true" />
                {plan.label}
              </span>

              {plan.badge && (
                <span
                  className={`${styles.badge} ${
                    plan.badge.kind === 'primary' ? styles.badgePrimary : styles.badgeSecondary
                  }`}
                >
                  {plan.badge.label}
                </span>
              )}
            </div>

            <h2 className={styles.planName}>{plan.name}</h2>
            <p className={styles.tagline}>{plan.tagline}</p>

            <p className={styles.price}>
              <span className="tn-num">{planPrice(plan, period)}</span>
              <span className={styles.priceUnit}>{planPriceUnit(plan, period)}</span>
            </p>
            <p className={styles.priceNote}>{planPriceNote(plan, period)}</p>

            {plan.id === 'free' ? (
              <Link className={`${styles.cta} ${CTA_VARIANT_CLASS[plan.cta.variant]}`} href="/voyager">
                {plan.cta.label}
              </Link>
            ) : (
              <button
                type="button"
                className={`${styles.cta} ${CTA_VARIANT_CLASS[plan.cta.variant]}`}
                onClick={() => choosePlan(plan)}
              >
                {plan.cta.label}
              </button>
            )}

            {plan.inherits && <p className={styles.inherits}>{plan.inherits}</p>}

            <ul className={styles.features}>
              {plan.features.map((feature) => (
                <li key={feature} className={styles.feature}>
                  <Icon
                    name="check"
                    size={15}
                    strokeWidth={2.4}
                    className={styles.featureCheck}
                  />
                  {feature}
                </li>
              ))}
            </ul>

            {plan.consentNote ? (
              <p className={styles.consentNote}>{plan.consentNote}</p>
            ) : (
              <p className={styles.bestFor}>
                <span className={styles.bestForLabel}>Best for</span> — {plan.bestFor}
              </p>
            )}

            <p className={styles.cardHandoff}>
              <Icon name="trendUp" size={13} strokeWidth={1.8} className={styles.cardHandoffIcon} />
              {TRADINGVIEW_CARD_LINE}
            </p>
          </article>
        ))}
      </section>

      <p className={styles.priceDisclaimer}>{PRICE_DISCLAIMER}</p>

      {/* ------------------------------------------------------ Dimensions */}

      <section className={styles.dimensions}>
        <div className={styles.panel}>
          <p className={styles.panelEyebrow}>{DIMENSIONS.eyebrow}</p>
          <h2 className={styles.panelHeading}>{DIMENSIONS.heading}</h2>
          <p className={styles.panelBody}>{DIMENSIONS.body}</p>

          <div className={styles.chipRow}>
            <span className={`${styles.dimensionChip} ${styles.dimensionChipVoyager}`}>
              {DIMENSIONS.voyagerChip}
            </span>
            <span className={styles.dimensionChip}>{DIMENSIONS.tradingViewChip}</span>
          </div>
        </div>

        <div className={`${styles.panel} ${styles.panelSplit}`}>
          <div>
            <div className={styles.panelHead}>
              <span className={styles.panelIcon} aria-hidden="true">
                <Icon name="trendUp" size={17} strokeWidth={1.8} />
              </span>
              <span>
                <span className={styles.panelTitle}>{DIMENSIONS.addTitle}</span>
                <span className={styles.panelSubtitle}>{DIMENSIONS.addSubtitle}</span>
              </span>
            </div>

            <p className={styles.panelBodySmall}>{DIMENSIONS.addBody}</p>
          </div>

          <button type="button" className={styles.ghostCta} onClick={() => setDrawerOpen(true)}>
            {DIMENSIONS.addCta}
            <Icon name="arrowRight" size={14} strokeWidth={2.2} />
          </button>
        </div>
      </section>

      {/* ------------------------------------------------- Marketplace note */}

      <section className={styles.marketplaceNote}>
        <span className={styles.panelIcon} aria-hidden="true">
          <Icon name="wallet" size={15} strokeWidth={1.8} />
        </span>

        <div className={styles.marketplaceNoteBody}>
          <p className={styles.marketplaceNoteTitle}>{MARKETPLACE_NOTE.title}</p>
          <p className={styles.marketplaceNoteText}>{MARKETPLACE_NOTE.body}</p>
        </div>

        <Link className={styles.marketplaceNoteLink} href="/marketplace">
          {MARKETPLACE_NOTE.link} →
        </Link>
      </section>

      {/* --------------------------------------------------------- Compare */}

      <section className={styles.compare} ref={compareRef} id="compare">
        <div className={styles.compareHead}>
          <div>
            <h2 className={styles.sectionHeading}>{COMPARE.heading}</h2>
            <p className={styles.sectionBody}>{COMPARE.body}</p>
          </div>

          <button
            type="button"
            className={styles.neutralCta}
            aria-expanded={compareOpen}
            onClick={() => setCompareOpen((value) => !value)}
          >
            {compareOpen ? COMPARE.hideLabel : COMPARE.showLabel}
          </button>
        </div>

        {compareOpen && (
          <div className={styles.matrix}>
            <div className={styles.matrixInner}>
              <div className={`${styles.matrixRow} ${styles.matrixHead}`}>
                <div className={styles.matrixCorner}>Capability</div>
                {SUBSCRIPTION_PLANS.map((plan) => (
                  <div
                    key={plan.id}
                    className={`${styles.matrixColumn} ${PLAN_ACCENT_CLASS[plan.accent]}`}
                  >
                    {plan.label}
                  </div>
                ))}
              </div>

              {COMPARISON_GROUPS.map((group) => (
                <div key={group.id}>
                  <p className={styles.matrixGroup}>{group.title}</p>

                  {group.rows.map((row) => (
                    <div key={row.id} className={styles.matrixRow}>
                      <div className={styles.matrixLabel}>{row.label}</div>

                      {PLAN_ORDER.map((planId, index) => (
                        <Cell
                          key={planId}
                          row={row}
                          index={index}
                          planName={PLANS_BY_ID[planId].label}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* -------------------------------------------------- Inside Voyager */}

      <section className={styles.inside}>
        <div className={styles.insideHead}>
          <h2 className={styles.sectionHeading}>{INSIDE_VOYAGER.heading}</h2>
          <p className={styles.sectionBody}>{INSIDE_VOYAGER.body}</p>
        </div>

        <p className={styles.previewNote}>{INSIDE_VOYAGER.previewNote}</p>

        <div className={styles.insideGrid}>
          {/* A capability boundary: the plan does not include this. */}
          <article className={styles.insideCard}>
            <div className={styles.insideCardHead}>
              <span className={styles.voyagerMark}>
                <Icon name="sparkle" size={15} strokeWidth={2} className={styles.voyagerMarkIcon} />
                Voyager
              </span>
              <span className={styles.insideBadge}>{CAPABILITY_BOUNDARY.badge}</span>
            </div>

            <div className={styles.insideBody}>
              <p className={styles.bubbleUser}>{CAPABILITY_BOUNDARY.question}</p>

              <div className={styles.bubbleVoyager}>
                <p className={styles.bubbleText}>{CAPABILITY_BOUNDARY.answerLead}</p>

                <div className={styles.metricTable}>
                  <span className={`${styles.metricCell} ${styles.metricCorner}`}>
                    {CAPABILITY_BOUNDARY.table.corner}
                  </span>
                  {CAPABILITY_BOUNDARY.table.columns.map((column) => (
                    <span
                      key={column}
                      className={`${styles.metricCell} ${styles.metricColumn}`}
                    >
                      {column}
                    </span>
                  ))}

                  {CAPABILITY_BOUNDARY.table.rows.map((row) => (
                    <Fragment key={row.label}>
                      <span className={`${styles.metricCell} ${styles.metricLabel}`}>
                        {row.label}
                      </span>
                      {row.values.map((value, index) => (
                        <span
                          key={CAPABILITY_BOUNDARY.table.columns[index]}
                          className={`${styles.metricCell} ${styles.metricValue} ${
                            row.tone === 'up' ? styles.metricUp : ''
                          }`}
                        >
                          {value}
                        </span>
                      ))}
                    </Fragment>
                  ))}
                </div>

                <p className={styles.placeholderNote}>{CAPABILITY_BOUNDARY.table.note}</p>
              </div>

              <div className={styles.gate}>
                <p className={styles.gateEyebrow}>
                  <Icon name="lock" size={13} strokeWidth={2} />
                  {CAPABILITY_BOUNDARY.gateEyebrow}
                </p>

                <p className={styles.gateBody}>{CAPABILITY_BOUNDARY.gateBody}</p>

                <ul className={styles.gatePoints}>
                  {CAPABILITY_BOUNDARY.gatePoints.map((point) => (
                    <li key={point.text} className={styles.gatePoint}>
                      <span className={styles.gateBullet} aria-hidden="true" />
                      <span>
                        {point.text}
                        {point.emphasis && (
                          <>
                            {' '}
                            <span className={styles.gateEmphasis}>{point.emphasis}</span>
                          </>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className={styles.gateActions}>
                  <button
                    type="button"
                    className={`${styles.gateCta} ${styles.gateCtaPrimary}`}
                    onClick={() => scrollTo(plansRef.current)}
                  >
                    {CAPABILITY_BOUNDARY.upgradeCta}
                  </button>
                  <button
                    type="button"
                    className={`${styles.gateCta} ${styles.gateCtaNeutral}`}
                    onClick={openComparison}
                  >
                    {CAPABILITY_BOUNDARY.compareCta}
                  </button>
                  {/* Inert in a preview — a span, so it offers nothing it cannot do. */}
                  <span className={`${styles.gateCta} ${styles.gateCtaGhost}`}>
                    {CAPABILITY_BOUNDARY.dismissCta}
                  </span>
                </div>
              </div>
            </div>
          </article>

          {/* A used-up allowance: the plan includes it, today's capacity is spent. */}
          <article className={styles.insideCard}>
            <div className={styles.insideCardHead}>
              <span className={styles.voyagerMark}>
                <Icon name="sparkle" size={15} strokeWidth={2} className={styles.voyagerMarkIcon} />
                Voyager
              </span>
              <span className={styles.insideBadge}>{USAGE_LIMIT.badge}</span>
            </div>

            <div className={styles.insideBody}>
              <div>
                <h3 className={styles.limitHeading}>{USAGE_LIMIT.heading}</h3>
                <p className={styles.limitBody}>{USAGE_LIMIT.body}</p>
              </div>

              <div className={styles.meterPanel}>
                <div className={styles.meterHead}>
                  <span className={styles.meterLabel}>{USAGE_LIMIT.meterLabel}</span>
                  <span className={styles.meterState}>{USAGE_LIMIT.meterState}</span>
                </div>

                <div className={styles.meterTrack}>
                  <div className={styles.meterFill} />
                </div>

                <p className={styles.meterReset}>
                  <Icon name="clock" size={14} strokeWidth={1.9} />
                  {USAGE_LIMIT.resetsAt}
                </p>
              </div>

              <div className={styles.stillWorks}>
                <p className={styles.stillWorksLabel}>{USAGE_LIMIT.stillWorksLabel}</p>
                {USAGE_LIMIT.stillWorks.map((line) => (
                  <p key={line} className={styles.stillWorksLine}>
                    <Icon
                      name="check"
                      size={14}
                      strokeWidth={2.4}
                      className={styles.stillWorksCheck}
                    />
                    {line}
                  </p>
                ))}
              </div>

              <div className={styles.nextPlan}>
                <p className={styles.nextPlanTitle}>{USAGE_LIMIT.nextPlanTitle}</p>
                <p className={styles.nextPlanBody}>{USAGE_LIMIT.nextPlanBody}</p>

                <div className={styles.gateActions}>
                  <button
                    type="button"
                    className={`${styles.gateCta} ${styles.gateCtaBlue}`}
                    onClick={openComparison}
                  >
                    {USAGE_LIMIT.compareCta}
                  </button>
                  <span className={`${styles.gateCta} ${styles.gateCtaNeutral}`}>
                    {USAGE_LIMIT.waitCta}
                  </span>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* ---------------------------------------------- TradingView drawer */}

      {drawerOpen &&
        createPortal(
          <>
            <div className={styles.scrim} onClick={closeOverlays} aria-hidden="true" />

          <aside className={styles.drawer} role="dialog" aria-label="TradingView access" aria-modal="true">
            <div className={styles.drawerHead}>
              <div>
                <p className={styles.panelEyebrow}>{TRADINGVIEW_DRAWER.eyebrow}</p>
                <h2 className={styles.drawerHeading}>{TRADINGVIEW_DRAWER.heading}</h2>
                <p className={styles.drawerBody}>{TRADINGVIEW_DRAWER.body}</p>
              </div>

              <button
                type="button"
                className={styles.iconButton}
                aria-label="Close"
                onClick={closeOverlays}
              >
                <Icon name="close" size={15} strokeWidth={2.2} />
              </button>
            </div>

            <div className={styles.drawerScroll}>
              <div className={styles.viewerPlan}>
                <span className={styles.viewerPlanIcon} aria-hidden="true">
                  <Icon name="check" size={16} strokeWidth={2} />
                </span>
                <span>
                  <span className={styles.viewerPlanTitle}>Your Voyager plan stays as it is</span>
                  <span className={styles.viewerPlanNote}>{TRADINGVIEW_DRAWER.planRowNote}</span>
                </span>
              </div>

              <p className={styles.panelEyebrow}>{TRADINGVIEW_DRAWER.chooseLabel}</p>

              <div
                className={styles.optionList}
                role="radiogroup"
                aria-label={TRADINGVIEW_DRAWER.chooseLabel}
              >
                {TRADINGVIEW_OPTIONS.map((option) => {
                  const selected = option.id === tradingView;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`${styles.option} ${selected ? styles.optionOn : ''}`}
                      onClick={() => setTradingView(option.id)}
                    >
                      <span className={styles.radio} aria-hidden="true">
                        <span className={styles.radioDot} />
                      </span>

                      <span className={styles.optionBody}>
                        <span className={styles.optionTop}>
                          <span className={styles.optionName}>{option.name}</span>
                          <span className={styles.optionPrice}>{option.price}</span>
                        </span>
                        <span className={styles.optionText}>{option.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className={styles.drawerDisclaimer}>{TRADINGVIEW_DRAWER.disclaimer}</p>
            </div>

            <div className={styles.drawerFoot}>
              <button type="button" className={styles.neutralCta} onClick={closeOverlays}>
                {TRADINGVIEW_DRAWER.dismiss}
              </button>
              <button type="button" className={styles.blueCta} onClick={confirmTradingView}>
                {selectedTradingView && selectedTradingView.id !== TRADINGVIEW_DEFAULT
                  ? `Continue with ${selectedTradingView.name}`
                  : 'Continue without a TradingView plan'}
              </button>
            </div>
          </aside>
          </>,
          document.body
        )}

      {/* ------------------------------------------------- Private explainer */}

      {privateOpen &&
        createPortal(
          <div className={styles.modalScrim} onClick={closeOverlays}>
          <div
            className={styles.modal}
            role="dialog"
            aria-label="Voyager Private"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <div>
                <p className={`${styles.panelEyebrow} ${styles.eyebrowViolet}`}>
                  {PRIVATE_DIALOG.eyebrow}
                </p>
                <h2 className={styles.modalHeading}>{PRIVATE_DIALOG.heading}</h2>
              </div>

              <button
                type="button"
                className={`${styles.iconButton} ${styles.iconButtonViolet}`}
                aria-label="Close"
                onClick={closeOverlays}
              >
                <Icon name="close" size={14} strokeWidth={2.2} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <p className={styles.modalLead}>{PRIVATE_DIALOG.body}</p>

              <div className={styles.privateTiles}>
                {PRIVATE_CAPABILITIES.map((capability) => (
                  <div key={capability.title} className={styles.privateTile}>
                    <p className={styles.privateTileTitle}>{capability.title}</p>
                    <p className={styles.privateTileBody}>{capability.body}</p>
                  </div>
                ))}
              </div>

              <p className={styles.privateConsent}>
                <Icon name="lock" size={17} strokeWidth={1.9} className={styles.privateConsentIcon} />
                {PRIVATE_DIALOG.consent}
              </p>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.violetCta}
                  onClick={() =>
                    say('Voyager Private is not open for setup yet — this page is a plan preview.')
                  }
                >
                  {PRIVATE_DIALOG.primaryCta}
                </button>
                <button type="button" className={styles.violetGhostCta} onClick={closeOverlays}>
                  {PRIVATE_DIALOG.dismiss}
                </button>
              </div>
            </div>
          </div>
          </div>,
          document.body
        )}

      {notice &&
        createPortal(
          <p className={styles.notice} role="status">
            {notice}
          </p>,
          document.body
        )}
    </div>
  );
}
