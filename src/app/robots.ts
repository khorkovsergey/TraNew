import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/metadata';

/**
 * robots.txt.
 *
 * The disallow list is everything that belongs to one person or exists only as
 * a step in a flow: an account page, a booking, a preview mailbox. None of it is
 * useful in a search result and some of it would be a privacy problem to have
 * crawled at all.
 *
 * `/api` is excluded because the endpoints answer to sessions rather than to
 * URLs, and a crawler following them would be spending the assistant's rate
 * limit on nobody's behalf.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dev/',
          '/en/account/',
          '/en/portfolio',
          '/en/events/my',
          '/en/events/manage',
          '/en/events/create',
          '/en/marketplace/consultations/',
          '/en/sign-in',
          '/en/sign-up',
          '/en/forgot-password',
          '/en/reset-password',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
