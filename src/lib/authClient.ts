'use client';

import { twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

/**
 * Browser-side auth client. It calls the server endpoints and reads the session
 * through them — the session cookie itself is httpOnly and unreadable from here,
 * which is the point.
 */
export const authClient = createAuthClient({
  plugins: [twoFactorClient()],
});

export const { signIn, signUp, signOut, useSession, requestPasswordReset, resetPassword } =
  authClient;
