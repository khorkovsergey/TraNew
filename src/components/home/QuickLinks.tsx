'use client';

import { useTranslations } from 'next-intl';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Link } from '@/i18n/navigation';
import type { StaticPathname } from '@/i18n/routing';
import { requestSearchFocus } from '@/lib/searchFocus';
import styles from './Home.module.css';

type QuickLink = {
  key: 'research' | 'today' | 'ideas' | 'portfolio' | 'charts';
  href: StaticPathname;
  icon: IconName;
  iconColor: string;
  accent?: boolean;
  focusSearch?: boolean;
};

const LINKS: QuickLink[] = [
  { key: 'research', href: '/', icon: 'search', iconColor: 'var(--tn-blue)', focusSearch: true },
  { key: 'today', href: '/market/brief', icon: 'bars', iconColor: 'var(--tn-purple)' },
  { key: 'ideas', href: '/ideas', icon: 'bulb', iconColor: 'var(--tn-orange-star)' },
  { key: 'portfolio', href: '/portfolio', icon: 'pie', iconColor: 'var(--tn-green)' },
  { key: 'charts', href: '/supercharts', icon: 'chart', iconColor: 'var(--tn-blue)', accent: true },
];

export function QuickLinks() {
  const t = useTranslations('home.quick');

  return (
    <div className={styles.quickRow}>
      {LINKS.map((link) => (
        <Link
          key={link.key}
          className={`${styles.quickChip} ${link.accent ? styles.quickChipAccent : ''}`}
          href={link.href}
          onClick={link.focusSearch ? requestSearchFocus : undefined}
        >
          <Icon name={link.icon} size={18} style={{ color: link.iconColor }} />
          {t(link.key)}
        </Link>
      ))}
    </div>
  );
}
