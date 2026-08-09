'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import {
  ASSET_CLASSES,
  assetClass,
  pairLabel,
  rivalPairs,
  verbFor,
  type AssetClassKey,
} from '@/content/assetClasses';
import { useLoginModal } from '@/components/shell/LoginModalProvider';
import { clarityLine, contextParam, stashDraft } from '@/components/voyager/AskEntry';
import { Link, useRouter } from '@/i18n/navigation';
import { CompareMatrix } from './CompareMatrix';
import styles from './Explore.module.css';

/**
 * Investment options.
 *
 * This screen is education and says so at the top. It used to open with market
 * tiles and a percentage on each one, under a heading about understanding your
 * options — a page that answers "what is an ETF" has no business also showing
 * what the market did this morning, and a reader who wanted the second thing
 * was being kept from it by a page that could only half give it.
 *
 * Live markets are a different destination, named in the first two lines and
 * linked from there. What is left here has no prices on it at all.
 *
 * One class is selected and everything follows it: the explanation, the fact
 * tiles, the starting points, and the comparison at the foot of the page. That
 * sounds obvious and was not true — the comparison in the middle was a fixed
 * table of three classes, so choosing Bonds produced a page whose middle column
 * was about somebody else.
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
  const category = assetClass(key) ?? ASSET_CLASSES[0];

  /*
   * The pair the comparison is against. It is keyed by class rather than held
   * as one value, so going Stocks → Bonds → Stocks comes back to the pair you
   * had chosen rather than to the default, and no selection can ever name the
   * class it is supposed to be compared with.
   */
  const [rivals, setRivals] = useState<Partial<Record<AssetClassKey, AssetClassKey[]>>>({});
  const pairs = rivalPairs(key);
  const rival = rivals[key] ?? pairs[0];
  const comparison = [category, ...rival.map((slug) => assetClass(slug)!)];

  const [question, setQuestion] = useState('');

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
        {/* The contract, before anything else on the page. Somebody who came
            here for a price is told in one line that they are in the wrong
            place, and where the right one is. */}
        <div className={styles.eyebrow}>
          <span className={styles.eyebrowMark}>Learn</span>
          <span className={styles.eyebrowNote}>Educational orientation · no live prices here</span>
        </div>

        <h1 className={styles.h1}>Investment options</h1>
        <p className={styles.lead}>
          What are the different ways you can invest? Understand each one, then compare them side by
          side — before you look at any individual asset.
        </p>

        <Link className={styles.marketsOut} href="/markets/global" prefetch={false}>
          Looking for live markets instead? Global markets
          <Icon name="arrowRight" size={14} strokeWidth={2.4} />
        </Link>
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

      <section className={styles.main} key={key}>
        <div className={styles.detail}>
          <div className={styles.catHead}>
            <span className={`${styles.catMark} ${styles[`mark_${category.accent}`]}`}>
              <Icon name={category.icon} size={24} strokeWidth={1.9} />
            </span>
            <div>
              <h2 className={styles.catName}>{category.name}</h2>
              <p className={styles.catTagline}>{category.tagline}</p>
            </div>
          </div>

          <p className={styles.what}>{category.longWhat}</p>

          <dl className={styles.facts}>
            <Fact term="Risk" detail={category.facts.risk} />
            <Fact term="Typical horizon" detail={category.facts.horizon} />
            <Fact term="Liquidity" detail={category.facts.liquidity} />
            <Fact term="Entry size" detail={category.facts.entry} />
          </dl>

          <div className={styles.block}>
            <h3 className={styles.blockTitle}>Good to know</h3>
            <ul className={styles.bullets}>
              {category.goodToKnow.map((line) => (
                <li key={line} className={styles.bullet}>
                  <span className={styles.bulletDot} aria-hidden="true" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Its own block, at the same weight as the explanation above it. A
              risk written as a footnote to an argument is an argument. */}
          <div className={`${styles.block} ${styles.blockRule}`}>
            <h3 className={styles.blockTitle}>Watch out for</h3>
            <p className={styles.watchOut}>{category.watchOut}</p>
          </div>
        </div>

        <div className={styles.side}>
          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Popular starting points</h3>
            <p className={styles.cardSub}>
              Common ways people begin — examples, not recommendations.
            </p>
            <ul className={styles.starts}>
              {category.starts.map((start) => (
                <li key={start.title} className={styles.start}>
                  <span className={styles.startName}>{start.title}</span>
                  <span className={styles.startText}>{start.sub}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Where this leads</h3>
            <div className={styles.leads}>
              <a className={`${styles.leadRow} ${styles.leadPrimary}`} href="#compare">
                Compare investment types
                <Icon name="arrowRight" size={15} strokeWidth={2.4} />
              </a>

              <Link
                className={styles.leadRow}
                href={{ pathname: '/explore/[class]', params: { class: category.key } }}
                prefetch={false}
              >
                <span>
                  Learn more about {category.name}
                  <span className={styles.leadSub}>{category.lesson}</span>
                </span>
                <Icon name="arrowRight" size={15} strokeWidth={2.4} />
              </Link>

              <Link className={styles.leadRow} href="/markets/global" prefetch={false}>
                See {category.marketLabel} in the market
                <Icon name="arrowRight" size={15} strokeWidth={2.4} />
              </Link>
            </div>
          </section>
        </div>
      </section>

      {/*
       * The comparison stays on this page.
       *
       * "Compare in detail" used to leave for the research workspace, which is
       * an instrument-research product with a search box and a chart in it.
       * Somebody deciding whether they want bonds or a fund at all had been
       * moved into a screen built for choosing between two tickers, and the
       * step back out of it was the browser button.
       */}
      <section className={styles.compare} id="compare">
        <div className={styles.compareHead}>
          <div className={styles.compareIntro}>
            <div className={styles.compareTitleRow}>
              <span className={styles.compareEyebrow}>Investment options</span>
              <h2 className={styles.h2}>Compare investment types</h2>
            </div>
            <p className={styles.compareSub}>
              {comparison.map((entry) => entry.name).join(' vs ')} — how these ways of investing
              differ in risk, cost and effort. Comparing individual instruments against each other
              is a different tool, and it lives with the live markets rather than here.
            </p>
          </div>

          <div className={styles.rivalChips}>
            {pairs.map((pair) => {
              const id = pair.join(',');
              const on = id === rival.join(',');
              return (
                <button
                  key={id}
                  className={`${styles.rivalChip} ${on ? styles.rivalChipOn : ''}`}
                  aria-pressed={on}
                  onClick={() => setRivals((current) => ({ ...current, [key]: pair }))}
                >
                  {pairLabel(pair)}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.matrixSlot}>
          <CompareMatrix entries={comparison} linkToPages />
        </div>

        <div className={styles.compareCtas}>
          <button
            className={styles.ctaPrimary}
            onClick={() =>
              ask(
                `Which of these would fit me — ${comparison.map((entry) => entry.name).join(', ')}?`
              )
            }
          >
            Ask Voyager which fits me
            <Icon name="arrowRight" size={15} strokeWidth={2.4} />
          </button>
          <Link className={styles.ctaGhost} href="/start" prefetch={false}>
            Find my next step
          </Link>
          <span className={styles.compareNote}>
            Educational comparison · not investment advice
          </span>
        </div>
      </section>

      <section className={styles.voyagerCard}>
        <div className={styles.voyagerBody}>
          <h2 className={styles.voyagerTitle}>
            <Icon name="sparkle" size={19} strokeWidth={2} className={styles.accent_cyan} />
            Ask Voyager about {category.name}
          </h2>

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
              placeholder="Ask anything about this option"
              aria-label={`Ask Voyager about ${category.name}`}
            />
            <button className={styles.askSend} type="submit" aria-label="Ask Voyager">
              <Icon name="send" size={14} strokeWidth={2.2} />
            </button>
          </form>

          <div className={styles.questionList}>
            <span className={styles.contextChip}>Context: {category.name}</span>
            {category.questions.map((entry) => (
              <button key={entry} className={styles.questionChip} onClick={() => ask(entry)}>
                {entry}
              </button>
            ))}
          </div>

          <p className={styles.clarity}>
            I can explain how {category.subject} {verbFor(category)}, and what it costs you.{' '}
            {clarityLine(authed)}
          </p>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element -- decorative, fixed size. */}
        <img className={styles.robot} src="/redesign/voyager-robot.png" alt="" aria-hidden="true" />
      </section>
    </div>
  );
}

function Fact({ term, detail }: { term: string; detail: string }) {
  return (
    <div className={styles.fact}>
      <dt className={styles.factTerm}>{term}</dt>
      <dd className={styles.factDetail}>{detail}</dd>
    </div>
  );
}
