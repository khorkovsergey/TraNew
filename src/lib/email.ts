import 'server-only';
import { randomUUID } from 'node:crypto';
import { Resend } from 'resend';
import { db, schema } from '@/db';
import { emailTransport } from './stubMode';

/**
 * Transactional email.
 *
 * Three transports, chosen by configuration rather than by a branch in each caller:
 * a real provider when RESEND_API_KEY exists, a database-backed preview mailbox
 * when EMAIL_TRANSPORT=preview, and the server log otherwise. The message content
 * and the tokens inside it are identical in all three — only delivery differs.
 */

const FROM = process.env.EMAIL_FROM ?? 'TradingNew <noreply@tradingnew.space>';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/** Pulls the action link out of the body so the preview page can offer it. */
function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/\S+/);
  return match ? match[0] : null;
}

/**
 * Exported so other transactional senders — event notifications, organizer
 * messages — go through the same transport selection rather than each choosing
 * their own and drifting apart on which one is a stub.
 */
export async function send(to: string, subject: string, text: string) {
  const transport = emailTransport();

  if (transport === 'resend' && resend) {
    const { error } = await resend.emails.send({ from: FROM, to, subject, text });
    if (error) {
      // Surfaced rather than swallowed: a silent failure here locks people out.
      throw new Error(`Failed to send "${subject}": ${error.message}`);
    }
    return;
  }

  if (transport === 'preview') {
    await db.insert(schema.emailOutbox).values({
      id: randomUUID(),
      recipient: to,
      subject,
      body: text,
      actionUrl: extractUrl(text),
    });
    return;
  }

  console.warn(
    `[email] No transport configured — "${subject}" for ${to} was NOT delivered.\n${text}`
  );
}

export async function sendVerificationEmail(to: string, url: string) {
  await send(
    to,
    'Confirm your TradingNew email',
    [
      'Confirm your email address to finish setting up your TradingNew account.',
      '',
      url,
      '',
      'The link expires in 1 hour. If you did not create an account, ignore this message.',
    ].join('\n')
  );
}

export async function sendPasswordReset(to: string, url: string) {
  await send(
    to,
    'Reset your TradingNew password',
    [
      'Use the link below to choose a new password.',
      '',
      url,
      '',
      'The link expires in 1 hour and can be used once. If you did not request this, ignore this message — your password stays unchanged.',
    ].join('\n')
  );
}

export async function sendNewDeviceNotice(to: string, device: string, when: string) {
  await send(
    to,
    'New sign-in to your TradingNew account',
    [
      `A new device signed in to your account: ${device} at ${when}.`,
      '',
      'If this was you, nothing to do. If not, open Settings → Security, log out from all devices, then change your password.',
    ].join('\n')
  );
}
