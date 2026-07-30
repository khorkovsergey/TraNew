import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Consultation } from '@/components/marketplace/Consultation';
import { BOOKING_REFERENCE } from '@/content/experts';
import { Link } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/marketplace/Marketplace.module.css';

type Props = { params: Promise<{ locale: Locale; id: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({
    locale,
    id: BOOKING_REFERENCE.toLowerCase(),
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'screens' });

  return pageMetadata({
    href: { pathname: '/marketplace/consultations/[id]', params: { id } },
    locale,
    title: t('consultation.title'),
    description: t('consultation.subtitle'),
  });
}

export default async function ConsultationPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('marketplace');
  const tScreens = await getTranslations('screens');

  return (
    <div className={styles.wrap}>
      <Link className={styles.backHome} href="/marketplace/experts">
        ← {tScreens('experts.title')}
      </Link>

      <div className={styles.breadcrumb}>{t('breadcrumb')}</div>

      <h1 className={styles.h1}>
        {tScreens('consultation.title')}
        <span className={styles.statusChip}>{t('consultation.confirmed')}</span>
      </h1>

      <Consultation bookingId={id} />
    </div>
  );
}
