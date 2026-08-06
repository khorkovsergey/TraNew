import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { SpaceBackdrop } from '@/components/shell/SpaceBackdrop';
import { Icon } from '@/components/ui/Icon';
import { ASSET_CLASSES, assetClass } from '@/content/assetClasses';
import { STARTERS } from '@/content/explore';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { compareHref } from '@/lib/explore/compareLink';
import { pageMetadata } from '@/lib/metadata';
import { wave } from '@/lib/wave';
import styles from '@/components/explore/Options.module.css';

/**
 * The catalogue behind "See all options".
 *
 * That link used to open an empty research page. This lists every category and
 * every product shape the portal describes, and each card carries the two
 * things somebody wants from it: understand this, or put it beside something
 * else.
 */

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    href: '/explore/options',
    locale,
    title: 'Every way to invest, explained',
    description:
      'The categories money can go into and the products people usually start from — what each is, what it risks, and how they compare.',
  });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <SpaceBackdrop tone={4} />

      <div className={styles.page}>
        <Link className={styles.back} href="/explore">
          <Icon name="arrowLeft" size={14} strokeWidth={2.2} />
          Explore
        </Link>

        <h1 className={styles.h1}>Every option, in one list</h1>
        <p className={styles.lead}>
          Six categories money can go into, and the product shapes people usually start from. Each
          one opens an explanation, or a comparison against its closest alternatives.
        </p>

        <section className={styles.section}>
          <h2 className={styles.h2}>Categories</h2>
          <div className={styles.grid}>
            {ASSET_CLASSES.map((entry) => (
              <div key={entry.key} className={styles.card}>
                <Icon
                  name={entry.icon}
                  size={24}
                  strokeWidth={1.8}
                  className={styles[`accent_${entry.accent}`]}
                />
                <div className={styles.cardName}>{entry.name}</div>
                <div className={styles.cardText}>{entry.tagline}</div>
                <div className={styles.ctas}>
                  <Link
                    className={styles.cta}
                    href={{ pathname: '/explore/[class]', params: { class: entry.key } }}
                    prefetch={false}
                  >
                    Understand
                  </Link>
                  <Link className={styles.cta} href={compareHref(entry.key)} prefetch={false}>
                    Compare
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Where people usually start</h2>
          <p className={styles.sectionSub}>
            Product shapes rather than categories. Each one belongs to a category above.
          </p>

          <div className={styles.grid}>
            {STARTERS.map((starter) => {
              const entry = assetClass(starter.klass);
              return (
                <div key={starter.name} className={styles.card}>
                  <div className={styles.starterTop}>
                    <div className={styles.cardName}>{starter.name}</div>
                    {/* Dashed and dimmed everywhere, so an invented shape is
                        never mistaken for a price. */}
                    <svg viewBox="0 0 64 26" className={styles.spark} aria-hidden="true">
                      <polyline
                        points={wave(starter.seed, 14, 64, 26)}
                        fill="none"
                        stroke="var(--tn-text-faint)"
                        strokeWidth="1.6"
                        strokeDasharray="3 3"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <div className={styles.cardText}>{starter.text}</div>
                  <span className={`${styles.badge} ${styles[`tag_${starter.accent}`]}`}>
                    {starter.badge}
                  </span>
                  <div className={styles.ctas}>
                    <Link
                      className={styles.cta}
                      href={{ pathname: '/explore/[class]', params: { class: starter.klass } }}
                      prefetch={false}
                    >
                      Understand
                    </Link>
                    <Link className={styles.cta} href={compareHref(starter.klass)} prefetch={false}>
                      Compare
                    </Link>
                  </div>
                  <div className={styles.cardMeta}>Illustrative shape · {entry?.name}</div>
                </div>
              );
            })}
          </div>
        </section>

        <p className={styles.disclaimer}>
          A list of categories, not a list of recommendations. Nothing here takes account of your
          circumstances.
        </p>
      </div>
    </>
  );
}
