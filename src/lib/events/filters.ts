import type {
  EventFormat,
  EventKind,
  EventSourceType,
  ExperienceLevel,
  PriceType,
} from './types';

/**
 * Filter state ⇄ URL.
 *
 * The URL is the state. Not a mirror of it kept in sync by an effect — the actual
 * store, read on render and written by navigation. That is what makes refresh,
 * back, forward and a pasted link all behave, and it is why this module has no
 * React in it and no imports beyond a type.
 *
 * Every value is validated on the way in. A query string is user input, and a
 * `format=<script>` that survives into a database query or a rendered chip is the
 * kind of thing that starts as untidy and ends as an incident.
 */

export type DateWindow =
  | 'any'
  | 'today'
  | 'tomorrow'
  | 'this_week'
  | 'this_weekend'
  | 'this_month'
  | 'custom';

export type SortOrder = 'recommended' | 'soonest' | 'nearest' | 'popular' | 'newest';

export type ViewMode = 'cards' | 'calendar' | 'map';

export type EventFilters = {
  q: string;
  dateWindow: DateWindow;
  /** Only meaningful when dateWindow is 'custom'. ISO date, no time. */
  from: string | null;
  to: string | null;
  formats: EventFormat[];
  country: string | null;
  city: string | null;
  /** Kilometres from the selected location. */
  distance: number | null;
  topics: string[];
  levels: ExperienceLevel[];
  languages: string[];
  types: EventKind[];
  sources: EventSourceType[];
  price: PriceType | null;
  onlineOnly: boolean;
  sort: SortOrder;
  view: ViewMode;
  page: number;
};

export const DEFAULT_FILTERS: EventFilters = {
  q: '',
  dateWindow: 'any',
  from: null,
  to: null,
  formats: [],
  country: null,
  city: null,
  distance: null,
  topics: [],
  levels: [],
  languages: [],
  types: [],
  sources: [],
  price: null,
  onlineOnly: false,
  sort: 'recommended',
  view: 'cards',
  page: 1,
};

const DATE_WINDOWS: DateWindow[] = [
  'any',
  'today',
  'tomorrow',
  'this_week',
  'this_weekend',
  'this_month',
  'custom',
];
const SORTS: SortOrder[] = ['recommended', 'soonest', 'nearest', 'popular', 'newest'];
const VIEWS: ViewMode[] = ['cards', 'calendar', 'map'];
const FORMATS: EventFormat[] = ['in_person', 'online', 'hybrid'];
const LEVELS: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced', 'all_levels'];
const KINDS: EventKind[] = [
  'conference',
  'meetup',
  'webinar',
  'workshop',
  'masterclass',
  'panel',
  'networking',
  'live_market_session',
];
const SOURCES: EventSourceType[] = ['tradingnew', 'community', 'external'];
const PRICES: PriceType[] = ['free', 'paid', 'external'];

/** Anything not on the list is dropped rather than corrected — a guess is worse. */
function pickMany<T extends string>(raw: string | null | undefined, allowed: T[]): T[] {
  if (!raw) return [];
  const seen = new Set<T>();
  for (const part of raw.split(',')) {
    const value = part.trim() as T;
    if (allowed.includes(value)) seen.add(value);
  }
  return [...seen];
}

function pickOne<T extends string>(raw: string | null | undefined, allowed: T[]): T | null {
  const value = (raw ?? '').trim() as T;
  return allowed.includes(value) ? value : null;
}

/** Free text is length-capped here so nothing downstream has to remember to. */
function text(raw: string | null | undefined, max: number): string {
  return (raw ?? '').trim().slice(0, max);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isoDate(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!ISO_DATE.test(value)) return null;
  return Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? null : value;
}

function positiveInt(raw: string | null | undefined, max: number): number | null {
  const value = Number.parseInt((raw ?? '').trim(), 10);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.min(value, max);
}

type Query = Record<string, string | string[] | undefined>;

function read(query: Query, key: string): string | null {
  const value = query[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function parseFilters(query: Query): EventFilters {
  const dateWindow = pickOne(read(query, 'when'), DATE_WINDOWS) ?? 'any';
  const from = isoDate(read(query, 'from'));
  const to = isoDate(read(query, 'to'));

  return {
    q: text(read(query, 'q'), 120),
    // A custom window with no usable dates is not a custom window.
    dateWindow: dateWindow === 'custom' && !from && !to ? 'any' : dateWindow,
    from: dateWindow === 'custom' ? from : null,
    to: dateWindow === 'custom' ? to : null,
    formats: pickMany(read(query, 'format'), FORMATS),
    country: text(read(query, 'country'), 60) || null,
    city: text(read(query, 'city'), 60) || null,
    distance: positiveInt(read(query, 'km'), 2000),
    topics: (read(query, 'topic') ?? '')
      .split(',')
      .map((topic) => topic.trim())
      .filter(Boolean)
      .slice(0, 12),
    levels: pickMany(read(query, 'level'), LEVELS),
    languages: (read(query, 'lang') ?? '')
      .split(',')
      .map((lang) => lang.trim().toUpperCase())
      .filter((lang) => /^[A-Z]{2}$/.test(lang))
      .slice(0, 8),
    types: pickMany(read(query, 'type'), KINDS),
    sources: pickMany(read(query, 'source'), SOURCES),
    price: pickOne(read(query, 'price'), PRICES),
    onlineOnly: read(query, 'online') === '1',
    sort: pickOne(read(query, 'sort'), SORTS) ?? 'recommended',
    view: pickOne(read(query, 'view'), VIEWS) ?? 'cards',
    page: positiveInt(read(query, 'page'), 500) ?? 1,
  };
}

/**
 * Only what differs from the default is written, so a plain `/events` stays a
 * plain `/events` and two identical filter states always produce the same string.
 */
export function serializeFilters(filters: EventFilters): Record<string, string> {
  const query: Record<string, string> = {};
  const list = (values: string[]) => values.join(',');

  if (filters.q) query.q = filters.q;
  if (filters.dateWindow !== 'any') query.when = filters.dateWindow;
  if (filters.dateWindow === 'custom') {
    if (filters.from) query.from = filters.from;
    if (filters.to) query.to = filters.to;
  }
  if (filters.formats.length) query.format = list(filters.formats);
  if (filters.country) query.country = filters.country;
  if (filters.city) query.city = filters.city;
  if (filters.distance) query.km = String(filters.distance);
  if (filters.topics.length) query.topic = list(filters.topics);
  if (filters.levels.length) query.level = list(filters.levels);
  if (filters.languages.length) query.lang = list(filters.languages);
  if (filters.types.length) query.type = list(filters.types);
  if (filters.sources.length) query.source = list(filters.sources);
  if (filters.price) query.price = filters.price;
  if (filters.onlineOnly) query.online = '1';
  if (filters.sort !== 'recommended') query.sort = filters.sort;
  if (filters.view !== 'cards') query.view = filters.view;
  if (filters.page > 1) query.page = String(filters.page);

  return query;
}

export function filtersToSearchString(filters: EventFilters): string {
  const params = new URLSearchParams(serializeFilters(filters));
  const value = params.toString();
  return value ? `?${value}` : '';
}

/** Location, sort and view are not filters — clearing must not move the map. */
export function clearFilters(filters: EventFilters): EventFilters {
  return {
    ...DEFAULT_FILTERS,
    country: filters.country,
    city: filters.city,
    sort: filters.sort,
    view: filters.view,
  };
}

export type FilterChip = {
  /** Identifies the value to drop when the chip's ✕ is pressed. */
  group: keyof EventFilters;
  value: string;
  label: string;
};

/** The active filters, as the row of removable chips the design shows. */
export function activeChips(filters: EventFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  const push = (group: keyof EventFilters, value: string, label: string) =>
    chips.push({ group, value, label });

  if (filters.q) push('q', filters.q, `“${filters.q}”`);

  if (filters.dateWindow === 'custom') {
    const range = [filters.from, filters.to].filter(Boolean).join(' → ');
    if (range) push('dateWindow', 'custom', range);
  } else if (filters.dateWindow !== 'any') {
    push('dateWindow', filters.dateWindow, DATE_LABEL[filters.dateWindow]);
  }

  filters.formats.forEach((format) => push('formats', format, FORMAT_CHIP[format]));
  if (filters.city) push('city', filters.city, filters.city);
  else if (filters.country) push('country', filters.country, filters.country);
  if (filters.distance) push('distance', String(filters.distance), `Within ${filters.distance} km`);
  filters.topics.forEach((topic) => push('topics', topic, topic));
  filters.levels.forEach((level) => push('levels', level, LEVEL_CHIP[level]));
  filters.languages.forEach((lang) => push('languages', lang, lang));
  filters.types.forEach((type) => push('types', type, TYPE_CHIP[type]));
  filters.sources.forEach((source) => push('sources', source, SOURCE_CHIP[source]));
  if (filters.price) push('price', filters.price, PRICE_CHIP[filters.price]);
  if (filters.onlineOnly) push('onlineOnly', '1', 'Online events');

  return chips;
}

/** Removing a chip resets pagination — page 4 of a different result set is noise. */
export function withoutChip(filters: EventFilters, chip: FilterChip): EventFilters {
  const next: EventFilters = { ...filters, page: 1 };

  switch (chip.group) {
    case 'q':
      next.q = '';
      break;
    case 'dateWindow':
      next.dateWindow = 'any';
      next.from = null;
      next.to = null;
      break;
    case 'formats':
      next.formats = filters.formats.filter((value) => value !== chip.value);
      break;
    case 'country':
      next.country = null;
      break;
    case 'city':
      next.city = null;
      break;
    case 'distance':
      next.distance = null;
      break;
    case 'topics':
      next.topics = filters.topics.filter((value) => value !== chip.value);
      break;
    case 'levels':
      next.levels = filters.levels.filter((value) => value !== chip.value);
      break;
    case 'languages':
      next.languages = filters.languages.filter((value) => value !== chip.value);
      break;
    case 'types':
      next.types = filters.types.filter((value) => value !== chip.value);
      break;
    case 'sources':
      next.sources = filters.sources.filter((value) => value !== chip.value);
      break;
    case 'price':
      next.price = null;
      break;
    case 'onlineOnly':
      next.onlineOnly = false;
      break;
    default:
      break;
  }

  return next;
}

export function countActive(filters: EventFilters): number {
  return activeChips(filters).length;
}

export const DATE_LABEL: Record<DateWindow, string> = {
  any: 'Any date',
  today: 'Today',
  tomorrow: 'Tomorrow',
  this_week: 'This week',
  this_weekend: 'This weekend',
  this_month: 'This month',
  custom: 'Custom range',
};

const FORMAT_CHIP: Record<EventFormat, string> = {
  in_person: 'In person',
  online: 'Online',
  hybrid: 'Hybrid',
};

const LEVEL_CHIP: Record<ExperienceLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  all_levels: 'All levels',
};

const TYPE_CHIP: Record<EventKind, string> = {
  conference: 'Conference',
  meetup: 'Meetup',
  webinar: 'Webinar',
  workshop: 'Workshop',
  masterclass: 'Masterclass',
  panel: 'Panel discussion',
  networking: 'Networking',
  live_market_session: 'Live market session',
};

const SOURCE_CHIP: Record<EventSourceType, string> = {
  tradingnew: 'TradingNew',
  community: 'Community',
  external: 'External',
};

const PRICE_CHIP: Record<PriceType, string> = {
  free: 'Free',
  paid: 'Paid',
  external: 'External ticketing',
};

/**
 * Resolves a date window to an absolute range, evaluated against a supplied
 * "now" so the caller owns the clock and this stays testable.
 */
export function dateRange(filters: EventFilters, now: Date): { from: Date | null; to: Date | null } {
  const startOfDay = (date: Date) =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const addDays = (date: Date, days: number) =>
    new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

  const today = startOfDay(now);

  switch (filters.dateWindow) {
    case 'today':
      return { from: today, to: addDays(today, 1) };
    case 'tomorrow':
      return { from: addDays(today, 1), to: addDays(today, 2) };
    case 'this_week':
      return { from: today, to: addDays(today, 7) };
    case 'this_weekend': {
      // Saturday and Sunday of the current week, counting from today.
      const day = today.getUTCDay();
      const toSaturday = (6 - day + 7) % 7;
      const saturday = addDays(today, toSaturday);
      return { from: saturday, to: addDays(saturday, 2) };
    }
    case 'this_month': {
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      return { from: from < today ? today : from, to };
    }
    case 'custom':
      return {
        from: filters.from ? new Date(`${filters.from}T00:00:00Z`) : null,
        // Inclusive of the chosen end day, which is what a person picking it means.
        to: filters.to ? addDays(new Date(`${filters.to}T00:00:00Z`), 1) : null,
      };
    default:
      return { from: null, to: null };
  }
}
