'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { track } from '@/lib/events/analytics';
import {
  activeChips,
  clearFilters,
  countActive,
  DATE_LABEL,
  filtersToSearchString,
  withoutChip,
  type DateWindow,
  type EventFilters,
  type FilterChip,
  type ViewMode,
} from '@/lib/events/filters';
import {
  EVENT_KIND_LABEL,
  EXPERIENCE_LABEL,
  FORMAT_LABEL,
  LANGUAGES,
  TOPICS,
  type EventKind,
  type EventSourceType,
  type EventSummary,
  type ExperienceLevel,
  type EventFormat,
} from '@/lib/events/types';
import { EventCard } from './EventCard';
import { EventsCalendar } from './EventsCalendar';
import { EventsMap } from './EventsMap';
import { LocationPicker } from './LocationPicker';
import styles from './Events.module.css';

/**
 * The browsing surface: toolbar, filters, and whichever of the three views is
 * selected.
 *
 * All of it is driven from the URL. Every control writes a new query string and
 * the server re-renders from it, which is what makes refresh, back, forward and a
 * shared link behave identically. The alternative — local state mirrored into the
 * URL by an effect — has two sources of truth and eventually disagrees with
 * itself, usually on the back button.
 */

export type EventsBrowserProps = {
  filters: EventFilters;
  items: EventSummary[];
  total: number;
  hasMore: boolean;
  savedIds: string[];
  registeredIds: string[];
  waitlistedIds: string[];
  reasons: Record<string, string>;
  viewerTimeZone: string | null;
  knownCities: string[];
};

export function EventsBrowser(props: EventsBrowserProps) {
  const { filters, items, total, hasMore } = props;
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [panelOpen, setPanelOpen] = useState(false);

  const saved = useMemo(() => new Set(props.savedIds), [props.savedIds]);
  const registered = useMemo(() => new Set(props.registeredIds), [props.registeredIds]);
  const waitlisted = useMemo(() => new Set(props.waitlistedIds), [props.waitlistedIds]);
  const chips = activeChips(filters);

  /** One way to change the query, so no control can forget to reset the page. */
  const apply = useCallback(
    (next: EventFilters, resetPage = true) => {
      const target = resetPage ? { ...next, page: 1 } : next;
      startTransition(() => {
        router.replace(`${pathname}${filtersToSearchString(target)}` as never, { scroll: false });
      });
    },
    [pathname, router]
  );

  /*
   * The view, counted once per set of results.
   *
   * Keyed on what was actually shown rather than fired on mount, so filtering
   * and paging each count and two renders of the same results do not.
   */
  const viewed = useRef('');
  useEffect(() => {
    const active = countActive(filters);
    const key = `${filters.view}:${active}:${total}`;
    if (viewed.current === key) return;
    viewed.current = key;

    track({
      name: 'events_discovery_viewed',
      view: filters.view,
      filterCount: active,
      resultCount: total,
    });
  }, [filters, total]);

  const toggleIn = <T extends string>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];

  const setView = (view: ViewMode) => {
    track({ name: 'events_view_mode_changed', view });
    apply({ ...filters, view }, false);
  };

  const setDate = (dateWindow: DateWindow) => {
    track({ name: 'events_filter_applied', filter: 'date', valueCount: 1 });
    apply({ ...filters, dateWindow, from: null, to: null });
  };

  const [draftQuery, setDraftQuery] = useState(filters.q);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    track({ name: 'events_search_performed', queryLength: draftQuery.length, resultCount: total });
    apply({ ...filters, q: draftQuery });
  };

  const removeChip = (chip: FilterChip) => apply(withoutChip(filters, chip));

  return (
    <>
      <div className={styles.boardHead}>
        <h2 className={styles.boardTitle}>
          {filters.city ? `Events near ${filters.city}` : 'All events'}
        </h2>

        <div className={styles.toolbar}>
          <LocationPicker
            city={filters.city}
            country={filters.country}
            cities={props.knownCities}
            onChange={(city, country) => apply({ ...filters, city, country })}
          />

          <button
            type="button"
            className={`${styles.control} ${filters.onlineOnly ? styles.controlOn : ''}`}
            aria-pressed={filters.onlineOnly}
            onClick={() => apply({ ...filters, onlineOnly: !filters.onlineOnly })}
          >
            Online events
          </button>

          <select
            className={styles.control}
            aria-label="Date range"
            value={filters.dateWindow}
            onChange={(event) => setDate(event.target.value as DateWindow)}
          >
            {(
              ['any', 'today', 'tomorrow', 'this_week', 'this_weekend', 'this_month'] as DateWindow[]
            ).map((window) => (
              <option key={window} value={window}>
                {DATE_LABEL[window]}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={`${styles.control} ${panelOpen ? styles.controlOn : ''}`}
            aria-expanded={panelOpen}
            aria-controls="event-filters"
            onClick={() => setPanelOpen((open) => !open)}
          >
            Filters
            {chips.length > 0 && <span className={styles.controlCount}>{chips.length}</span>}
          </button>
        </div>
      </div>

      {/* One line: what to look for on the left, how to look at it on the right.
          The submit button sits inside the field rather than beside it, so the
          field is the width of the row minus its own button and not minus a
          gap and a button. */}
      <div className={styles.searchRow}>
        <form className={styles.search} onSubmit={submitSearch} role="search">
          <Magnifier />
          <input
            className={styles.searchInput}
            type="search"
            name="q"
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="Search events, topics, organizers or cities"
            aria-label="Search events"
          />
          <button type="submit" className={styles.searchSubmit}>
            Search
          </button>
        </form>

        <div className={styles.viewSwitch} role="group" aria-label="View">
          {(['cards', 'calendar', 'map'] as ViewMode[]).map((view) => (
            <button
              key={view}
              type="button"
              className={`${styles.control} ${filters.view === view ? styles.controlOn : ''}`}
              aria-pressed={filters.view === view}
              onClick={() => setView(view)}
            >
              {view === 'cards' ? 'Cards' : view === 'calendar' ? 'Calendar' : 'Map'}
            </button>
          ))}

          <select
            className={styles.control}
            aria-label="Sort by"
            value={filters.sort}
            onChange={(event) =>
              apply({ ...filters, sort: event.target.value as EventFilters['sort'] })
            }
          >
            <option value="recommended">Recommended</option>
            <option value="soonest">Soonest</option>
            <option value="nearest">Nearest</option>
            <option value="popular">Most popular</option>
            <option value="newest">Recently added</option>
          </select>
        </div>
      </div>

      {chips.length > 0 && (
        <div className={styles.chipRow}>
          {chips.map((chip) => (
            <button
              key={`${chip.group}-${chip.value}`}
              type="button"
              className={styles.activeChip}
              onClick={() => removeChip(chip)}
            >
              {chip.label}
              <span className={styles.activeChipX} aria-hidden="true">
                ✕
              </span>
              <span className="tn-sr-only">Remove filter</span>
            </button>
          ))}
          <button type="button" className={styles.clearAll} onClick={() => apply(clearFilters(filters))}>
            Clear all
          </button>
        </div>
      )}

      {panelOpen && (
        <div className={styles.panel} id="event-filters">
          <div className={styles.panelGrid}>
            <FilterGroup title="Format">
              {(['in_person', 'online', 'hybrid'] as EventFormat[]).map((format) => (
                <Option
                  key={format}
                  on={filters.formats.includes(format)}
                  onClick={() => apply({ ...filters, formats: toggleIn(filters.formats, format) })}
                >
                  {FORMAT_LABEL[format]}
                </Option>
              ))}
            </FilterGroup>

            <FilterGroup title="Topic">
              {TOPICS.map((topic) => (
                <Option
                  key={topic}
                  on={filters.topics.includes(topic)}
                  onClick={() => apply({ ...filters, topics: toggleIn(filters.topics, topic) })}
                >
                  {topic}
                </Option>
              ))}
            </FilterGroup>

            <FilterGroup title="Experience level">
              {(['beginner', 'intermediate', 'advanced', 'all_levels'] as ExperienceLevel[]).map(
                (level) => (
                  <Option
                    key={level}
                    on={filters.levels.includes(level)}
                    onClick={() => apply({ ...filters, levels: toggleIn(filters.levels, level) })}
                  >
                    {EXPERIENCE_LABEL[level]}
                  </Option>
                )
              )}
            </FilterGroup>

            <FilterGroup title="Language">
              {LANGUAGES.map((language) => (
                <Option
                  key={language}
                  on={filters.languages.includes(language)}
                  onClick={() =>
                    apply({ ...filters, languages: toggleIn(filters.languages, language) })
                  }
                >
                  {language}
                </Option>
              ))}
            </FilterGroup>

            <FilterGroup title="Event type">
              {(Object.keys(EVENT_KIND_LABEL) as EventKind[]).map((kind) => (
                <Option
                  key={kind}
                  on={filters.types.includes(kind)}
                  onClick={() => apply({ ...filters, types: toggleIn(filters.types, kind) })}
                >
                  {EVENT_KIND_LABEL[kind]}
                </Option>
              ))}
            </FilterGroup>

            <FilterGroup title="Organizer">
              {(['tradingnew', 'community', 'external'] as EventSourceType[]).map((source) => (
                <Option
                  key={source}
                  on={filters.sources.includes(source)}
                  onClick={() => apply({ ...filters, sources: toggleIn(filters.sources, source) })}
                >
                  {source === 'tradingnew'
                    ? 'TradingNew'
                    : source === 'community'
                      ? 'Community & verified'
                      : 'External'}
                </Option>
              ))}
            </FilterGroup>

            <FilterGroup title="Price">
              {(['free', 'paid'] as const).map((price) => (
                <Option
                  key={price}
                  on={filters.price === price}
                  onClick={() =>
                    apply({ ...filters, price: filters.price === price ? null : price })
                  }
                >
                  {price === 'free' ? 'Free' : 'Paid'}
                </Option>
              ))}
            </FilterGroup>

            <FilterGroup title="Distance">
              {[10, 50, 200].map((km) => (
                <Option
                  key={km}
                  on={filters.distance === km}
                  onClick={() =>
                    apply({ ...filters, distance: filters.distance === km ? null : km })
                  }
                >
                  Within {km} km
                </Option>
              ))}
            </FilterGroup>
          </div>

          <div className={styles.panelFoot}>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => apply(clearFilters(filters))}
            >
              Clear all
            </button>
            <button type="button" className={styles.primary} onClick={() => setPanelOpen(false)}>
              Show {total} {total === 1 ? 'event' : 'events'}
            </button>
          </div>
        </div>
      )}

      <p className={styles.resultCount} aria-live="polite">
        {pending ? 'Updating…' : `${total} ${total === 1 ? 'event' : 'events'}`}
      </p>

      {items.length === 0 ? (
        <EmptyResults
          hasFilters={chips.length > 0}
          city={filters.city}
          onClear={() => apply(clearFilters(filters))}
        />
      ) : filters.view === 'calendar' ? (
        <EventsCalendar items={items} viewerTimeZone={props.viewerTimeZone} />
      ) : filters.view === 'map' ? (
        <EventsMap items={items} viewerTimeZone={props.viewerTimeZone} />
      ) : (
        <div className={`${styles.grid} ${styles.gridWide}`}>
          {items.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              saved={saved.has(event.id)}
              registered={registered.has(event.id)}
              waitlisted={waitlisted.has(event.id)}
              reason={props.reasons[event.id] ?? null}
              viewerTimeZone={props.viewerTimeZone}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <div className={styles.more}>
          <button
            type="button"
            className={styles.secondary}
            disabled={pending}
            onClick={() => apply({ ...filters, page: filters.page + 1 }, false)}
          >
            {pending ? 'Loading…' : 'Load more events'}
          </button>
        </div>
      )}
    </>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className={styles.group}>
      <legend className={styles.groupTitle}>{title}</legend>
      <div className={styles.groupOptions}>{children}</div>
    </fieldset>
  );
}

function Option({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${styles.option} ${on ? styles.optionOn : ''}`}
      aria-pressed={on}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function EmptyResults({
  hasFilters,
  city,
  onClear,
}: {
  hasFilters: boolean;
  city: string | null;
  onClear: () => void;
}) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>
        {hasFilters ? 'Nothing matches those filters' : `No events in ${city ?? 'your area'} yet`}
      </p>
      <p className={styles.emptyText}>
        {hasFilters
          ? 'Try widening the date range or removing a filter. Online events are available wherever you are.'
          : 'Online events are open to everyone, wherever they are — or be the first to organize one here.'}
      </p>
      {hasFilters && (
        <div className={styles.emptyActions}>
          <button type="button" className={styles.secondary} onClick={onClear}>
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}

function Magnifier() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      style={{ color: 'var(--tn-text-muted)', flexShrink: 0 }}
      aria-hidden="true"
    >
      <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M21 21l-4.35-4.35" />
    </svg>
  );
}
