import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { StrategyBuilder } from '@/components/strategy/StrategyBuilder';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/strategy/Strategy.module.css';
import { VoyagerPageContext } from '@/components/voyager/VoyagerProvider';
import { buildContext } from '@/lib/voyager/context';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'screens' });

  return pageMetadata({
    href: '/strategy',
    locale,
    title: t('strategy.title'),
    description: t('strategy.subtitle'),
  });
}

export default async function StrategyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('strategy');
  const tScreens = await getTranslations('screens');
  const tCommon = await getTranslations('common');

  return (
    <div className={styles.wrap}>
      <VoyagerPageContext context={buildContext('strategy')} />
      <Link className={styles.backHome} href="/">
        {tCommon('backHome')}
      </Link>

      <h1 className={styles.h1}>{tScreens('strategy.title')}</h1>
      <p className={styles.lead}>{tScreens('strategy.subtitle')}</p>
      {/* Legal framing stays visible above the interview, not buried under the result. */}
      <p className={styles.disclaimer}>{t('disclaimer')}</p>

      <StrategyBuilder />
    </div>
  );
}
