'use client';

import { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import {
  ACADEMY_COURSES,
  ACADEMY_GUARANTEES,
  ACADEMY_TRUST,
  COURSE_CATEGORIES,
  COURSE_FACET_TYPES,
  COURSE_SORTS,
  type Course,
  type CourseSort,
} from '@/content/academyCourses';
import { Link } from '@/i18n/navigation';
import {
  EMPTY_QUERY,
  FORMAT_LABEL,
  cardMeta,
  facetCount,
  formatPrice,
  searchCourses,
  type CatalogQuery,
} from '@/lib/academy/courses';
import styles from './Courses.module.css';

/**
 * The Academy catalogue.
 *
 * Filtering happens in the browser over twelve courses. That is not a shortcut
 * around the server — it is the honest size of the data: round-tripping a
 * checkbox to filter a list this small would make the page slower and buy
 * nothing. When the catalogue is large enough for that to be wrong, the query
 * shape here is already the one a server filter would take.
 *
 * The counts beside each facet are counted over the whole catalogue rather than
 * over what is currently showing, so a filter never claims something is empty
 * until it has been tried.
 */

type FacetGroup = 'type' | 'format' | 'level' | 'provider' | 'price';

const FACET_GROUPS: Array<{ title: string; group: FacetGroup; options: readonly string[] }> = [
  { title: 'Course type', group: 'type', options: COURSE_FACET_TYPES },
  { title: 'Format', group: 'format', options: ['Online', 'Live Online', 'In-person', 'Hybrid'] },
  { title: 'Level', group: 'level', options: ['Beginner', 'Intermediate', 'Advanced', 'All Levels'] },
  { title: 'Provider', group: 'provider', options: ['TradingNew', 'External providers'] },
  { title: 'Price', group: 'price', options: ['Free', 'Paid'] },
];

function cover(image: string) {
  return { backgroundImage: `url(/redesign/courses/${image}.jpg)` };
}

function badgeClass(badge: Course['badge']) {
  if (badge === 'Bestseller') return styles.badgeBestseller;
  if (badge === 'Few seats left') return styles.badgeSeats;
  return styles.badgeNew;
}

/** 1214 → "1.2k". Review counts are read, not calculated with. */
function compact(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
}

export function CourseCatalog({ enrolledSlugs }: { enrolledSlugs: string[] }) {
  const [query, setQuery] = useState<CatalogQuery>(EMPTY_QUERY);
  const [sort, setSort] = useState<CourseSort>('Popular');

  const owned = useMemo(() => new Set(enrolledSlugs), [enrolledSlugs]);
  const results = useMemo(() => searchCourses(query, sort), [query, sort]);

  // The two most-reviewed courses. Featuring is a fact about the catalogue here,
  // not an editorial slot somebody has to remember to update.
  const featured = useMemo(
    () => [...ACADEMY_COURSES].sort((a, b) => (b.rating?.count ?? 0) - (a.rating?.count ?? 0)).slice(0, 2),
    []
  );

  const reviewed = ACADEMY_COURSES.filter((course) => course.rating);
  const totalReviews = reviewed.reduce((sum, course) => sum + (course.rating?.count ?? 0), 0);
  const averageRating =
    totalReviews === 0
      ? 0
      : reviewed.reduce((sum, course) => sum + course.rating!.score * course.rating!.count, 0) /
        totalReviews;

  const toggle = (group: FacetGroup, value: string) => {
    setQuery((current) => {
      const list = current[group];
      return {
        ...current,
        [group]: list.includes(value)
          ? list.filter((entry) => entry !== value)
          : [...list, value],
      };
    });
  };

  const activeChips: Array<{ label: string; clear: () => void }> = [];
  if (query.category !== 'All') {
    activeChips.push({
      label: query.category,
      clear: () => setQuery((current) => ({ ...current, category: 'All' })),
    });
  }
  for (const { group } of FACET_GROUPS) {
    for (const value of query[group]) {
      activeChips.push({ label: value, clear: () => toggle(group, value) });
    }
  }

  const clearAll = () => setQuery(EMPTY_QUERY);

  return (
    <div className={styles.main}>
      <section className={styles.hero}>
        <div>
          <h1 className={styles.h1}>Academy</h1>
          <p className={styles.lead}>
            Paid trading and investing courses from TradingNew and from providers we have checked.
          </p>

          <div className={styles.trustRow}>
            {ACADEMY_TRUST.map((item) => (
              <div className={styles.trustItem} key={item.title}>
                <span className={styles.trustIcon}>
                  <Icon name={item.icon} size={18} strokeWidth={1.9} />
                </span>
                <div>
                  <div className={styles.trustTitle}>{item.title}</div>
                  <div className={styles.trustText}>{item.text}</div>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.search}>
            <input
              className={styles.searchInput}
              value={query.q}
              onChange={(event) => setQuery((current) => ({ ...current, q: event.target.value }))}
              placeholder="Search courses, topics, instructors or providers…"
              aria-label="Search courses"
            />
            <span className={styles.searchButton} aria-hidden="true">
              <Icon name="search" size={17} strokeWidth={2.2} />
            </span>
          </div>
        </div>

        <div>
          <div className={styles.featuredLabel}>FEATURED</div>
          <div className={styles.featuredGrid}>
            {featured.map((course) => (
              <Link
                key={course.slug}
                className={styles.featured}
                style={cover(course.image)}
                href={{ pathname: '/marketplace/academy/[slug]', params: { slug: course.slug } }}
                prefetch={false}
              >
                <span className={styles.featuredScrim} />
                {course.badge && (
                  <span className={`${styles.badge} ${badgeClass(course.badge)}`}>
                    {course.badge}
                  </span>
                )}
                <span className={styles.featuredBody}>
                  <span className={styles.featuredTitle}>{course.title}</span>
                  <span className={styles.featuredMeta}>
                    {course.provider} · {formatPrice(course.price, course.currency)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
          <div className={styles.ratingLine}>
            <span className={styles.stars} aria-hidden="true">
              ★★★★★
            </span>
            <b className="tn-num">{averageRating.toFixed(1)}</b> average across{' '}
            {compact(totalReviews)} reviews
          </div>
        </div>
      </section>

      <div className={styles.categoryRow}>
        {['All', ...COURSE_CATEGORIES].map((category) => (
          <button
            key={category}
            className={`${styles.chip} ${query.category === category ? styles.chipOn : ''}`}
            onClick={() => setQuery((current) => ({ ...current, category }))}
            aria-pressed={query.category === category}
          >
            {category}
          </button>
        ))}
      </div>

      <div className={styles.catalogue}>
        <div className={styles.filters}>
          <div className={styles.filtersHead}>
            <span className={styles.filtersTitle}>FILTERS</span>
            <button className={styles.textButton} onClick={clearAll}>
              Clear all
            </button>
          </div>

          <div className={styles.facetGroups}>
            {FACET_GROUPS.map((facet) => (
              <div key={facet.group}>
                <div className={styles.facetTitle}>{facet.title}</div>
                <div className={styles.facetList}>
                  {facet.options.map((option) => {
                    const on = query[facet.group].includes(option);
                    return (
                      <label className={styles.facet} key={option}>
                        <input
                          className={styles.facetInput}
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(facet.group, option)}
                        />
                        <span className={`${styles.facetBox} ${on ? styles.facetBoxOn : ''}`}>
                          {on && <Icon name="check" size={11} strokeWidth={3.4} />}
                        </span>
                        <span className={`${styles.facetLabel} ${on ? styles.facetLabelOn : ''}`}>
                          {option}
                        </span>
                        <span className={`${styles.facetCount} tn-num`}>
                          {facetCount(facet.group, option)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <div className={styles.resultsHead}>
            <div className={styles.resultCount}>
              <b className="tn-num">{results.length}</b> {results.length === 1 ? 'course' : 'courses'}
              {query.q.trim() && <> matching “{query.q.trim()}”</>}
            </div>
            <div className={styles.sortRow}>
              <span className={styles.sortLabel}>Sort by</span>
              {COURSE_SORTS.map((option) => (
                <button
                  key={option}
                  className={`${styles.chip} ${styles.sortChip} ${sort === option ? styles.chipOn : ''}`}
                  onClick={() => setSort(option)}
                  aria-pressed={sort === option}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {activeChips.length > 0 && (
            <div className={styles.chipRow}>
              {activeChips.map((chip) => (
                <button className={styles.activeChip} key={chip.label} onClick={chip.clear}>
                  {chip.label}
                  <Icon name="close" size={11} strokeWidth={2.6} />
                </button>
              ))}
            </div>
          )}

          {results.length > 0 ? (
            <div className={styles.grid}>
              {results.map((course) => (
                <Link
                  key={course.slug}
                  className={styles.card}
                  href={{ pathname: '/marketplace/academy/[slug]', params: { slug: course.slug } }}
                  prefetch={false}
                >
                  <div className={styles.cover} style={cover(course.image)}>
                    {course.badge && (
                      <span className={`${styles.badge} ${badgeClass(course.badge)}`}>
                        {course.badge}
                      </span>
                    )}
                    <span className={styles.formatTag}>{FORMAT_LABEL[course.format]}</span>
                  </div>

                  <div className={styles.cardBody}>
                    <div className={styles.cardTitle}>{course.title}</div>
                    <div className={styles.cardProvider}>
                      <span>{course.provider}</span>
                      {course.providerVerified && (
                        <Icon
                          className={styles.verified}
                          name="checkCircle"
                          size={13}
                          strokeWidth={2.4}
                          aria-label="Verified provider"
                        />
                      )}
                    </div>
                    <div className={styles.cardMeta}>{cardMeta(course)}</div>

                    <div className={styles.cardFoot}>
                      {course.rating ? (
                        <span className={styles.cardRating}>
                          <Icon name="star" size={13} strokeWidth={2} />
                          <b className="tn-num">{course.rating.score.toFixed(1)}</b>
                          <span className="tn-num">({compact(course.rating.count)})</span>
                        </span>
                      ) : (
                        <span className={styles.unrated}>No reviews yet</span>
                      )}

                      {owned.has(course.slug) ? (
                        <span className={styles.ownedTag}>
                          <Icon name="check" size={12} strokeWidth={3} />
                          In your library
                        </span>
                      ) : (
                        <span
                          className={`${styles.price} tn-num ${
                            course.price === 0 ? styles.priceFree : ''
                          }`}
                        >
                          {formatPrice(course.price, course.currency)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>
                <Icon name="search" size={24} strokeWidth={1.8} />
              </span>
              <div className={styles.emptyTitle}>No courses match your filters</div>
              <p className={styles.emptyText}>
                Try removing a filter — or browse everything currently in Academy.
              </p>
              <div className={styles.emptyActions}>
                <button className={styles.primary} onClick={clearAll}>
                  Clear filters
                </button>
                <Link className={styles.ghost} href="/academy" prefetch={false}>
                  Free content in Learn
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={styles.guarantees}>
        {ACADEMY_GUARANTEES.map((item) => (
          <div className={styles.guarantee} key={item.title}>
            <span className={styles.guaranteeIcon}>
              <Icon name={item.icon} size={19} strokeWidth={1.9} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div className={styles.guaranteeTitle}>{item.title}</div>
              <div className={styles.guaranteeText}>{item.text}</div>
            </div>
          </div>
        ))}
      </div>

      <p className={styles.sampleNote}>
        No provider has published to Academy yet: these twelve courses, their instructors and their
        reviews are sample content, and enrolling is a demonstration — nothing is charged and no
        payment provider is connected.
      </p>
    </div>
  );
}
