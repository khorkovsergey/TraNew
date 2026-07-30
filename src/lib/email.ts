import 'server-only';
import { Resend } from 'resend';

/**
 * Transactional email. Without RESEND_API_KEY the links are written to the server
 * log instead of being sent — usable for local work, and loud enough that nobody
 * mistakes it for a working mail setup in production.
 */

const FROM = process.env.EMAIL_FROM ?? 'TradingNew <noreply@tradingnew.space>';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function send(to: string, subject: string, text: string) {
  if (!resend) {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        `[email] RESEND_API_KEY missing — "${subject}" for ${to} was NOT sent. Configure it before onboarding users.`
      );
    } else {
      console.info(`[email] ${subject} -> ${to}\n${text}`);
    }
    return;
  }

  const { error } = await resend.emails.send({ from: FROM, to, subject, text });
  if (error) {
    // Surfaced rather than swallowed: a silent failure here locks people out.
    throw new Error(`Failed to send "${subject}": ${error.message}`);
  }
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
      'If this was you, nothing to do. If not, open Settings → Security and log out from all devices, then change your password.',
    ].join('\n')
  );
}
