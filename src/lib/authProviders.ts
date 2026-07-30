import 'server-only';

/**
 * Which social providers are actually usable. Reading this on the server keeps the
 * buttons honest: a provider without credentials is never offered, so nobody clicks
 * a button that leads to a broken callback.
 */
export function configuredSocialProviders(): string[] {
  const providers: string[] = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) providers.push('google');
  if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) providers.push('apple');
  return providers;
}
