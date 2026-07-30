'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { locales, type Locale } from '@/i18n/routing';
import { requestSearchFocus } from '@/lib/searchFocus';
import { useLoginModal } from './LoginModalProvider';
import { MENUS, NAV_ACTIVE_PREFIXES, type MenuEntry, type NavKey } from './menu';
import styles from './Header.module.css';

const NAV_KEYS: NavKey[] = ['home', 'market', 'symbols', 'economy', 'community', 'marketplace'];

const LOCALE_LABELS: Record<Locale, string> = { en: 'English', ru: 'Русский' };
const LOCALE_CODES: Record<Locale, string> = { en: 'EN', ru: 'RU' };

export function Header() {
  const t = useTranslations('header');
  const tMenu = useTranslations('menu');
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const { openLogin } = useLoginModal();

  const [openMenu, setOpenMenu] = useState<NavKey | null>(null);
  const [langOpen, setLangOpen] = useState(false);

  const closeAll = () => {
    setOpenMenu(null);
    setLangOpen(false);
  };

  useEffect(() => {
    if (!openMenu && !langOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAll();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openMenu, langOpen]);

  const isActive = (key: NavKey) => {
    if (key === 'home') return pathname === '/';
    return NAV_ACTIVE_PREFIXES[key].some((prefix) => pathname.startsWith(prefix));
  };

  const switchLocale = (next: Locale) => {
    closeAll();
    if (next === locale) return;
    // next-intl rewrites the pathname to the target locale's slug for us.
    router.replace({ pathname, params } as never, { locale: next });
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
                onClick={() => {
                  setLangOpen(false);
                  setOpenMenu((current) => (current === key ? null : key));
                }}
              >
                {t(`nav.${key}`)}
              </button>
            );
          })}
        </nav>

        <div className={styles.actions}>
          <button
            className={styles.globeButton}
            aria-expanded={langOpen}
            aria-haspopup="true"
            aria-label={t('languageRegion')}
            onClick={() => {
              setOpenMenu(null);
              setLangOpen((current) => !current);
            }}
          >
            <Icon name="globe" size={17} />
            {LOCALE_CODES[locale]}
          </button>

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

      {langOpen && (
        <>
          <div className={styles.scrim} onClick={closeAll} />
          <div className={`${styles.panel} ${styles.langPanel}`}>
            <div className={styles.groupTitle}>{tMenu('globe.interfaceLanguage')}</div>
            <div className={styles.langSegments}>
              {locales.map((candidate) => (
                <button
                  key={candidate}
                  className={`${styles.langSegment} ${
                    candidate === locale ? styles.langSegmentActive : ''
                  }`}
                  onClick={() => switchLocale(candidate)}
                >
                  {LOCALE_LABELS[candidate]}
                </button>
              ))}
            </div>

            <div className={styles.regionRows}>
              {(
                [
                  ['globe.region', 'globe.regionValue'],
                  ['globe.marketDataRegion', 'globe.marketDataValue'],
                  ['globe.currency', 'globe.currencyValue'],
                  ['globe.timezone', 'globe.timezoneValue'],
                ] as const
              ).map(([keyKey, valueKey]) => (
                <div className={styles.regionRow} key={keyKey}>
                  <span className={styles.regionKey}>{tMenu(keyKey)}</span>
                  <span className={styles.regionValue}>{tMenu(valueKey)}</span>
                </div>
              ))}
            </div>

            <div className={styles.langNote}>{tMenu('globe.note')}</div>
          </div>
        </>
      )}
    </>
  );
}
