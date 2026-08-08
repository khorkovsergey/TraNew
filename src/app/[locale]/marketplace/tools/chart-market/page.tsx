import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { ChartMarketCatalog } from '@/components/marketplace/tools/ChartMarketCatalog';
import {
  AuthGate,
  CheckoutDialog,
  PurchaseDone,
} from '@/components/marketplace/tools/CheckoutDialog';
import { ScriptDetail } from '@/components/marketplace/tools/ScriptDetail';
import { ToolsRail } from '@/components/marketplace/tools/ToolsRail';
import { SpaceBackdrop } from '@/components/shell/SpaceBackdrop';
import { findProduct } from '@/content/chartMarket';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { parseFilters } from '@/lib/chartMarket/filters';
import { listScriptPurchases } from '@/lib/chartMarket/purchases';
import { selectProducts } from '@/lib/chartMarket/select';
import { sourceFor } from '@/lib/chartMarket/source';
import { pageMetadata } from '@/lib/metadata';
import { getSession } from '@/lib/session';
import styles from '@/components/marketplace/tools/Tools.module.css';

/**
 * Chart Market — catalogue, product, checkout and confirmation on one route.
 *
 * Dynamic, because every one of those states comes out of the query string and
 * because two of them depend on who is asking. Prerendering it would serve one
 * person's entitlements to everybody, which on this screen means serving one
 * person's unlocked source code to everybody.
 *
 * The access rule lives here, at the top, in one place: `owned` is computed on
 * the server from a purchase row, and `sourceFor` refuses to return anything
 * without it. Nothing below this function can decide to show the code.
 */

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const raw = await searchParams;
  const product = findProduct(typeof raw.script === 'string' ? raw.script : null);

  if (product) {
    return pageMetadata({
      href: '/marketplace/tools/chart-market',
      locale,
      title: `${product.title} — ${product.type} for TradingNew charts`,
      description: product.short,
    });
  }

  return pageMetadata({
    href: '/marketplace/tools/chart-market',
    locale,
    title: 'Chart Market — Pine Script indicators and strategies',
    description:
      'Indicators, strategies and chart tools built by developers and traders. Browse without an account; only buying needs one.',
  });
}

export default async function ChartMarketPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const raw = await searchParams;
  const filters = parseFilters(raw);
  const product = findProduct(typeof raw.script === 'string' ? raw.script : null);

  const session = await getSession();
  const user = session?.user ?? null;

  const purchases = user ? await listScriptPurchases(user.id) : [];
  const ownedIds = new Set(purchases.map((purchase) => purchase.productId));

  const owned = product ? ownedIds.has(product.id) : false;
  const demoPurchase = product
    ? (purchases.find((purchase) => purchase.productId === product.id)?.demo ?? false)
    : false;

  // The one call that can produce source, and it is given the entitlement
  // rather than left to infer one.
  const source = product ? sourceFor(product.id, owned) : null;

  const step = typeof raw.step === 'string' ? raw.step : null;
  /*
   * An owned script has nothing left to check out. Somebody arriving on
   * `?step=checkout` for a script they already have — a stale tab, the back
   * button after buying — is shown the product, not a second sale.
   */
  const showCheckout = Boolean(product) && step === 'checkout' && !owned;
  const showDone = Boolean(product) && step === 'done' && owned;

  return (
    <>
      <SpaceBackdrop tone={4} />

      <div className={styles.page}>
        <div className={styles.shell}>
          <ToolsRail active="chart-market" />

          <div className={styles.main}>
            <div className={styles.breadcrumb}>
              <Link href="/marketplace">Marketplace</Link>
              <span className={styles.breadcrumbSep}>/</span>
              <Link href="/marketplace/tools">Tools &amp; Data</Link>
              <span className={styles.breadcrumbSep}>/</span>
              {product ? (
                <>
                  <Link href="/marketplace/tools/chart-market">Chart Market</Link>
                  <span className={styles.breadcrumbSep}>/</span>
                  <span className={styles.breadcrumbHere}>{product.title}</span>
                </>
              ) : (
                <span className={styles.breadcrumbHere}>Chart Market</span>
              )}
            </div>

            {product ? (
              <ScriptDetail
                product={product}
                filters={filters}
                owned={owned}
                source={source}
                demoPurchase={demoPurchase}
              />
            ) : (
              <ChartMarketCatalog
                filters={filters}
                products={selectProducts(filters)}
                ownedIds={ownedIds}
              />
            )}
          </div>
        </div>
      </div>

      {showCheckout &&
        product &&
        (user ? (
          <CheckoutDialog product={product} filters={filters} viewerEmail={user.email ?? null} />
        ) : (
          <AuthGate product={product} filters={filters} />
        ))}

      {showDone && product && <PurchaseDone product={product} filters={filters} />}
    </>
  );
}
