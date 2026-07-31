import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CountryActions } from '@/components/economy/CountryActions';
import { TrustLabel } from '@/components/ui/TrustLabel';
import { INDICATOR, type Tone } from '@/content/economy';
import { Link } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/economy/Economy.module.css';
import { VoyagerPageContext } from '@/components/voyager/VoyagerProvider';
import { buildContext } from '@/lib/voyager/context';

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, slug: INDICATOR.slug }));
}

const TONE_BAR: Record<Tone, string> = {
  good: 'var(--tn-green)',
  warn: 'var(--tn-blue)',
  bad: 'var(--tn-red)',
};

const STAT_TONE = {
  plain: '',
  muted: styles.muted,
  bad: styles.bad,
} as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (slug !== INDICATOR.slug) return {};

  return pageMetadata({
    href: { pathname: '/economy/indicators/[slug]', params: { slug } },
    locale,
    title: `${INDICATOR.name} — ${INDICATOR.stats[0].v}`,
    description: INDICATOR.whyItMatters.slice(0, 160),
  });
}

function chartPath(values: number[]) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 460;
      const y = 150 - ((value - min) / span) * 126 - 12;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export default async function IndicatorPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  // Only the CPI indicator is authored in full; the rest of the catalogue is planned.
  if (slug !== INDICATOR.slug) notFound();

  return (
    <div className={styles.wrap}>
      <VoyagerPageContext context={buildContext('indicator', INDICATOR.name)} />
      <Link className={styles.backHome} href="/economy">
        ← Economy
      </Link>

      <div className={styles.countryHead}>
        <div>
          <h1 className={styles.h1} style={{ fontSize: 38 }}>
            {INDICATOR.name}
          </h1>
          <div className={styles.status}>{INDICATOR.subtitle}</div>
        </div>
        <TrustLabel kind="marketData" />
      </div>

      <CountryActions name={INDICATOR.name} />

      <div className={styles.statGrid}>
        {INDICATOR.stats.map((stat) => (
          <div className={styles.card} key={stat.k}>
            <div className={styles.statKey}>{stat.k}</div>
            <div className={`${styles.statValue} ${STAT_TONE[stat.tone]} tn-num`}>{stat.v}</div>
          </div>
        ))}
      </div>

      <div className={styles.grid}>
        <div className={styles.column}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Last five years</h2>
            <svg viewBox="0 0 460 150" className={styles.rateChart} aria-hidden="true">
              <polyline
                points={chartPath(INDICATOR.chart)}
                fill="none"
                stroke="var(--tn-blue)"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className={styles.note}>
              Range {INDICATOR.chartRange} · {INDICATOR.provenance}
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Why it matters</h2>
            <p className={styles.clusterText}>{INDICATOR.whyItMatters}</p>
          </section>

          <section className={styles.card}>
            <div className={styles.sectionHead} style={{ marginTop: 0 }}>
              <h2 className={styles.cardTitle}>Current interpretation</h2>
              <TrustLabel kind="aiExplanation" />
            </div>
            <p className={styles.clusterText}>{INDICATOR.interpretation}</p>
            <Link
              className={styles.linkRow}
              href={{ pathname: '/academy/lesson/[slug]', params: { slug: 'why-people-invest' } }}
            >
              Learn how this works →
            </Link>
          </section>
        </div>

        <div className={styles.column}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Compare with countries</h2>
            {INDICATOR.compare.map((row) => (
              <div className={styles.barRow} key={row.k}>
                <div className={styles.barHead}>
                  <span>{row.k}</span>
                  <span className="tn-num">{row.v}</span>
                </div>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${row.width}%`, background: TONE_BAR[row.tone] }}
                  />
                </div>
              </div>
            ))}
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Potentially affected assets</h2>
            <div className={styles.chips}>
              {INDICATOR.affectedAssets.map((asset) => (
                <span className={styles.chip} key={asset}>
                  {asset}
                </span>
              ))}
            </div>
            {/* The bridge from macro data to the reader's own position. */}
            <Link className={styles.wealthCta} href="/account/wealth">
              See how this may affect your wealth →
            </Link>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Related news</h2>
            <Link className={styles.groupItem} href="/news">
              US inflation — 12 related stories
            </Link>
            <Link className={styles.groupItem} href="/news">
              Bond market reaction
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
