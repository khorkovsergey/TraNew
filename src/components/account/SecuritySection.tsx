'use client';

import { useState } from 'react';
import { authClient } from '@/lib/authClient';
import styles from './Account.module.css';

export type DeviceSession = {
  id: string;
  token: string;
  createdAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  current: boolean;
};

/** Turns a user-agent string into something a person can recognise. */
function describe(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Safari\//.test(userAgent)
        ? 'Safari'
        : /Firefox\//.test(userAgent)
          ? 'Firefox'
          : 'Browser';
  const os = /Windows/.test(userAgent)
    ? 'Windows'
    : /Macintosh|Mac OS/.test(userAgent)
      ? 'macOS'
      : /iPhone|iPad/.test(userAgent)
        ? 'iOS'
        : /Android/.test(userAgent)
          ? 'Android'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : 'Unknown OS';
  return `${browser} on ${os}`;
}

/**
 * Active sessions with a real revoke. Because sessions are database rows, revoking
 * one ends it server-side immediately — it does not merely hide it from this list.
 */
export function SecuritySection({ sessions }: { sessions: DeviceSession[] }) {
  const [revoked, setRevoked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const revoke = async (token: string) => {
    setBusy(true);
    await authClient.revokeSession({ token });
    setRevoked((current) => ({ ...current, [token]: true }));
    setBusy(false);
  };

  const revokeOthers = async () => {
    setBusy(true);
    await authClient.revokeOtherSessions();
    const next: Record<string, boolean> = {};
    for (const item of sessions) if (!item.current) next[item.token] = true;
    setRevoked(next);
    setBusy(false);
  };

  const signOutEverywhere = async () => {
    setBusy(true);
    await authClient.revokeSessions();
    await authClient.signOut();
    window.location.href = '/en/sign-in';
  };

  return (
    <div className={styles.card} style={{ marginTop: 18 }}>
      <div className={styles.cardTitle}>Active sessions</div>
      <div className={styles.note} style={{ marginTop: 6 }}>
        Each row is a signed-in device. Revoking one ends that session on the server, not just
        on this screen.
      </div>

      <div className={styles.stack}>
        {sessions.map((item) => {
          const isRevoked = revoked[item.token];
          return (
            <div className={styles.row} key={item.id}>
              <span>
                <span className={styles.itemTitle}>
                  {describe(item.userAgent)}
                  {item.current && <span className={styles.typeChip} style={{ marginLeft: 8 }}>This device</span>}
                </span>
                <span className={styles.itemMeta}>
                  {item.ipAddress ?? 'IP unknown'} · signed in {new Date(item.createdAt).toLocaleString()}
                </span>
              </span>
              {!item.current && (
                <button
                  className={styles.dangerAction}
                  disabled={busy || isRevoked}
                  onClick={() => revoke(item.token)}
                >
                  {isRevoked ? 'Revoked' : 'Revoke'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.filters}>
        <button className={styles.filter} disabled={busy} onClick={revokeOthers}>
          Log out other devices
        </button>
        <button className={styles.filter} disabled={busy} onClick={signOutEverywhere}>
          Log out everywhere, including this one
        </button>
      </div>
    </div>
  );
}
