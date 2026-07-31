import 'server-only';
import { listActivity, type ActivityType } from './activity';
import { listAlerts } from './alerts';
import { listPurchases } from './bookings';
import { listMemory } from './profile';
import { listCollections, listSaved, type SavedKind } from './savedObjects';

/**
 * View models for the account screens.
 *
 * The screens already render a specific shape; this maps the real aggregates onto
 * it so the sections keep their markup. It is the last place that knows about
 * presentation formatting — services return data, this returns strings a person
 * reads.
 */

/** "Saved today" reads better than a date on a list someone scans. */
function relativeTime(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const KIND_LABEL: Record<SavedKind, string> = {
  symbol: 'Company',
  country: 'Country',
  news: 'News',
  research: 'Research',
  chart: 'Chart',
  expert: 'Expert',
  lesson: 'Lesson',
  screener: 'Screener',
  idea: 'Idea',
};

export type WorkspaceView = {
  collections: { id: string; name: string; meta: string }[];
  saved: { id: string; type: string; title: string; meta: string }[];
  alerts: { id: string; name: string; meta: string; status: string }[];
  /** True for a new account, so the screens offer a first step instead of blank space. */
  empty: boolean;
};

export async function getWorkspaceView(userId: string): Promise<WorkspaceView> {
  const [collections, saved, alerts] = await Promise.all([
    listCollections(userId),
    listSaved(userId),
    listAlerts(userId),
  ]);

  return {
    collections: collections.map((entry) => ({
      id: entry.id,
      name: entry.name,
      meta: `${entry.items.length} item${entry.items.length === 1 ? '' : 's'} · ${
        entry.isPublic ? 'Shared' : 'Private'
      }`,
    })),
    saved: saved.map((entry) => ({
      id: entry.id,
      type: KIND_LABEL[entry.kind],
      title: entry.title,
      meta: `Saved ${relativeTime(entry.createdAt)}`,
    })),
    alerts: alerts.map((entry) => ({
      id: entry.id,
      name: entry.label,
      // The draft state is visible: an alert that has not been switched on should
      // not look like one that is watching.
      meta: `${entry.kind.replace('_', ' ')} · ${
        entry.status === 'draft' ? 'Draft — not active yet' : entry.channels.join(' + ')
      }`,
      status: entry.status,
    })),
    empty: collections.length === 0 && saved.length === 0 && alerts.length === 0,
  };
}

export type ActivityView = {
  entries: { id: string; type: string; title: string; time: string }[];
  empty: boolean;
};

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  viewed: 'Viewed',
  saved: 'Saved',
  asked: 'Voyager',
  learned: 'Academy',
  alert: 'Alerts',
  booking: 'Marketplace',
  purchase: 'Marketplace',
  wealth: 'Wealth',
};

export async function getActivityView(userId: string, filter = 'All'): Promise<ActivityView> {
  const entries = await listActivity(userId);
  const visible =
    filter === 'All'
      ? entries
      : entries.filter((entry) => ACTIVITY_LABEL[entry.type] === filter);

  return {
    entries: visible.map((entry) => ({
      id: entry.id,
      type: ACTIVITY_LABEL[entry.type],
      title: entry.title,
      time: relativeTime(entry.createdAt),
    })),
    empty: entries.length === 0,
  };
}

export type MemoryView = {
  entries: { id: string; kind: string; content: string; source: string }[];
  empty: boolean;
};

export async function getMemoryView(userId: string): Promise<MemoryView> {
  const entries = await listMemory(userId);

  return {
    entries: entries.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      content: entry.content,
      source: entry.sourceEvent
        ? `Source: ${entry.sourceEvent} · ${relativeTime(entry.createdAt)}`
        : `Recorded ${relativeTime(entry.createdAt)}`,
    })),
    empty: entries.length === 0,
  };
}

export type PurchasesView = {
  entries: { id: string; kind: string; title: string; meta: string; status: string }[];
  empty: boolean;
};

export async function getPurchasesView(userId: string): Promise<PurchasesView> {
  const entries = await listPurchases(userId);

  return {
    entries: entries.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      title: entry.title,
      meta: `${(entry.amountCents / 100).toLocaleString('en-GB', {
        style: 'currency',
        currency: entry.currency,
      })} · ${entry.purchasedAt.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })}`,
      status: entry.status,
    })),
    empty: entries.length === 0,
  };
}
