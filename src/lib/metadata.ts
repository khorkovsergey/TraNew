import type { Metadata } from 'next';
import { getPathname } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tradingnew.example').replace(
  /\/$/,
  ''
);

type Href = Parameters<typeof getPathname>[0]['href'];

/**
 * Canonical + hreflang for a screen. Every page must call this: localized slugs
 * only pay off for SEO when each locale advertises its own URL and its siblings.
 */
export function alternates(href: Href, locale: Locale): Metadata['alternates'] {
  const languages: Record<string, string> = {};

  for (const candidate of routing.locales) {
    languages[candidate] = SITE_URL + getPathname({ href, locale: candidate });
  }
  languages['x-default'] = SITE_URL + getPathname({ href, locale: routing.defaultLocale });

  return {
    canonical: SITE_URL + getPathname({ href, locale }),
    languages,
  };
}

/** Page metadata with canonical, hreflang and Open Graph filled in consistently. */
export function pageMetadata(options: {
  href: Href;
  locale: Locale;
  title: string;
  description: string;
}): Metadata {
  const { href, locale, title, description } = options;

  return {
    title,
    description,
    alternates: alternates(href, locale),
    openGraph: {
      title,
      description,
      url: SITE_URL + getPathname({ href, locale }),
      siteName: 'TradingNew',
      locale: 'en_US',
      type: 'website',
    },
  };
}
