'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import {
  ASSET_CLASSES,
  assetClass,
  comparisonSet,
  verbFor,
  type AssetClassKey,
} from '@/content/assetClasses';
import { EXPLORE_MORE, MARKET_TILES, STARTERS } from '@/content/explore';
import { useLoginModal } from '@/components/shell/LoginModalProvider';
import { clarityLine, contextParam, stashDraft } from '@/components/voyager/AskEntry';
import { Link, useRouter } from '@/i18n/navigation';
import { compareHref } from '@/lib/explore/compareLink';
import { wave } from '@/lib/wave';
import { CompareMatrix } from './CompareMatrix';
import styles from './Explore.module.css';

/**
 * Explore.
 *
 * One class is selected and all three columns follow it. That sounds obvious
 * and was not true: the comparison in the middle was a fixed table of three
 * classes, so choosing Bonds produced a page whose middle column was about
 * somebody else.
 *
 * Economy is no longer a tab. It was a seventh entry in a row of asset classes
 * and is not one — it sits in "Explore more" at the foot of the page with the
 * other sections that were dressed as tabs and are not.
 */
export function ExploreHub({ initialClass }: { initialClass?: AssetClassKey }) {
  const router = useRouter();
  const { authed } = useLoginModal();
  /*
   * The class the arriving link asked for. Somebody who pressed "I have money
   * and want to explore options" is deciding what to do with cash, and opening
   * them on Stocks answers a question they did not ask.
   */
  const [key, setKey] = useState<AssetClassKey>(initialClass ?? 'stocks');
  const [question, setQuestion] = useState('');

  const category = assetClass(key) ?? ASSET_CLASSES[0];
  const comparison = comparisonSet(key);

  /*
   * The class being read about travels with the question, so the workspace can
   * say what it can see rather than opening on "this conversation only" from a
   * page that was entirely about bonds.
   */
  const ask = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const source = { kind: 'explore' as const, subject: key };
    stashDraft(trimmed, source);
    router.push({ pathname: '/voyager', query: { context: contextParam(source) } });
  };

  return (
    <div className={styles.page}>
      <header>
        <h1 className={styles.h1}>
          Explore <span className={styles.accentText}>your options</span>
        </h1>
        <p className={styles.lead}>
          Different ways to grow and protect money. What each one is, what it risks, and how they
          compare — before anybody asks you to choose.
        </p>
      </header>

      {/* Radios, not buttons: exactly one class is shown, and that is a choice
          among alternatives rather than six independent switches. */}
      <div className={styles.tabs} role="radiogroup" aria-label="Investment type">
        {ASSET_CLASSES.map((entry) => (
          <button
            key={entry.key}
            role="radio"
            aria-checked={entry.key === key}
            className={`${styles.tab} ${entry.key === key ? styles.tabOn : ''}`}
            onClick={() => setKey(entry.key)}
          >
            <Icon
              name={entry.icon}
              size={19}
              strokeWidth={1.9}
              className={styles[`accent_${entry.accent}`]}
            />
            {entry.name}
          </button>
        ))}
      </div>

      <div className={styles.topRow}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Understand this option</h2>

          <div className={styles.catHead}>
            <span className={`${styles.catMark} ${styles[`mark_${category.accent}`]}`}>
              <Icon name={category.icon} size={24} strokeWidth={1.9} />
            </span>
            <div>
              <div className={styles.catName}>{category.name}</div>
              <div className={styles.catTagline}>{category.tagline}</div>
            </div>
          </div>

          <dl className={styles.facts}>
            <Fact icon="fileSearch" accent="blue" term="What it is" detail={category.what} />
            <Fact icon="checkCircle" accent="green" term="Why people use it" detail={category.why} />
            <Fact icon="alert" accent="amber" term="Main risks" detail={category.risks} />
            <Fact icon="user" accent="purple" term="Who it may suit" detail={category.suit} />
          </dl>

          <Link
            className={styles.learnMore}
            href={{ pathname: '/explore/[class]', params: { class: category.key } }}
            prefetch={false}
          >
            Learn more about {category.name}
            <Icon name="arrowRight" size={15} strokeWidth={2.2} />
          </Link>
        </section>

        <section className={`${styles.card} ${styles.compareCard}`}>
          <div className={styles.cardHead}>
            <div>
              <h2 className={styles.cardTitle}>Compare options</h2>
              <div className={styles.cardSub}>
                {category.name} beside the two it is most often weighed against.
              </div>
            </div>
            {/* The comparison on screen, carried into the URL. */}
            <Link className={styles.ghostChip} href={compareHref(key)} prefetch={false}>
              Compare in detail
            </Link>
          </div>

          <div className={styles.matrixSlot}>
            <CompareMatrix entries={comparison} linkToPages />
          </div>
        </section>

        <section className={styles.voyagerCard}>
          <h2 className={styles.cardTitle}>Ask Voyager about this option</h2>

          <div className={styles.voyagerIntro}>
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative, fixed size. */}
            <img className={styles.robot} src="/redesign/voyager-robot.png" alt="" aria-hidden="true" />
            <p className={styles.voyagerLine}>
              I can explain how {category.subject} {verbFor(category)}, and what it costs you.
            </p>
          </div>

          <form
            className={styles.askForm}
            onSubmit={(event) => {
              event.preventDefault();
              ask(question);
            }}
          >
            <input
              className={styles.askInput}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={`Ask anything about ${category.name}…`}
              aria-label={`Ask Voyager about ${category.name}`}
            />
            <button className={styles.askSend} type="submit" aria-label="Ask Voyager">
              <Icon name="send" size={14} strokeWidth={2.2} />
            </button>
          </form>

          <p className={styles.clarity}>{clarityLine(authed)}</p>

          <div className={styles.tryLabel}>Try asking</div>
          <div className={styles.questionList}>
            {category.questions.map((entry) => (
              <button key={entry} className={styles.questionChip} onClick={() => ask(entry)}>
                <Icon name="chat" size={13} strokeWidth={2} className={styles.accent_cyan} />
                {entry}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className={styles.bottomRow}>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <h2 className={styles.cardTitle}>Popular starting points</h2>
              <div className={styles.cardSub}>Where most people begin, and why.</div>
            </div>
            <Link className={styles.moreLink} href="/explore/options" prefetch={false}>
              See all options
              <Icon name="arrowRight" size={13} strokeWidth={2.2} />
            </Link>
          </div>

          <div className={styles.starterGrid}>
            {STARTERS.slice(0, 4).map((starter) => (
              <div key={starter.name} className={styles.starter}>
                <div className={styles.starterTop}>
                  <div>
                    <div className={styles.starterName}>{starter.name}</div>
                    <div className={styles.starterText}>{starter.text}</div>
                  </div>
                  {/* Dashed and dimmed, so it cannot be mistaken for the real
                      mini-charts in "Today in markets" one column away. */}
                  <svg viewBox="0 0 64 30" className={styles.starterSpark} aria-hidden="true">
                    <polyline
                      points={wave(starter.seed, 14, 64, 30)}
                      fill="none"
                      stroke="var(--tn-text-faint)"
                      strokeWidth="1.6"
                      strokeDasharray="3 3"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <span className={`${styles.badge} ${styles[`tag_${starter.accent}`]}`}>
                  {starter.badge}
                </span>

                <div className={styles.starterCtas}>
                  <Link
                    className={styles.starterCta}
                    href={{ pathname: '/explore/[class]', params: { class: starter.klass } }}
                    prefetch={false}
                  >
                    Understand
                  </Link>
                  <Link
                    className={styles.starterCta}
                    href={compareHref(starter.klass)}
                    prefetch={false}
                  >
                    Compare
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.note}>
            <Icon name="info" size={13} strokeWidth={2} />
            The dashed shapes are illustrative, not price history.
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <h2 className={styles.cardTitle}>Today in markets</h2>
              <div className={styles.cardSub}>A quick look at what moved.</div>
            </div>
            <Link className={styles.moreLink} href="/markets/global" prefetch={false}>
              View markets
              <Icon name="arrowRight" size={13} strokeWidth={2.2} />
            </Link>
          </div>

          <div className={styles.tileGrid}>
            {MARKET_TILES.map((tile) => (
              <div key={tile.name} className={styles.tile}>
                <div className={styles.tileName}>{tile.name}</div>
                <div className={`${styles.tileChange} ${tile.up ? styles.up : styles.down} tn-num`}>
                  {tile.change}
                </div>
                <svg viewBox="0 0 80 26" className={styles.tileSpark} aria-hidden="true">
                  <polyline
                    points={wave(tile.seed, 18, 80, 26)}
                    fill="none"
                    stroke={tile.up ? 'var(--tn-green)' : 'var(--tn-red)'}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            ))}
          </div>

          <div className={styles.delayNote}>
            Market data is delayed. Past performance says nothing certain about the future.
          </div>
        </section>
      </div>

      <section className={styles.section}>
        <h2 className={styles.h2}>Explore more</h2>
        <p className={styles.cardSub}>The parts of the market that are not an asset class.</p>

        <div className={styles.moreGrid}>
          {EXPLORE_MORE.map((entry) => (
            <Link key={entry.label} className={styles.moreCard} href={entry.href} prefetch={false}>
              <Icon
                name={entry.icon}
                size={22}
                strokeWidth={1.8}
                className={styles[`accent_${entry.accent}`]}
              />
              <div className={styles.moreName}>{entry.label}</div>
              <div className={styles.moreText}>{entry.text}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Fact({
  icon,
  accent,
  term,
  detail,
}: {
  icon: 'fileSearch' | 'checkCircle' | 'alert' | 'user';
  accent: string;
  term: string;
  detail: string;
}) {
  return (
    <div className={styles.fact}>
      <Icon name={icon} size={19} strokeWidth={2} className={styles[`accent_${accent}`]} />
      <div>
        <dt className={styles.factTerm}>{term}</dt>
        <dd className={styles.factDetail}>{detail}</dd>
      </div>
    </div>
  );
}
