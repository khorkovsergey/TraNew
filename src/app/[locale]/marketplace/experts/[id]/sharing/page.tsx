import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ContextSharing } from '@/components/marketplace/ContextSharing';
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
    href: { pathname: '/marketplace/experts/[id]/sharing', params: { id } },
    locale,
    title: t('expertSharing.title'),
    description: t('expertSharing.subtitle'),
  });
}

export default async function ExpertSharingPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const expert = expertById(id);
  if (!expert) notFound();

  const t = await getTranslations('marketplace');

  return (
    <div className={styles.wrap}>
      <Link
        className={styles.backHome}
        href={{ pathname: '/marketplace/experts/[id]', params: { id } }}
      >
        ← {expert.name}
      </Link>

      <div className={styles.breadcrumb}>{t('breadcrumb')}</div>

      <h1 className={styles.h1}>{t('sharing.title')}</h1>
      <p className={styles.lead}>{t('sharing.sub')}</p>

      <ContextSharing expertId={id} />
    </div>
  );
}
