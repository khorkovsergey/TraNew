import type { Metadata } from 'next';
import { Manrope, Plus_Jakarta_Sans } from 'next/font/google';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Header } from '@/components/shell/Header';
import { LoginModalProvider } from '@/components/shell/LoginModalProvider';
import { VoyagerProvider } from '@/components/voyager/VoyagerProvider';
import { VoyagerWidget } from '@/components/voyager/VoyagerWidget';
import { routing } from '@/i18n/routing';
import { SITE_URL } from '@/lib/metadata';
import '../globals.css';

/**
 * Plus Jakarta Sans is the handoff typeface but ships no Cyrillic glyphs, so Russian
 * text would drop to a system font. Manrope sits next in the stack purely as the
 * Cyrillic carrier — per-glyph fallback keeps Latin on Jakarta in both locales.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['cyrillic', 'cyrillic-ext', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'meta' });

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: t('homeTitle'),
      template: `%s · ${t('siteName')}`,
    },
    description: t('homeDescription'),
  };
}

export default async function LocaleLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const t = await getTranslations('header');

  return (
    <html lang={locale} className={`${jakarta.variable} ${manrope.variable}`}>
      <body>
        <NextIntlClientProvider>
          <LoginModalProvider>
            {/* Voyager sits at layout level so it survives navigation; each page
                announces its own context through VoyagerPageContext. */}
            <VoyagerProvider>
              <a className="tn-skip-link" href="#main">
                {t('skipToContent')}
              </a>
              <div className="tn-app">
                <Header />
                <main id="main">{props.children}</main>
              </div>
              <VoyagerWidget />
            </VoyagerProvider>
          </LoginModalProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
