import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AskVoyager } from '@/components/home/AskVoyager';
import { IntentCards } from '@/components/home/IntentCards';
import { SpaceBackdrop } from '@/components/shell/SpaceBackdrop';
import { Icon } from '@/components/ui/Icon';
import { PATH_STEPS, TODAY_CARDS, TODAY_INDEX, TRUST_ITEMS } from '@/content/homeV2';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import { wave } from '@/lib/wave';
import styles from '@/components/home/HomeV2.module.css';

/**
 * The public home.
 *
 * A conversion and orientation page, not a dashboard: no goals, no portfolio, no
 * personal numbers. It moves someone from curiosity to a first useful thing, and
 * every card here opens a journey a guest can finish without an account.
 */

type Props = { params: Promise<{ locale: Locale }> };

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
              TradingNew helps new investors cut through the noise, understand your options, and
              take your first steps with confidence.
            </p>

            <div className={styles.heroCtas}>
              <Link className={styles.ctaPrimary} href="/start">
                Find where to start
                <Icon name="arrowRight" size={17} strokeWidth={2.4} />
              </Link>
              <Link className={styles.ctaGhost} href="/explore">
                Explore today&rsquo;s markets
                <Icon name="trendUp" size={16} strokeWidth={2.2} className={styles.accent_mint} />
              </Link>
            </div>
          </div>

          <AskVoyager />
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>What brings you here today?</h2>

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

          <div className={styles.todayGrid}>
            {TODAY_CARDS.map((card) => (
              <div key={card.step} className={styles.todayCard}>
                <div className={styles.todayText}>
                  <div className={styles.todayHead}>
                    <span className={`${styles.stepDot} ${styles[`dot_${card.accent}`]}`}>
                      {card.step}
                    </span>
                    <span className={styles.todayTitle}>{card.title}</span>
                  </div>
                  <p className={styles.todayBody}>{card.body}</p>
                </div>

                {card.step === 1 ? (
                  <div className={styles.todayQuote}>
                    <svg viewBox="0 0 140 44" className={styles.spark} aria-hidden="true">
                      <polyline
                        points={wave(4.2, 30, 140, 44)}
                        fill="none"
                        stroke="var(--tn-green)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className={styles.quoteName}>{TODAY_INDEX.name}</div>
                    <div className={`${styles.quoteValue} tn-num`}>
                      {TODAY_INDEX.value}{' '}
                      <span className={styles.quoteChange}>{TODAY_INDEX.change}</span>
                    </div>
                    {/* The shape comes from a deterministic generator, not a price
                        feed, and says so rather than passing for one. */}
                    <div className={styles.quoteNote}>Illustrative · delayed data</div>
                  </div>
                ) : (
                  card.icon && (
                    <Icon
                      name={card.icon}
                      size={40}
                      strokeWidth={1.5}
                      className={`${styles.todayIcon} ${styles[`accent_${card.accent}`]}`}
                    />
                  )
                )}
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>
            Start with confidence
            <span className={styles.h2Sub}>A simple path to turn curiosity into action.</span>
          </h2>

          {/* An ordered list, because the steps are in an order and a row of divs
              does not say so to anyone listening rather than looking. */}
          <ol className={styles.pathRow}>
            {PATH_STEPS.map((step, index) => (
              <li key={step.step} className={styles.pathItem}>
                {index > 0 && <span className={styles.pathLink} aria-hidden="true" />}
                <Link className={styles.pathCard} href={step.href}
                  /*
                   * A grid of options is not a path anybody is about to take —
                   * they will follow at most one of these. Prefetching all of them
                   * spends the network on the five that will not be opened.
                   */
                  prefetch={false}>
                  <span className={`${styles.pathStep} ${styles[`step_${step.accent}`]}`}>
                    {step.step}
                  </span>
                  <span className={styles.pathText}>
                    <span className={styles.pathTitle}>{step.title}</span>
                    <span className={styles.pathBody}>{step.body}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.section}>
          <div className={styles.trustBar}>
            {TRUST_ITEMS.map((item) => (
              <div key={item.label} className={styles.trustItem}>
                <Icon
                  name={item.icon}
                  size={20}
                  strokeWidth={2}
                  className={styles[`accent_${item.accent}`]}
                />
                {item.label}
              </div>
            ))}
            <div className={styles.trustItem}>
              <span className={styles.tvMark} aria-hidden="true">
                TV
              </span>
              Powered by the TradingView ecosystem
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
