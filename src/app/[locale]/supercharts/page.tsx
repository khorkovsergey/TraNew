import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Supercharts } from '@/components/content/Supercharts';
import { SuperchartWorkspace } from '@/components/superchart/SuperchartWorkspace';
import { DEMO_SYMBOLS } from '@/lib/superchart/datafeed/demoAdapter';
import { parsePreset } from '@/lib/superchart/layouts/preset';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getSeries } from '@/lib/market/client';
import { pageMetadata } from '@/lib/metadata';
import { waveSeries } from '@/lib/wave';
import styles from '@/components/content/Content.module.css';
import { VoyagerPageContext } from '@/components/voyager/VoyagerProvider';
import { buildContext } from '@/lib/voyager/context';

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'screens' });

  return pageMetadata({
    href: '/supercharts',
    locale,
    title: t('supercharts.title'),
    description: t('supercharts.subtitle'),
  });
}

export default async function SuperchartsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('screens');
  const tCommon = await getTranslations('common');

  /*
   * A workspace asked for by the Supercharts catalogue.
   *
   * Validated here rather than trusted: the symbol has to be one the datafeed
   * serves and every study has to exist, or the preset is dropped and the chart
   * opens on its default instead of on a broken header.
   */
  const preset = parsePreset(
    await searchParams,
    DEMO_SYMBOLS.map((entry) => entry.id)
  );

  /*
   * Real closes when a key is configured, a deterministic stand-in when not.
   *
   * The fallback is not a fallback in the usual sense — the studies are computed
   * against whatever this is, so the chart works either way. What changes is the
   * label under it, and that is the part that has to be true.
   */
  const series = await getSeries('TSLA');
  const closes = series?.closes ?? waveSeries(5.1, 260, 250);
  const dates = series?.dates ?? [];

  /*
   * Two screens behind one route while Superchart is built.
   *
   * The workspace is Phase 1: a frame and a chart. The screen it will replace
   * still has the studies, the Pine block and the Voyager integration, so
   * swapping now would be a regression. The flag is the swap, and it happens
   * when Superchart reaches parity rather than before.
   *
   * A preset overrides the flag, and only a preset. The catalogue's cards
   * promise a particular symbol, interval and set of studies; the placeholder
   * screen cannot show any of the three, so honouring the flag there would turn
   * six different workspaces into six links to the same chart of Tesla. Arriving
   * without a preset is unchanged.
   */
  if (FEATURE_FLAGS.superchartEnabled || preset) {
    return (
      <SuperchartWorkspace
        symbol="TSLA"
        companyName="Tesla"
        exchange="NASDAQ"
        preset={preset}
      />
    );
  }

  return (
    <div className={styles.wrap}>
      <VoyagerPageContext context={buildContext('chart')} />
      <Link className={styles.backHome} href="/">
        {tCommon('backHome')}
      </Link>

      <h1 className={styles.h1}>{t('supercharts.title')}</h1>
      <p className={styles.lead}>{t('supercharts.subtitle')}</p>

      <Supercharts
        series={closes}
        dates={dates}
        illustrative={series === null}
        asOf={series?.asOf}
      />
    </div>
  );
}
