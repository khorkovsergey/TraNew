import { Icon } from '@/components/ui/Icon';
import { Link } from '@/i18n/navigation';
import { SITE_URL } from '@/lib/metadata';
import { getMarket, listMarkets, sectionState, type MarketConfig, type MarketSection } from '@/content/markets';
import { PHASE_LABEL, sessionStatus, type SessionStatus } from '@/lib/markets/sessions';
import type { MarketExchange } from '@/content/markets';
import styles from './Markets.module.css';

/**
 * The parts every page in the markets cluster shares.
 *
 * Breadcrumbs, the intent navigation and the trust footer are here rather than
 * copied into each route, because the guarantee they make — that the chosen
 * market survives a move between sections, and that every number says where it
 * came from — only holds if there is one implementation of them.
 */

/* --------------------------------------------------------- Breadcrumbs */

export function MarketBreadcrumbs({
  trail,
}: {
  trail: Array<{ label: string; href?: string }>;
}) {
  // The JSON-LD is generated from the same array the person sees, so the two
  // cannot describe different paths — which is the only way the markup is worth
  // emitting at all.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((step, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: step.label,
      ...(step.href ? { item: `${SITE_URL}/en${step.href}` } : {}),
    })),
  };

  return (
    <>
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        {trail.map((step, index) => (
          <span key={step.label} className={styles.crumb}>
            {index > 0 && <span className={styles.crumbSep} aria-hidden="true">/</span>}
            {step.href ? (
              <Link className={styles.crumbLink} href={step.href as never}>
                {step.label}
              </Link>
            ) : (
              <span aria-current="page">{step.label}</span>
            )}
          </span>
        ))}
      </nav>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}

/* ------------------------------------------------- Intent navigation */

const INTENTS: Array<{ section: MarketSection; label: string; suffix: string }> = [
  { section: 'overview', label: 'Overview', suffix: '' },
  { section: 'news', label: 'News', suffix: '/news' },
  { section: 'assets', label: 'Assets', suffix: '/assets' },
  { section: 'trends', label: 'Trends', suffix: '/trends' },
  { section: 'community', label: 'Community', suffix: '/community' },
  { section: 'events', label: 'Events', suffix: '/events' },
  { section: 'learn', label: 'Learn', suffix: '/learn' },
];

/**
 * The row that keeps the market fixed while the question changes.
 *
 * Sections that are not built for this market are left out entirely rather than
 * rendered as dead entries: a tab that goes nowhere is a worse answer than no
 * tab, and an indexable page with nothing on it is worse than both.
 */
export function MarketContextNavigation({
  market,
  active,
}: {
  market: MarketConfig;
  active: MarketSection;
}) {
  const available = INTENTS.filter((intent) => sectionState(market, intent.section) !== 'disabled');
  if (available.length < 2) return null;

  const base = market.slug === 'global' ? '/markets/global' : `/markets/${market.slug}`;

  return (
    <nav className={styles.intentNav} aria-label={`${market.name} sections`}>
      {available.map((intent) => {
        const current = intent.section === active;
        // Sections beyond the vertical slice are declared in the config but have
        // no route yet; they render as text so the row still describes the shape
        // of the section without promising a page that 404s.
        const href = intent.suffix === '' || intent.suffix === '/news' ? `${base}${intent.suffix}` : null;

        if (!href) {
          return (
            <span className={`${styles.intent} ${styles.intentSoon}`} key={intent.section}>
              {intent.label}
              <span className={styles.soon}>Soon</span>
            </span>
          );
        }

        return (
          <Link
            className={`${styles.intent} ${current ? styles.intentActive : ''}`}
            key={intent.section}
            href={href as never}
            aria-current={current ? 'page' : undefined}
          >
            {intent.label}
          </Link>
        );
      })}
    </nav>
  );
}

/* ------------------------------------------------------- Market selector */

/**
 * Every option is a real link.
 *
 * A dropdown that changes the page through JavaScript is invisible to a crawler
 * and unusable without a pointer; these are anchors that happen to be laid out
 * in a row.
 */
export function MarketSelector({ current }: { current: string }) {
  const markets = listMarkets();

  return (
    <nav className={styles.selector} aria-label="Choose a market">
      {markets.map((market) => (
        <Link
          className={`${styles.marketChip} ${market.slug === current ? styles.marketChipOn : ''}`}
          key={market.slug}
          href={(market.slug === 'global' ? '/markets/global' : `/markets/${market.slug}`) as never}
          aria-current={market.slug === current ? 'page' : undefined}
        >
          {market.name}
        </Link>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------- Sessions */

export function ExchangeSessions({
  exchanges,
  now,
  note,
}: {
  exchanges: MarketExchange[];
  now: Date;
  note: string;
}) {
  const rows = exchanges.map((exchange) => ({
    exchange,
    status: sessionStatus(exchange, now),
  }));

  return (
    <>
      <div className={styles.sessionGrid}>
        {rows.map(({ exchange, status }) => (
          <div className={styles.session} key={exchange.id}>
            <div className={styles.sessionHead}>
              <span className={styles.sessionName}>{exchange.name}</span>
              <PhaseBadge status={status} />
            </div>
            <div className={styles.sessionMeta}>
              {exchange.city} · {status.localTime} local · {status.regularSession}
            </div>
            {status.nextTransition && (
              <div className={styles.sessionNext}>
                {status.nextTransition.label} {status.nextTransition.at}
              </div>
            )}
          </div>
        ))}
      </div>
      <p className={styles.note}>{note}</p>
    </>
  );
}

/**
 * Status as a word first and a colour second.
 *
 * "Open" in green and "Closed" in red are the same shape to someone who cannot
 * tell them apart, and this is the one fact on the page a person came to read.
 */
function PhaseBadge({ status }: { status: SessionStatus }) {
  const tone =
    status.phase === 'open' ? styles.phaseOpen : status.phase === 'closed' ? styles.phaseClosed : styles.phaseEdge;

  return (
    <span className={`${styles.phase} ${tone}`}>
      <span className={styles.phaseDot} aria-hidden="true" />
      {PHASE_LABEL[status.phase]}
    </span>
  );
}

/* ---------------------------------------------------------- Trust footer */

export function MarketTrustFooter({
  updated,
  dataNote,
  disclaimer,
}: {
  updated: string;
  dataNote: string;
  disclaimer: string;
}) {
  return (
    <footer className={styles.trust}>
      <p className={styles.trustLine}>{dataNote}</p>
      <p className={styles.trustLine}>Last updated {updated}.</p>
      <p className={styles.trustLine}>{disclaimer}</p>
    </footer>
  );
}

/* --------------------------------------------------------- Related links */

export function RelatedMarkets({ market, title }: { market: MarketConfig; title: string }) {
  const links = market.related
    .map((entry) => ({ ...entry, config: getMarket(entry.slug) }))
    .filter((entry) => entry.config !== null);

  if (!links.length) return null;

  return (
    <section>
      <h2 className={styles.h2}>{title}</h2>
      <div className={styles.cardList}>
        {links.map((entry) => (
          <Link
            className={styles.relatedCard}
            key={entry.slug}
            href={(entry.slug === 'global' ? '/markets/global' : `/markets/${entry.slug}`) as never}
          >
            <span className={styles.relatedName}>
              {entry.config!.name}
              <Icon name="arrowRight" size={16} />
            </span>
            {/* The reason is the anchor's job: "related" without it is a guess. */}
            <span className={styles.relatedWhy}>Because it {entry.because}.</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
