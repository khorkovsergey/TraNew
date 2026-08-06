'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/Icon';
import { Link, usePathname } from '@/i18n/navigation';
import { requestSearchFocus } from '@/lib/searchFocus';
import { AuthedActions } from './AuthedActions';
import { useLoginModal } from './LoginModalProvider';
import { MENUS, type MenuEntry } from './menu';
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
  const tMenu = useTranslations('menu');
  const pathname = usePathname();
  const { openLogin, authed } = useLoginModal();

  const [mpOpen, setMpOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = useRef<HTMLButtonElement>(null);
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
    if (!mpOpen) return;
    const anchor = trigger.current?.getBoundingClientRect();
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const width = panel.offsetWidth;
    const margin = 12;
    const centred = anchor.left + anchor.width / 2 - width / 2;
    const rightmost = Math.max(margin, window.innerWidth - width - margin);

    setPanelLeft(Math.round(Math.min(Math.max(centred, margin), rightmost)));
  }, [mpOpen]);

  // Before paint, so the panel is never seen at the position it starts from.
  useLayoutEffect(placePanel, [placePanel]);

  useEffect(() => {
    if (!mpOpen) return;
    window.addEventListener('resize', placePanel);
    return () => window.removeEventListener('resize', placePanel);
  }, [mpOpen, placePanel]);

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
    setMpOpen(false);
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
    closeTimer.current = setTimeout(() => setMpOpen(false), 220);
  };

  useEffect(() => cancelClose, []);

  useEffect(() => {
    if (!mpOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAll();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mpOpen, closeAll]);

  const renderEntry = (entry: MenuEntry, index: number) => {
    const label = tMenu(entry.labelKey);
    const sub = entry.subKey ? tMenu(entry.subKey) : null;
    const body = (
      <>
        <div className={styles.menuItemLabel}>
          {label}
          {/* Said before the click rather than after it. */}
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
            {items.map((item) => (
              <Link
                key={item.key}
                className={`${styles.navItem} ${active === item.key ? styles.navItemActive : ''}`}
                href={item.href}
                aria-current={active === item.key ? 'page' : undefined}
                onClick={closeAll}
              >
                {t(`nav.${item.labelKey}`)}
              </Link>
            ))}

            <button
              ref={trigger}
              className={`${styles.navItem} ${styles.navTrigger} ${
                active === 'marketplace' || mpOpen ? styles.navItemActive : ''
              }`}
              aria-expanded={mpOpen}
              aria-haspopup="true"
              onClick={() => setMpOpen((open) => !open)}
            >
              {t('nav.marketplace')}
              <Icon name="chevronDown" size={12} strokeWidth={2.4} />
            </button>
          </nav>

          <div className={styles.actions}>
            <button
              className={styles.iconButton}
              aria-label={t('search')}
              onClick={() => {
                closeAll();
                requestSearchFocus();
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

        {mpOpen && (
          <div
            ref={panelRef}
            className={styles.panel}
            style={panelLeft === null ? undefined : { left: panelLeft }}
          >
            {MENUS.marketplace.map((group) => (
              <div className={styles.group} key={group.titleKey}>
                <div className={styles.groupTitle}>{tMenu(group.titleKey)}</div>
                <div className={styles.groupItems}>{group.items.map(renderEntry)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {mpOpen && <div className={styles.scrim} onClick={closeAll} />}
    </>
  );
}
