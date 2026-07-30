import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Link } from '@/i18n/navigation';
import type { Locale, StaticPathname } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/marketplace/Marketplace.module.css';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'screens' });

  return pageMetadata({
    href: '/marketplace',
    locale,
    title: t('marketplace.title'),
    description: t('marketplace.subtitle'),
  });
}

const CATEGORIES: Array<{
  key: 'expert' | 'tools' | 'learning' | 'merch';
  href: StaticPathname;
  icon: IconName;
  color: string;
  tile: string;
}> = [
  {
    key: 'expert',
    href: '/marketplace/experts',
    icon: 'user',
    color: 'var(--tn-blue)',
    tile: 'var(--tn-blue-tint)',
  },
  {
    key: 'tools',
    href: '/tools',
    icon: 'bars',
    color: 'var(--tn-purple)',
    tile: 'var(--tn-purple-tint)',
  },
  {
    key: 'learning',
    href: '/academy',
    icon: 'grad',
    color: 'var(--tn-green)',
    tile: 'var(--tn-green-tint)',
  },
  {
    key: 'merch',
    href: '/brokers',
    icon: 'star',
    color: 'var(--tn-orange)',
    tile: 'var(--tn-orange-tint)',
  },
];

export default async function MarketplaceHubPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('marketplace.hub');
  const tScreens = await getTranslations('screens');
  const tCommon = await getTranslations('common');

  return (
    <div className={styles.wrap}>
      <Link className={styles.backHome} href="/">
        {tCommon('backHome')}
      </Link>

      <h1 className={styles.h1} style={{ marginTop: 0 }}>
        {tScreens('marketplace.title')}
      </h1>
      <p className={styles.lead}>{tScreens('marketplace.subtitle')}</p>

      <div className={styles.cardGrid}>
        {CATEGORIES.map((category) => (
          <Link className={styles.taskCard} href={category.href} key={category.key}>
            <div className={styles.categoryIcon} style={{ background: category.tile }}>
              <Icon
                name={category.icon}
                size={22}
                strokeWidth={1.9}
                style={{ color: category.color }}
              />
            </div>
            <div className={styles.taskTitle}>{t(`${category.key}Title`)}</div>
            <div className={styles.taskDesc}>{t(`${category.key}Text`)}</div>
            <span className={styles.categoryCta}>{t(`${category.key}Cta`)} →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
