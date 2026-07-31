import { Link } from '@/i18n/navigation';
import { getMacroSeries } from '@/lib/market/client';
import styles from './Economy.module.css';

/**
 * The macro forces behind an asset — path 2 of the Economy spec.
 *
 * This is the link that stops Economy being an encyclopedia read on its own: from
 * a share, the reader reaches the indicator that actually moves it, with the asset
 * still in context.
 *
 * Drivers are authored per asset type rather than inferred. A correlation computed
 * on the fly would produce confident-looking nonsense on short histories, and the
 * claim "US rates matter to this company" is a judgement, not a measurement.
 *
 * The data is fetched by the page and passed in, and this component is synchronous.
 * An async child component is not awaited by the static prerender — it renders into
 * a streamed boundary instead, so its output was simply absent from the generated
 * HTML. Fetching in the page keeps the block in the prerendered page where it
 * belongs.
 */

export type DriverGroup = 'tech' | 'bank' | 'energy' | 'consumer' | 'index' | 'commodity' | 'default';

/** FRED series ids, so the live figure sits next to the claim. */
const DRIVERS: Record<DriverGroup, { label: string; series: string; why: string }[]> = {
  tech: [
    {
      label: 'US interest rates',
      series: 'FEDFUNDS',
      why: 'Higher rates weigh more on companies whose value sits far in the future.',
    },
    {
      label: 'Inflation',
      series: 'CPIAUCSL',
      why: 'Inflation shapes rate expectations, which feed straight into valuations.',
    },
    {
      label: 'Economic growth',
      series: 'GDPC1',
      why: 'Demand for technology tends to track the wider economy.',
    },
  ],
  bank: [
    {
      label: 'US interest rates',
      series: 'FEDFUNDS',
      why: 'Lending margins widen and narrow with the policy rate.',
    },
    {
      label: 'Unemployment',
      series: 'UNRATE',
      why: 'Loan losses usually rise when employment falls.',
    },
  ],
  energy: [
    {
      label: 'Inflation',
      series: 'CPIAUCSL',
      why: 'Energy prices are both a cause and a consequence of inflation.',
    },
    {
      label: 'Economic growth',
      series: 'GDPC1',
      why: 'Energy demand follows industrial activity closely.',
    },
  ],
  consumer: [
    {
      label: 'Unemployment',
      series: 'UNRATE',
      why: 'Household spending depends on whether people have work.',
    },
    {
      label: 'Inflation',
      series: 'CPIAUCSL',
      why: 'Rising prices squeeze what is left for discretionary purchases.',
    },
  ],
  index: [
    {
      label: 'US interest rates',
      series: 'FEDFUNDS',
      why: 'The policy rate is the anchor for how every future cash flow is valued.',
    },
    {
      label: 'Inflation',
      series: 'CPIAUCSL',
      why: 'Inflation drives what the central bank is expected to do next.',
    },
    {
      label: 'Unemployment',
      series: 'UNRATE',
      why: 'The labour market is the other half of the central bank’s mandate.',
    },
  ],
  commodity: [
    {
      label: 'Inflation',
      series: 'CPIAUCSL',
      why: 'Commodities are often held as a hedge against rising prices.',
    },
    {
      label: 'US interest rates',
      series: 'FEDFUNDS',
      why: 'Holding a non-yielding asset costs more when rates are high.',
    },
  ],
  default: [
    {
      label: 'US interest rates',
      series: 'FEDFUNDS',
      why: 'Rates set the baseline against which every asset is compared.',
    },
    {
      label: 'Inflation',
      series: 'CPIAUCSL',
      why: 'Inflation shapes rate expectations and real returns.',
    },
  ],
};

const UNITS: Record<string, string> = {
  FEDFUNDS: '%',
  UNRATE: '%',
};

/** How the current reading is phrased. Never a direction, only a description. */
function describe(series: string, value: number, yearOverYear: number | null): string {
  if (series === 'CPIAUCSL') {
    return yearOverYear === null ? 'latest reading' : `${yearOverYear.toFixed(1)}% year over year`;
  }
  if (series === 'GDPC1') {
    return yearOverYear === null ? 'latest reading' : `${yearOverYear.toFixed(1)}% year over year`;
  }
  return `${value.toFixed(2)}${UNITS[series] ?? ''}`;
}

export type DriverReading = {
  label: string;
  why: string;
  series: string;
  figure: string | null;
};

/**
 * Resolves the drivers for an asset group, with a live figure where FRED has one.
 * Called from the page so the result is part of the prerender.
 */
export async function loadEconomicDrivers(group: DriverGroup = 'default'): Promise<DriverReading[]> {
  const drivers = DRIVERS[group] ?? DRIVERS.default;

  // One call per series, cached for half a day — a macro series does not change
  // between two page views, and the free tier would not survive it if it did.
  const readings = await Promise.all(drivers.map((driver) => getMacroSeries(driver.series)));

  return drivers.map((driver, index) => {
    const reading = readings[index];
    return {
      label: driver.label,
      why: driver.why,
      series: driver.series,
      figure: reading
        ? describe(driver.series, reading.latest.value, reading.yearOverYear)
        : null,
    };
  });
}

export function EconomicDrivers({
  drivers,
  assetName,
}: {
  drivers: DriverReading[];
  assetName: string;
}) {
  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Economic drivers</h2>
      <p className={styles.note} style={{ marginTop: 0 }}>
        Macro forces that tend to matter for {assetName}. These describe conditions, not what
        will happen next.
      </p>

      {drivers.map((driver) => (
        <Link
          className={styles.groupItem}
          key={driver.series}
          href={{ pathname: '/economy/indicators/[slug]', params: { slug: 'us-cpi' } }}
        >
          <span>
            <span className={styles.statKey}>{driver.label}</span>
            <span className={styles.clusterText}>{driver.why}</span>
          </span>
          {/* A live figure where FRED has one, and nothing rather than a
              placeholder where it does not. */}
          {driver.figure && <span className="tn-num">{driver.figure}</span>}
        </Link>
      ))}
    </section>
  );
}
