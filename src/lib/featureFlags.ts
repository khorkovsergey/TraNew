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
} as const;
