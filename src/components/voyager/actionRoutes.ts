import type { StaticPathname } from '@/i18n/routing';
import type { VoyagerActionId, VoyagerContext } from '@/lib/voyager/types';

/**
 * Where each allowlisted action goes.
 *
 * This is the other half of the guarantee made in the orchestrator: the model
 * chooses an id, and the id resolves here. Nothing the model writes ever reaches
 * the router, so an answer cannot navigate anywhere this table does not name.
 *
 * `null` means the action stays in the conversation — the widget asks a follow-up
 * instead of leaving the page.
 */
export function routeFor(
  action: VoyagerActionId,
  context: VoyagerContext
): StaticPathname | { pathname: '/symbols/[ticker]'; params: { ticker: string } } | null {
  const ticker = context.facts?.ticker;

  switch (action) {
    case 'open_symbol':
      return ticker ? { pathname: '/symbols/[ticker]', params: { ticker } } : '/explore';
    case 'open_chart':
      return '/supercharts';
    case 'open_news':
      return '/news';
    case 'open_economy':
      return '/economy';
    case 'open_indicator':
      return '/economy';
    case 'open_academy':
      return '/academy';
    case 'open_events':
      return '/events';
    case 'open_my_events':
      return '/events/my';
    case 'open_experts':
      return '/marketplace/experts';
    case 'open_experts_intake':
      return '/marketplace/experts/intake';
    case 'open_strategy':
      return '/strategy';
    case 'open_explore':
      return '/explore';
    case 'open_screener':
      return '/research';
    case 'open_wealth':
      return '/account/wealth';
    case 'open_wealth_assets':
      return '/account/wealth';
    case 'open_wealth_scenarios':
      return '/account/wealth';
    case 'open_wealth_insights':
      return '/account/wealth';
    case 'open_watchlist':
      return '/account/workspace';
    case 'create_alert':
      // An alert is a reversible action, but it still belongs to the person's
      // account — the draft is made where they can see and confirm it.
      return '/account/workspace';
    // Reveals the Pine block on the chart already open. Nothing to navigate to,
    // which is why it resolves to null like `none` does.
    case 'view_pine':
      return null;
    case 'none':
      return null;
  }
}
