import { CHART_MARKET_PRODUCTS } from '@/content/chartMarket';
import { SUPERCHART_PRESETS } from '@/content/superchartCatalog';
import { Icon } from '@/components/ui/Icon';
import { Link } from '@/i18n/navigation';
import { ChartPreview } from './ChartPreview';
import { ToolsRail } from './ToolsRail';
import styles from './Tools.module.css';

/**
 * Tools & Data — the gateway.
 *
 * Four cards, two of which are products and two of which are announcements. The
 * difference is visible before it is read: the announcements are quieter, carry
 * no arrow, and do not click. A "Coming soon" tile that navigates spends a click
 * to repeat itself, and after the second time it teaches people that the badges
 * on this page do not mean anything.
 *
 * The two lines underneath are the point of the screen. Chart Market and
 * Supercharts are easy to confuse — both are "charts, but better" — and the
 * difference is who made the thing you are getting.
 */

export function ToolsHub() {
  const scriptCount = CHART_MARKET_PRODUCTS.length;
  const workspaceCount = SUPERCHART_PRESETS.length;

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <ToolsRail active="tools" />

        <div className={styles.main}>
          <div className={styles.breadcrumb}>
            <Link href="/marketplace">Marketplace</Link>
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbHere}>Tools &amp; Data</span>
          </div>

          <h1 className={styles.h1}>Tools &amp; Data</h1>
          <p className={styles.lead}>
            Charting tools built by other people, and chart workspaces built by us. Two products
            that exist, and two that are named here rather than implied.
          </p>

          <div className={styles.hubGrid}>
            <Link className={`${styles.hubCard} ${styles.hubCardSplit}`} href="/marketplace/tools/chart-market">
              <div>
                <span className={styles.hubIcon}>
                  <Icon name="flask" size={23} strokeWidth={1.9} style={{ color: 'var(--tn-purple)' }} />
                </span>
                <div className={styles.hubTitleRow}>
                  <span className={styles.hubTitle}>Chart Market</span>
                </div>
                <p className={styles.hubText}>
                  Pine Script indicators, strategies and overlays from developers and traders. Browse
                  the whole catalogue without an account; buying is the only step that needs one.
                </p>
                <span className={`${styles.hubCta} ${styles.hubCtaMint}`}>
                  Explore {scriptCount} scripts
                  <Icon name="chevronRight" size={15} strokeWidth={2.6} />
                </span>
              </div>

              <ChartPreview seed={11} accent="--tn-purple" className={styles.previewBordered} />
            </Link>

            <Link className={`${styles.hubCard} ${styles.hubCardSplit}`} href="/marketplace/tools/supercharts">
              <div>
                <span className={styles.hubIcon}>
                  <Icon name="chart" size={23} strokeWidth={1.9} style={{ color: 'var(--tn-blue)' }} />
                </span>
                <div className={styles.hubTitleRow}>
                  <span className={styles.hubTitle}>Supercharts</span>
                </div>
                <p className={styles.hubText}>
                  Ready-made chart workspaces with Voyager on the chart beside you — ask what a move
                  means, or ask it to add a study and approve the change before it applies.
                </p>
                <span className={styles.hubCta}>
                  Open {workspaceCount} workspaces
                  <Icon name="chevronRight" size={15} strokeWidth={2.6} />
                </span>
              </div>

              <ChartPreview seed={17} accent="--tn-blue" className={styles.previewBordered} />
            </Link>

            <div className={`${styles.hubCard} ${styles.hubCardSoon}`} aria-disabled="true">
              <div>
                <span className={styles.hubIcon}>
                  <Icon name="coins" size={21} strokeWidth={1.9} style={{ color: 'var(--tn-teal)' }} />
                </span>
                <div className={styles.hubTitleRow}>
                  <span className={styles.hubTitle}>Data Hub</span>
                  <span className={styles.soonBadge}>Coming soon</span>
                </div>
                {/* No dataset list. A catalogue of things nobody can buy is a
                    catalogue, and it would be read as one. */}
                <p className={styles.hubText}>
                  Market, fundamental and alternative datasets for deeper analysis. Nothing is
                  available to browse yet, so there is nothing here to browse.
                </p>
                <span className={styles.hubLocked}>
                  <Icon name="lock" size={13} strokeWidth={2} />
                  Not open yet
                </span>
              </div>
            </div>

            <div className={`${styles.hubCard} ${styles.hubCardSoon}`} aria-disabled="true">
              <div>
                <span className={styles.hubIcon}>
                  <Icon name="sliders" size={21} strokeWidth={1.9} style={{ color: 'var(--tn-purple)' }} />
                </span>
                <div className={styles.hubTitleRow}>
                  <span className={styles.hubTitle}>More Tools</span>
                  <span className={styles.soonBadge}>Coming soon</span>
                </div>
                <p className={styles.hubText}>
                  Screeners, calendars and utilities are planned for the Marketplace. They are named
                  here so the gap is visible rather than surprising.
                </p>
                <span className={styles.hubLocked}>
                  <Icon name="lock" size={13} strokeWidth={2} />
                  Not open yet
                </span>
              </div>
            </div>
          </div>

          <div className={styles.hubSplit}>
            <div className={styles.hubSplitCard}>
              <div className={styles.hubSplitKey}>Chart Market</div>
              <div className={styles.hubSplitText}>
                <b>Creators build Pine Script tools</b> → you find one and buy it. What you get is
                the script.
              </div>
            </div>
            <div className={styles.hubSplitCard}>
              <div className={styles.hubSplitKey}>Supercharts</div>
              <div className={styles.hubSplitText}>
                <b>TradingNew builds the chart</b> → Voyager explains it and extends it. What you get
                is the workspace, free with your plan.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
