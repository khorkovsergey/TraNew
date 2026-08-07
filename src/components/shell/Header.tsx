'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { SearchForm } from '@/components/shared/SearchForm';
import { Icon } from '@/components/ui/Icon';
import { Link, usePathname } from '@/i18n/navigation';
import { AuthedActions } from './AuthedActions';
import { useLoginModal } from './LoginModalProvider';
import { MENUS, type MenuEntry, type MenuKey } from './menu';
import { AUTHED_NAV, GUEST_NAV, activeNavKey } from './nav';
import styles from './Header.module.css';

/**
 * The shared shell.
 *
 * Marketplace is the only dropdown left. The other five headings became
 * destinations, which is the point of the redesign: a beginner should be able to
 * read the top of the page rather than navigate it.
 */
export function Header() {
  const t = useTranslations('header');
  const pathname = usePathname();
  const { openLogin, authed } = useLoginModal();

  /** Which section's dropdown is open, if any. One at a time. */
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggers = useRef<Partial<Record<MenuKey, HTMLButtonElement | null>>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelLeft, setPanelLeft] = useState<number | null>(null);

  const items = authed ? AUTHED_NAV : GUEST_NAV;
  const active = activeNavKey(items, pathname);

  /*
   * A dropdown belongs under the thing that opened it. The panel is fixed, so
   * that means measuring the trigger and writing a pixel `left` — and clamping
   * it, because Marketplace sits near the right edge and its panel would
   * otherwise hang off the screen at narrow widths.
   */
  const placePanel = useCallback(() => {
    if (!openMenu) return;
    const anchor = triggers.current[openMenu]?.getBoundingClientRect();
    const panel = panelRef.current;
    if (!anchor || !panel) return;

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

  const closeAll = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpenMenu(null);
  }, []);

  /*
   * Closing when the pointer leaves, with a delay: the panel sits below the
   * header, so a diagonal path from the trigger to the panel crosses a gap where
   * the pointer is inside neither. Closing instantly would snatch the menu away
   * mid-reach. Pointer only — a touch never "leaves".
   */
  const scheduleClose = (event: React.PointerEvent) => {
    if (event.pointerType === 'touch') return;
    cancelClose();
    closeTimer.current = setTimeout(() => setOpenMenu(null), 220);
  };

  useEffect(() => cancelClose, []);

  useEffect(() => {
    if (!openMenu && !searchOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      closeAll();
      setSearchOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openMenu, searchOpen, closeAll]);

  const renderEntry = (entry: MenuEntry, index: number) => {
    const body = (
      <>
        <div className={styles.menuItemLabel}>
          {entry.label}
          {/* Said before the click rather than after it. */}
          {entry.soon && <span className={styles.soon}>Soon</span>}
        </div>
        {entry.sub && <div className={styles.menuItemSub}>{entry.sub}</div>}
      </>
    );

    // Named, and that is all. Not a link, not a button, not focusable — the
    // "Soon" badge is the whole entry.
    if (entry.kind === 'inert') {
      return (
        <div
          key={index}
          className={`${styles.menuItem} ${styles.menuItemInert}`}
          aria-disabled="true"
        >
          {body}
        </div>
      );
    }

    if (entry.kind === 'route') {
      return (
        <Link
          key={index}
          className={styles.menuItem}
          href={{ pathname: entry.href, params: entry.params, query: entry.query } as never}
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
      <Link key={index} className={styles.menuItem} href="/research" onClick={closeAll}>
        {body}
      </Link>
    );
  };

  return (
    <>
      {/* Header and panel share one pointer region so leaving either closes the
          menu. The scrim stays outside it: a full-viewport child would mean the
          pointer never leaves, and the close would never fire. */}
      <div className={styles.headerDock} onPointerLeave={scheduleClose} onPointerEnter={cancelClose}>
        <header className={styles.header}>
          <Link className={styles.logo} href="/" aria-label={t('homeLink')} onClick={closeAll}>
            {/* The mark is a rising line that turns into an arrow — the mint
                stroke is the line, the blue one the corner it leaves through. */}
            <svg
              className={styles.mark}
              width="30"
              height="30"
              viewBox="0 0 32 32"
              fill="none"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M4 22 L12 13 L18 18 L28 7"
                stroke="var(--tn-mint)"
                strokeWidth="3.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M21 7h7v7"
                stroke="var(--tn-blue)"
                strokeWidth="3.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className={styles.wordmark}>TradingNew</span>
          </Link>

          <nav className={styles.nav} aria-label={t('nav.home')}>
            {items.map((item) => {
              const on = active === item.key || (item.menu && openMenu === item.menu);
              const className = `${styles.navItem} ${on ? styles.navItemActive : ''}`;

              /*
               * A section with a dropdown is a button, not a link. The section
               * itself is the first entry inside its menu, so nothing became
               * unreachable — but a label that both navigates and opens a panel
               * is a control nobody can predict, and on a touch screen it fires
               * both at once.
               */
              if (item.menu) {
                const menuKey = item.menu;
                return (
                  <button
                    key={item.key}
                    ref={(element) => {
                      triggers.current[menuKey] = element;
                    }}
                    className={`${className} ${styles.navTrigger}`}
                    aria-expanded={openMenu === menuKey}
                    aria-haspopup="true"
                    onClick={() =>
                      setOpenMenu((current) => (current === menuKey ? null : menuKey))
                    }
                  >
                    {t(`nav.${item.labelKey}`)}
                    <Icon name="chevronDown" size={12} strokeWidth={2.4} />
                  </button>
                );
              }

              return (
                <Link
                  key={item.key}
                  className={className}
                  href={item.href}
                  aria-current={active === item.key ? 'page' : undefined}
                  onClick={closeAll}
                >
                  {t(`nav.${item.labelKey}`)}
                </Link>
              );
            })}
          </nav>

          <div className={styles.actions}>
            {/*
              * An overlay with a real field, rather than a jump to another page.
              * Sending somebody to a search screen to type is asking them to
              * leave the thing they were reading in order to look something up
              * about it.
              */}
            <button
              className={styles.iconButton}
              aria-label={t('search')}
              aria-expanded={searchOpen}
              onClick={() => {
                closeAll();
                setSearchOpen(true);
              }}
            >
              <Icon name="search" size={17} strokeWidth={2.2} />
            </button>

            {/* Signed in, the two anonymous CTAs give way to saved, notifications
                and the avatar. */}
            {authed ? (
              <AuthedActions />
            ) : (
              <>
                <button className={styles.loginButton} onClick={openLogin}>
                  {t('login')}
                </button>

                <Link className={styles.startButton} href="/start" onClick={closeAll}>
                  {t('openApp')}
                </Link>
              </>
            )}
          </div>
        </header>

        {openMenu && (
          <div
            ref={panelRef}
            className={`${styles.panel} ${
              MENUS[openMenu].length > 1 ? styles.panelWide : styles.panelNarrow
            }`}
            style={panelLeft === null ? undefined : { left: panelLeft }}
          >
            {MENUS[openMenu].map((group) => (
              <div className={styles.group} key={group.title}>
                <div className={styles.groupTitle}>{group.title}</div>
                <div className={styles.groupItems}>{group.items.map(renderEntry)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {openMenu && <div className={styles.scrim} onClick={closeAll} />}

      {searchOpen && (
        <>
          <div className={styles.searchScrim} onClick={() => setSearchOpen(false)} />
          <div
            className={styles.searchPanel}
            role="dialog"
            aria-modal="true"
            aria-label={t('search')}
          >
            <SearchForm autoFocus onNavigate={() => setSearchOpen(false)} />
          </div>
        </>
      )}
    </>
  );
}
