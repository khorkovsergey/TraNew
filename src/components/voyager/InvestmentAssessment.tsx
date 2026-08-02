'use client';

import { useState } from 'react';
import {
  READING_LABEL,
  STANCE_LABEL,
  type InvestmentSummary,
} from '@/lib/investment/summary';
import styles from './Investment.module.css';

/**
 * An investment assessment, inside the Voyager panel.
 *
 * The top of it is meant to be readable by someone who has never valued a
 * company: a sentence about which way the evidence leans, four short readings,
 * and what would change the picture. Everything a specialist would want —
 * the arithmetic, the sources, where the analysts disagreed — is behind a
 * disclosure, present but not in the way.
 *
 * Two things are deliberately not collapsible. The date the analysis describes,
 * because an assessment without one is undated advice; and the limitation that
 * this runs on fixtures, because a demo that has to be expanded before it
 * admits it is a demo is not admitting it.
 */

export function InvestmentAssessmentCard({ data }: { data: InvestmentSummary }) {
  return (
    <section className={styles.card}>
      <Header data={data} />
      <Readings data={data} />

      {data.bullCase.length > 0 && data.bearCase.length > 0 && <BullBear data={data} />}

      {data.invalidationConditions.length > 0 && (
        <Block title="What would change this">
          <ul className={styles.list}>
            {data.invalidationConditions.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Block>
      )}

      {data.unknowns.length > 0 && (
        <Block title="What is not known">
          <ul className={styles.list}>
            {data.unknowns.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Block>
      )}

      <Drawer label={`Show the arithmetic (${data.calculations.length})`}>
        <Calculations data={data} />
      </Drawer>

      <Drawer label={`Show the sources (${data.evidence.length})`}>
        <Sources data={data} />
      </Drawer>

      <Drawer label="Show where the analysts differed">
        <Debate data={data} />
      </Drawer>

      <Drawer label="How confidence was worked out">
        <ul className={styles.list}>
          {data.confidenceExplanation.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className={styles.note}>
          This describes how well evidenced the analysis is. It is not a probability that the price
          rises.
        </p>
      </Drawer>

      <footer className={styles.footer}>
        {data.limitations.map((line) => (
          <p className={styles.limitation} key={line}>
            {line}
          </p>
        ))}
        <p className={styles.disclaimer}>{data.disclaimer}</p>
      </footer>
    </section>
  );
}

function Header({ data }: { data: InvestmentSummary }) {
  return (
    <header className={styles.head}>
      <div className={styles.stance}>{STANCE_LABEL[data.stance] ?? data.stance}</div>

      <div className={styles.meta}>
        <span className={styles.instrument}>
          {data.instrumentName} · {data.symbol}
        </span>
        {/* Never collapsible: an assessment without its date is undated advice. */}
        <span className={styles.asOf}>As of {data.analysisAsOf}</span>
      </div>

      <div className={styles.confidenceRow}>
        <span className={`${styles.confidence} ${styles[`confidence_${data.confidenceLabel}`]}`}>
          Confidence {data.confidence} · {data.confidenceLabel}
        </span>
        <span className={styles.freshness}>
          {data.dataFreshness.newestEvidenceDays === null
            ? 'No dated sources'
            : `Newest source ${data.dataFreshness.newestEvidenceDays} days old`}
          {' · '}
          {Math.round(data.dataFreshness.primarySourceRatio * 100)}% primary
        </span>
      </div>
    </header>
  );
}

function Readings({ data }: { data: InvestmentSummary }) {
  const rows: Array<[string, string]> = [
    ['Business quality', data.businessQuality],
    ['Valuation', data.valuationStatus],
    ['Price behaviour', data.technicalState],
    ['Risk', data.riskLevel],
    ['Fit for you', data.portfolioFit],
  ];

  return (
    <div className={styles.readings}>
      {rows.map(([label, value]) => (
        <div className={styles.reading} key={label}>
          <span className={styles.readingLabel}>{label}</span>
          <span className={styles.readingValue}>{READING_LABEL[value] ?? value}</span>
        </div>
      ))}
    </div>
  );
}

function BullBear({ data }: { data: InvestmentSummary }) {
  return (
    <div className={styles.bullBear}>
      <div className={styles.side}>
        <div className={styles.sideTitle}>The case for</div>
        <ul className={styles.list}>
          {data.bullCase.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <div className={styles.side}>
        <div className={styles.sideTitle}>The case against</div>
        <ul className={styles.list}>
          {data.bearCase.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Calculations({ data }: { data: InvestmentSummary }) {
  return (
    <table className={styles.table}>
      <caption className={styles.caption}>
        Every figure above was computed here, not written by a language model.
      </caption>
      <thead>
        <tr>
          <th scope="col">Measure</th>
          <th scope="col">Result</th>
          <th scope="col">Formula</th>
        </tr>
      </thead>
      <tbody>
        {data.calculations.map((calc) => (
          <tr key={calc.id}>
            <th scope="row" className={styles.cellName}>
              {calc.type.replace(/_/g, ' ')}
              {calc.warnings.length > 0 && (
                <span className={styles.warning}>{calc.warnings[0]}</span>
              )}
            </th>
            <td className="tn-num">
              {calc.result === null ? '—' : formatResult(calc.result, calc.unit)}
            </td>
            <td className={styles.cellVersion}>v{calc.formulaVersion}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatResult(value: number, unit: string): string {
  if (unit === '%') return `${value.toFixed(1)}%`;
  if (unit === 'x') return `${value.toFixed(1)}x`;
  if (unit === 'ratio') return value.toFixed(2);
  if (unit === 'currency') return value.toLocaleString('en-GB', { maximumFractionDigits: 0 });
  return value.toFixed(2);
}

function Sources({ data }: { data: InvestmentSummary }) {
  return (
    <ul className={styles.sourceList}>
      {data.evidence.map((item) => (
        <li className={styles.source} key={item.id}>
          <div className={styles.sourceHead}>
            <span className={styles.sourceName}>{item.name}</span>
            <span className={styles.tier}>
              Tier {item.tier}
              {item.primary ? ' · primary' : ''}
            </span>
          </div>
          <div className={styles.sourceDates}>
            Describes {item.dataAsOf}
            {item.publishedAt ? ` · published ${item.publishedAt}` : ''}
          </div>
          {item.excerpt && <p className={styles.excerpt}>{item.excerpt}</p>}
        </li>
      ))}
    </ul>
  );
}

function Debate({ data }: { data: InvestmentSummary }) {
  return (
    <ul className={styles.list}>
      {data.debate.map((entry) => (
        <li key={entry.agent}>
          <strong>{entry.agent}</strong> — {STANCE_LABEL[entry.stance] ?? entry.stance}. {entry.summary}
        </li>
      ))}
      <li className={styles.note}>
        The committee weighs these by how well evidenced each one is, rather than averaging them.
      </li>
    </ul>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.block}>
      <h4 className={styles.blockTitle}>{title}</h4>
      {children}
    </div>
  );
}

/** A disclosure rather than a tab: closed by default, and its own element. */
function Drawer({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.drawer}>
      <button className={styles.drawerToggle} aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? '−' : '+'} {label}
      </button>
      {open && <div className={styles.drawerBody}>{children}</div>}
    </div>
  );
}
