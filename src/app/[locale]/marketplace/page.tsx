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

/*
 * The four categories, and the same four destinations the Marketplace menu uses.
 *
 * They had drifted apart: three of the four led somewhere different depending on
 * whether you arrived through the menu or through this page, and Merchandise —
 * "physical goods and limited editions" — opened the page about choosing a
 * broker. Two lists describing one thing will always end up disagreeing, so
 * changing a destination now means changing it here and in `menu.ts`, and the
 * verification script compares the two.
 *
 * Merchandise has no `href` in either list. The store does not exist, and the
 * placeholder screen it used to open was a click spent to be told so; the card
 * names the category and says "Soon" without being clickable.
 */
const CATEGORIES: Array<{
  key: 'expert' | 'tools' | 'learning' | 'merch' | 'subscriptions';
  /** Absent when the category has no screen behind it at all. */
  href?: StaticPathname;
  icon: IconName;
  color: string;
  tile: string;
  /** Carries the "Soon" badge. */
  soon?: boolean;
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
    href: '/marketplace/tools',
    icon: 'bars',
    color: 'var(--tn-purple)',
    tile: 'var(--tn-purple-tint)',
  },
  {
    key: 'learning',
    href: '/learning-events',
    icon: 'grad',
    color: 'var(--tn-green)',
    tile: 'var(--tn-green-tint)',
  },
  {
    key: 'subscriptions',
    href: '/marketplace/subscriptions',
    icon: 'shield',
    color: 'var(--tn-purple)',
    tile: 'var(--tn-purple-tint)',
  },
  {
    key: 'merch',
    icon: 'star',
    color: 'var(--tn-orange)',
    tile: 'var(--tn-orange-tint)',
    soon: true,
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
        {CATEGORIES.map((category) => {
          const body = (
            <>
              <div className={styles.categoryIcon} style={{ background: category.tile }}>
                <Icon
                  name={category.icon}
                  size={22}
                  strokeWidth={1.9}
                  style={{ color: category.color }}
                />
              </div>
              <div className={styles.taskTitle}>
                {t(`${category.key}Title`)}
                {category.soon && <span className={styles.soon}>Soon</span>}
              </div>
              <div className={styles.taskDesc}>{t(`${category.key}Text`)}</div>
              {/* The arrow is a promise about what the click does, so it only
                  appears on the cards that click. */}
              <span
                className={`${styles.categoryCta} ${category.href ? '' : styles.categoryCtaInert}`}
              >
                {t(`${category.key}Cta`)}
                {category.href && ' →'}
              </span>
            </>
          );

          return category.href ? (
            <Link className={styles.taskCard} href={category.href as never} key={category.key}>
              {body}
            </Link>
          ) : (
            <div
              className={`${styles.taskCard} ${styles.taskCardInert}`}
              aria-disabled="true"
              key={category.key}
            >
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
