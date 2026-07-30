import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // Legacy Expert Marketplace paths from the previous portal.
      { source: '/community/experts', destination: '/en/marketplace/experts', permanent: true },
      { source: '/capital/experts', destination: '/en/marketplace/experts', permanent: true },
    ];
  },
};

export default withNextIntl(nextConfig);
