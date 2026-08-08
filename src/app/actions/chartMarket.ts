'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { findProduct } from '@/content/chartMarket';
import { grantScript } from '@/lib/chartMarket/purchases';
import { getSession } from '@/lib/session';

/**
 * Completing a Chart Market purchase.
 *
 * A form action rather than a fetch, so the whole flow works before any
 * JavaScript has run and the result is a navigation somebody can bookmark, go
 * back from, or reload.
 *
 * The product id is the only thing the browser sends. The price, the title and
 * the entitlement all come from the catalogue and the session on this side —
 * a hidden field naming an amount is an amount somebody can choose.
 *
 * Nothing here charges anybody. No payment provider is connected, the screen
 * says so above the button, and the row this writes is marked `demo`.
 */
export async function completeDemoPurchase(formData: FormData): Promise<void> {
  const productId = String(formData.get('script') ?? '');
  const product = findProduct(productId);

  if (!product) {
    redirect('/en/marketplace/tools/chart-market');
  }

  const session = await getSession();

  /*
   * Signed out at the moment of purchase — a session that expired while the
   * checkout was open, or a request that never had one. Back to the checkout
   * step, which is the screen that offers to sign in and keeps the intent in
   * its own URL.
   */
  if (!session?.user) {
    redirect(`/en/marketplace/tools/chart-market?script=${product.id}&step=checkout`);
  }

  await grantScript(session.user.id, product.id);

  // The account's purchases list reads this, and it must not be served from a
  // cache written before the script was owned.
  revalidatePath('/en/account/purchases');

  redirect(`/en/marketplace/tools/chart-market?script=${product.id}&step=done`);
}
