'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { SearchForm } from '@/components/shared/SearchForm';
import { Icon } from '@/components/ui/Icon';
import { Link, usePathname } from '@/i18n/navigation';
import { AuthedActions } from './AuthedActions';
import { ExploreIcon, ExploreMenuSprite } from './ExploreMenuIcons';
import { useLoginModal } from './LoginModalProvider';
import { MENUS, type MenuEntry, type MenuKey } from './menu';
import { AUTHED_NAV, GUEST_NAV, activeNavKey } from './nav';
import styles from './Header.module.css';

/**
 * The shared shell.
 *
 * Four headings carry a dropdown and the rest are plain destinations, which is
 * the point of the redesign: a beginner should be able to read the top of the
 * page rather than navigate it.
 *
 * Explore is the widest of the four and the only one whose entries do not click
 * — see `menu.ts`. Everything that makes it different is a class here, not a
 * second component: one panel that can be a list, three columns, or a
 * full-screen drawer is easier to keep honest than three that drift apart.
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
  const headerRef = useRef<HTMLElement>(null);
  const [panelLeft, setPanelLeft] = useState<number | null>(null);
  const [panelTop, setPanelTop] = useState<number | null>(null);

  const items = authed ? AUTHED_NAV : GUEST_NAV;
  const active = activeNavKey(items, pathname);

  /*
   * Explore is the wide one: three columns across the page rather than a list
   * under its own label, because it is read as a whole and a panel that hangs
   * off one trigger cannot hold it.
   */
  const mega = openMenu === 'explore';

  /*
   * A dropdown belongs under the thing that opened it. The panel is fixed, so
   * that means measuring the trigger and writing a pixel `left` — and clamping
   * it, because Marketplace sits near the right edge and its panel would
   * otherwise hang off the screen at narrow widths.
   *
   * The top is measured too, and was not before: below 860px the header wraps
   * to two rows, and a panel pinned at a hardcoded 64px opened across the
   * navigation it belongs to.
   *
   * Both are handed to CSS as custom properties rather than as inline `top` and
   * `left`. An inline value wins over every rule in the stylesheet, including
   * the media query that turns this panel into a full-screen drawer on a phone —
   * a variable lets that rule simply not read it.
   */
  const placePanel = useCallback(() => {
    if (!openMenu) return;

    const head = headerRef.current?.getBoundingClientRect();
    if (head) setPanelTop(Math.round(head.bottom + 8));

    if (mega) return;

    const anchor = triggers.current[openMenu]?.getBoundingClientRect();
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const width = panel.offsetWidth;
    const margin = 12;
    const centred = anchor.left + anchor.width / 2 - width / 2;
    const rightmost = Math.max(margin, window.innerWidth - width - margin);

    setPanelLeft(Math.round(Math.min(Math.max(centred, margin), rightmost)));
  }, [openMenu, mega]);

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
    /*
     * Every row in every menu now has a glyph, so `menuItemWide` is what a row
     * looks like rather than a variant of one. The class stays because the two
     * sources of a glyph are different elements — the Explore sprite and `Icon`
     * — and a row could still be written without either.
     */
    const row = `${styles.menuItem} ${entry.icon || entry.glyph ? styles.menuItemWide : ''}`;

    const body = (
      <>
        {(entry.icon || entry.glyph) && (
          <span className={styles.menuIcon}>
            {entry.icon ? (
              <ExploreIcon name={entry.icon} />
            ) : (
              // 21px inside a 42px box, stroke 1.6: the sprite's weight, so a
              // Learn row and an Explore row read as the same row.
              <Icon name={entry.glyph!} size={21} strokeWidth={1.6} />
            )}
          </span>
        )}
        <span className={styles.menuItemText}>
          <span className={styles.menuItemLabel}>
            {entry.label}
            {/*
              * Said before the click rather than after it — and after the label
              * rather than before, so the labels down a column stay aligned on
              * their first letter.
              */}
            {entry.soon && (
              <span className={styles.soon}>
                {/* Two spellings, one shown at a time. A 390px row has no width
                    for the long one, and CSS cannot rewrite text. */}
                <span className={styles.soonLong}>Coming soon</span>
                <span className={styles.soonShort}>Soon</span>
              </span>
            )}
          </span>
          {entry.sub && <span className={styles.menuItemSub}>{entry.sub}</span>}
        </span>
      </>
    );

    // Named, and that is all. Not a link, not a button, not focusable — the
    // badge is the whole entry, and it stays fully legible: a row nobody can
    // read is not a roadmap.
    if (entry.kind === 'inert') {
      return (
        <div key={index} className={`${row} ${styles.menuItemInert}`} aria-disabled="true">
          {body}
        </div>
      );
    }

    if (entry.kind === 'route') {
      return (
        <Link
          key={index}
          className={row}
          href={
            {
              pathname: entry.href,
              params: entry.params,
              query: entry.query,
              hash: entry.hash,
            } as never
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
          className={row}
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
      <Link key={index} className={row} href="/research" onClick={closeAll}>
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
        <header className={styles.header} ref={headerRef}>
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
              /*
               * Two conventions, never the same one.
               *
               * Where you are is mint and stays mint while a menu is open over
               * it; what you have opened is blue. They used to share a class, so
               * opening Explore from Marketplace moved the underline and the
               * page you were on stopped being marked anywhere — the menu
               * answered "what am I looking at" by erasing "where am I".
               */
              const current = active === item.key;
              const open = Boolean(item.menu) && openMenu === item.menu;
              const className = [
                styles.navItem,
                current ? styles.navItemCurrent : '',
                open ? styles.navItemOpen : '',
              ]
                .filter(Boolean)
                .join(' ');

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
                    <Icon
                      className={styles.chevron}
                      name="chevronDown"
                      size={12}
                      strokeWidth={2.4}
                    />
                  </button>
                );
              }

              /*
               * Community is TradingView's, and leaves the portal. A plain
               * anchor rather than the locale router, which would prefix an
               * absolute URL with `/en`, and a glyph that says so before the
               * click rather than after it — the tab does not come back on its
               * own, and a reader deserves to know that beforehand.
               */
              if (item.external) {
                return (
                  <a
                    key={item.key}
                    className={className}
                    href={item.external}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={closeAll}
                  >
                    {t(`nav.${item.labelKey}`)}
                    <Icon
                      className={styles.external}
                      name="arrowUpRight"
                      size={12}
                      strokeWidth={2.4}
                    />
                  </a>
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
            /*
             * Two shapes, not four. Explore is three columns across the window;
             * Ideas, Learn and Marketplace are the same panel anchored under
             * their trigger, however many groups they hold. The single-column
             * variant went with them — a menu that was narrow because it had
             * one group looked like a different component to the one beside it.
             */
            className={`${styles.panel} ${mega ? styles.panelMega : styles.panelWide}`}
            style={
              {
                '--panel-top': panelTop === null ? undefined : `${panelTop}px`,
                '--panel-left': panelLeft === null ? undefined : `${panelLeft}px`,
              } as React.CSSProperties
            }
          >
            {mega && <ExploreMenuSprite />}

            {/* Only on a phone, where the panel is the screen and needs a way
                out that is not "press the label again behind the drawer". */}
            <div className={styles.drawerHead}>
              <span className={styles.drawerTitle}>
                {t(`nav.${items.find((item) => item.menu === openMenu)?.labelKey ?? 'home'}`)}
              </span>
              <button
                className={styles.drawerClose}
                aria-label={t('closeMenu')}
                onClick={closeAll}
              >
                <Icon name="close" size={15} strokeWidth={2.2} />
              </button>
            </div>

            {MENUS[openMenu].map((group) => (
              <div className={styles.group} key={group.title}>
                {/* Both stay `div`s: `verify-header.mjs` finds the groups by
                    `div[class*="groupTitle"]`, and an element swap here is a red
                    suite in a file that is not mine to edit. */}
                <div className={styles.groupHead}>
                  <div className={styles.groupTitle}>{group.title}</div>
                  {group.hint && <div className={styles.groupHint}>{group.hint}</div>}
                </div>
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
