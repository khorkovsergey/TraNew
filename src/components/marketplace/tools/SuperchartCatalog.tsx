import {
  ASSET_CLASSES,
  COMPLEXITIES,
  presetQuery,
  SUPERCHART_PRESETS,
  USE_CASES,
  VOYAGER_PROMPTS,
  type SuperchartPreset,
} from '@/content/superchartCatalog';
import { Icon } from '@/components/ui/Icon';
import { Link } from '@/i18n/navigation';
import { INDICATORS } from '@/lib/superchart/indicators';
import { ChartPreview } from './ChartPreview';
import { ToolsRail } from './ToolsRail';
import styles from './Tools.module.css';

/**
 * The Superchart catalogue.
 *
 * Six ways into the workspace that already exists, filtered by three facets
 * held in the query string. Every card's button is a link to `/supercharts`
 * carrying the preset — no chart is drawn here beyond the illustration on the
 * card, and nothing about the workspace is duplicated.
 *
 * The filters are anchors rather than a client component. There are eleven of
 * them, each with one destination; a bundle to compute those destinations in the
 * browser would be a bundle to avoid writing eleven hrefs.
 */

const PATH = '/marketplace/tools/supercharts' as const;

export type SuperchartFilters = {
  asset: string | null;
  use: string | null;
  level: string | null;
};

export function selectPresets(filters: SuperchartFilters): SuperchartPreset[] {
  return SUPERCHART_PRESETS.filter((preset) => {
    if (filters.asset && preset.asset !== filters.asset) return false;
    if (filters.use && preset.use !== filters.use) return false;
    if (filters.level && preset.level !== filters.level) return false;
    return true;
  });
}

/** Each facet is single-select, so clicking the active option clears it. */
function query(filters: SuperchartFilters, patch: Partial<SuperchartFilters>) {
  const next = { ...filters, ...patch };
  const out: Record<string, string> = {};
  if (next.asset) out.asset = next.asset;
  if (next.use) out.use = next.use;
  if (next.level) out.level = next.level;
  return out;
}

function levelClass(level: SuperchartPreset['level']): string {
  if (level === 'Beginner') return styles.levelBeginner;
  if (level === 'Intermediate') return styles.levelIntermediate;
  return styles.levelAdvanced;
}

/** What a study is called, taken from the registry that computes it. */
function studyLabel(definitionId: string, params: Record<string, number>): string {
  const definition = INDICATORS[definitionId];
  if (!definition) return definitionId;
  return definition.label({ ...definition.defaults, ...params });
}

function Facet({
  title,
  options,
  selected,
  filters,
  patchKey,
}: {
  title: string;
  options: readonly string[];
  selected: string | null;
  filters: SuperchartFilters;
  patchKey: keyof SuperchartFilters;
}) {
  return (
    <div className={styles.filterBarGroup}>
      <div className={styles.filterBarTitle}>{title}</div>
      <div className={styles.pillRow}>
        {options.map((option) => {
          const on = selected === option;
          return (
            <Link
              key={option}
              className={`${styles.pill} ${on ? styles.pillOn : ''}`}
              href={{
                pathname: PATH,
                query: query(filters, { [patchKey]: on ? null : option }),
              }}
              aria-pressed={on}
            >
              {on && <Icon name="check" size={11} strokeWidth={3.2} />}
              {option}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function SuperchartCatalog({
  filters,
  presets,
}: {
  filters: SuperchartFilters;
  presets: SuperchartPreset[];
}) {
  const filtered = Boolean(filters.asset || filters.use || filters.level);

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <ToolsRail active="supercharts" />

        <div className={styles.main}>
          <div className={styles.breadcrumb}>
            <Link href="/marketplace">Marketplace</Link>
            <span className={styles.breadcrumbSep}>/</span>
            <Link href="/marketplace/tools">Tools &amp; Data</Link>
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbHere}>Supercharts</span>
          </div>

          <span className={`${styles.eyebrow} ${styles.eyebrowBlue}`}>
            <Icon name="sparkle" size={13} strokeWidth={2.2} />
            Voyager on every chart
          </span>
          <h1 className={styles.h1} style={{ marginTop: 12 }}>
            Supercharts
          </h1>
          <p className={styles.lead}>
            Ready-made chart workspaces. Open one, ask Voyager what it shows, and extend it with
            Pine Script. Every workspace opens the chart you already have — this page only decides
            what it starts with.
          </p>

          <div className={styles.filterBar}>
            <Facet
              title="Asset class"
              options={ASSET_CLASSES}
              selected={filters.asset}
              filters={filters}
              patchKey="asset"
            />
            <Facet
              title="Use case"
              options={USE_CASES}
              selected={filters.use}
              filters={filters}
              patchKey="use"
            />
            <Facet
              title="Complexity"
              options={COMPLEXITIES}
              selected={filters.level}
              filters={filters}
              patchKey="level"
            />
          </div>

          <div className={styles.chipRow} style={{ marginTop: 20 }}>
            <span className={styles.resultCount}>
              {presets.length} {presets.length === 1 ? 'workspace' : 'workspaces'}
            </span>
            {filtered && (
              <Link className={styles.linkButton} href={PATH}>
                Clear filters
              </Link>
            )}
          </div>

          {presets.length > 0 ? (
            <div className={`${styles.grid} ${styles.gridWide}`}>
              {presets.map((preset) => (
                <article className={styles.card} key={preset.id}>
                  <div>
                    <div className={styles.workspaceHead}>
                      <span className={styles.symbolChip}>{preset.ticker}</span>
                      <span>{preset.interval}</span>
                      <span style={{ flex: 1 }} />
                      <span style={{ color: 'var(--tn-blue)' }}>Voyager</span>
                    </div>
                    <ChartPreview seed={preset.seed} accent={preset.accent} bars={30} />
                  </div>

                  <div className={styles.cardBody}>
                    <div className={styles.badgeRow}>
                      {preset.tags.map((tag) => (
                        <span className={styles.badge} key={tag}>
                          {tag}
                        </span>
                      ))}
                      <span className={`${styles.levelBadge} ${levelClass(preset.level)}`}>
                        {preset.level}
                      </span>
                    </div>

                    <h2 className={styles.cardTitle} style={{ marginTop: 10, fontSize: 17 }}>
                      {preset.title}
                    </h2>
                    <p className={styles.cardText}>{preset.description}</p>

                    <div className={styles.included}>
                      <div className={styles.includedTitle}>Included</div>
                      <div className={styles.includedChips}>
                        {preset.studies.map((study) => (
                          <span className={styles.includedChip} key={study.definitionId}>
                            {studyLabel(study.definitionId, study.params)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <Link
                      className={styles.blueButton}
                      href={{ pathname: '/supercharts', query: presetQuery(preset) }}
                    >
                      Open chart
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <div className={styles.emptyTitle}>No workspaces match those filters</div>
              <p className={styles.emptyText}>
                The catalogue is still small. Clear the filters, or open a blank chart and build
                your own with Voyager.
              </p>
              <div className={styles.emptyActions}>
                <Link className={styles.ghostButton} href={PATH}>
                  Clear filters
                </Link>
                <Link className={styles.ghostButton} href="/supercharts">
                  Open a blank chart
                </Link>
              </div>
            </div>
          )}

          <div className={styles.voyagerStrip}>
            <div className={styles.voyagerStripMain}>
              {/* eslint-disable-next-line @next/next/no-img-element -- decorative, fixed size. */}
              <img src="/redesign/voyager-robot.png" alt="" aria-hidden="true" />
              <div style={{ minWidth: 0 }}>
                <h2 className={styles.sectionH2} style={{ margin: 0, fontSize: 18 }}>
                  Every Superchart comes with Voyager
                </h2>
                <p className={styles.cardText} style={{ maxWidth: '46em' }}>
                  Voyager reads the symbol, interval and studies on the chart in front of you. Ask
                  what a move means, or ask it to add something — it writes the Pine Script, shows
                  you the change, and applies it only when you approve.
                </p>
              </div>
            </div>

            <div className={styles.voyagerPrompts}>
              {VOYAGER_PROMPTS.map((prompt) => (
                <Link className={styles.voyagerPrompt} href="/supercharts" key={prompt}>
                  “{prompt}”
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
