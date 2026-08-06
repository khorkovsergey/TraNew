'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import {
  CATEGORIES,
  COMPARE_CARDS,
  DOT_SCALE,
  EXPLORE_SUBNAV,
  MARKET_TILES,
  RATING_NOTE,
  STARTERS,
  type CategoryKey,
} from '@/content/explore';
import { Link, useRouter } from '@/i18n/navigation';
import { wave } from '@/lib/wave';
import styles from './Explore.module.css';

/**
 * Explore.
 *
 * One tab is selected at a time and everything on the upper half follows it:
 * the explanation, the comparison, and what Voyager offers to be asked. That is
 * the progressive disclosure the brief asks for — the beginner layer is what you
 * land on, and the detailed and advanced layers are a link away rather than a
 * different product.
 */
export function ExploreHub() {
  const router = useRouter();
  const [key, setKey] = useState<CategoryKey>('etfs');
  const [question, setQuestion] = useState('');

  const category = CATEGORIES.find((entry) => entry.key === key) ?? CATEGORIES[1];

  const ask = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    router.push({ pathname: '/voyager', query: { q: trimmed } });
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

      <nav className={styles.subnav} aria-label="Explore sections">
        {EXPLORE_SUBNAV.map((entry) =>
          entry.href === null ? (
            <span key={entry.label} className={styles.subnavHere} aria-current="page">
              {entry.label}
            </span>
          ) : (
            <Link key={entry.label} className={styles.subnavLink} href={entry.href}>
              {entry.label}
            </Link>
          )
        )}
      </nav>

      {/* Radios, not buttons: exactly one category is shown, and that is a
          choice among alternatives rather than seven independent switches. */}
      <div className={styles.tabs} role="radiogroup" aria-label="Investment type">
        {CATEGORIES.map((entry) => (
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
            <Fact
              icon="checkCircle"
              accent="green"
              term="Why people use it"
              detail={category.why}
            />
            <Fact icon="alert" accent="amber" term="Main risks" detail={category.risks} />
            <Fact icon="user" accent="purple" term="Who it may suit" detail={category.suit} />
          </dl>

          <Link
            className={styles.learnMore}
            href={{ pathname: category.href, params: category.params } as never}
          >
            Learn more about {category.name}
            {category.soon && <span className={styles.soon}>Soon</span>}
            <Icon name="arrowRight" size={15} strokeWidth={2.2} />
          </Link>
        </section>

        <section className={`${styles.card} ${styles.compareCard}`}>
          <div className={styles.cardHead}>
            <div>
              <h2 className={styles.cardTitle}>Compare options</h2>
              <div className={styles.cardSub}>
                How three common choices sit against one another.
              </div>
            </div>
            <Link className={styles.ghostChip} href="/research">
              Compare in detail
            </Link>
          </div>

          <div className={styles.compareGrid}>
            {COMPARE_CARDS.map((entry) => (
              <div key={entry.name} className={styles.compareTile}>
                <div className={styles.compareName}>
                  <Icon
                    name={entry.icon}
                    size={18}
                    strokeWidth={1.9}
                    className={styles[`accent_${entry.accent}`]}
                  />
                  {entry.name}
                </div>

                {entry.metrics.map((metric) => (
                  <div key={metric.label} className={styles.metric}>
                    <div className={styles.metricLine}>
                      <span>{metric.label}</span>
                      {/* The word is the value; the dots repeat it. Anyone who
                          cannot see the fill still reads "Medium". */}
                      <span className={styles.metricValue}>{metric.value}</span>
                    </div>
                    <div className={styles.dots} aria-hidden="true">
                      {Array.from({ length: DOT_SCALE }, (_, index) => (
                        <span
                          key={index}
                          className={`${styles.dot} ${
                            index < metric.level ? styles[`dotOn_${entry.accent}`] : ''
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                <div className={`${styles.compareTag} ${styles[`tag_${entry.accent}`]}`}>
                  {entry.tag}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.ratingNote}>
            <Icon name="info" size={13} strokeWidth={2} />
            {RATING_NOTE} <Link href="/how-we-explain">How we explain this</Link>
          </div>
        </section>

        <section className={styles.voyagerCard}>
          <h2 className={styles.cardTitle}>Ask Voyager about this option</h2>

          <div className={styles.voyagerIntro}>
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative, fixed size. */}
            <img className={styles.robot} src="/redesign/voyager-robot.png" alt="" aria-hidden="true" />
            <p className={styles.voyagerLine}>
              I can explain how {category.name} work, and what they cost you.
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
            <Link className={styles.moreLink} href="/research">
              See all options
              <Icon name="arrowRight" size={13} strokeWidth={2.2} />
            </Link>
          </div>

          <div className={styles.starterGrid}>
            {STARTERS.map((starter) => (
              <div key={starter.name} className={styles.starter}>
                <div className={styles.starterTop}>
                  <div>
                    <div className={styles.starterName}>{starter.name}</div>
                    <div className={styles.starterText}>{starter.text}</div>
                  </div>
                  <svg viewBox="0 0 64 30" className={styles.starterSpark} aria-hidden="true">
                    <polyline
                      points={wave(starter.seed, 14, 64, 30)}
                      fill="none"
                      stroke={`var(--tn-${accentVar(starter.accent)})`}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <span className={`${styles.badge} ${styles[`tag_${starter.accent}`]}`}>
                  {starter.badge}
                </span>

                <Link
                  className={styles.starterCta}
                  href={{ pathname: starter.href, params: starter.params } as never}
                >
                  {starter.cta}
                  {starter.soon && <span className={styles.soon}>Soon</span>}
                </Link>
              </div>
            ))}
          </div>

          {/* The shapes are generated, not measured. Said once, near them. */}
          <div className={styles.ratingNote}>
            <Icon name="info" size={13} strokeWidth={2} />
            The shapes are illustrative, not price history.
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <h2 className={styles.cardTitle}>Today in markets</h2>
              <div className={styles.cardSub}>A quick look at what moved.</div>
            </div>
            <Link className={styles.moreLink} href="/markets/global">
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
                    stroke={`var(--tn-${accentVar(tile.accent)})`}
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

/** Accent name to the token that carries it, so an SVG stroke can use one too. */
function accentVar(accent: string): string {
  if (accent === 'rose') return 'red';
  if (accent === 'amber') return 'orange-star';
  if (accent === 'orange') return 'orange';
  return accent;
}
