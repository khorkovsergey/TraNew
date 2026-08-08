import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { AccountLayout } from '@/components/account/AccountLayout';
import { AccountPurchases, type PurchasedScript } from '@/components/account/AccountSections';
import { findProduct, formatPrice } from '@/content/chartMarket';
import { listScriptPurchases } from '@/lib/chartMarket/purchases';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import { requireUser } from '@/lib/session';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    href: '/account/purchases',
    locale,
    title: 'Purchases',
    description: 'Expert services, tools and data, learning, merchandise and payments.',
  });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Middleware only checks that a cookie exists; this is the real gate.
  const user = await requireUser();

  /*
   * Chart Market entitlements, read here rather than in the component.
   *
   * The tools tab used to be an empty state with no way to stop being one. Now
   * it lists what somebody actually owns — and the catalogue lookup is what
   * turns a purchase row into a line worth reading, so a product removed from
   * the catalogue drops out of the list rather than rendering as a blank.
   */
  const purchases = await listScriptPurchases(user.id);
  const scripts: PurchasedScript[] = purchases.flatMap((purchase) => {
    const product = findProduct(purchase.productId);
    if (!product) return [];

    return [
      {
        productId: product.id,
        title: product.title,
        demo: purchase.demo,
        meta: `${product.creator} · ${product.type} · Pine Script v${product.pine} · ${formatPrice(
          purchase.amountCents
        )}`,
      },
    ];
  });

  return (
    <AccountLayout>
      <AccountPurchases scripts={scripts} />
    </AccountLayout>
  );
}
