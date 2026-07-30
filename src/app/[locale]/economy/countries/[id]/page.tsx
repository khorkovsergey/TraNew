import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CountryActions } from '@/components/economy/CountryActions';
import { TrustLabel } from '@/components/ui/TrustLabel';
import { COUNTRIES, COUNTRY_IDS, type Tone } from '@/content/economy';
import { Link } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/economy/Economy.module.css';

type Props = { params: Promise<{ locale: Locale; id: string }> };

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => COUNTRY_IDS.map((id) => ({ locale, id })));
}

const TONE_TEXT: Record<Tone, string> = {
  good: styles.good,
  warn: styles.warn,
  bad: styles.bad,
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const country = COUNTRIES[id];
  if (!country) return {};

  return pageMetadata({
    href: { pathname: '/economy/countries/[id]', params: { id } },
    locale,
    title: `${country.name} economy`,
    description: country.status,
  });
}

/** Five years of policy rate as a simple polyline. */
function ratePath(values: number[]) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 300;
      const y = 90 - ((value - min) / span) * 76 - 7;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export default async function CountryPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const country = COUNTRIES[id];
  if (!country) notFound();

  return (
    <div className={styles.wrap}>
      <Link className={styles.backHome} href="/economy">
        ← Economy
      </Link>

      <div className={styles.countryHead}>
        <div>
          <h1 className={styles.h1} style={{ fontSize: 38 }}>
            {country.name}
          </h1>
          <div className={styles.status}>{country.status}</div>
        </div>
        <TrustLabel kind="marketData" />
      </div>

      <CountryActions name={country.name} />

      <div className={styles.grid}>
        <div className={styles.column}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Economic snapshot</h2>
            <div style={{ marginTop: 12 }}>
              {country.snapshot.map(([k, v]) => (
                <div className={styles.kv} key={k}>
                  <span className={styles.kvKey}>{k}</span>
                  <span className={`${styles.kvValue} tn-num`}>{v}</span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>What changed</h2>
            <div className={styles.bullets}>
              {country.changed.map((line) => (
                <div className={styles.bullet} key={line}>
                  <span>•</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{country.centralBank}</h2>
            <div style={{ marginTop: 12 }}>
              {country.cb.map(([k, v]) => (
                <div className={styles.kv} key={k}>
                  <span className={styles.kvKey}>{k}</span>
                  <span className={`${styles.kvValue} tn-num`}>{v}</span>
                </div>
              ))}
            </div>
            <svg viewBox="0 0 300 90" className={styles.rateChart} aria-hidden="true">
              <polyline
                points={ratePath(country.rateHistory)}
                fill="none"
                stroke="var(--tn-purple)"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className={styles.note}>Policy rate, last five years.</div>
          </section>
        </div>

        <div className={styles.column}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Key risks</h2>
            <div style={{ marginTop: 12 }}>
              {country.risks.map(([k, v, tone]) => (
                <div className={styles.kv} key={k}>
                  <span className={styles.kvKey}>{k}</span>
                  <span className={`${styles.kvValue} ${TONE_TEXT[tone]}`}>{v}</span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Market connections</h2>
            <div className={styles.chips}>
              {country.connections.map((item) => (
                <Link
                  className={styles.chipLink}
                  key={item}
                  href={{
                    pathname: '/tool/[slug]',
                    params: { slug: item.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
                  }}
                >
                  {item}
                </Link>
              ))}
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Compare</h2>
            <div style={{ marginTop: 6 }}>
              {country.compare.map((item) =>
                item.id ? (
                  <Link
                    className={styles.groupItem}
                    key={item.label}
                    href={{ pathname: '/economy/countries/[id]', params: { id: item.id } }}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <Link
                    className={styles.groupItem}
                    key={item.label}
                    href={{ pathname: '/tool/[slug]', params: { slug: 'country-compare' } }}
                  >
                    {item.label}
                  </Link>
                )
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
