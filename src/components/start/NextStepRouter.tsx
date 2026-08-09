'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Icon } from '@/components/ui/Icon';
import { contextParam, stashDraft } from '@/components/voyager/AskEntry';
import {
  FREE_TEXT_EXAMPLES,
  INTENTS,
  LEVELS,
  NEXT_STEP_STEPS,
  RESULTS,
  SECONDARY,
  WEALTH_GATE,
  WEALTH_UNAVAILABLE,
  WEALTH_VOYAGER_PROMPT,
  type AnswerOption,
  type NextStepAnswers,
  type NextStepClarification,
  type NextStepDestination,
  type NextStepIntent,
  type NextStepLevel,
  type NextStepResultKey,
  type SecondaryKey,
} from '@/content/nextStep';
import { Link, useRouter } from '@/i18n/navigation';
import { track } from '@/lib/events/analytics';
import {
  NEXT_STEP_VOYAGER_CONTEXT,
  clarificationFor,
  intentOrder,
  reasonFor,
  resolve,
  voyagerPrompt,
} from '@/lib/start/nextStep';
import { stashHandoff } from '@/lib/start/nextStepHandoff';
import styles from './NextStepRouter.module.css';

/**
 * "Find my next step" — the product router.
 *
 * Two questions, sometimes a third, and then a real place in the product. It is
 * emphatically not a suitability questionnaire: it never asks what somebody
 * holds or how much, and it never answers with an instrument. The output is a
 * door, and every door it names already exists.
 *
 * A guest completes the whole thing. The only screen that mentions an account is
 * the Wealth Hub result, and it explains what the hub is before it asks.
 *
 * Nothing here is written to the database. The answers live in this component
 * for as long as the flow is open; the two handoffs that outlive it — a question
 * for Voyager, the answers for Expert Services — go through session storage,
 * which dies with the tab.
 */

type Step = 'level' | 'intent' | 'clarify' | 'freetext' | 'loading' | 'result';

const SELECT_MS = 160;
const LOADING_MS = 700;

const EMPTY: NextStepAnswers = { level: null, intent: null, clarification: null };

export function NextStepRouter({
  authed,
  wealthEnabled,
}: {
  authed: boolean;
  wealthEnabled: boolean;
}) {
  const router = useRouter();
  const reduced = usePrefersReducedMotion();

  const [step, setStep] = useState<Step>('level');
  const [answers, setAnswers] = useState<NextStepAnswers>(EMPTY);
  const [freeText, setFreeText] = useState('');
  /* Where the free-text screen was entered from, so Back returns there and not
     to a question the reader skipped past. */
  const [freeTextFrom, setFreeTextFrom] = useState<'level' | 'intent'>('intent');
  /** The card being highlighted while the flow advances under it. */
  const [picking, setPicking] = useState<string | null>(null);

  /*
   * One transition at a time.
   *
   * Cards commit on click and the screen changes 160 ms later, which is exactly
   * long enough to press a second one. A ref rather than state because the guard
   * has to be true for the click that happens before the next render.
   */
  const moving = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const after = useCallback((ms: number, run: () => void) => {
    if (ms <= 0) {
      run();
      return;
    }
    timers.current.push(setTimeout(run, ms));
  }, []);

  useEffect(() => {
    track({ name: 'next_step_opened' });
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
    };
  }, []);

  /** Every screen change goes through here, so nothing forgets the scroll or the guard. */
  const go = useCallback(
    (next: Step) => {
      setStep(next);
      setPicking(null);
      moving.current = false;
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    },
    [reduced]
  );

  const commit = useCallback(
    (id: string, advance: () => void) => {
      if (moving.current) return;
      moving.current = true;
      setPicking(id);
      after(reduced ? 0 : SELECT_MS, advance);
    },
    [after, reduced]
  );

  const toResult = useCallback(() => {
    setPicking(null);
    setStep('loading');
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    after(reduced ? 0 : LOADING_MS, () => {
      moving.current = false;
      setStep('result');
    });
  }, [after, reduced]);

  const pickLevel = (level: NextStepLevel) =>
    commit(level, () => {
      track({ name: 'next_step_level_selected' });
      setAnswers({ level, intent: null, clarification: null });
      go('intent');
    });

  const pickIntent = (intent: NextStepIntent) =>
    commit(intent, () => {
      track({ name: 'next_step_intent_selected' });
      const next = { ...answers, intent, clarification: null };
      setAnswers(next);

      if (intent === 'unsure') {
        setFreeTextFrom('intent');
        go('freetext');
        return;
      }
      if (clarificationFor(intent, next.level)) {
        go('clarify');
        return;
      }
      toResult();
    });

  const pickClarification = (clarification: NextStepClarification) =>
    commit(clarification, () => {
      track({ name: 'next_step_clarification_selected' });
      setAnswers((current) => ({ ...current, clarification }));
      toResult();
    });

  const back = () => {
    if (step === 'result') {
      if (answers.intent === null || answers.intent === 'unsure') return go('freetext');
      return go(clarificationFor(answers.intent, answers.level) ? 'clarify' : 'intent');
    }
    if (step === 'clarify') {
      setAnswers((current) => ({ ...current, clarification: null }));
      return go('intent');
    }
    if (step === 'freetext') return go(freeTextFrom);
    return go('level');
  };

  const startOver = () => {
    track({ name: 'next_step_restarted' });
    setAnswers(EMPTY);
    setFreeText('');
    setFreeTextFrom('intent');
    go('level');
  };

  /** The step-1 escape, and the `unsure` intent, land on the same screen. */
  const escapeToVoyager = () => {
    setFreeTextFrom('level');
    go('freetext');
  };

  const askVoyager = () => {
    const text = freeText.trim();
    if (!text) return;

    stashDraft(voyagerPrompt(answers, text), { kind: NEXT_STEP_VOYAGER_CONTEXT });
    stashHandoff(answers, text);
    router.push({
      pathname: '/voyager',
      query: { context: contextParam({ kind: NEXT_STEP_VOYAGER_CONTEXT }) },
    });
  };

  const resultKey = resolve(answers);
  const railStep = step === 'level' ? 0 : step === 'result' ? 2 : 1;

  return (
    <div className={styles.page}>
      <ProgressRail active={railStep} />

      {step === 'level' && (
        <Screen
          eyebrow="Find your next step"
          title="Where are you today?"
          sub="Tell us where you are today and what you want to achieve. We’ll point you to the most useful place to start."
          aside={
            <button type="button" className={styles.escape} onClick={escapeToVoyager}>
              Don’t want to choose? Ask Voyager
              <Icon name="arrowRight" size={14} strokeWidth={2.4} />
            </button>
          }
        >
          <Options
            label="Where are you today?"
            options={LEVELS}
            picking={picking}
            selected={answers.level}
            onPick={pickLevel}
          />
        </Screen>
      )}

      {step === 'intent' && (
        <Screen
          eyebrow={levelTitle(answers.level)}
          title="What would you like to do?"
          sub="One answer is enough — we’ll only ask more if it changes where you should go."
          onBack={back}
        >
          <Options
            label="What would you like to do?"
            options={intentOrder(answers.level).map((id) => ({ id, ...INTENTS[id] }))}
            picking={picking}
            selected={answers.intent}
            onPick={pickIntent}
          />
        </Screen>
      )}

      {step === 'clarify' &&
        (() => {
          const spec = clarificationFor(answers.intent, answers.level);
          if (!spec) return null;
          return (
            <Screen eyebrow="One more thing" title={spec.title} sub={spec.sub} onBack={back}>
              <Options
                label={spec.title}
                options={spec.options}
                picking={picking}
                selected={answers.clarification}
                onPick={pickClarification}
              />
            </Screen>
          );
        })()}

      {step === 'freetext' && (
        <Screen
          eyebrow="In your own words"
          title="Let’s figure it out together"
          sub="You’ve told us enough to start. Describe what you’re trying to achieve in your own words."
          onBack={back}
        >
          <div className={styles.freeCard}>
            <label className={styles.freeLabel} htmlFor="next-step-question">
              What are you trying to achieve?
            </label>
            <textarea
              id="next-step-question"
              className={styles.freeInput}
              value={freeText}
              onChange={(event) => setFreeText(event.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Describe it however it comes out — Voyager will work with it."
            />

            <div className={styles.examplesLabel}>For example</div>
            <ul className={styles.examples}>
              {FREE_TEXT_EXAMPLES.map((example) => (
                <li key={example} className={styles.example}>
                  {example}
                </li>
              ))}
            </ul>

            <button
              type="button"
              className={styles.primary}
              disabled={!freeText.trim()}
              onClick={askVoyager}
            >
              Ask Voyager
              <Icon name="arrowRight" size={16} strokeWidth={2.4} />
            </button>

            {/* Said before the button is pressed, not discovered afterwards. */}
            <p className={styles.freeNote}>
              <Icon name="lock" size={13} strokeWidth={2} />
              What you type goes to Voyager and stays in this browser on the way there — never in
              the address bar, never in analytics.
            </p>
          </div>
        </Screen>
      )}

      {step === 'loading' && (
        <div className={styles.loading} role="status" aria-live="polite">
          <span className={styles.loadingDot} aria-hidden="true" />
          Finding your next step…
        </div>
      )}

      {step === 'result' && (
        <Result
          resultKey={resultKey}
          answers={answers}
          freeText={freeText}
          authed={authed}
          wealthEnabled={wealthEnabled}
          onBack={back}
          onStartOver={startOver}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------- the frame */

function ProgressRail({ active }: { active: number }) {
  return (
    <ol className={styles.rail}>
      {NEXT_STEP_STEPS.map((label, index) => {
        const state = index < active ? 'done' : index === active ? 'current' : 'todo';
        return (
          <li key={label} className={`${styles.railItem} ${styles[`rail_${state}`]}`}>
            <span className={styles.railNumber} aria-hidden="true">
              {state === 'done' ? <Icon name="check" size={12} strokeWidth={3} /> : index + 1}
            </span>
            <span className={styles.railLabel}>{label}</span>
            <span className="tn-sr-only">
              {state === 'done' ? ' — done' : state === 'current' ? ' — current step' : ''}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Screen({
  eyebrow,
  title,
  sub,
  aside,
  onBack,
  children,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  aside?: React.ReactNode;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.screen}>
      <div className={styles.head}>
        {onBack && (
          <button type="button" className={styles.back} onClick={onBack}>
            <Icon name="arrowLeft" size={15} strokeWidth={2.2} />
            Back
          </button>
        )}
        <div className={styles.eyebrow}>{eyebrow}</div>
        <h1 className={styles.h1}>{title}</h1>
        <p className={styles.sub}>{sub}</p>
        {aside}
      </div>
      {children}
    </section>
  );
}

/* ---------------------------------------------------------------- the cards */

/**
 * A question, as a radio group of cards.
 *
 * Real radio semantics rather than a grid of buttons that look chosen: "pick
 * one" is a promise the markup should make too, and a button says nothing about
 * it to anybody who is not looking at the tick.
 */
function Options<T extends string>({
  label,
  options,
  picking,
  selected,
  onPick,
}: {
  label: string;
  options: AnswerOption<T>[];
  picking: string | null;
  selected: T | null;
  onPick: (id: T) => void;
}) {
  return (
    <div className={styles.grid} role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const on = picking === option.id || (picking === null && selected === option.id);
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={on}
            className={`${styles.card} ${on ? styles.cardOn : ''}`}
            onClick={() => onPick(option.id)}
          >
            <span className={styles.cardTop}>
              <Icon name={option.icon} size={24} strokeWidth={1.7} className={styles.cardIcon} />
              {/* Selection is never colour alone — the tick is what still says
                  "this one" when the mint does not arrive. */}
              <span className={`${styles.tick} ${on ? styles.tickOn : ''}`} aria-hidden="true">
                {on && <Icon name="check" size={12} strokeWidth={3} />}
              </span>
            </span>
            <span className={styles.cardTitle}>{option.title}</span>
            <span className={styles.cardDesc}>{option.desc}</span>
            <span className={styles.cardGo} aria-hidden="true">
              <Icon name="arrowRight" size={14} strokeWidth={2.4} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- the answer */

function Result({
  resultKey,
  answers,
  freeText,
  authed,
  wealthEnabled,
  onBack,
  onStartOver,
}: {
  resultKey: NextStepResultKey;
  answers: NextStepAnswers;
  freeText: string;
  authed: boolean;
  wealthEnabled: boolean;
  onBack: () => void;
  onStartOver: () => void;
}) {
  const result = RESULTS[resultKey];
  const gated = resultKey === 'wealth' && !authed;
  const unavailable = resultKey === 'wealth' && !wealthEnabled;

  useEffect(() => {
    track({ name: 'next_step_recommendation_shown', destination: resultKey });
  }, [resultKey]);

  /* Voyager is opened with what the router already knows, so the conversation
     does not begin by asking for it again. */
  const seedVoyager = () => {
    stashDraft(voyagerPrompt(answers, freeText), { kind: NEXT_STEP_VOYAGER_CONTEXT });
  };

  const onDestination = () => {
    track({ name: 'next_step_destination_clicked', destination: resultKey, external: false });
    if (resultKey === 'voyager' || resultKey === 'voyagerCtx') seedVoyager();
    // Expert Services asks what you are trying to solve, which the router never
    // collected. What it does not need to ask twice is what it already has.
    if (resultKey === 'experts') stashHandoff(answers, freeText);
  };

  return (
    <section className={styles.screen}>
      <div className={styles.head}>
        <button type="button" className={styles.back} onClick={onBack}>
          <Icon name="arrowLeft" size={15} strokeWidth={2.2} />
          Back
        </button>
        <div className={styles.eyebrow}>Your best next step</div>
      </div>

      <div className={styles.resultCard}>
        <div className={styles.resultHead}>
          <span className={styles.resultIcon}>
            <Icon name={result.icon} size={26} strokeWidth={1.7} />
          </span>
          <h1 className={styles.resultTitle}>{result.title}</h1>
        </div>

        <p className={styles.resultReason}>{reasonFor(resultKey, answers.level)}</p>

        {unavailable ? (
          <WealthUnavailable />
        ) : gated ? (
          <WealthGate />
        ) : (
          <>
            <Destination
              destination={destinationFor(resultKey, result.destination)}
              label={result.cta}
              onClick={onDestination}
              onExternal={() =>
                track({
                  name: 'next_step_destination_clicked',
                  destination: resultKey,
                  external: true,
                })
              }
            />
            {result.helper && <p className={styles.helper}>{result.helper}</p>}
            {resultKey === 'wealth' && (
              <Link
                className={styles.textLink}
                href={{
                  pathname: '/voyager',
                  query: { context: contextParam({ kind: NEXT_STEP_VOYAGER_CONTEXT }) },
                }}
                onClick={() =>
                  stashDraft(WEALTH_VOYAGER_PROMPT, { kind: NEXT_STEP_VOYAGER_CONTEXT })
                }
              >
                Ask Voyager about Wealth Hub
              </Link>
            )}
          </>
        )}
      </div>

      <div className={styles.alsoHead}>You may also find useful</div>
      <div className={styles.alsoGrid}>
        {(unavailable ? (['voyager', 'experts'] as SecondaryKey[]) : result.secondary)
          .slice(0, 2)
          .map((key) => (
            <SecondaryCard key={key} secondaryKey={key} />
          ))}
      </div>

      <div className={styles.resultActions}>
        <button type="button" className={styles.ghost} onClick={onBack}>
          Change my answers
        </button>
        <button type="button" className={styles.textButton} onClick={onStartOver}>
          Start over
        </button>
      </div>
    </section>
  );
}

/** Voyager destinations carry the context in the URL; everything else is as declared. */
function destinationFor(
  key: NextStepResultKey,
  destination: NextStepDestination
): NextStepDestination {
  if (key !== 'voyager' && key !== 'voyagerCtx') return destination;
  return {
    kind: 'internal',
    href: { pathname: '/voyager', query: { context: contextParam({ kind: NEXT_STEP_VOYAGER_CONTEXT }) } },
  };
}

function Destination({
  destination,
  label,
  onClick,
  onExternal,
}: {
  destination: NextStepDestination;
  label: string;
  onClick: () => void;
  onExternal: () => void;
}) {
  if (destination.kind === 'external') {
    return (
      <a
        className={styles.primary}
        href={destination.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onExternal}
      >
        {label}
        <Icon name="arrowUpRight" size={16} strokeWidth={2.4} />
      </a>
    );
  }

  return (
    <Link className={styles.primary} href={destination.href} onClick={onClick}>
      {label}
      <Icon name="arrowRight" size={16} strokeWidth={2.4} />
    </Link>
  );
}

function SecondaryCard({ secondaryKey }: { secondaryKey: SecondaryKey }) {
  const card = SECONDARY[secondaryKey];

  const body = (
    <>
      <Icon name={card.icon} size={20} strokeWidth={1.7} className={styles.alsoIcon} />
      <span className={styles.alsoText}>
        <span className={styles.alsoTitle}>{card.title}</span>
        <span className={styles.alsoDesc}>{card.desc}</span>
      </span>
    </>
  );

  if (card.destination.kind === 'external') {
    return (
      <a
        className={styles.alsoCard}
        href={card.destination.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {body}
        <Icon name="arrowUpRight" size={13} strokeWidth={2.4} className={styles.alsoArrow} />
        <span className="tn-sr-only">Opens tradingview.com in a new tab</span>
      </a>
    );
  }

  return (
    <Link className={styles.alsoCard} href={card.destination.href} prefetch={false}>
      {body}
      <Icon name="chevronRight" size={13} strokeWidth={2.4} className={styles.alsoArrow} />
    </Link>
  );
}

/**
 * The Wealth Hub account gate.
 *
 * The reason paragraph above it has already explained what the hub is for. Only
 * then does this appear, and it says why an account is needed rather than
 * treating the sign-up as self-evident: registration is asked for to save
 * something, never as a toll on the way in.
 */
function WealthGate() {
  return (
    <div className={styles.gate}>
      <span className={styles.gateChip}>
        <Icon name="lock" size={13} strokeWidth={2.2} />
        {WEALTH_GATE.chip}
      </span>
      <p className={styles.gateBody}>{WEALTH_GATE.body}</p>
      <div className={styles.gateActions}>
        <Link
          className={styles.primary}
          href={{ pathname: '/sign-up', query: { next: WEALTH_GATE.returnTo } }}
        >
          {WEALTH_GATE.primary}
          <Icon name="arrowRight" size={16} strokeWidth={2.4} />
        </Link>
        <Link
          className={styles.ghost}
          href={{ pathname: '/sign-in', query: { next: WEALTH_GATE.returnTo } }}
        >
          {WEALTH_GATE.secondary}
        </Link>
      </div>
    </div>
  );
}

/** With the hub switched off, say so — a primary CTA into a 404 is worse than none. */
function WealthUnavailable() {
  return (
    <div className={styles.gate}>
      <span className={styles.gateChip}>
        <Icon name="clock" size={13} strokeWidth={2.2} />
        {WEALTH_UNAVAILABLE.chip}
      </span>
      <p className={styles.gateBody}>{WEALTH_UNAVAILABLE.body}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ motion */

/**
 * Whether this browser has asked for less movement.
 *
 * The two delays in this flow are the 160 ms selection highlight and the 700 ms
 * transition before the result. Neither carries information, so under reduced
 * motion both become zero rather than becoming a slower version of themselves.
 *
 * Read as an external store rather than copied into state by an effect: the
 * media query is the source of truth, and mirroring it costs a second render on
 * every mount to arrive at what `matchMedia` could already answer.
 */
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia?.(REDUCED_MOTION);
  if (!query) return () => {};

  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function reducedMotionSnapshot(): boolean {
  return window.matchMedia?.(REDUCED_MOTION).matches === true;
}

/** On the server there is no preference to read, and no animation running yet. */
function reducedMotionServerSnapshot(): boolean {
  return false;
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    reducedMotionSnapshot,
    reducedMotionServerSnapshot
  );
}

function levelTitle(level: NextStepLevel | null): string {
  return LEVELS.find((option) => option.id === level)?.title ?? 'About you';
}
