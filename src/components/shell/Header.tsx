'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { requestSearchFocus } from '@/lib/searchFocus';
import { AuthedActions } from './AuthedActions';
import { useLoginModal } from './LoginModalProvider';
import { MENUS, NAV_ACTIVE_PREFIXES, type MenuEntry, type NavKey } from './menu';
import styles from './Header.module.css';

const NAV_KEYS: NavKey[] = ['home', 'market', 'symbols', 'economy', 'community', 'marketplace'];

export function Header() {
  const t = useTranslations('header');
  const tMenu = useTranslations('menu');
  const pathname = usePathname();
  const { openLogin, authed } = useLoginModal();

  const [openMenu, setOpenMenu] = useState<NavKey | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggers = useRef<Partial<Record<NavKey, HTMLButtonElement | null>>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelLeft, setPanelLeft] = useState<number | null>(null);

  /*
   * A dropdown belongs under the thing that opened it. The panel is fixed, so
   * that means measuring the trigger and writing a pixel `left` — and clamping
   * it, because the Marketplace item sits near the right edge and its panel
   * would otherwise hang off the screen at narrow widths.
   */
  const placePanel = useCallback(() => {
    if (!openMenu) return;
    const trigger = triggers.current[openMenu];
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const anchor = trigger.getBoundingClientRect();
    const width = panel.offsetWidth;
    const margin = 12;
    const centred = anchor.left + anchor.width / 2 - width / 2;
    const rightmost = Math.max(margin, window.innerWidth - width - margin);

    setPanelLeft(Math.round(Math.min(Math.max(centred, margin), rightmost)));
  }, [openMenu]);

  // Before paint, so the panel is never seen at the position it starts from.
  useLayoutEffect(placePanel, [placePanel]);

  useEffect(() => {
    if (!openMenu) return;
    window.addEventListener('resize', placePanel);
    return () => window.removeEventListener('resize', placePanel);
  }, [openMenu, placePanel]);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const closeAll = () => {
    cancelClose();
    setOpenMenu(null);
  };

  /*
   * Closing when the pointer leaves.
   *
   * Without this the panel stays open until something is clicked, which is why it
   * felt like it had to be dismissed rather than simply left. The delay matters:
   * the panel sits below the header, so a diagonal path from a nav item to the
   * panel crosses a gap where the pointer is inside neither. Closing instantly
   * would snatch the menu away mid-reach.
   *
   * Pointer only — a touch never "leaves", so on a phone the scrim and the
   * trigger stay the way out.
   */
  const scheduleClose = (event: React.PointerEvent) => {
    if (event.pointerType === 'touch') return;
    cancelClose();
    closeTimer.current = setTimeout(() => setOpenMenu(null), 220);
  };

  useEffect(() => cancelClose, []);

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
        <div className={styles.menuItemLabel}>
          {label}
          {/* Said before the click rather than after it. The destination still
              exists and still explains itself — this only stops the menu from
              implying the screen is finished. */}
          {entry.soon && <span className={styles.soon}>Soon</span>}
        </div>
        {sub && <div className={styles.menuItemSub}>{sub}</div>}
      </>
    );

    if (entry.kind === 'route') {
      return (
        <Link
          key={index}
          className={styles.menuItem}
          href={
            { pathname: entry.href, params: entry.params, query: entry.query } as never
          }
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
      {/* Header and panel share one pointer region so leaving either closes the
          menu. The scrim stays outside it: a full-viewport child would mean the
          pointer never leaves, and the close would never fire. */}
      <div
        className={styles.headerDock}
        onPointerLeave={scheduleClose}
        onPointerEnter={cancelClose}
      >
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
                  ref={(element) => {
                    triggers.current[key] = element;
                  }}
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
            {/* Signed in, the two anonymous CTAs give way to notifications and the avatar. */}
            {authed ? (
              <AuthedActions />
            ) : (
              <>
                <button className={styles.loginButton} onClick={openLogin}>
                  {t('login')}
                </button>

                <Link className={styles.openButton} href="/start" onClick={closeAll}>
                  {t('openApp')}
                </Link>
              </>
            )}
          </div>
        </header>

        {openMenu && (
          <div
            ref={panelRef}
            className={`${styles.panel} ${styles.menuPanel}`}
            style={panelLeft === null ? undefined : { left: panelLeft }}
          >
            {MENUS[openMenu as Exclude<NavKey, 'home'>].map((group) => (
              <div className={styles.group} key={group.titleKey}>
                <div className={styles.groupTitle}>{tMenu(group.titleKey)}</div>
                <div className={styles.groupItems}>{group.items.map(renderEntry)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {openMenu && <div className={styles.scrim} onClick={closeAll} />}
    </>
  );
}
