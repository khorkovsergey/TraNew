import { Icon, type IconName } from '@/components/ui/Icon';
import { Link } from '@/i18n/navigation';
import type { StaticPathname } from '@/i18n/routing';
import styles from './Tools.module.css';

/**
 * The Marketplace rail.
 *
 * Every entry goes somewhere that exists. The mockup's rail also carried
 * "Publish", a Developer Hub, Pine Script docs and a TNW balance card; none of
 * those has anything behind it in this portal, and a rail of links to nothing is
 * a menu that teaches people the product is broken. What is missing is said in
 * one line at the bottom instead, which is smaller and true.
 */

export type RailKey =
  | 'overview'
  | 'experts'
  | 'tools'
  | 'chart-market'
  | 'supercharts'
  | 'academy'
  | 'events'
  | 'subscriptions'
  | 'purchases';

const ITEMS: Array<{ key: RailKey; label: string; href: StaticPathname; icon: IconName }> = [
  { key: 'overview', label: 'Overview', href: '/marketplace', icon: 'layers' },
  { key: 'experts', label: 'Expert services', href: '/marketplace/experts', icon: 'users' },
  { key: 'tools', label: 'Tools & Data', href: '/marketplace/tools', icon: 'bars' },
  {
    key: 'chart-market',
    label: 'Chart Market',
    href: '/marketplace/tools/chart-market',
    icon: 'flask',
  },
  {
    key: 'supercharts',
    label: 'Supercharts',
    href: '/marketplace/tools/supercharts',
    icon: 'chart',
  },
  { key: 'academy', label: 'Academy', href: '/academy', icon: 'grad' },
  { key: 'events', label: 'Events near you', href: '/events', icon: 'calendar' },
  { key: 'subscriptions', label: 'Subscriptions', href: '/marketplace/subscriptions', icon: 'wallet' },
  { key: 'purchases', label: 'My purchases', href: '/account/purchases', icon: 'bookmark' },
];

export function ToolsRail({ active }: { active: RailKey }) {
  return (
    <nav className={styles.rail} aria-label="Marketplace sections">
      <div className={styles.railTitle}>Marketplace</div>

      {ITEMS.map((item) => (
        <Link
          key={item.key}
          className={`${styles.railLink} ${item.key === active ? styles.railLinkOn : ''}`}
          href={item.href}
          aria-current={item.key === active ? 'page' : undefined}
        >
          <Icon name={item.icon} size={16} strokeWidth={1.9} />
          {item.label}
        </Link>
      ))}

      <div className={styles.railDivider} />
      <p className={styles.railNote}>
        Publishing your own scripts, a developer hub and Pine Script reference are not part of the
        portal yet.
      </p>
    </nav>
  );
}
