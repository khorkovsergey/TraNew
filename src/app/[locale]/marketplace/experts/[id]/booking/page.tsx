import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Booking } from '@/components/marketplace/Booking';
import { EXPERTS, expertById } from '@/content/experts';
import { Link } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/marketplace/Marketplace.module.css';

type Props = { params: Promise<{ locale: Locale; id: string }> };

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    EXPERTS.map((expert) => ({ locale, id: expert.id }))
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'screens' });

  return pageMetadata({
    href: { pathname: '/marketplace/experts/[id]/booking', params: { id } },
    locale,
    title: t('expertBooking.title'),
    description: t('expertBooking.subtitle'),
  });
}

export default async function ExpertBookingPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const expert = expertById(id);
  if (!expert) notFound();

  const t = await getTranslations('marketplace');
  const tScreens = await getTranslations('screens');

  return (
    <div className={`${styles.wrap} ${styles.wrapWide}`}>
      <Link
        className={styles.backHome}
        href={{ pathname: '/marketplace/experts/[id]/sharing', params: { id } }}
      >
        ← {t('sharing.title')}
      </Link>

      <div className={styles.breadcrumb}>{t('breadcrumb')}</div>

      <h1 className={styles.h1}>{tScreens('expertBooking.title')}</h1>
      <p className={styles.lead}>
        {expert.name} · {tScreens('expertBooking.subtitle')}
      </p>

      <Booking expert={expert} />
    </div>
  );
}
