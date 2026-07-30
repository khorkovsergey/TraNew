'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { NOTIFICATIONS, NOTIFICATION_NOTE } from '@/content/account';
import { Link } from '@/i18n/navigation';
import type { StaticPathname } from '@/i18n/routing';
import { authClient } from '@/lib/authClient';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { useLoginModal } from './LoginModalProvider';
import styles from './AuthedActions.module.css';

const MENU: Array<{ label: string; href: StaticPathname | null; danger?: boolean }> = [
  { label: 'My TradingNew', href: '/account' },
  { label: 'My Workspace', href: '/account/workspace' },
  { label: 'Copilot', href: '/account/copilot' },
  { label: 'Wealth Hub', href: '/account/wealth' },
  { label: 'Purchases', href: '/account/purchases' },
  { label: 'View Public Profile', href: '/account/settings' },
  { label: 'Settings & Billing', href: '/account/settings' },
  { label: 'Help & Support', href: null },
  { label: 'Log out', href: null, danger: true },
];

export function AuthedActions() {
  const { signOut } = useLoginModal();
  const { data: session } = authClient.useSession();
  const [notifOpen, setNotifOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [read, setRead] = useState(false);

  // Identity comes from the server session, never from a local constant.
  const user = session?.user;
  const displayName = user?.name?.trim() || user?.email?.split('@')[0] || 'Account';
  const email = user?.email ?? '';
  const initial = displayName.charAt(0).toUpperCase();
  // `plan` is a custom field on the user record; the client session type does not
  // carry it, so it is read defensively rather than assumed.
  const rawPlan = (user as unknown as { plan?: unknown } | undefined)?.plan;
  const plan = typeof rawPlan === 'string' ? rawPlan : 'free';
  const planLabel =
    plan === 'ai_private' ? 'AI Private' : plan === 'premium' ? 'Premium' : 'Free plan';

  const closeAll = () => {
    setNotifOpen(false);
    setAvatarOpen(false);
  };

  useEffect(() => {
    if (!notifOpen && !avatarOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAll();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [notifOpen, avatarOpen]);

  return (
    <>
      <button
        className={styles.bell}
        aria-label="Notifications"
        aria-expanded={notifOpen}
        onClick={() => {
          setAvatarOpen(false);
          setNotifOpen((value) => !value);
        }}
      >
        <Icon name="bell" size={19} />
        {!read && <span className={styles.unreadDot} />}
      </button>

      <button
        className={styles.avatar}
        aria-label="Account menu"
        aria-expanded={avatarOpen}
        onClick={() => {
          setNotifOpen(false);
          setAvatarOpen((value) => !value);
        }}
      >
        {initial}
      </button>

      {(notifOpen || avatarOpen) && <div className={styles.scrim} onClick={closeAll} />}

      {notifOpen && (
        <div className={styles.notifPanel}>
          <div className={styles.notifHead}>
            <span className={styles.notifTitle}>Notifications</span>
            <button className={styles.markRead} onClick={() => setRead(true)}>
              Mark all as read
            </button>
          </div>

          {NOTIFICATIONS.map((item) => (
            <button className={styles.notifRow} key={item.id} onClick={closeAll}>
              <span className={`${styles.notifDot} ${read ? styles.notifDotRead : ''}`} />
              <span>
                <span className={styles.notifItemTitle}>{item.title}</span>
                <span className={styles.notifMessage}>{item.message}</span>
                <span className={styles.notifMeta}>{item.meta}</span>
              </span>
            </button>
          ))}

          {/* The distinction the design insists on. */}
          <div className={styles.notifNote}>{NOTIFICATION_NOTE}</div>
        </div>
      )}

      {avatarOpen && (
        <div className={styles.avatarPanel}>
          <div className={styles.avatarHead}>
            <span className={styles.avatarLarge}>{initial}</span>
            <span>
              <span className={styles.avatarName}>{displayName}</span>
              <span className={styles.avatarMeta}>
                {email} · {planLabel}
              </span>
            </span>
          </div>

          {MENU.map((item) => {
            const isWealth = item.label === 'Wealth Hub';
            const wealthOff = isWealth && !FEATURE_FLAGS.wealthHubEnabled;

            if (wealthOff) {
              return (
                <span className={`${styles.menuItem} ${styles.menuItemSoon}`} key={item.label}>
                  Wealth Hub · Soon
                </span>
              );
            }

            if (item.label === 'Log out') {
              return (
                <button
                  className={`${styles.menuItem} ${styles.menuItemDanger}`}
                  key={item.label}
                  onClick={() => {
                    closeAll();
                    signOut();
                  }}
                >
                  {item.label}
                </button>
              );
            }

            return item.href ? (
              <Link className={styles.menuItem} href={item.href} key={item.label} onClick={closeAll}>
                {item.label}
              </Link>
            ) : (
              <Link
                className={styles.menuItem}
                href={{ pathname: '/tool/[slug]', params: { slug: 'help-center' } }}
                key={item.label}
                onClick={closeAll}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
