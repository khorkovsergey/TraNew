import styles from './Footer.module.css';

/**
 * The brand line and the legal block. Nothing else.
 *
 * This used to be a directory of about forty links, and it existed for a reason:
 * the redesign cut five dropdowns, and the destinations they held kept their
 * only way in here. That reason has expired — the four menus above are now one
 * component with one row anatomy, and what belongs in a menu is in one. What was
 * left underneath was a wall of small grey text on the bottom of every page,
 * read by nobody and prefetching itself into the server's error budget.
 *
 * Some routes did lose their only link when it went. They are named in the
 * handoff and were handed back deliberately rather than quietly re-listed here;
 * a footer is not a place to hide a navigation problem.
 */
export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <svg
            width="28"
            height="28"
            viewBox="0 0 32 32"
            fill="none"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M4 22 L12 13 L18 18 L28 7"
              stroke="var(--tn-mint)"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M21 7h7v7"
              stroke="var(--tn-blue)"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className={styles.wordmark}>TradingNew</span>
          <p className={styles.tagline}>
            A beginner-first way into the markets. Part of the TradingView ecosystem.
          </p>
        </div>
      </div>

      {/*
       * The disclaimer is part of the design, not boilerplate: this product
       * explains money to people who are new to it, and the line between an
       * explanation and a recommendation has to be drawn where they can see it.
       */}
      <div className={styles.legal}>
        <p>
          TradingNew is an educational and research service. Nothing here is financial advice, and
          no result shown is a prediction. Market data is delayed and provided for illustration.
        </p>
        <p className={styles.copyright}>© {new Date().getFullYear()} TradingNew · Demo portal</p>
      </div>
    </footer>
  );
}
