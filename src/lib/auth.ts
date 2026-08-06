import 'server-only';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { twoFactor } from 'better-auth/plugins';
import { hash, verify } from '@node-rs/argon2';
import { db, schema } from '@/db';
import { sendPasswordReset, sendVerificationEmail } from './email';
import { SITE_URL } from './metadata';

/**
 * Server-side authentication.
 *
 * Sessions are database rows, not self-contained tokens: that is what makes
 * "log out this device" and "log out everywhere" actually end a session rather
 * than merely stop showing it. The session cookie is httpOnly and SameSite=Lax,
 * so client JavaScript cannot read it.
 */

/**
 * argon2id parameters. Deliberately above the library defaults for a product that
 * guards financial data — roughly 64 MB and 3 passes, which costs a legitimate
 * sign-in a few hundred milliseconds and costs an offline cracker a great deal more.
 */
const ARGON2 = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const;

const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};

// OAuth providers activate only when their credentials are present, so a missing
// key degrades to "no social sign-in" rather than a broken build.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
}
if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
  socialProviders.apple = {
    clientId: process.env.APPLE_CLIENT_ID,
    clientSecret: process.env.APPLE_CLIENT_SECRET,
  };
}

/**
 * Which origins may make a state-changing auth request.
 *
 * better-auth checks the browser's `Origin` header on every POST to
 * `/api/auth/*` and answers 403 when it is not on this list. That check is the
 * CSRF defence and it is doing its job — the bug it caused was that the list
 * defaults to `[baseURL]` alone, and this app answers on more than one host.
 * Railway always keeps its `*.up.railway.app` domain alive beside a custom one,
 * so anybody who arrived through it could sign in — the demo path is a
 * server-side call and never sees the check — and then could not sign out.
 *
 * Deliberately not a wildcard. Trusting every origin would remove the reason the
 * check exists, on a product where the state being changed is somebody's
 * session. Extra hosts are named, in an environment variable, one per entry.
 */
function trustedOrigins(): string[] {
  const origins = new Set<string>();

  const add = (value: string | undefined) => {
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    try {
      // Normalised through URL so `tradingnew.space`, a trailing slash and a
      // full URL all end up as the same origin string.
      origins.add(new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`).origin);
    } catch {
      // An unparseable entry is dropped rather than trusted as a literal.
    }
  };

  add(SITE_URL);
  add(process.env.BETTER_AUTH_URL);
  // Railway's generated domain, which exists whether or not it is advertised.
  add(process.env.RAILWAY_PUBLIC_DOMAIN);
  process.env.AUTH_TRUSTED_ORIGINS?.split(',').forEach(add);

  /*
   * The www. sibling of the configured site. Same registrable domain, and a
   * person who typed it should be able to sign out of the session they signed
   * into — this cannot be forged by anybody who does not already control the
   * domain.
   */
  try {
    const site = new URL(SITE_URL);
    if (!site.hostname.startsWith('www.')) {
      origins.add(`${site.protocol}//www.${site.hostname}`);
    }
  } catch {
    // SITE_URL is malformed; the list is whatever else resolved.
  }

  return [...origins];
}

export const auth = betterAuth({
  baseURL: SITE_URL,
  trustedOrigins: trustedOrigins(),
  secret: process.env.BETTER_AUTH_SECRET,

  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      twoFactor: schema.twoFactor,
    },
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 200,
    password: {
      hash: (password) => hash(password, ARGON2),
      verify: ({ hash: digest, password }) => verify(digest, password, ARGON2),
    },
    sendResetPassword: async ({ user: recipient, url }) => {
      await sendPasswordReset(recipient.email, url);
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user: recipient, url }) => {
      await sendVerificationEmail(recipient.email, url);
    },
  },

  socialProviders,

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    // Financial screens read the session on the server every time; a short cookie
    // cache keeps that cheap without letting a revoked session linger for long.
    cookieCache: { enabled: true, maxAge: 60 },
  },

  advanced: {
    cookiePrefix: 'tn',
    useSecureCookies: process.env.NODE_ENV === 'production',
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: 'lax',
    },
  },

  user: {
    additionalFields: {
      plan: { type: 'string', defaultValue: 'free', input: false },
      planRenewsAt: { type: 'date', required: false, input: false },
      dataKeyEnc: { type: 'string', required: false, input: false },
    },
    deleteUser: { enabled: true },
  },

  plugins: [twoFactor(), nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
