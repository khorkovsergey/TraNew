'use client';

import { ACCOUNT_TABS } from '@/content/account';
import { Link, usePathname } from '@/i18n/navigation';
import type { StaticPathname } from '@/i18n/routing';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { getUser } from '@/lib/accountService';
import styles from './Account.module.css';

/**
 * Account chrome: the section sidebar plus the Wealth Hub entry, which is a
 * separate product surface rather than another account section. With the flag off
 * the entry reads "Soon" and nothing else about the account changes.
 */
export function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = getUser();

  return (
    <div className={styles.wrap}>
      <Link className={styles.backHome} href="/">
        ← Home
      </Link>
      <div>
        <span className={styles.privateChip}>Private space · {user.plan}</span>
      </div>

      <div className={styles.layout}>
        <nav className={styles.sidebar}>
          {ACCOUNT_TABS.map((tab) => (
            <Link
              key={tab.id}
              className={`${styles.navItem} ${pathname === tab.href ? styles.navItemActive : ''}`}
              href={tab.href as StaticPathname}
            >
              {tab.label}
            </Link>
          ))}

          {FEATURE_FLAGS.wealthHubEnabled ? (
            <Link
              className={`${styles.navItem} ${
                pathname.startsWith('/account/wealth') ? styles.navItemActive : ''
              }`}
              href="/account/wealth"
            >
              Wealth Hub
            </Link>
          ) : (
            <span className={`${styles.navItem} ${styles.navItemSoon}`}>Wealth Hub · Soon</span>
          )}
        </nav>

        <div>{children}</div>
      </div>
    </div>
  );
}
