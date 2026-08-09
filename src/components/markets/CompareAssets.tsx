'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useLoginModal } from '@/components/shell/LoginModalProvider';
import { clarityLine, contextParam, stashDraft } from '@/components/voyager/AskEntry';
import { Link, useRouter } from '@/i18n/navigation';
import {
  COMPARE_SETS,
  SERIES_COLORS,
  bestValue,
  formatMetric,
  isSigned,
  type AssetKind,
} from '@/lib/market/compare';
import styles from './CompareAssets.module.css';

/** How wide the chart's own coordinate system is. Points are drawn into it. */
const CHART_W = 640;
const CHART_H = 240;
const BASELINE = 200;

/**
 * Compare assets.
 *
 * Two to four instruments of the same type, the metrics that separate them, and
 * a sentence about what the numbers mean. It is a research tool, not a
 * terminal: the limit is four because a fifth column stops being read, and the
 * minimum is two because one instrument is not a comparison.
 *
 * The same type throughout, enforced rather than requested. A table holding a
 * forward P/E in one column and an expense ratio in the next is two tables
 * printed on top of each other, so the add dialog only ever offers instruments
 * from the set already on screen.
 *
 * This is the other comparison, and it is never the same screen as Compare
 * investment types: that one is about whether to hold stocks or bonds at all,
 * this one is about which of three chips to hold. They link to each other and
 * say what the other is for.
 */
export function CompareAssets({
  initialKind,
  initialSymbols,
}: {
  initialKind: AssetKind;
  /** Already parsed and validated on the server — see `lib/market/compare`. */
  initialSymbols: string[];
}) {
  const router = useRouter();
  const { authed } = useLoginModal();

  const [kind, setKind] = useState<AssetKind>(initialKind);
  const [symbols, setSymbols] = useState<string[]>(initialSymbols);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [question, setQuestion] = useState('');

  const set = COMPARE_SETS[kind];
  const items = symbols.map((symbol) => ({ symbol, ...set.items[symbol] }));
  const full = items.length >= 4;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAddOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const choosePreset = (next: AssetKind) => {
    setKind(next);
    setSymbols(COMPARE_SETS[next].base);
  };

  const ask = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const source = { kind: 'comparison' as const, subject: symbols.join(',') };
    stashDraft(trimmed, source);
    router.push({ pathname: '/voyager', query: { context: contextParam(source) } });
  };

  /*
   * One scale for every line, including zero.
   *
   * Each instrument is rebased to 0% at the start, so the lines already share
   * an origin; giving them a shared range as well is what makes the gap between
   * two of them mean something. Scaling each line to its own range would draw
   * a flat asset and a tripling one as the same picture.
   */
  const all = items.flatMap((item) => item.series);
  const min = Math.min(0, ...all);
  const max = Math.max(...all);
  const span = max - min || 1;

  const lines = items.map((item, index) => ({
    symbol: item.symbol,
    color: SERIES_COLORS[index],
    points: item.series
      .map((value, step) => {
        const x = (step * (CHART_W / (item.series.length - 1))).toFixed(1);
        const y = (BASELINE - ((value - min) / span) * (BASELINE - 20)).toFixed(1);
        return `${x},${y}`;
      })
      .join(' '),
  }));

  const rows = set.rows.map((row) => {
    const values = items.map((item) => item.metrics[row.key]);
    const peak = Math.max(...values.map((value) => Math.abs(value))) || 1;
    const best = bestValue(values, row.better, row.key);
    const signed = isSigned(row.key);

    return {
      ...row,
      cells: values.map((value, index) => ({
        symbol: items[index].symbol,
        text: formatMetric(value, row.format, signed),
        isBest: best !== null && value === best,
        isNegative: signed && value < 0,
        width: Math.max(6, (Math.abs(value) / peak) * 100),
      })),
    };
  });

  const needle = query.trim().toLowerCase();
  const candidates = Object.keys(set.items)
    .filter((symbol) => !symbols.includes(symbol))
    .filter(
      (symbol) => !needle || `${symbol} ${set.items[symbol].name}`.toLowerCase().includes(needle)
    );

  return (
    <div className={styles.page}>
      <header>
        <div className={styles.headRow}>
          <div className={styles.headMain}>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowMark}>Symbols</span>
              <span className={styles.eyebrowNote}>What is this asset?</span>
            </div>
            <h1 className={styles.h1}>{symbols.join(' vs ')}</h1>
            <p className={styles.lead}>
              Two to four instruments, the metrics that matter for their type, and a plain-language
              read of what the numbers mean.
            </p>
          </div>
          <span className={styles.sample}>Sample data</span>
        </div>

        <div className={styles.chipRow}>
          {items.map((item, index) => (
            <span className={styles.chip} key={item.symbol}>
              <span
                className={styles.chipDot}
                style={{ background: SERIES_COLORS[index] }}
                aria-hidden="true"
              />
              <span className={styles.chipText}>
                <span className={styles.chipSym}>{item.symbol}</span>
                <span className={styles.chipName}>{item.name}</span>
              </span>
              {/*
               * Disabled at two rather than hidden. A control that vanishes at
               * the limit leaves the reader wondering whether they broke it;
               * one that is visibly unavailable has told them the rule.
               */}
              <button
                className={styles.chipRemove}
                aria-label={`Remove ${item.symbol}`}
                disabled={items.length <= 2}
                onClick={() => setSymbols(symbols.filter((entry) => entry !== item.symbol))}
              >
                ×
              </button>
            </span>
          ))}

          <button className={styles.addButton} disabled={full} onClick={() => setAddOpen(true)}>
            + Add symbol
          </button>
          <span className={styles.slots}>{items.length} of 4 · same asset type</span>
        </div>

        <div className={styles.presetRow}>
          <span className={styles.presetLabel}>Presets</span>
          {(Object.keys(COMPARE_SETS) as AssetKind[]).map((id) => {
            const on = id === kind && symbols.join(',') === COMPARE_SETS[id].base.join(',');
            return (
              <button
                key={id}
                className={`${styles.preset} ${on ? styles.presetOn : ''}`}
                aria-pressed={on}
                onClick={() => choosePreset(id)}
              >
                {COMPARE_SETS[id].label}
              </button>
            );
          })}
        </div>
      </header>

      <section className={styles.chartRow} key={`${kind}:${symbols.join(',')}`}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.h2}>Price performance</h2>
            <span className={styles.cardNote}>Rebased to 0% · last 12 months</span>
          </div>

          <svg
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            preserveAspectRatio="none"
            className={styles.chart}
            role="img"
            aria-label={`Rebased performance over twelve months: ${symbols.join(', ')}`}
          >
            {[20, 80, 140].map((y) => (
              <line key={y} x1="0" y1={y} x2={CHART_W} y2={y} className={styles.gridLine} />
            ))}
            <line x1="0" y1={BASELINE} x2={CHART_W} y2={BASELINE} className={styles.baseLine} />
            {lines.map((line) => (
              <polyline
                key={line.symbol}
                points={line.points}
                fill="none"
                stroke={line.color}
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>

          <div className={styles.legend}>
            {items.map((item, index) => {
              const last = item.series[item.series.length - 1];
              return (
                <span className={styles.legendItem} key={item.symbol}>
                  <span
                    className={styles.legendMark}
                    style={{ background: SERIES_COLORS[index] }}
                    aria-hidden="true"
                  />
                  {item.symbol}
                  <span className={`${styles.legendValue} tn-num ${last >= 0 ? styles.up : styles.down}`}>
                    {formatMetric(last, '%', true)}
                  </span>
                </span>
              );
            })}
          </div>
        </div>

        <div className={styles.card}>
          <h2 className={styles.h3}>What the numbers say</h2>
          <ul className={styles.takeaways}>
            {set.takeaways.map((line) => (
              <li className={styles.takeaway} key={line}>
                <span className={styles.takeawayDot} aria-hidden="true" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <p className={styles.disclaimer}>Descriptive only — not a recommendation to buy or sell.</p>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.h2}>Key metrics</h2>
          <span className={styles.cardNote}>{set.note}</span>
        </div>

        {/*
         * Flex rows, never a fixed grid: the column count follows the
         * instruments on screen, so removing one closes the gap instead of
         * leaving an empty fourth column ruled off down the table.
         */}
        <div className={styles.tableScroll}>
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span className={styles.metricCol}>Metric</span>
              {items.map((item) => (
                <span className={styles.valueCol} key={item.symbol}>
                  <span className={styles.colSym}>{item.symbol}</span>
                  <span className={styles.colName}>{item.name}</span>
                </span>
              ))}
            </div>

            {rows.map((row) => (
              <div className={styles.tableRow} key={row.key}>
                <span className={styles.metricCol}>
                  <span className={styles.metricLabel}>{row.label}</span>
                  <span className={styles.metricHint}>{row.hint}</span>
                </span>
                {row.cells.map((cell) => (
                  <span className={styles.valueCol} key={cell.symbol}>
                    <span
                      className={`${styles.cellValue} tn-num ${
                        cell.isBest ? styles.best : cell.isNegative ? styles.down : ''
                      }`}
                    >
                      {cell.text}
                    </span>
                    <span className={styles.bar} aria-hidden="true">
                      <span
                        className={`${styles.barFill} ${cell.isBest ? styles.barBest : ''}`}
                        style={{ width: `${cell.width.toFixed(0)}%` }}
                      />
                    </span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.voyagerCard}>
        <div className={styles.voyagerBody}>
          <h2 className={styles.voyagerTitle}>
            <Icon name="sparkle" size={19} strokeWidth={2} className={styles.iconCyan} />
            Ask Voyager about this comparison
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
              placeholder="Ask why these differ, or what to look at next"
              aria-label="Ask Voyager about this comparison"
            />
            <button className={styles.askSend} type="submit" aria-label="Ask Voyager">
              <Icon name="send" size={14} strokeWidth={2.2} />
            </button>
          </form>

          <div className={styles.promptRow}>
            <span className={styles.contextChip}>Context: {symbols.join(' vs ')}</span>
            {set.prompts.map((prompt) => (
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

      {/* The two comparisons cross-link and never share a screen. */}
      <section className={styles.footer}>
        <div>
          <div className={styles.footerTitle}>Deciding between kinds of investment instead?</div>
          <div className={styles.footerSub}>
            Stocks against ETFs against bonds is a different question, and it has its own screen.
          </div>
        </div>
        <div className={styles.footerActions}>
          <Link className={styles.ghostCta} href="/explore" prefetch={false}>
            Compare investment types
          </Link>
          <a
            className={styles.mintCta}
            href="https://www.tradingview.com/chart/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Continue to TradingView
            <Icon name="arrowUpRight" size={14} strokeWidth={2.4} />
          </a>
        </div>
      </section>

      {addOpen && (
        <>
          <div className={styles.scrim} onClick={() => setAddOpen(false)} role="presentation" />
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-label="Add a symbol">
            <div className={styles.dialogSearch} role="search">
              <Icon name="search" size={18} strokeWidth={2.2} className={styles.iconMuted} />
              <input
                className={styles.dialogInput}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${set.note.replace('Metrics shown for ', '')}`}
                aria-label="Search instruments"
                autoFocus
              />
              <button className={styles.escButton} onClick={() => setAddOpen(false)}>
                Esc
              </button>
            </div>

            <div className={styles.resultsLabel}>
              {full
                ? 'Comparison is full — remove one to add another'
                : needle
                  ? 'Matching symbols · same asset type'
                  : 'Suggested — same asset type'}
            </div>

            <div className={styles.results}>
              {candidates.map((symbol) => (
                <button
                  key={symbol}
                  className={styles.result}
                  disabled={full}
                  onClick={() => {
                    setSymbols([...symbols, symbol]);
                    setAddOpen(false);
                    setQuery('');
                  }}
                >
                  <span className={styles.resultBadge}>{symbol}</span>
                  <span className={styles.resultText}>
                    <span className={styles.resultName}>{set.items[symbol].name}</span>
                    <span className={styles.resultMeta}>{set.items[symbol].market}</span>
                  </span>
                  <span className={styles.resultAction}>{full ? 'Full' : 'Add'}</span>
                </button>
              ))}

              {candidates.length === 0 && (
                <p className={styles.noResults}>
                  Nothing else of this type to add. Instruments of a different type would need their
                  own comparison — the metrics below are not the same ones.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
