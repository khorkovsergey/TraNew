import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { EconomyScreen } from '@/components/economy/EconomyScreen';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/economy/Economy.module.css';
import { VoyagerPageContext } from '@/components/voyager/VoyagerProvider';
import { buildContext } from '@/lib/voyager/context';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    href: '/economy',
    locale,
    title: 'Understand what is moving the economy',
    description:
      'Track growth, inflation, interest rates and other forces that may affect markets and your investments.',
  });
}

export default async function EconomyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const tCommon = await getTranslations('common');

  return (
    <div className={styles.wrap}>
      <VoyagerPageContext context={buildContext('economy')} />
      <Link className={styles.backHome} href="/">
        {tCommon('backHome')}
      </Link>

      <h1 className={styles.h1}>Understand what is moving the economy</h1>
      <p className={styles.lead}>
        Track growth, inflation, interest rates and other forces that may affect markets and your
        investments.
      </p>

      <EconomyScreen />
    </div>
  );
}
