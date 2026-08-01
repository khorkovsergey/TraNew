'use client';

import { useEffect, useState } from 'react';
import styles from './Events.module.css';

/**
 * Where the person is.
 *
 * The order matters and is the point of this component: an explicit choice wins,
 * then whatever they chose last time, then nothing. Browser geolocation is asked
 * for only when the "Use my location" item is pressed — never on load — and what
 * comes back is reduced to a city before it is stored. Coordinates are used for
 * one lookup and discarded.
 *
 * Nothing here writes a precise position anywhere. An events page has no business
 * knowing which building someone is in.
 */

const KEY = 'tn_events_location_v2';

export function LocationPicker({
  city,
  country,
  cities,
  onChange,
}: {
  city: string | null;
  country: string | null;
  cities: string[];
  onChange: (city: string | null, country: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [denied, setDenied] = useState(false);

  // Remembered only after an explicit choice, so this restores a decision rather
  // than making one.
  useEffect(() => {
    if (city) return;
    try {
      const stored = localStorage.getItem(KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as { city: string; country: string | null };
      if (parsed.city) onChange(parsed.city, parsed.country ?? null);
    } catch {
      /* Storage unavailable — the manual picker is still there. */
    }
    // Deliberately once, on mount: this is a fallback, not a subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (next: string | null) => {
    setOpen(false);
    setDenied(false);
    try {
      if (next) localStorage.setItem(KEY, JSON.stringify({ city: next, country }));
      else localStorage.removeItem(KEY);
    } catch {
      /* Not being able to remember it is not a reason to refuse the change. */
    }
    onChange(next, next ? country : null);
  };

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setDenied(true);
      return;
    }

    setAsking(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setAsking(false);
        // Reduced to the nearest city we know about; the coordinates go no
        // further than this function.
        const nearest = nearestCity(position.coords.latitude, position.coords.longitude, cities);
        choose(nearest);
      },
      () => {
        setAsking(false);
        setDenied(true);
      },
      { maximumAge: 600_000, timeout: 8000 }
    );
  };

  return (
    <span style={{ position: 'relative' }}>
      <button
        type="button"
        className={styles.control}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((value) => !value)}
      >
        <Pin />
        {city ?? 'Anywhere'}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Choose a location"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 20,
            minWidth: 220,
            background: 'var(--tn-surface)',
            border: '1px solid var(--tn-border-control)',
            borderRadius: 'var(--tn-radius-card)',
            boxShadow: 'var(--tn-shadow-dropdown)',
            padding: 8,
          }}
        >
          <LocationOption selected={!city} onClick={() => choose(null)}>
            Anywhere
          </LocationOption>

          {cities.map((name) => (
            <LocationOption key={name} selected={city === name} onClick={() => choose(name)}>
              {name}
            </LocationOption>
          ))}

          <LocationOption selected={false} onClick={useMyLocation}>
            {asking ? 'Asking your browser…' : 'Use my location'}
          </LocationOption>

          {denied && (
            <p
              style={{
                margin: '6px 10px 4px',
                fontSize: 11.5,
                lineHeight: 1.45,
                color: 'var(--tn-text-muted)',
              }}
            >
              Your browser did not share a location. Pick a city from the list instead.
            </p>
          )}
        </div>
      )}
    </span>
  );
}

function LocationOption({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: selected ? 'var(--tn-chip-bg)' : 'transparent',
        border: 0,
        borderRadius: 10,
        padding: '9px 12px',
        font: 'inherit',
        fontSize: 13.5,
        fontWeight: selected ? 700 : 600,
        color: 'var(--tn-text)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

/** Coarse city coordinates, used only to name a city and then forgotten. */
const CITY_POINTS: Record<string, [number, number]> = {
  Limassol: [34.707, 33.022],
  Nicosia: [35.185, 33.382],
  Athens: [37.983, 23.727],
  London: [51.507, -0.128],
  Berlin: [52.52, 13.405],
  Tokyo: [35.676, 139.65],
  Mumbai: [19.076, 72.877],
  'New York': [40.713, -74.006],
};

function nearestCity(latitude: number, longitude: number, cities: string[]): string | null {
  let best: { city: string; distance: number } | null = null;

  for (const city of cities) {
    const point = CITY_POINTS[city];
    if (!point) continue;
    const distance = Math.hypot(point[0] - latitude, point[1] - longitude);
    if (!best || distance < best.distance) best = { city, distance };
  }

  // Roughly 5 degrees. Beyond that "nearest" would be a claim, not a match.
  return best && best.distance < 5 ? best.city : null;
}

function Pin() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
