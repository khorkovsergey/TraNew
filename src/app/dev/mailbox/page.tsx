import { desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db, schema } from '@/db';
import { emailTransport, previewMailboxKey } from '@/lib/stubMode';
import { safeEqual } from '@/lib/crypto';

/**
 * Preview mailbox — where verification and reset messages land while no mail
 * provider is configured.
 *
 * Two deliberate constraints: it exists only in preview transport, and it demands a
 * key. Without the key this page is the same as an open list of everyone's
 * account-recovery links, which would be a worse hole than the one the stub fills.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Preview mailbox',
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ key?: string }> };

export default async function MailboxPage({ searchParams }: Props) {
  if (emailTransport() !== 'preview') notFound();

  const expected = previewMailboxKey();
  const { key } = await searchParams;

  // No key configured means no access at all — not "access for everyone".
  if (!expected || !key || !safeEqual(key, expected)) notFound();

  const messages = await db
    .select()
    .from(schema.emailOutbox)
    .orderBy(desc(schema.emailOutbox.createdAt))
    .limit(25);

  return (
    <main
      style={{
        maxWidth: 760,
        margin: '40px auto 80px',
        padding: '0 24px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Preview mailbox</h1>
      <p style={{ color: '#5a6376', lineHeight: 1.6, marginTop: 10 }}>
        Email delivery is simulated. The tokens in these links are real, single-use and expire
        in an hour — only the delivery is stubbed. Configure <code>RESEND_API_KEY</code> and this
        page disappears.
      </p>

      {messages.length === 0 && (
        <p style={{ marginTop: 30, color: '#8a93a6' }}>
          No messages yet. Create an account or request a password reset.
        </p>
      )}

      {messages.map((message) => (
        <article
          key={message.id}
          style={{
            border: '1px solid #eceff4',
            borderRadius: 16,
            padding: '20px 22px',
            marginTop: 18,
            background: '#fff',
          }}
        >
          <div style={{ fontSize: 12, color: '#8a93a6' }}>
            {message.createdAt.toLocaleString()} · to {message.recipient}
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6 }}>{message.subject}</div>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'inherit',
              fontSize: 13.5,
              color: '#3a4254',
              lineHeight: 1.6,
              marginTop: 10,
            }}
          >
            {message.body}
          </pre>
          {message.actionUrl && (
            <a
              href={message.actionUrl}
              style={{
                display: 'inline-block',
                marginTop: 10,
                background: '#2962ff',
                color: '#fff',
                borderRadius: 20,
                padding: '10px 18px',
                fontSize: 13.5,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Open the link
            </a>
          )}
        </article>
      ))}
    </main>
  );
}
