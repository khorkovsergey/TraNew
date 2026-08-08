import { Link } from '@/i18n/navigation';
import type { AppPathname } from '@/i18n/routing';
import styles from './Footer.module.css';

/**
 * The footer exists because of what the redesign did to the header.
 *
 * Market, Symbols, Economy, Community and Academy lost their dropdowns — five
 * menus, roughly forty destinations. The brief is explicit that nothing may be
 * deleted, and a route with no link into it is deleted in every sense that
 * matters to the person looking for it. Most of those destinations reappear
 * inside Explore and Learn where they belong contextually; this is where the
 * rest live, and where every one of them is reachable from any page.
 *
 * Entries marked `soon` open a page that says it is still being built. Saying so
 * here costs nothing and saves a click that ends in disappointment. An entry
 * with no `href` is further along that thought: nothing is being built behind
 * it, so it is named without being clickable.
 */
type FooterLink = {
  label: string;
  /** Absent when the entry names something that has no page at all. */
  href?: AppPathname;
  params?: Record<string, string>;
  soon?: boolean;
};

const tool = (slug: string, label: string): FooterLink => ({
  label,
  href: '/tool/[slug]',
  params: { slug },
  soon: true,
});

const COLUMNS: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: 'Explore',
    links: [
      { label: 'Today in markets', href: '/markets/global' },
      { label: 'Market news', href: '/news' },
      { label: 'Market Views', href: '/ideas' },
      { label: 'Economy & your money', href: '/economy' },
      { label: 'Compare investments', href: '/explore' },
      { label: 'Research an asset', href: '/research' },
      { label: 'Advanced charts', href: '/supercharts' },
      tool('screeners', 'Find investments'),
    ],
  },
  {
    title: 'Learn',
    links: [
      { label: 'Learn', href: '/academy' },
      { label: 'Beginner path', href: '/academy/path' },
      { label: 'Events', href: '/events' },
      { label: 'Create an event', href: '/events/create' },
      { label: 'Practice portfolio', href: '/portfolio' },
      { label: 'Learning & events hub', href: '/learning-events' },
    ],
  },
  {
    title: 'Services',
    links: [
      { label: 'Expert services', href: '/marketplace/experts' },
      { label: 'Tools and data', href: '/marketplace/tools' },
      { label: 'Chart Market', href: '/marketplace/tools/chart-market' },
      { label: 'Plans', href: '/marketplace/subscriptions' },
      { label: 'Marketplace', href: '/marketplace' },
      { label: 'Brokers', href: '/brokers' },
      // No store yet, and no placeholder standing in for one.
      { label: 'Merchandise', soon: true },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'The power of community', href: '/community' },
      tool('top-authors', 'Top authors'),
      tool('indicators', 'Community indicators'),
      tool('the-leap', 'The Leap'),
      tool('rewards', 'Rewards'),
    ],
  },
  {
    title: 'About & trust',
    links: [
      { label: 'Why TradingNew', href: '/why' },
      { label: 'Trust centre', href: '/trust' },
      { label: 'How we explain markets', href: '/how-we-explain' },
      { label: 'Personal guidance', href: '/guidance' },
    ],
  },
];

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

        <nav className={styles.columns} aria-label="Site sections">
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h2 className={styles.columnTitle}>{column.title}</h2>
              <ul className={styles.list}>
                {column.links.map((link) => {
                  const body = (
                    <>
                      {link.label}
                      {link.soon && <span className={styles.soon}>Soon</span>}
                    </>
                  );

                  return (
                    <li key={`${column.title}-${link.label}`}>
                      {link.href ? (
                        <Link
                          className={styles.link}
                          href={{ pathname: link.href, params: link.params } as never}
                          /*
                           * A footer is a directory, not a path anybody is about
                           * to take. Left to prefetch, these twenty-five links
                           * fired an RSC request each on every page in the
                           * portal — 112 of them on the home page alone, several
                           * URLs four to six times over — and the host started
                           * answering 503 to its own pages. The one thing a
                           * footer must not do is make the page above it slower.
                           */
                          prefetch={false}
                        >
                          {body}
                        </Link>
                      ) : (
                        <span className={`${styles.link} ${styles.linkInert}`} aria-disabled="true">
                          {body}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
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
