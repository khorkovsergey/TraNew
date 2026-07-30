import 'server-only';

/**
 * Which social providers are actually usable. Reading this on the server keeps the
 * buttons honest: a provider without credentials is never offered, so nobody clicks
 * a button that leads to a broken callback.
 */
import { isStubOAuthEnabled } from './stubMode';

export type SocialProvider = { id: 'google' | 'apple'; simulated: boolean };

export function configuredSocialProviders(): SocialProvider[] {
  const providers: SocialProvider[] = [];

  const googleReal = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const appleReal = Boolean(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET);
  const stub = isStubOAuthEnabled();

  // A real provider always wins over the stub, so adding credentials is enough to
  // switch over — no code change and no chance of both being offered at once.
  if (googleReal) providers.push({ id: 'google', simulated: false });
  else if (stub) providers.push({ id: 'google', simulated: true });

  if (appleReal) providers.push({ id: 'apple', simulated: false });
  else if (stub) providers.push({ id: 'apple', simulated: true });

  return providers;
}
