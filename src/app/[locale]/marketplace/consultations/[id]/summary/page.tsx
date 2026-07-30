import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SummaryRating } from '@/components/marketplace/SummaryRating';
import { TrustLabel } from '@/components/ui/TrustLabel';
import { BOOKING_REFERENCE, EXPERTS, SUMMARY_SECTIONS } from '@/content/experts';
import { pick } from '@/content/types';
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
    href: { pathname: '/marketplace/consultations/[id]/summary', params: { id } },
    locale,
    title: t('consultationSummary.title'),
    description: t('consultationSummary.subtitle'),
  });
}

export default async function ConsultationSummaryPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('marketplace');
  const tScreens = await getTranslations('screens');

  // The summary is attributed to the adviser who ran the session, not to the platform.
  const expert = EXPERTS[0];

  return (
    <div className={styles.wrap}>
      <Link
        className={styles.backHome}
        href={{ pathname: '/marketplace/consultations/[id]', params: { id } }}
      >
        ← {tScreens('consultation.title')}
      </Link>

      <div className={styles.breadcrumb}>{t('breadcrumb')}</div>

      <h1 className={styles.h1}>{tScreens('consultationSummary.title')}</h1>

      <div className={styles.summaryLabels}>
        <TrustLabel kind="aiExplanation" />
        <span className={`${styles.band} ${styles.credVerified}`}>
          {t('summary.confirmedBy', { expert: expert.name })}
        </span>
      </div>

      {SUMMARY_SECTIONS.map((section) => (
        <section className={styles.card} key={section.id}>
          <div className={styles.briefKey}>{pick(section.title, locale).toUpperCase()}</div>
          <p className={styles.briefValue}>{pick(section.body, locale)}</p>
        </section>
      ))}

      <SummaryRating />
    </div>
  );
}
