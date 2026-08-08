import styles from './Tools.module.css';

/**
 * The shape on a product or workspace card.
 *
 * Decoration, and it says so. A generated series drawn as green and red candles
 * on a card selling an indicator is a picture of that indicator working — which
 * it is not, so the bars here are one neutral colour and the label in the corner
 * is part of the component rather than something a caller may forget.
 *
 * Deterministic from the seed, and rendered on the server. The same product
 * draws the same shape on every request, which is what stops a catalogue from
 * shuffling under somebody between one page and the next.
 */

function sequence(seed: number, count: number): number[] {
  let state = seed;
  const next = () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };

  let value = 0.55;
  const out: number[] = [];
  for (let index = 0; index < count; index += 1) {
    value += (next() - 0.46) * 0.22;
    value = Math.min(0.9, Math.max(0.12, value));
    out.push(value);
  }
  return out;
}

/** A moving average of the series, so the accent line relates to the bars under it. */
function smooth(values: number[], window: number): number[] {
  return values.map((_, index) => {
    const from = Math.max(0, index - window + 1);
    const slice = values.slice(from, index + 1);
    return slice.reduce((total, entry) => total + entry, 0) / slice.length;
  });
}

export type ChartPreviewProps = {
  seed: number;
  /** A token name such as `--tn-purple`. */
  accent: string;
  className?: string;
  bars?: number;
  /** Off for the small tiles, where the label would be larger than the picture. */
  label?: boolean;
};

export function ChartPreview({
  seed,
  accent,
  className,
  bars = 26,
  label = true,
}: ChartPreviewProps) {
  const width = 300;
  const height = 130;
  const series = sequence(seed, bars);
  const average = smooth(series, 5);
  const step = width / bars;
  const barWidth = Math.max(3, step * 0.52);

  const line = average
    .map((value, index) => {
      const x = (index + 0.5) * step;
      const y = height - value * height;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className={`${styles.preview} ${className ?? ''}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        {series.map((value, index) => {
          const barHeight = Math.max(4, value * height * 0.82);
          return (
            <rect
              key={index}
              x={(index * step + (step - barWidth) / 2).toFixed(1)}
              y={(height - barHeight).toFixed(1)}
              width={barWidth.toFixed(1)}
              height={barHeight.toFixed(1)}
              rx="1"
              fill="var(--tn-chip-bg)"
            />
          );
        })}
        <path d={line} fill="none" stroke={`var(${accent})`} strokeWidth="2" />
      </svg>
      {label && <span className={styles.illustrative}>Illustrative</span>}
    </div>
  );
}
