import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AskVoyager, AskVoyagerToday } from '@/components/home/AskVoyager';
import { IntentCards } from '@/components/home/IntentCards';
import { SpaceBackdrop } from '@/components/shell/SpaceBackdrop';
import { Icon } from '@/components/ui/Icon';
import {
  COMMUNITY_ROWS,
  IDEAS,
  TODAY_QUOTES,
  TODAY_SUMMARY,
  TODAY_TOPICS,
  TRADINGVIEW,
  TRADINGVIEW_SOCIAL,
} from '@/content/homeV2';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import { wave } from '@/lib/wave';
import styles from '@/components/home/HomeV2.module.css';

/**
 * The public home.
 *
 * The entry point to the whole product rather than an onboarding page: markets,
 * ideas, community and AI, each one door wide. It is a showcase and not a
 * dashboard — no goals, no portfolio, no personal numbers — and every card here
 * opens a journey a guest can finish without an account.
 *
 * Every figure on the page is illustrative and says so on screen.
 */

type Props = { params: Promise<{ locale: Locale }> };

/** "M. Ivanova" → "MI". Derived, so a name and its tile cannot disagree. */
function monogram(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter((letter) => /\p{L}/u.test(letter ?? ''))
    .join('')
    .slice(0, 2);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });

  return pageMetadata({
    href: '/',
    locale,
    title: t('homeTitle'),
    description: t('homeDescription'),
  });
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <SpaceBackdrop tone={1} />

      <div className={styles.page}>
        <section className={styles.hero}>
          <div>
            {/* Three words, one line — no break: at 62px "Explore. Analyze."
                already fills the column, and a forced break would leave the
                accent word stranded on its own row on a wide screen. */}
            <h1 className={styles.h1}>
              Explore. Analyze. <span className={styles.h1Accent}>Invest.</span>
            </h1>
            <p className={styles.heroSub}>
              Markets, ideas, knowledge and AI — everything you need to make your next investment
              decision.
            </p>

            <div className={styles.heroCtas}>
              <Link className={styles.ctaPrimary} href="/start">
                Find my next step
                <Icon name="arrowRight" size={17} strokeWidth={2.4} />
              </Link>
              <Link className={styles.ctaGhost} href="/explore">
                Explore markets
                <Icon name="arrowUpRight" size={16} strokeWidth={2.2} className={styles.iconMuted} />
              </Link>
            </div>
          </div>

          <AskVoyager />
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>What do you want to do?</h2>

          <IntentCards />
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>
              Today in 3 minutes
              <span className={styles.h2Sub}>Short, clear, and focused on what matters.</span>
            </h2>
            <Link className={styles.sectionLink} href="/markets/global">
              View market snapshot
              <Icon name="arrowRight" size={14} strokeWidth={2.2} />
            </Link>
          </div>

          {/* What moved · why · what people are saying · what to do with it. */}
          <div className={styles.todayGrid}>
            <div className={styles.todayCard}>
              <div className={styles.eyebrow}>What moved</div>
              <div className={styles.quoteRows}>
                {TODAY_QUOTES.map((quote) => (
                  <div key={quote.name} className={`${styles.quoteRow} ${styles[quote.direction]}`}>
                    <span className={styles.quoteName}>{quote.name}</span>
                    {/* The shape comes from a deterministic generator, not a
                        price feed — see the note under the card. */}
                    <svg viewBox="0 0 64 20" className={styles.quoteSpark} aria-hidden="true">
                      <polyline
                        points={wave(quote.seed, 24, 64, 20)}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className={styles.quoteValue}>{quote.value}</span>
                    <span className={styles.quoteChange}>{quote.change}</span>
                  </div>
                ))}
              </div>
              <div className={styles.quoteNote}>Illustrative · delayed data</div>
            </div>

            <div className={`${styles.todayCard} ${styles.summaryCard}`}>
              <div className={styles.summaryText}>
                <div className={styles.eyebrow}>What happened</div>
                <p className={styles.summaryBody}>{TODAY_SUMMARY}</p>
              </div>
              <Icon name="fileSearch" size={36} strokeWidth={1.5} className={styles.summaryIcon} />
            </div>

            <div className={styles.todayCard}>
              <div className={styles.eyebrow}>What people are discussing</div>
              <div className={styles.topicList}>
                {TODAY_TOPICS.map((topic) => (
                  <Link key={topic} className={styles.topicChip} href="/ideas" prefetch={false}>
                    {topic}
                  </Link>
                ))}
              </div>
            </div>

            <AskVoyagerToday />
          </div>
        </section>

        {/* Side by side, so both previews are visible at once and the page stays
            short. Three rows each, capped: neither of these is a feed. */}
        <section className={styles.split}>
          <div>
            <div className={styles.sectionHead}>
              <h2 className={styles.h2}>Ideas worth exploring</h2>
              <Link className={styles.sectionLink} href="/ideas">
                Explore all ideas
                <Icon name="arrowRight" size={14} strokeWidth={2.2} />
              </Link>
            </div>

            <div className={styles.rowList}>
              {IDEAS.map((idea) => (
                <Link
                  key={idea.ticker}
                  className={styles.ideaRow}
                  href="/ideas"
                  prefetch={false}
                >
                  <div className={styles.ideaMain}>
                    <div className={styles.ideaTop}>
                      <span className={styles.ticker}>{idea.ticker}</span>
                      {/* A thesis, never an instruction. The colour says which
                          way the author leans and nothing more. */}
                      <span className={`${styles.ideaThesis} ${styles[idea.direction]}`}>
                        <Icon
                          name={idea.direction === 'up' ? 'trendUp' : 'trendDown'}
                          size={13}
                          strokeWidth={2.2}
                        />
                        {idea.thesis}
                      </span>
                      <span className={styles.ideaFacts}>{idea.meta}</span>
                    </div>
                    <div className={styles.ideaHeadline}>{idea.headline}</div>
                    <div className={styles.ideaAuthor}>
                      <span className={styles.monogram} aria-hidden="true">
                        {monogram(idea.author)}
                      </span>
                      <span className={styles.authorName}>{idea.author}</span>
                    </div>
                  </div>

                  <svg
                    viewBox="0 0 96 44"
                    className={`${styles.ideaSpark} ${styles[idea.direction]}`}
                    aria-hidden="true"
                  >
                    <polyline
                      points={wave(idea.seed, 24, 96, 44)}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div className={styles.sectionHead}>
              <h2 className={styles.h2}>From the community</h2>
              <a
                className={styles.sectionLink}
                href={TRADINGVIEW_SOCIAL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Explore community
                <Icon name="arrowUpRight" size={13} strokeWidth={2.4} />
                <span className="tn-sr-only">Opens tradingview.com in a new tab</span>
              </a>
            </div>

            <div className={styles.rowList}>
              {COMMUNITY_ROWS.map((row) => (
                <a
                  key={row.title}
                  className={styles.communityRow}
                  href={TRADINGVIEW_SOCIAL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className={styles.glyphTile}>
                    <Icon name={row.icon} size={18} strokeWidth={1.8} />
                  </span>
                  <span className={styles.communityText}>
                    <span className={`${styles.eyebrow} ${styles.communityKind}`}>{row.kind}</span>
                    <span className={styles.communityTitle}>{row.title}</span>
                    <span className={styles.communityMeta}>{row.meta}</span>
                  </span>
                  <span className="tn-sr-only">Opens tradingview.com in a new tab</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* The way out, said once and quietly. TradingNew is the simple layer;
            TradingView is where the professional workflow lives. */}
        <section className={styles.escalateSection}>
          <a
            className={styles.escalate}
            href={TRADINGVIEW}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className={styles.escalateTile}>
              <Icon name="chart" size={20} strokeWidth={1.8} />
            </span>
            <span className={styles.escalateText}>
              <span className={styles.escalateTitle}>Need professional trading tools?</span>
              <span className={styles.escalateBody}>
                Advanced charts, screeners, indicators and trading workflows are available on
                TradingView.
              </span>
            </span>
            <span className={styles.escalateCta}>
              Continue to TradingView
              <Icon name="arrowUpRight" size={13} strokeWidth={2.4} />
            </span>
            <span className="tn-sr-only">Opens tradingview.com in a new tab</span>
          </a>
        </section>
      </div>
    </>
  );
}
