import * as data from '@/content/account';

/**
 * Account data access layer.
 *
 * Everything the account screens render goes through here rather than importing
 * `content/account` directly. Today each function returns a frozen mock; when a
 * real backend arrives only this file changes — the screens keep their shape, and
 * the functions can become async without touching call sites that already await.
 */

export function getUser(): data.User {
  return data.USER;
}

export function getNotifications(): data.Notification[] {
  return data.NOTIFICATIONS;
}

export function getContinueItems() {
  return data.CONTINUE_ITEMS;
}

export function getCopilotInsights() {
  return data.COPILOT_INSIGHTS;
}

export function getCollections() {
  return data.COLLECTIONS;
}

export function getSavedItems(filter: string) {
  const items = data.SAVED_ITEMS;
  return filter === 'All' ? items : items.filter((item) => item.type === filter);
}

export function getSavedViews() {
  return data.SAVED_VIEWS;
}

export function getResearchItems() {
  return data.RESEARCH_ITEMS;
}

export function getReports() {
  return data.REPORTS;
}

export function getAlerts() {
  return data.ALERTS;
}

export function getConversations() {
  return data.CONVERSATIONS;
}

export function getSavedInsights() {
  return data.SAVED_INSIGHTS;
}

export function getMemory() {
  return data.MEMORY;
}

export function getPermissions() {
  return data.PERMISSIONS;
}

export function getUsage() {
  return data.USAGE;
}

export function getActivity(filter: string) {
  const events = data.ACTIVITY;
  return filter === 'All' ? events : events.filter((event) => event.type === filter);
}

export function getPurchases() {
  return data.PURCHASES;
}

export function getSettingsRows(section: string): data.SettingRow[] {
  return data.SETTINGS_ROWS[section] ?? [];
}

export function getSettingsNote(section: string): string | undefined {
  return data.SETTINGS_NOTES[section];
}

export function getProfileFields() {
  return data.PROFILE_FIELDS;
}

export function getAcademySummary() {
  return data.ACADEMY_SUMMARY;
}

export function getWealthPreview() {
  return data.WEALTH_PREVIEW;
}
