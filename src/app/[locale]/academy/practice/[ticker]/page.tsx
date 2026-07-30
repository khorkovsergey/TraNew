import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PracticeSymbol } from '@/components/academy/PracticeSymbol';
import { SYMBOLS } from '@/content/symbols';
import { pick } from '@/content/types';
import { Link } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import { isTicker, TICKERS, type Ticker } from '@/lib/symbolSearch';
import { FIRST_LESSON } from '@/content/academy';
import styles from '@/components/academy/Academy.module.css';

type Props = { params: Promise<{ locale: Locale; ticker: string }> };

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => TICKERS.map((ticker) => ({ locale, ticker })));
}

function resolve(raw: string): Ticker | null {
  const upper = raw.toUpperCase();
  return isTicker(upper) ? (upper as Ticker) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, ticker } = await params;
  const key = resolve(ticker);
  if (!key) return {};

  const t = await getTranslations({ locale, namespace: 'academy.practice' });

  return pageMetadata({
    href: { pathname: '/academy/practice/[ticker]', params: { ticker: key } },
    locale,
    title: `${pick(SYMBOLS[key].name, locale)} — ${t('modeBeginner')}`,
    description: t('banner'),
  });
}

export default async function AcademyPracticePage({ params }: Props) {
  const { locale, ticker } = await params;
  setRequestLocale(locale);

  const key = resolve(ticker);
  if (!key) notFound();

  const t = await getTranslations('academy');

  return (
    <div className={styles.wrap}>
      <Link
        className={styles.backHome}
        href={{ pathname: '/academy/lesson/[slug]', params: { slug: FIRST_LESSON.slug } }}
      >
        {t('lesson.askClose')}
      </Link>

      <PracticeSymbol ticker={key} />
    </div>
  );
}
