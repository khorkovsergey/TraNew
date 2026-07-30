'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { requestSearchFocus } from '@/lib/searchFocus';
import { useLoginModal } from './LoginModalProvider';
import { MENUS, NAV_ACTIVE_PREFIXES, type MenuEntry, type NavKey } from './menu';
import styles from './Header.module.css';

const NAV_KEYS: NavKey[] = ['home', 'market', 'symbols', 'economy', 'community', 'marketplace'];

export function Header() {
  const t = useTranslations('header');
  const tMenu = useTranslations('menu');
  const pathname = usePathname();
  const { openLogin } = useLoginModal();

  const [openMenu, setOpenMenu] = useState<NavKey | null>(null);

  const closeAll = () => {
    setOpenMenu(null);
  };

  useEffect(() => {
    if (!openMenu) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAll();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openMenu]);

  const isActive = (key: NavKey) => {
    if (key === 'home') return pathname === '/';
    return NAV_ACTIVE_PREFIXES[key].some((prefix) => pathname.startsWith(prefix));
  };

  const renderEntry = (entry: MenuEntry, index: number) => {
    const label = tMenu(entry.labelKey);
    const sub = entry.subKey ? tMenu(entry.subKey) : null;
    const body = (
      <>
        <div className={styles.menuItemLabel}>{label}</div>
        {sub && <div className={styles.menuItemSub}>{sub}</div>}
      </>
    );

    if (entry.kind === 'route') {
      return (
        <Link
          key={index}
          className={styles.menuItem}
          href={{ pathname: entry.href, params: entry.params } as never}
          onClick={closeAll}
        >
          {body}
        </Link>
      );
    }

    // Saving anything requires an account — this is the only place we ask for one.
    if (entry.kind === 'auth') {
      return (
        <button
          key={index}
          className={styles.menuItem}
          onClick={() => {
            closeAll();
            openLogin();
          }}
        >
          {body}
        </button>
      );
    }

    return (
      <Link
        key={index}
        className={styles.menuItem}
        href="/"
        onClick={() => {
          closeAll();
          requestSearchFocus();
        }}
      >
        {body}
      </Link>
    );
  };

  return (
    <>
      <header className={styles.header}>
        <Link className={styles.logo} href="/" aria-label={t('homeLink')} onClick={closeAll}>
          <span className={styles.mark} aria-hidden="true">
            TN
          </span>
          <span className={styles.wordmark}>TradingNew</span>
        </Link>

        <nav className={styles.nav} aria-label={t('nav.home')}>
          {NAV_KEYS.map((key) => {
            const className = `${styles.navItem} ${isActive(key) ? styles.navItemActive : ''}`;

            if (key === 'home') {
              return (
                <Link key={key} className={className} href="/" onClick={closeAll}>
                  {t('nav.home')}
                </Link>
              );
            }

            return (
              <button
                key={key}
                className={className}
                aria-expanded={openMenu === key}
                aria-haspopup="true"
                onClick={() => setOpenMenu((current) => (current === key ? null : key))}
              >
                {t(`nav.${key}`)}
              </button>
            );
          })}
        </nav>

        <div className={styles.actions}>
          <button className={styles.loginButton} onClick={openLogin}>
            {t('login')}
          </button>

          <Link className={styles.openButton} href="/start" onClick={closeAll}>
            {t('openApp')}
          </Link>
        </div>
      </header>

      {openMenu && (
        <>
          <div className={styles.scrim} onClick={closeAll} />
          <div className={`${styles.panel} ${styles.menuPanel}`}>
            {MENUS[openMenu as Exclude<NavKey, 'home'>].map((group) => (
              <div className={styles.group} key={group.titleKey}>
                <div className={styles.groupTitle}>{tMenu(group.titleKey)}</div>
                <div className={styles.groupItems}>{group.items.map(renderEntry)}</div>
              </div>
            ))}
          </div>
        </>
      )}

    </>
  );
}
