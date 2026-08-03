'use client';

import { useMemo } from 'react';
import type { Bar, ChartInterval } from '@/lib/superchart/chart-engine/types';
import styles from './Superchart.module.css';

/**
 * The chart, for anybody who cannot see it.
 *
 * A canvas is one opaque element. `aria-hidden` on it is honest — there is
 * nothing in there to read — but on its own it means the entire chart is
 * missing rather than merely unlabelled. So the same data exists a second time
 * in the DOM, as text.
 *
 * It is not a transcription of every bar. Two hundred rows read aloud is not
 * access, it is a denial-of-service with good intentions. What a person gets
 * from glancing at a chart is the shape: where it started, where it ended, the
 * extremes, and roughly what happened in between. That is what this says, plus
 * a table of the most recent bars for anyone who wants the numbers.
 *
 * The statistics are computed here rather than pulled from the Voyager context,
 * because this has to be right when Voyager is switched off.
 */

type Props = {
  bars: Bar[];
  symbol: string;
  interval: ChartInterval;
  dataStatus: string;
  /** How many bars are in view, so the description matches what is drawn. */
  fromIndex: number;
  toIndex: number;
};

/** How many recent bars get a row. Enough to be useful, short enough to hear. */
const TABLE_ROWS = 10;

function formatDate(time: number): string {
  return new Date(time * 1000).toISOString().slice(0, 10);
}

/**
 * The shape of the window in words.
 *
 * Divided into thirds rather than described bar by bar: "rose, then fell back"
 * is what somebody looking at the chart takes from it, and it is a claim the
 * arithmetic can actually support.
 */
function describeShape(bars: Bar[]): string {
  if (bars.length < 6) return '';

  const third = Math.floor(bars.length / 3);
  const segments = [bars.slice(0, third), bars.slice(third, third * 2), bars.slice(third * 2)];

  const words = segments.map((segment) => {
    const change = segment[segment.length - 1].close / segment[0].close - 1;
    if (change > 0.02) return 'rose';
    if (change < -0.02) return 'fell';
    return 'moved sideways';
  });

  return ` Across the window in three parts, it ${words[0]}, then ${words[1]}, then ${words[2]}.`;
}

export function SeriesDescription({
  bars,
  symbol,
  interval,
  dataStatus,
  fromIndex,
  toIndex,
}: Props) {
  const visible = useMemo(
    () => bars.slice(Math.max(0, Math.floor(fromIndex)), Math.min(bars.length, Math.ceil(toIndex))),
    [bars, fromIndex, toIndex]
  );

  const summary = useMemo(() => {
    if (visible.length < 2) return null;

    const first = visible[0];
    const last = visible[visible.length - 1];
    const change = (last.close / first.close - 1) * 100;

    const highs = visible.map((bar) => bar.high);
    const lows = visible.map((bar) => bar.low);
    const highest = Math.max(...highs);
    const lowest = Math.min(...lows);

    return {
      first,
      last,
      change,
      highest,
      lowest,
      highestAt: visible[highs.indexOf(highest)],
      lowestAt: visible[lows.indexOf(lowest)],
    };
  }, [visible]);

  if (!summary) {
    return (
      <div className={styles.srOnly} role="region" aria-label="Chart data">
        <p>No price data is loaded for {symbol}.</p>
      </div>
    );
  }

  const direction = summary.change >= 0 ? 'up' : 'down';

  return (
    <div className={styles.srOnly} role="region" aria-label="Chart data as text">
      <h2>
        {symbol}, {interval} candles, {dataStatus} data
      </h2>

      {/*
        aria-live is deliberately absent. This changes on every pan and zoom, and
        a region that announces itself on every scroll wheel movement makes the
        chart unusable with a screen reader. It is here to be read on demand.
      */}
      <p>
        {visible.length} bars from {formatDate(summary.first.time)} to{' '}
        {formatDate(summary.last.time)}. Closed at {summary.last.close.toFixed(2)}, which is{' '}
        {direction} {Math.abs(summary.change).toFixed(1)} percent from{' '}
        {summary.first.close.toFixed(2)} at the start of the window. The highest price in view is{' '}
        {summary.highest.toFixed(2)} on {formatDate(summary.highestAt.time)} and the lowest is{' '}
        {summary.lowest.toFixed(2)} on {formatDate(summary.lowestAt.time)}.
        {describeShape(visible)}
      </p>

      <table>
        <caption>The last {Math.min(TABLE_ROWS, visible.length)} bars in view</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Open</th>
            <th scope="col">High</th>
            <th scope="col">Low</th>
            <th scope="col">Close</th>
            <th scope="col">Volume</th>
          </tr>
        </thead>
        <tbody>
          {visible.slice(-TABLE_ROWS).map((bar) => (
            <tr key={bar.time}>
              <th scope="row">{formatDate(bar.time)}</th>
              <td>{bar.open.toFixed(2)}</td>
              <td>{bar.high.toFixed(2)}</td>
              <td>{bar.low.toFixed(2)}</td>
              <td>{bar.close.toFixed(2)}</td>
              <td>{bar.volume ? Math.round(bar.volume).toLocaleString('en-US') : 'not reported'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
