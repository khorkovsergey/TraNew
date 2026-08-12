'use client';

import { useMemo, useState } from 'react';
import { ago } from '../format';
import { Section, StateBadge } from '../primitives';
import styles from '../Observatory.module.css';
import { AREA_FILTERS, buildProductAreas, type AreaFilterKey } from './productAreaModel';
import type { DrawerRequest, ObservatoryData } from '../types';

/**
 * 07 — Product areas.
 *
 * The design's searchable, status-filtered grid. Twenty-six areas, one per
 * surface in the registry, each opening a drawer with its full metric set.
 *
 * The search and the filter are local state and that is not a compromise: they
 * narrow a list of already-rendered rows. Nothing here recomputes a rate, so
 * there is no way for a filter to produce a segmented KPI the query layer never
 * measured — the distinction the global filter strip has to be careful about
 * does not arise in a list of surfaces.
 */
export function ProductAreas({
  data,
  onOpen,
}: {
  data: ObservatoryData;
  onOpen: (request: DrawerRequest) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AreaFilterKey>('all');

  const areas = useMemo(() => buildProductAreas(data), [data]);

  const counts = useMemo(() => {
    const tally: Record<string, number> = { all: areas.length };
    for (const area of areas) tally[area.bucket] = (tally[area.bucket] ?? 0) + 1;
    return tally;
  }, [areas]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return areas.filter((area) => {
      if (filter !== 'all' && area.bucket !== filter) return false;
      if (!needle) return true;
      return (
        area.name.toLowerCase().includes(needle) ||
        area.key.includes(needle) ||
        area.category.includes(needle) ||
        area.routes.some((route) => route.includes(needle))
      );
    });
  }, [areas, filter, query]);

  return (
    <Section
      id="s-areas"
      number="07"
      title="Product areas"
      lede="Availability first, then behaviour · open any card for its full metric set"
    >
      <div className={styles.areaToolbar}>
        <label className={styles.searchBox}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4c6076" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <input
            className={styles.searchInput}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search areas"
            aria-label="Search product areas"
            type="search"
          />
        </label>

        {AREA_FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            className={styles.areaFilter}
            aria-pressed={filter === option.key}
            onClick={() => setFilter(option.key)}
          >
            {option.label} <span className={styles.areaFilterCount}>{counts[option.key] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className={styles.areaGrid}>
        {shown.length === 0 ? (
          <p className={styles.note}>No product area matches that search.</p>
        ) : (
          shown.map((area) => (
            <button
              key={area.key}
              type="button"
              className={styles.areaCard}
              data-state={area.state}
              data-absent={area.bucket === 'no_source' || area.bucket === 'external' ? 'true' : 'false'}
              onClick={() => onOpen({ kind: 'area', areaKey: area.key })}
            >
              <div className={styles.areaHead}>
                <span className={styles.areaName}>{area.name}</span>
                <StateBadge state={area.state} small />
              </div>

              <div>
                {area.stats.map((stat) => (
                  <div key={stat.label} className={styles.areaStat}>
                    <span className={styles.areaStatLabel}>{stat.label}</span>
                    <span
                      className={`${styles.areaStatValue} ${styles.toneText}`}
                      data-tone={stat.tone}
                    >
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className={styles.areaFoot}>
                <span className={styles.areaNote}>{area.note}</span>
                <span className={styles.areaNote} style={{ whiteSpace: 'nowrap' }}>
                  {ago(area.lastSeen, data.queriedAtMs)}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </Section>
  );
}
