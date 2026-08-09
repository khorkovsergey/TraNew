'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useLoginModal } from '@/components/shell/LoginModalProvider';
import { clarityLine, contextParam, stashDraft } from '@/components/voyager/AskEntry';
import { Link, useRouter } from '@/i18n/navigation';
import {
  ASSET_VIEWS,
  MACRO_TILES,
  MARKET_VIEWS,
  isQuantity,
  isUp,
  sparkPoints,
  type AssetView,
  type SymbolHit,
} from '@/lib/market/overview';
import type { MarketSession } from '@/lib/market/session';
import styles from './MarketOverview.module.css';

/**
 * Market Overview — what is happening, and where to go next.
 *
 * A routing hub with immediate value, not a screen that accumulates every
 * feature. It answers one question at the top — is the market open and what
 * moved — and every block below it ends in a way onward rather than in more of
 * itself.
 *
 * Choosing an asset class swaps the pulse, the movers, the watch list, the
 * Ideas card and the Voyager prompts together. A strip that changed only the
 * cards would be a filter on one block, and would leave bond prompts sitting
 * under crypto numbers.
 *
 * Nothing here explains what a stock is. That is Investment options, one link
 * away at the foot of the page: this screen is for somebody who already knows
 * what they are looking at, and mixing the two produced a page that was the
 * wrong answer to both questions.
 */
export function MarketOverview({
  session,
  symbols,
}: {
  /** Derived on the server from real exchange hours — see `lib/market/session`. */
  session: MarketSession;
  /** Only symbols that have a page. A search result that 404s is not a result. */
  symbols: SymbolHit[];
}) {
  const router = useRouter();
  const { authed } = useLoginModal();

  const [view, setView] = useState<AssetView>('global');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [question, setQuestion] = useState('');

  const data = MARKET_VIEWS[view];

  /*
   * `/` opens the search, Escape closes it — the two keys anybody who uses a
   * market screen reaches for without being told. `/` is ignored while typing,
   * or it would eat the slash out of every question in the Voyager box.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && /input|textarea/i.test(target.tagName);

      if (event.key === '/' && !typing) {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') setSearchOpen(false);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const ask = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const source = { kind: 'explore' as const, subject: view };
    stashDraft(trimmed, source);
    router.push({ pathname: '/voyager', query: { context: contextParam(source) } });
  };

  const needle = query.trim().toLowerCase();
  const hits = needle
    ? symbols.filter((entry) =>
        `${entry.ticker} ${entry.name} ${entry.meta}`.toLowerCase().includes(needle)
      )
    : symbols;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headMain}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowMark}>Market</span>
            <span className={styles.eyebrowNote}>What is happening?</span>
          </div>

          <h1 className={styles.h1}>{data.title}</h1>

          <div className={styles.state}>
            {/* Green only when something is trading. The prototype was drawn on
                a Sunday and hard-coded the weekend; this follows the clock. */}
            <span className={styles.stateLine}>
              <span className={`${styles.dot} ${styles[`dot_${session.tone}`]}`} aria-hidden="true" />
              {session.line}
            </span>
            <span className={styles.stateSep}>·</span>
            <span>{session.dateLine}</span>
            <span className={styles.sample}>Sample data</span>
          </div>
        </div>

        <div className={styles.headSearch}>
          <button className={styles.searchButton} onClick={() => setSearchOpen(true)}>
            <Icon name="search" size={18} strokeWidth={2.2} />
            <span className={styles.searchLabel}>Search Apple, Tesla, Bitcoin, S&amp;P 500…</span>
            <span className={styles.kbd}>/</span>
          </button>

          <div className={styles.symbolRow}>
            <span className={styles.symbolRowLabel}>Symbols</span>
            {/* Screeners and Popular symbols are named in the menu as future
                work; naming them here as links would promise two more. */}
            <span className={styles.symbolSoon}>Screeners</span>
            <span className={styles.symbolSoon}>Popular symbols</span>
            <Link className={styles.symbolLink} href="/markets/compare" prefetch={false}>
              Compare assets
            </Link>
          </div>
        </div>
      </header>

      <div className={styles.tabs} role="radiogroup" aria-label="Asset class">
        {ASSET_VIEWS.map((entry) => (
          <button
            key={entry.id}
            role="radio"
            aria-checked={entry.id === view}
            className={`${styles.tab} ${entry.id === view ? styles.tabOn : ''}`}
            onClick={() => setView(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <section className={styles.body} key={view}>
        {/*
         * The pulse cards do not click.
         *
         * Every one of them names a symbol whose page does not exist yet, and a
         * card that looks like a door and opens onto a 404 costs more than a
         * card that never looked like one. The search overlay is the way to a
         * symbol, and it only lists the ones that are built.
         */}
        <div className={styles.pulse}>
          {data.pulse.map((card) => {
            const quantity = isQuantity(card.change);
            const up = isUp(card.change);
            return (
              <div className={styles.pulseCard} key={card.name}>
                <div className={styles.pulseTop}>
                  <span className={styles.pulseName}>{card.name}</span>
                  <span className={styles.pulseGroup}>{card.group}</span>
                </div>
                <div className={styles.pulseBottom}>
                  <div>
                    <div className={`${styles.pulseValue} tn-num`}>{card.value}</div>
                    <div
                      className={`${styles.pulseChange} tn-num ${
                        quantity ? (up ? styles.up : styles.down) : styles.neutral
                      }`}
                    >
                      {card.change}
                    </div>
                  </div>
                  <svg viewBox="0 0 64 22" className={styles.spark} aria-hidden="true">
                    <polyline
                      points={sparkPoints(card.series)}
                      fill="none"
                      stroke={up ? 'var(--tn-green)' : 'var(--tn-red)'}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.split}>
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.h2}>What moved{session.movedSuffix}</h2>
              <span className={styles.cardNote}>Data with context, not just numbers</span>
            </div>

            <div className={styles.movedList}>
              {data.moved.map((row) => (
                <div className={styles.moved} key={row.name}>
                  <span className={styles.movedName}>
                    {row.name}
                    <span className={styles.movedKind}>{row.kind}</span>
                  </span>
                  <span
                    className={`${styles.movedChange} tn-num ${
                      isUp(row.change) ? styles.up : styles.down
                    }`}
                  >
                    {row.change}
                  </span>
                  {/* The sentence is the point. A number without one is what
                      this screen exists to stop being. */}
                  <span className={styles.movedWhy}>{row.why}</span>
                </div>
              ))}
            </div>
          </section>

          <div className={styles.side}>
            <section className={styles.card}>
              <h2 className={styles.h3}>Watch next</h2>
              <div className={styles.watchList}>
                {data.watch.map((row) => (
                  <div className={styles.watch} key={row.label}>
                    <span className={styles.watchLabel}>{row.label}</span>
                    <span className={styles.watchWhen}>{row.when}</span>
                  </div>
                ))}
              </div>
              <a className={styles.cardLink} href="#economy">
                Economy context
                <Icon name="arrowRight" size={14} strokeWidth={2.4} />
              </a>
            </section>

            <Link className={styles.ideaCard} href="/ideas" prefetch={false}>
              <span className={styles.ideaMark}>Ideas</span>
              <span className={styles.ideaTitle}>{data.idea.title}</span>
              <span className={styles.ideaSub}>{data.idea.sub}</span>
              <span className={styles.cardLink}>
                See ideas
                <Icon name="arrowRight" size={14} strokeWidth={2.4} />
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section} id="economy">
        <div className={styles.eyebrow}>
          <span className={styles.eyebrowCyan}>Economy</span>
          <h2 className={styles.h2}>Why is it happening?</h2>
        </div>

        <div className={styles.macro}>
          {MACRO_TILES.map((tile) => (
            <div className={styles.macroTile} key={tile.label}>
              <span className={styles.macroLabel}>{tile.label}</span>
              <span className={`${styles.macroValue} tn-num`}>{tile.value}</span>
              <span className={styles.macroNote}>{tile.note}</span>
            </div>
          ))}
        </div>

        {/* One of these is built. The rest are named because the menu names
            them, and marked so nobody spends a click finding out. */}
        <div className={styles.econLinks}>
          <Link className={styles.econChip} href="/economy" prefetch={false}>
            World economy
          </Link>
          <span className={styles.econSoon}>
            Economic calendar<span className={styles.soonMark}>Soon</span>
          </span>
          <span className={styles.econSoon}>
            Countries<span className={styles.soonMark}>Soon</span>
          </span>
          <span className={styles.econSoon}>
            Yield curves<span className={styles.soonMark}>Soon</span>
          </span>
          <span className={styles.econSoon}>
            Macro maps<span className={styles.soonMark}>Soon</span>
          </span>
        </div>
      </section>

      {/*
       * The lightweight entry, and deliberately only that.
       *
       * The full tool lives in Symbols at `/markets/compare`. This block exists
       * so somebody looking at the market can start a comparison without
       * knowing the tool is there — it is discovery and routing, not a second
       * copy of the screen.
       */}
      <section className={styles.compare} id="compare">
        <div className={styles.compareHead}>
          <div>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowMark}>Symbols</span>
              <h2 className={styles.h2}>Compare assets</h2>
            </div>
            <p className={styles.compareSub}>
              Put 2–4 real instruments side by side. Lives in Symbols — this is the shortcut.
            </p>
          </div>

          <div className={styles.compareActions}>
            <span className={styles.symChip}>NVDA</span>
            <span className={styles.symChip}>AMD</span>
            <Link
              className={styles.addChip}
              href={{ pathname: '/markets/compare', query: { symbols: 'NVDA,AMD' } }}
              prefetch={false}
            >
              + Add symbol
            </Link>
            <Link
              className={styles.compareCta}
              href={{ pathname: '/markets/compare', query: { symbols: 'NVDA,AMD' } }}
              prefetch={false}
            >
              Compare
              <Icon name="arrowRight" size={15} strokeWidth={2.4} />
            </Link>
          </div>
        </div>

        <div className={styles.compareFoot}>
          <span className={styles.compareFootLabel}>Popular comparisons</span>
          <Link
            className={styles.compareFootLink}
            href={{ pathname: '/markets/compare', query: { symbols: 'NVDA,AMD,AVGO' } }}
            prefetch={false}
          >
            NVDA vs AMD vs AVGO
          </Link>
          <Link
            className={styles.compareFootLink}
            href={{ pathname: '/markets/compare', query: { symbols: 'SPY,QQQ,VOO' } }}
            prefetch={false}
          >
            SPY vs QQQ vs VOO
          </Link>
          {/* The other comparison, named as the different thing it is. */}
          <span className={styles.compareCross}>
            Comparing investment types instead?{' '}
            <Link className={styles.compareFootLink} href="/explore" prefetch={false}>
              Stocks vs ETFs vs Bonds →
            </Link>
          </span>
        </div>
      </section>

      <section className={styles.voyagerCard}>
        <div className={styles.voyagerBody}>
          <h2 className={styles.voyagerTitle}>
            <Icon name="sparkle" size={19} strokeWidth={2} className={styles.iconCyan} />
            Ask Voyager about this view
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
              placeholder="Ask about what you are looking at"
              aria-label={`Ask Voyager about ${data.title}`}
            />
            <button className={styles.askSend} type="submit" aria-label="Ask Voyager">
              <Icon name="send" size={14} strokeWidth={2.2} />
            </button>
          </form>

          <div className={styles.promptRow}>
            <span className={styles.contextChip}>Context: {data.title}</span>
            {data.prompts.map((prompt) => (
              <button key={prompt} className={styles.promptChip} onClick={() => ask(prompt)}>
                {prompt}
              </button>
            ))}
          </div>

          <p className={styles.clarity}>{clarityLine(authed)}</p>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element -- decorative, fixed size. */}
        <img className={styles.robot} src="/redesign/voyager-robot.png" alt="" aria-hidden="true" />
      </section>

      {/* TradingView is an escalation, never this page's primary call to action. */}
      <section className={styles.advanced}>
        <div>
          <div className={styles.advancedTitle}>
            Need professional charts, screeners and indicators?
          </div>
          <div className={styles.advancedSub}>
            Drawing tools, custom indicators and full trading workflows live on TradingView.
          </div>
        </div>
        <div className={styles.advancedActions}>
          <Link className={styles.ghostCta} href="/explore" prefetch={false}>
            Understand investment options
          </Link>
          <a
            className={styles.mintCta}
            href="https://www.tradingview.com/chart/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open advanced charts
            <Icon name="arrowUpRight" size={14} strokeWidth={2.4} />
          </a>
        </div>
      </section>

      {searchOpen && (
        <>
          <div
            className={styles.scrim}
            onClick={() => setSearchOpen(false)}
            role="presentation"
          />
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-label="Search markets">
            <div className={styles.dialogSearch} role="search">
              <Icon name="search" size={18} strokeWidth={2.2} className={styles.iconMuted} />
              <input
                className={styles.dialogInput}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Apple, Tesla, Bitcoin, S&amp;P 500…"
                aria-label="Search symbols"
                autoFocus
              />
              <button className={styles.escButton} onClick={() => setSearchOpen(false)}>
                Esc
              </button>
            </div>

            <div className={styles.resultsLabel}>
              {needle ? `Symbols matching “${query.trim()}”` : 'Popular symbols'}
            </div>

            <div className={styles.results}>
              {hits.map((hit) => (
                <Link
                  key={hit.ticker}
                  className={styles.result}
                  href={{ pathname: '/symbols/[ticker]', params: { ticker: hit.ticker } }}
                  onClick={() => setSearchOpen(false)}
                  prefetch={false}
                >
                  <span className={styles.resultBadge}>{hit.ticker}</span>
                  <span className={styles.resultText}>
                    <span className={styles.resultName}>{hit.name}</span>
                    <span className={styles.resultMeta}>{hit.meta}</span>
                  </span>
                  <span className={`${styles.resultChange} tn-num ${hit.up ? styles.up : styles.down}`}>
                    {hit.change}
                  </span>
                </Link>
              ))}

              {hits.length === 0 && (
                <p className={styles.noResults}>
                  Nothing here matches “{query.trim()}”. The portal carries a small set of symbol
                  pages so far — the rest of the market is illustrative on this screen.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
