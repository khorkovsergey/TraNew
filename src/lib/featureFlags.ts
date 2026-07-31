/**
 * Feature flags. Kept in one place so turning a product area on or off is a config
 * change rather than a refactor of the screens that link to it.
 */
export const FEATURE_FLAGS = {
  /**
   * Wealth Hub is a distinct product surface layered on the account. With the flag
   * off, the account still renders in full: the menu entry reads "Soon" and the
   * Overview card becomes a waitlist preview of the same size.
   */
  wealthHubEnabled: process.env.NEXT_PUBLIC_WEALTH_HUB !== 'false',

  /**
   * Alerts are hidden until there is a live price feed behind them.
   *
   * The schema, the service and the draft state all exist and are tested — what
   * does not exist is anything that could make an alert fire. A button that
   * creates something which can never trigger is a promise the product does not
   * keep, so the surface stays off rather than shipping the illusion.
   *
   * Turning this on is the whole re-enable once quotes are streaming.
   */
  alertsEnabled: process.env.NEXT_PUBLIC_ALERTS === 'true',
} as const;
