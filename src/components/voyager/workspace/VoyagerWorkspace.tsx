'use client';

import { useCallback, useRef, useState } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Link } from '@/i18n/navigation';
import { VoyagerOrb } from '@/components/voyager/VoyagerOrb';
import {
  briefingFor,
  PROMPT_CATEGORIES,
  STARTERS,
  type Briefing,
} from '@/lib/voyager/workspace/landing';
import styles from './VoyagerWorkspace.module.css';

/**
 * The AI Voyager workspace.
 *
 * The rule this screen exists to hold: **simple by default, complex only after
 * somebody asks for something.** With no request in flight the canvas is the
 * only zone that renders — no conversation panel, no inspector, no toolbar, no
 * floating call to action. They are not hidden with CSS; they are not mounted.
 * That is what makes the transition from a bare page to a working workspace
 * legible instead of feeling like a page that was busy all along.
 *
 * Phase 1 builds the landing and the transition out of it. The zones it
 * transitions *into* arrive in Phase 2, and until then the workspace stage says
 * plainly what is not built yet rather than showing an empty frame that looks
 * broken.
 */

type Stage = 'landing' | 'requested';

type Props = {
  /** From the session on the server; the prototype's persona switch is not product. */
  personName: string | null;
};

export function VoyagerWorkspace({ personName }: Props) {
  const [stage, setStage] = useState<Stage>('landing');
  const [request, setRequest] = useState('');
  const [draft, setDraft] = useState('');
  const [showCategories, setShowCategories] = useState(false);
  const composer = useRef<HTMLTextAreaElement>(null);

  /*
   * The hour is read when a request starts, not during render.
   *
   * A greeting computed in the render body is an impure call that the server
   * and the browser can disagree about — the server says "Good morning" at
   * 11:59 and hydration says "Good afternoon" a second later, and React
   * replaces the tree. Held in state, set once.
   */
  const [briefing] = useState<Briefing | null>(() =>
    personName ? briefingFor(personName, new Date().getHours()) : null
  );

  const send = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setRequest(trimmed);
    setStage('requested');
    setDraft('');
  }, []);

  /** "New" returns to the bare screen, which is the other half of the rule. */
  const reset = useCallback(() => {
    setStage('landing');
    setRequest('');
    setDraft('');
    setShowCategories(false);
  }, []);

  if (stage === 'requested') {
    return (
      <div className={styles.shell}>
        <header className={styles.topBar}>
          <span className={styles.brand}>
            <VoyagerOrb size={20} />
            <span className={styles.wordmark}>AI Voyager</span>
          </span>
          <span className={styles.workspaceTitle}>New workspace</span>
          <span className={styles.namedBadge}>Named by Voyager</span>
          <span className={styles.spacer} />
          <button className={styles.topAction} onClick={reset}>
            New
          </button>
        </header>

        <div className={styles.stagePlaceholder}>
          <p className={styles.requestEcho}>{request}</p>
          <p className={styles.placeholderNote}>
            The three-zone workspace — conversation, canvas and inspector — is the next phase of
            this build. What is finished is the screen you came from and the transition you just
            made; the rest is deliberately absent rather than mocked up, because a frame with
            nothing behind it is harder to judge than an empty one.
          </p>
          <button className={styles.primaryAction} onClick={reset}>
            Back to the start
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.landing}>
      <div className={`${styles.column} ${showCategories ? styles.columnWide : ''}`}>
        {briefing ? (
          <>
            <VoyagerOrb size={42} />
            <h1 className={styles.greeting}>{briefing.greeting}</h1>
            <p className={styles.supporting}>{briefing.summary}</p>

            <div className={styles.briefingGrid}>
              {briefing.cards.map((card) => (
                <button
                  key={card.id}
                  className={styles.briefingCard}
                  onClick={() => send(card.title)}
                >
                  <span className={styles.briefingKind}>{card.kind}</span>
                  <span className={styles.briefingTitle}>{card.title}</span>
                  {/* Why this card is here. Required, not decorative. */}
                  <span className={styles.briefingWhy}>{card.because}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 className={styles.headline}>
              What would you like to understand, build or monitor?
            </h1>
            <p className={styles.supporting}>
              Ask a question, build a chart, analyse an asset or create a financial workspace.
              Voyager shows the data it used and asks before it changes anything.
            </p>
          </>
        )}

        <form
          className={styles.composer}
          onSubmit={(event) => {
            event.preventDefault();
            send(draft);
          }}
        >
          <textarea
            ref={composer}
            className={styles.composerInput}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends; Shift+Enter is a newline. A composer that needs a
              // mouse to submit is a composer people abandon mid-sentence.
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                send(draft);
              }
            }}
            rows={1}
            placeholder="Ask anything about markets, a company or your own plan"
            aria-label="Ask Voyager"
          />

          <button
            type="button"
            className={styles.composerIcon}
            title="Dictate (not built yet)"
            aria-label="Dictate — not built yet"
            disabled
          >
            <Icon name="bubble" size={17} />
          </button>
          <button
            type="button"
            className={styles.composerIcon}
            title="Attach a file (not built yet)"
            aria-label="Attach a file — not built yet"
            disabled
          >
            <Icon name="arrowUpRight" size={17} />
          </button>
          <button
            type="submit"
            className={styles.composerSend}
            title="Send"
            aria-label="Send"
            disabled={!draft.trim()}
          >
            <Icon name="arrowRight" size={17} />
          </button>
        </form>

        <div className={styles.starters}>
          {STARTERS.map((starter) => (
            <button
              key={starter.id}
              className={styles.starter}
              onClick={() => send(starter.text)}
            >
              <Icon name={starter.icon as IconName} size={15} className={styles.starterIcon} />
              <span className={styles.starterText}>{starter.text}</span>
              <Icon name="chevronDown" size={15} className={styles.starterChevron} />
            </button>
          ))}
        </div>

        <div className={styles.quietRow}>
          <button
            className={styles.quietLink}
            onClick={() => setShowCategories((value) => !value)}
            aria-expanded={showCategories}
          >
            {showCategories ? 'Hide examples' : 'More things I can do'}
          </button>

          {!personName && (
            <Link className={styles.quietSignup} href="/sign-up">
              Sign up and get <strong>3 000</strong> free tokens →
            </Link>
          )}
        </div>

        {showCategories && (
          <div className={styles.categories}>
            {PROMPT_CATEGORIES.map((category) => (
              <section key={category.id} className={styles.category}>
                <div className={styles.categoryHead}>
                  <span className={styles.categoryIcon}>
                    <Icon name={category.icon as IconName} size={14} />
                  </span>
                  <span>
                    <h2 className={styles.categoryTitle}>{category.title}</h2>
                    <p className={styles.categorySubtitle}>{category.subtitle}</p>
                  </span>
                </div>

                <div className={styles.categoryCards}>
                  {category.cards.map((card) => (
                    <button
                      key={card.text}
                      className={styles.promptCard}
                      onClick={() => send(card.text)}
                    >
                      <span>{card.text}</span>
                      {/* Said before the click, not after. */}
                      {card.pro && <span className={styles.proBadge}>Pro</span>}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
