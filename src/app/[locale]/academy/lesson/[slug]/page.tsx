import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Lesson } from '@/components/academy/Lesson';
import { FIRST_LESSON } from '@/content/academy';
import { pick } from '@/content/types';
import { Link } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/academy/Academy.module.css';

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, slug: FIRST_LESSON.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (slug !== FIRST_LESSON.slug) return {};

  const t = await getTranslations({ locale, namespace: 'screens' });

  return pageMetadata({
    href: { pathname: '/academy/lesson/[slug]', params: { slug } },
    locale,
    title: pick(FIRST_LESSON.title, locale),
    description: `${t('academyLesson.subtitle')} ${pick(FIRST_LESSON.objective, locale)}`,
  });
}

export default async function AcademyLessonPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  // Only the first lesson is authored in full; the rest of the path is planned content.
  if (slug !== FIRST_LESSON.slug) notFound();

  const t = await getTranslations('academy');

  return (
    <div className={styles.wrap}>
      <Link className={styles.backHome} href="/academy/dashboard">
        ← {t('dashboard.yourPath')}
      </Link>

      <div className={styles.crumbs}>
        <span className={styles.crumbIdle}>{t('breadcrumb.intro')}</span>
        <span className={styles.crumbSep}>→</span>
        <span className={styles.crumbIdle}>{t('breadcrumb.plan')}</span>
        <span className={styles.crumbSep}>→</span>
        <span className={styles.crumbActive}>{t('breadcrumb.lesson')}</span>
      </div>

      <Lesson />
    </div>
  );
}
