'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { contextParam, stashDraft, type AskSource } from '@/components/voyager/AskEntry';
import { Link, useRouter } from '@/i18n/navigation';
import { wave } from '@/lib/wave';
import {
  COMPARISONS,
  OPPORTUNITIES,
  POPULAR,
  PORTFOLIOS,
  STARTERS,
  THEME_COLUMNS,
  TRENDING,
  type Trend,
} from './content';
import styles from './Ideas.module.css';

/**
 * Ideas — "what should I look at?".
 *
 * The section starts from a concept somebody already understands (AI, electricity
 * demand, defence budgets) and works down towards companies and funds, which is
 * the reverse of arriving with a ticker and looking for a reason to like it.
 *
 * Nothing here recommends anything, and the copy is written so it cannot be read
 * as though it did: attention is reported as attention, a change is described as
 * a change, and every figure on the page is labelled illustrative because every
 * figure on the page is invented. The line this section must never cross is the
 * one between explaining a market and pointing at it.
 *
 * A client component in one piece rather than a server shell with islands: every
 * card on it is a handoff to Voyager, so an island per card would be the whole
 * page in islands. The data is static and deterministic — the sparklines come
 * from `wave`, seeded — so the server renders exactly what the browser does.
 */

/** Theme pages do not exist yet, so a card hands its subject to Voyager. */
const themeSource = (subject: string): AskSource => ({ kind: 'explore', subject });

export function IdeasScreen() {
  const router = useRouter();
  const [draft, setDraft] = useState('');

  /*
   * The question goes through storage, the page it came from goes in the URL —
   * the same split every other entry point in the portal uses. A question in a
   * query string is in the history, in the next request's referrer and in any
   * log along the way; the context is a page name and can travel openly.
   *
   * `explore` is the context kind rather than an `ideas` one of its own: the set
   * is closed, it is read from a URL and shown to the reader as "what Voyager
   * can see", and it belongs to the Voyager section rather than to this one.
   * Adding a value to it is a request, not a drive-by edit.
   */
  const ask = (question: string, source: AskSource) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    stashDraft(trimmed, source);
    router.push({ pathname: '/voyager', query: { context: contextParam(source) } });
  };

  const explore = (title: string, key: string) =>
    ask(`Explain the ${title} theme and what is connected to it.`, themeSource(key));

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.h1}>Ideas</h1>
        <p className={styles.lead}>
          Discover themes, trends and market opportunities worth exploring. Start from something
          you already understand — the companies and funds come later.
        </p>
      </header>

      {/* ---- The natural-language way in ---- */}

      <section className={styles.askSection}>
        <div className={styles.askCard}>
          <div className={styles.askHead}>
            <Icon className={styles.sparkle} name="sparkle" size={14} />
            <span className={styles.askTitle}>Explore an idea</span>
          </div>
          <p className={styles.askSub}>
            Describe what you are interested in — we will show the part of the market it touches.
          </p>

          <form
            className={styles.askForm}
            onSubmit={(event) => {
              event.preventDefault();
              ask(draft, themeSource('ideas'));
            }}
          >
            {/* 16px, because anything smaller makes iOS zoom the page on focus. */}
            <input
              className={styles.askInput}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="I think AI will increase electricity demand…"
              aria-label="Explore an idea"
            />
            <button className={styles.askSubmit} type="submit">
              Explore
            </button>
          </form>

          <div className={styles.askStartersLabel}>Or start from one of these</div>
          <div className={styles.chipRow}>
            {STARTERS.map((starter) => (
              <button
                key={starter}
                className={styles.chip}
                onClick={() => ask(`Explain ${starter} as an investment theme.`, themeSource('ideas'))}
              >
                {starter}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Trending now ---- */}

      <section className={styles.section} id="trending">
        <div className={styles.sectionHead}>
          <h2 className={styles.h2}>
            Trending now
            <span className={styles.h2Sub}>Narratives the market is paying attention to.</span>
          </h2>
        </div>

        <div className={styles.trendGrid}>
          {TRENDING.map((trend) => (
            <TrendCard key={trend.key} trend={trend} onOpen={() => explore(trend.title, trend.key)} />
          ))}
        </div>

        <div className={styles.trendFoot}>
          <span className={styles.note}>Illustrative · delayed data</span>
          <span className={styles.spacer} />
          {['Why is this trending?', 'What benefits from this trend?'].map((question) => (
            <button
              key={question}
              className={`${styles.chip} ${styles.chipSmall}`}
              onClick={() => ask(question, themeSource('ideas'))}
            >
              <Icon className={styles.sparkle} name="sparkle" size={14} />
              {question}
            </button>
          ))}
        </div>
      </section>

      {/* ---- Explore by theme ---- */}

      <section className={styles.section} id="themes">
        <div className={styles.sectionHead}>
          <h2 className={styles.h2}>
            Explore by theme
            <span className={styles.h2Sub}>The market, grouped the way people think about it.</span>
          </h2>
        </div>

        <div className={styles.themeCard}>
          {THEME_COLUMNS.map((column) => (
            <div key={column.title}>
              <div className={styles.columnTitle}>{column.title}</div>
              <div className={styles.themeList}>
                {column.items.map((item) => (
                  <button
                    key={item}
                    className={styles.themeChip}
                    onClick={() => explore(item, slug(item))}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Opportunities worth watching ---- */}

      <section className={styles.section} id="opportunities">
        <h2 className={styles.h2}>
          Opportunities worth watching
          <span className={styles.h2Sub}>Something is changing — not a recommendation.</span>
        </h2>

        <div className={styles.oppGrid}>
          {OPPORTUNITIES.map((opportunity) => (
            <button
              key={opportunity.key}
              className={styles.oppCard}
              onClick={() => explore(opportunity.title, opportunity.key)}
            >
              <span className={styles.oppLabel}>{opportunity.label}</span>
              <span className={styles.cardTitle}>{opportunity.title}</span>
              <span className={styles.oppBody}>{opportunity.body}</span>
              <span className={styles.cardLink}>
                Explore the theme
                <Icon name="arrowRight" size={14} strokeWidth={2.2} />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ---- Popular with investors ---- */}

      <section className={styles.section} id="popular">
        <div className={styles.sectionHead}>
          <h2 className={styles.h2}>
            Popular with investors
            <span className={styles.h2Sub}>
              A signal worth investigating, not evidence of a good investment.
            </span>
          </h2>

          {/*
           * The only outward link on the page, and it is the honest one: what
           * people think about these ideas is on TradingView's network, which is
           * a product this portal is part of rather than one it reproduces.
           */}
          <a
            className={styles.sectionLink}
            href="https://www.tradingview.com/social-network/"
            target="_blank"
            rel="noopener noreferrer"
          >
            See what the community thinks
            <Icon name="arrowUpRight" size={13} strokeWidth={2.4} />
          </a>
        </div>

        <div className={styles.popularCard}>
          {POPULAR.map((entry, index) => (
            <button
              key={entry.key}
              className={styles.popularRow}
              onClick={() => ask(`Why is ${entry.name} getting attention right now?`, themeSource(entry.key))}
            >
              <span className={styles.rank}>{index + 1}</span>
              <span className={styles.popularName}>{entry.name}</span>
              <span className={styles.kindChip}>{entry.kind}</span>
              <span className={styles.signal}>{entry.signal}</span>
              <Icon className={styles.rowChevron} name="chevronRight" size={13} strokeWidth={2.4} />
            </button>
          ))}
        </div>
      </section>

      {/* ---- Explore portfolios ---- */}

      <section className={styles.section} id="portfolios">
        <div className={styles.sectionHead}>
          <h2 className={styles.h2}>
            Explore portfolios
            <span className={styles.h2Sub}>Ideas combined, so you can see how they fit together.</span>
          </h2>
        </div>

        <div className={styles.oppGrid}>
          {PORTFOLIOS.map((portfolio) => (
            <button
              key={portfolio.key}
              className={styles.oppCard}
              onClick={() =>
                ask(
                  `What would a ${portfolio.title} portfolio consist of, and what drives it?`,
                  themeSource(portfolio.key)
                )
              }
            >
              <span className={styles.cardTitle}>{portfolio.title}</span>
              <span className={styles.cardBody}>{portfolio.body}</span>

              {/* Flex weights rather than percentages: the bar shows proportion,
                  and a number would read as an allocation somebody could act on. */}
              <span className={styles.bar} aria-hidden="true">
                {portfolio.slices.map((slice) => (
                  <span
                    key={slice.label}
                    className={styles[`tone_${slice.tone}`]}
                    style={{ flex: slice.weight }}
                  />
                ))}
              </span>
              <span className={styles.legend}>
                {portfolio.slices.map((slice) => (
                  <span key={slice.label} className={styles.legendItem}>
                    <span className={`${styles.swatch} ${styles[`tone_${slice.tone}`]}`} />
                    {slice.label}
                  </span>
                ))}
              </span>

              <span className={styles.spacer} />
              <span className={styles.cardMeta}>
                {portfolio.holdings} holdings · {portfolio.etfs} ETFs · Illustrative
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ---- Compare ideas ---- */}

      <section className={styles.section} id="compare">
        <h2 className={styles.h2}>
          Compare ideas
          <span className={styles.h2Sub}>Two themes, side by side, in plain language.</span>
        </h2>

        <div className={styles.compareList}>
          {COMPARISONS.map((comparison) => (
            <button
              key={`${comparison.left}-${comparison.right}`}
              className={styles.compareRow}
              onClick={() =>
                ask(
                  `Compare ${comparison.left} and ${comparison.right} as investment themes.`,
                  { kind: 'comparison', subject: `${slug(comparison.left)},${slug(comparison.right)}` }
                )
              }
            >
              <span className={styles.versus}>
                <span className={styles.versusChip}>{comparison.left}</span>
                <span className={styles.versusWord}>vs</span>
                <span className={styles.versusChip}>{comparison.right}</span>
              </span>
              <span className={styles.compareBody}>{comparison.body}</span>
              <Icon className={styles.rowChevron} name="chevronRight" size={13} strokeWidth={2.4} />
            </button>
          ))}

          {/*
           * The one row on the page that is a link rather than a question. The
           * side-by-side comparison screen already exists and does this properly;
           * sending the reader to Voyager to build one would be the long way
           * round to a page we have.
           */}
          <Link className={styles.buildRow} href="/explore/options">
            <Icon name="plus" size={16} strokeWidth={2.2} />
            Build your own comparison
          </Link>
        </div>
      </section>

      {/* ---- Voyager, which augments this page rather than carrying it ---- */}

      <section className={styles.voyagerSection}>
        <div className={styles.voyagerCard}>
          {/* eslint-disable-next-line @next/next/no-img-element --
              A decorative PNG at a fixed size with no LCP role; next/image would
              add a wrapper and a loader for an asset that is never resized. */}
          <img className={styles.robot} src="/redesign/voyager-robot.png" alt="" aria-hidden="true" />

          <div className={styles.voyagerText}>
            <div className={styles.voyagerTitle}>Still not sure what to look at?</div>
            <p className={styles.voyagerSub}>
              Voyager can explain a theme, name what is connected to it, or compare two ideas for
              you.
            </p>
          </div>

          <div className={styles.voyagerChips}>
            {['Explain this theme', 'What is connected to this?', 'Compare these ideas'].map(
              (question) => (
                <button
                  key={question}
                  className={styles.chip}
                  onClick={() => ask(question, themeSource('ideas'))}
                >
                  {question}
                </button>
              )
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * One trending theme.
 *
 * The sparkline is drawn from `wave`, seeded by the card's position, so the
 * server and the browser produce the same path — and so nothing labelled
 * illustrative can quietly start looking like a live feed.
 */
function TrendCard({ trend, onOpen }: { trend: Trend; onOpen: () => void }) {
  const points = wave(seedOf(trend.key), 18, 88, 28);

  return (
    <button className={styles.trendCard} onClick={onOpen}>
      <span className={styles.trendTop}>
        <span className={styles.statusPill}>{trend.status}</span>
        <svg className={styles.spark} viewBox="0 0 88 28" aria-hidden="true">
          <polyline
            points={points}
            fill="none"
            stroke={trend.direction === 'up' ? 'var(--tn-green)' : 'var(--tn-red)'}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      <span className={styles.cardTitle}>{trend.title}</span>
      <span className={styles.cardBody}>{trend.body}</span>

      {/*
       * The ecosystem chain — the part that makes this an idea rather than a
       * quote. Each link is downstream of the one before it, which is how a
       * reader gets from "AI is growing" to something they can look up.
       */}
      <span className={styles.chain}>
        {trend.chain.map((link, index) => (
          <span key={link} className={styles.chainStep}>
            {index > 0 && (
              <Icon className={styles.chainArrow} name="chevronRight" size={10} strokeWidth={2.6} />
            )}
            <span className={styles.chainChip}>{link}</span>
          </span>
        ))}
      </span>

      <span className={styles.spacer} />

      <span className={styles.trendFootRow}>
        <span className={trend.direction === 'up' ? styles.up : styles.down}>{trend.change}</span>
        <span>{trend.companies} companies</span>
        <span>{trend.etfs} ETFs</span>
      </span>
    </button>
  );
}

/** `AI Infrastructure` → `ai-infrastructure`. Also what `parseContext` accepts. */
function slug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** A stable number per card, so a sparkline never changes shape between loads. */
function seedOf(key: string): number {
  let total = 0;
  for (let i = 0; i < key.length; i += 1) total += key.charCodeAt(i) * (i + 1);
  return total;
}
