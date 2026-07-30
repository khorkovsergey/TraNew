import 'server-only';

/**
 * Simulated integrations.
 *
 * Email delivery and social sign-in are stubbed while there is no mail provider and
 * no OAuth application. Both stubs are opt-in through environment variables, and
 * both are built so that turning them on cannot hand anyone another person's
 * account:
 *
 * - The preview mailbox is readable only with PREVIEW_MAILBOX_KEY. Verification
 *   tokens themselves stay real, single-use and time-limited.
 * - Stub social sign-in signs you in as a fixed demo account per provider. It never
 *   accepts an arbitrary address, so it cannot be used to take over a real user.
 *
 * Neither stub weakens password sign-in, session handling or route protection.
 */

export type EmailTransport = 'resend' | 'preview' | 'log';

export function emailTransport(): EmailTransport {
  if (process.env.RESEND_API_KEY) return 'resend';
  if (process.env.EMAIL_TRANSPORT === 'preview') return 'preview';
  return 'log';
}

export function isStubOAuthEnabled(): boolean {
  return process.env.OAUTH_TRANSPORT === 'stub';
}

export function previewMailboxKey(): string | null {
  return process.env.PREVIEW_MAILBOX_KEY ?? null;
}

/** Fixed demo identities. Deliberately not configurable from a request. */
export const STUB_ACCOUNTS = {
  google: { email: 'demo.google@tradingnew.space', name: 'Demo Google User' },
  apple: { email: 'demo.apple@tradingnew.space', name: 'Demo Apple User' },
} as const;

export type StubProvider = keyof typeof STUB_ACCOUNTS;

export function isStubProvider(value: string): value is StubProvider {
  return value === 'google' || value === 'apple';
}

/** True when anything on screen is simulated, so the UI can say so plainly. */
export function anyStubActive(): boolean {
  return emailTransport() !== 'resend' || isStubOAuthEnabled();
}

export function stubSummary(): string[] {
  const notes: string[] = [];
  const transport = emailTransport();

  if (transport === 'preview') {
    notes.push('Email delivery is simulated — messages land in the preview mailbox.');
  } else if (transport === 'log') {
    notes.push('Email delivery is not configured — messages are written to the server log.');
  }

  if (isStubOAuthEnabled()) {
    notes.push('Google and Apple sign-in are simulated and open a fixed demo account.');
  }

  return notes;
}
