import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/lib/auth';

/**
 * better-auth endpoints: sign-up, sign-in, sign-out, email verification, password
 * reset, OAuth callbacks, session listing and 2FA. Lives under /api so the i18n
 * middleware leaves it alone.
 */
export const { GET, POST } = toNextJsHandler(auth);
