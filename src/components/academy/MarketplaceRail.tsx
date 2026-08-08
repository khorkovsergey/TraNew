import { Icon, type IconName } from '@/components/ui/Icon';
import { Link } from '@/i18n/navigation';
import type { StaticPathname } from '@/i18n/routing';
import styles from './Courses.module.css';

/**
 * The Marketplace side navigation.
 *
 * Every destination is a route that already exists — the rail names the
 * marketplace's parts, it does not invent them.
 */

const ITEMS: Array<{ label: string; href: StaticPathname; icon: IconName }> = [
  { label: 'Overview', href: '/marketplace', icon: 'layers' },
  { label: 'Expert services', href: '/marketplace/experts', icon: 'users' },
  { label: 'Events near you', href: '/events', icon: 'calendar' },
  { label: 'Academy', href: '/marketplace/academy', icon: 'grad' },
  { label: 'Subscriptions', href: '/marketplace/subscriptions', icon: 'wallet' },
  { label: 'Tools and data', href: '/marketplace/tools', icon: 'bars' },
];

export function MarketplaceRail({ active }: { active: StaticPathname }) {
  return (
    <aside className={styles.rail}>
      <div className={styles.railLabel}>MARKETPLACE</div>

      <nav className={styles.railList} aria-label="Marketplace">
        {ITEMS.map((item) => {
          const current = item.href === active;
          return (
            <Link
              key={item.href}
              className={`${styles.railItem} ${current ? styles.railItemActive : ''}`}
              href={item.href}
              aria-current={current ? 'page' : undefined}
              prefetch={false}
            >
              <Icon name={item.icon} size={17} strokeWidth={1.9} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className={styles.railCard}>
        <div className={styles.railCardHead}>
          <Icon name="bulb" size={17} strokeWidth={2} />
          Why Academy?
        </div>
        <div className={styles.railCardText}>
          Structured, paid programmes from vetted providers — beyond the free explainers in Learn.
        </div>
        <Link className={styles.railCardLink} href="/academy" prefetch={false}>
          Free content is in Learn
        </Link>
      </div>
    </aside>
  );
}
