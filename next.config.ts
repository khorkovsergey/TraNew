import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

/**
 * The portal shipped briefly with a Russian locale on transliterated slugs. Those
 * URLs were live, so each one is redirected to its English counterpart rather than
 * left to 404. next.config redirects run before the i18n middleware, so these win.
 */
const RUSSIAN_SLUG_REDIRECTS: Array<[string, string]> = [
  ['/ru/rynok/obzor-dnya', '/en/markets/global'],
  ['/ru/rynok', '/en/market'],
  ['/ru/novosti', '/en/news'],
  ['/ru/idei', '/en/ideas'],
  ['/ru/vozmozhnosti', '/en/explore'],
  ['/ru/simvoly/:ticker', '/en/symbols/:ticker'],
  ['/ru/issledovanie', '/en/research'],
  ['/ru/supercharts', '/en/supercharts'],
  ['/ru/portfel', '/en/portfolio'],
  ['/ru/ekonomika', '/en/economy'],
  ['/ru/soobshchestvo', '/en/community'],
  ['/ru/brokery', '/en/brokers'],
  ['/ru/akademiya/nastroyka', '/en/academy/setup'],
  ['/ru/akademiya/plan', '/en/academy/path'],
  ['/ru/akademiya/kabinet', '/en/academy/dashboard'],
  ['/ru/akademiya/urok/:slug', '/en/academy/lesson/:slug'],
  ['/ru/akademiya/praktika/:ticker', '/en/academy/practice/:ticker'],
  ['/ru/akademiya/itog', '/en/academy/done'],
  ['/ru/akademiya', '/en/academy'],
  ['/ru/strategiya', '/en/strategy'],
  ['/ru/marketplace/eksperty/anketa', '/en/marketplace/experts/intake'],
  ['/ru/marketplace/eksperty/podbor', '/en/marketplace/experts/matches'],
  ['/ru/marketplace/eksperty/sravnenie', '/en/marketplace/experts/compare'],
  ['/ru/marketplace/eksperty/:id/dostup-k-dannym', '/en/marketplace/experts/:id/sharing'],
  ['/ru/marketplace/eksperty/:id/bronirovanie', '/en/marketplace/experts/:id/booking'],
  ['/ru/marketplace/eksperty/:id', '/en/marketplace/experts/:id'],
  ['/ru/marketplace/eksperty', '/en/marketplace/experts'],
  ['/ru/marketplace/konsultatsii/:id/itog', '/en/marketplace/consultations/:id/summary'],
  ['/ru/marketplace/konsultatsii/:id', '/en/marketplace/consultations/:id'],
  ['/ru/marketplace', '/en/marketplace'],
  ['/ru/instrument/:slug', '/en/tool/:slug'],
  ['/ru/nachat', '/en/start'],
  ['/ru/pochemu-tradingnew', '/en/why-tradingnew'],
  ['/ru/tsentr-doveriya', '/en/trust-center'],
  ['/ru/kak-my-obyasnyaem-rynok', '/en/how-we-explain-markets'],
  ['/ru/personalnye-rekomendatsii', '/en/personal-guidance'],
  ['/ru/professionalnye-instrumenty', '/en/professional-tools'],
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // Legacy Expert Marketplace paths from the previous portal.
      { source: '/community/experts', destination: '/en/marketplace/experts', permanent: true },
      { source: '/capital/experts', destination: '/en/marketplace/experts', permanent: true },

      /*
       * "Entire World" became "Global Markets" and moved to its own cluster.
       *
       * `/market/brief` was the destination of that menu item, so it keeps its
       * traffic by pointing at the new canonical page rather than being deleted.
       * The brief's own content — top moves, what to watch — was carried into
       * the global page, so nothing is lost behind the redirect.
       */
      // 301 rather than `permanent: true`, which emits 308. Search engines treat
      // the two the same for canonicalisation, but 308 preserves the request
      // method and these are plain page moves — 301 is what the brief asks for
      // and what anyone inspecting the migration will expect to see.
      { source: '/en/market/brief', destination: '/en/markets/global', statusCode: 301 },
      { source: '/market/brief', destination: '/en/markets/global', statusCode: 301 },
      { source: '/markets', destination: '/en/markets/global', statusCode: 301 },
      { source: '/en/markets', destination: '/en/markets/global', statusCode: 301 },

      // The assistant was renamed Copilot → Voyager; the old account URL is live.
      { source: '/en/account/copilot', destination: '/en/account/voyager', permanent: true },
      { source: '/account/copilot', destination: '/en/account/voyager', permanent: true },

      ...RUSSIAN_SLUG_REDIRECTS.map(([source, destination]) => ({
        source,
        destination,
        permanent: true,
      })),

      // Anything else under the retired locale goes to the English home page.
      { source: '/ru', destination: '/en', permanent: true },
      { source: '/ru/:path*', destination: '/en', permanent: true },
    ];
  },
};

export default withNextIntl(nextConfig);
