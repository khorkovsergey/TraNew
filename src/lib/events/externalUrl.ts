/**
 * External destinations.
 *
 * An organizer supplies a URL and TradingNew shows it to strangers. That is a
 * link the platform is lending its credibility to, so it is checked rather than
 * trusted: protocol, shape, host, and whether an administrator has vetted the
 * domain. Anything that does not survive all four is not rendered as a link.
 *
 * Pure and dependency-free so the rules can be tested exhaustively.
 */

export type UrlCheck =
  | { ok: true; url: string; domain: string; trusted: boolean }
  | { ok: false; reason: UrlRejection };

export type UrlRejection =
  | 'empty'
  | 'malformed'
  | 'unsupported_protocol'
  | 'credentials_in_url'
  | 'not_a_public_host'
  | 'too_long';

export const URL_REJECTION_MESSAGE: Record<UrlRejection, string> = {
  empty: 'Enter the address of the event page.',
  malformed: 'That does not look like a web address.',
  unsupported_protocol: 'Only https:// links are accepted.',
  credentials_in_url: 'Remove the username and password from the address.',
  not_a_public_host: 'That address does not point at a public website.',
  too_long: 'That address is too long.',
};

/**
 * https only. http is refused rather than upgraded: silently rewriting someone's
 * link means the address shown is not the address checked.
 */
const ALLOWED_PROTOCOLS = ['https:'];

const MAX_LENGTH = 2048;

/** Hosts that resolve inside a network rather than out on the web. */
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|0\.0\.0\.0)/i;

export function checkExternalUrl(raw: string, trustedDomains: string[] = []): UrlCheck {
  const value = (raw ?? '').trim();

  if (!value) return { ok: false, reason: 'empty' };
  if (value.length > MAX_LENGTH) return { ok: false, reason: 'too_long' };

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    return { ok: false, reason: 'unsupported_protocol' };
  }

  // A link carrying credentials is either a mistake or an attempt to disguise
  // the real host behind an @ — both end here.
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'credentials_in_url' };
  }

  if (!parsed.hostname || PRIVATE_HOST.test(parsed.hostname) || !parsed.hostname.includes('.')) {
    return { ok: false, reason: 'not_a_public_host' };
  }

  const domain = parsed.hostname.replace(/^www\./i, '').toLowerCase();

  return {
    ok: true,
    url: parsed.toString(),
    domain,
    trusted: isTrustedDomain(domain, trustedDomains),
  };
}

/**
 * Suffix matching, but only on a label boundary. `evil-example.com` must not
 * inherit the trust granted to `example.com`.
 */
export function isTrustedDomain(domain: string, trustedDomains: string[]): boolean {
  const host = domain.replace(/^www\./i, '').toLowerCase();

  return trustedDomains.some((entry) => {
    const trusted = entry.trim().replace(/^www\./i, '').toLowerCase();
    if (!trusted) return false;
    return host === trusted || host.endsWith(`.${trusted}`);
  });
}

/** For display beside a link, so people can see where it goes before pressing it. */
export function displayDomain(url: string): string | null {
  const check = checkExternalUrl(url);
  return check.ok ? check.domain : null;
}

/**
 * The attributes an external link must carry. `noopener` denies the opened page
 * a handle on this one; `nofollow` keeps user-submitted links from passing rank.
 */
export const EXTERNAL_LINK_ATTRS = {
  target: '_blank',
  rel: 'noopener noreferrer nofollow',
} as const;
