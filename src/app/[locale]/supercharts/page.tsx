import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Supercharts } from '@/components/content/Supercharts';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getSeries } from '@/lib/market/client';
import { pageMetadata } from '@/lib/metadata';
import { waveSeries } from '@/lib/wave';
import styles from '@/components/content/Content.module.css';
import { VoyagerPageContext } from '@/components/voyager/VoyagerProvider';
import { buildContext } from '@/lib/voyager/context';

type Props = { params: Promise<{ locale: Locale }> };

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

export default async function SuperchartsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('screens');
  const tCommon = await getTranslations('common');

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
