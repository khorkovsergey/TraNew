'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Link, useRouter } from '@/i18n/navigation';
import { takeDraft } from '@/components/voyager/AskEntry';
import { track } from '@/lib/events/analytics';
import { buildContext } from '@/lib/voyager/context';
import {
  ALLOWANCE_KEY,
  adoptServerCount,
  askedInDialog,
  framed,
  historyFor,
  lastQuestion,
  limitLabel,
  MODES,
  offersActions,
  parseAllowance,
  screenFor,
  SUGGESTIONS,
  TOPICS,
  userTurn,
  type ChatMode,
  type Turn,
} from '@/lib/voyager/chat/transcript';
import {
  allowanceToday,
  canSend,
  contextLabel,
  EMPTY_ALLOWANCE,
  FREE_DAILY_LIMIT,
  GUEST_GATE_AFTER,
  parseContext,
  parsePending,
  remaining,
  requiresAccount,
  requiresConfirmation,
  spend,
  specFor,
  type Allowance,
  type Pending,
  type VoyagerActionId,
} from '@/lib/voyager/session';
import { parsePlan, type VoyagerModule, type VoyagerPlan } from '@/lib/voyager/workspace/contract';
import { confirmationFor, type Confirmation } from '@/lib/voyager/workspace/actions';
import { responseFor } from '@/lib/voyager/workspace/scenarios';
import { routeFor } from '@/components/voyager/actionRoutes';
import { runVoyagerAction } from '@/app/actions/voyagerActions';
import type { InvestmentSummary } from '@/lib/investment/summary';
import type { VoyagerResponse } from '@/lib/voyager/types';
import { InvestmentAssessmentCard } from '@/components/voyager/InvestmentAssessment';
import { VoyagerChart } from '@/components/voyager/chart/VoyagerChart';
import { HandoffCard, PineBlock } from './PineBlock';
import type { ChartPayload } from '@/lib/voyager/chart/build';
import type { PineArtifact } from '@/lib/voyager/tools/pine';
import type { TradingViewHandoff } from '@/lib/voyager/tools/tradingView';
import { ModuleCard } from '@/components/voyager/workspace/ModuleCard';
import styles from './VoyagerChat.module.css';

/**
 * Voyager — the dialogue agent, at `/voyager`.
 *
 * The screen is the composer. There is no landing in front of it and no
 * capability tour beside it: somebody arriving here has already decided to ask
 * something, and every pixel between them and the input is a pixel spent
 * telling them what they came to find out.
 *
 * Three things are structural rather than decoration, and each one is a
 * refusal:
 *
 * - **Nothing that changes anything runs without an explicit Confirm.** The
 *   sentence somebody agrees to is built from the action's own record, so a
 *   button cannot describe itself more kindly than it behaves.
 * - **An answer shows what it rests on.** The tool chips are the calls that
 *   actually ran and the source chips are what the server put in front of the
 *   model — not the model's account of itself, which sits last and is labelled
 *   as such.
 * - **A question is never lost.** The limit, the guest gate and an outage all
 *   queue the text rather than discarding it, because the thing a person typed
 *   is the one thing they cannot get back.
 *
 * The structured side of Voyager — plans, charts, comparison tables, Pine —
 * still renders, inside the answer that produced it. It moved here from a
 * three-column canvas; the canvas itself is now the research workspace next
 * door, which is a different thing and says so.
 */

/** Guest dialogue survives the trip through sign-in, and goes with the tab. */
const DIALOG_KEY = 'tn.voyager.dialog.v1';
const PENDING_KEY = 'tn.voyager.pending.v1';

type Props = {
  /** From the session on the server. Null is a guest. */
  personName: string | null;
  /** True on a plan with no daily ceiling, which changes every counter on screen. */
  unlimited: boolean;
  /** `?q=` — a question carried in from a link or a suggestion chip elsewhere. */
  seedQuestion: string | null;
  /** `symbol:TSLA`, `learn` — the page the question came from. */
  pageContext: string | null;
};

type Confirming =
  /**
   * An action offered under an answer, with what it will act on.
   *
   * The subject is captured when the button is pressed rather than read when
   * the confirmation is accepted: three answers later, "add this to my
   * watchlist" still means the instrument in the answer the button sat under.
   */
  | { kind: 'answer'; id: VoyagerActionId; ticker?: string; title: string; note: string }
  /** An action declared by a module inside an answer. */
  | { kind: 'module'; confirmation: Confirmation };

export function VoyagerChat({ personName, unlimited, seedQuestion, pageContext }: Props) {
  const router = useRouter();
  const authed = Boolean(personName);
  const context = useMemo(() => parseContext(pageContext), [pageContext]);

  /**
   * The context package, built once and used by both the request and the
   * actions.
   *
   * Built here rather than inside `deliver` because an action needs the same
   * facts the question was sent with — the instrument in particular. Two
   * derivations of "which symbol is this about" is how a watchlist row ends up
   * keyed by the word "chart".
   */
  const voyagerContext = useMemo(
    () =>
      buildContext(
        screenFor(context?.kind ?? null),
        context?.subject ?? undefined,
        context?.subject ? { ticker: context.subject.toUpperCase() } : undefined
      ),
    [context]
  );

  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<ChatMode>('explain');
  const [allowance, setAllowance] = useState<Allowance>(EMPTY_ALLOWANCE);
  const [sending, setSending] = useState(false);
  /** The question or action waiting on a gate, a limit or a connection. */
  const [pending, setPending] = useState<Pending>(null);
  const [gate, setGate] = useState<'auth' | 'limit' | 'error' | null>(null);
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  /** An action is with the server. The Confirm button says so and cannot be pressed twice. */
  const [running, setRunning] = useState(false);
  /**
   * Whether the server has told us what has been spent today.
   *
   * False until it has, and the counter says "—" rather than a number for
   * exactly that long. The allowance is per visitor and lives on the server; a
   * browser that has never asked knows nothing about it, and drawing zero is
   * the difference between not knowing and claiming.
   */
  const [usageKnown, setUsageKnown] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** Ticks inside a permission-request module — a decision, not display. */
  const [ticked, setTicked] = useState<string[]>([]);
  /** How much of the newest answer has been written out. */
  const [reveal, setReveal] = useState<{ id: string; chars: number } | null>(null);

  const foot = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLInputElement>(null);
  /** The question already in flight, so nothing is asked twice. */
  const inFlight = useRef<string | null>(null);
  /**
   * Whether the counter has been settled by something authoritative.
   *
   * The bootstrap read and the first answer race. The answer wins whichever
   * lands second, because it was counted after the question — a bootstrap
   * arriving late would otherwise walk the number backwards in front of
   * somebody who had just watched it move.
   */
  const usageSettled = useRef(false);

  const now = useCallback(() => new Date(), []);

  /* ------------------------------------------------------------ restoring */

  /*
   * The dialogue, the counter and anything queued, read back once on arrival.
   *
   * In an effect rather than an initialiser because the server has neither
   * storage: reading during render would build markup that hydration then
   * disagrees with, and the disagreement would be the whole conversation.
   */
  useEffect(() => {
    let restored: Turn[] = [];

    try {
      const raw = sessionStorage.getItem(DIALOG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          restored = parsed.filter(
            (turn): turn is Turn =>
              !!turn &&
              typeof turn === 'object' &&
              typeof (turn as Turn).text === 'string' &&
              ((turn as Turn).role === 'user' || (turn as Turn).role === 'assistant')
          );
        }
      }
    } catch {
      /* Unreadable storage means an empty dialogue, which is recoverable. */
    }

    /*
     * The browser's copy is a head start, not an answer.
     *
     * It is read so the number has something to show the instant the server
     * replies, but `usageKnown` stays false until it does — the count lives on
     * the server against a subject this browser cannot see, and anything here
     * is at best this device's share of it.
     */
    try {
      const raw = localStorage.getItem(ALLOWANCE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setAllowance(allowanceToday(parseAllowance(JSON.parse(raw)), new Date()));
    } catch {
      /* Private mode. The server's count is what decides anything anyway. */
    }

    let queued: Pending = null;
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (raw) queued = parsePending(JSON.parse(raw));
    } catch {
      /* Nothing queued, which is the ordinary case. */
    }

    if (restored.length) {
      setTurns(restored);
      /*
       * The gate's promise, kept. A guest who signed in mid-dialogue was told
       * the conversation would be restored exactly here, and this is the line
       * that has to be true for that to be a promise rather than a slogan.
       */
      if (authed) track({ name: 'voyager_restored_after_auth', turns: restored.length });
    }

    if (queued) {
      setPending(queued);
      /*
       * An action queued behind the gate runs now that there is an account —
       * as a confirmation, never as a fait accompli.
       */
      if (authed && queued.kind === 'action') {
        setConfirming({
          kind: 'answer',
          id: queued.id,
          // The dialogue is restored in the same effect, so what the action
          // will act on is read from what came back rather than from an empty
          // transcript.
          ticker: [...restored].reverse().find((turn) => turn.ticker)?.ticker,
          title: lastQuestion(restored) ?? 'Voyager conversation',
          note: transcriptText(restored),
        });
        setPending(null);
        try {
          sessionStorage.removeItem(PENDING_KEY);
        } catch {
          /* Nothing to clean up. */
        }
      }
    }
    // Once, on arrival: a starting point rather than a subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * What the server says has been spent today.
   *
   * The counter is kept on the server against a subject the browser cannot
   * compute — for a guest it is a hash of their address, which is shared with
   * every other tab and window on it. So this page has to ask, and until it has
   * an answer it must not draw a number.
   *
   * It used to draw zero. A fresh browser on an address that had already spent
   * nine questions showed "Free: 0 of 10", and the first answer corrected it to
   * 9 — which reads exactly like one question costing nine, and was reported as
   * a quota bug that did not exist. The counter was fine; the placeholder was
   * the defect.
   *
   * A GET here spends nothing: the route peeks for this and only counts on POST.
   */
  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams({
      screen: voyagerContext.screen,
      subject: voyagerContext.subject,
    });

    fetch(`/api/voyager?${params}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { used?: number; total?: number | null } | null) => {
        if (cancelled || !data || typeof data.used !== 'number') return;
        /*
         * An answer that has already come back knows more than this does.
         *
         * The bootstrap and the first question race, and the bootstrap can lose
         * — it was read before the question was counted. Letting it land second
         * would walk the counter backwards in front of somebody who had just
         * watched it move.
         */
        if (usageSettled.current) return;

        usageSettled.current = true;
        setAllowance(adoptServerCount(data.used, data.total, new Date()) ?? EMPTY_ALLOWANCE);
        setUsageKnown(true);
      })
      .catch(() => {
        /*
         * The count could not be fetched. The line keeps saying it does not
         * know rather than inventing a number, and the first answer will
         * correct it — the server's own reply carries the real figure.
         */
      });

    return () => {
      cancelled = true;
    };
  }, [voyagerContext.screen, voyagerContext.subject]);

  /* The dialogue is written back on every change, so sign-in cannot lose it. */
  useEffect(() => {
    if (!turns.length) return;
    try {
      sessionStorage.setItem(DIALOG_KEY, JSON.stringify(turns.slice(-40)));
    } catch {
      /* Private mode, or full. The conversation still works for this visit. */
    }
  }, [turns]);

  const rememberAllowance = useCallback((next: Allowance) => {
    setAllowance(next);
    try {
      localStorage.setItem(ALLOWANCE_KEY, JSON.stringify(next));
    } catch {
      /* Display only — the server keeps the count that decides anything. */
    }
  }, []);

  const queue = useCallback((next: Pending) => {
    setPending(next);
    try {
      if (next) sessionStorage.setItem(PENDING_KEY, JSON.stringify(next));
      else sessionStorage.removeItem(PENDING_KEY);
    } catch {
      /* The queue is a convenience; the text is still on screen. */
    }
  }, []);

  /* --------------------------------------------------------------- asking */

  /**
   * One question, delivered.
   *
   * It does not put the question on screen — `send` does that, and a retry must
   * not repeat a bubble that is already in the transcript. What it owns is the
   * request, the answer, and the honest version of both failing.
   */
  const deliver = useCallback(
    async (question: string) => {
      setSending(true);
      setGate(null);
      inFlight.current = question;

      try {
        const response = await fetch('/api/voyager', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            question,
            /*
             * The page the question came from, as the server's own vocabulary.
             *
             * This used to be hardcoded to the generic context, so a question
             * asked from a symbol page arrived with no symbol and the policy
             * layer offered the model no market data — the context chip said
             * "This asset" over an answer that had never been told which one.
             */
            context: voyagerContext,
            disabledSources: [],
            /* Prior turns, so a follow-up is a follow-up rather than a first question. */
            history: historyFor(turns),
          }),
        });

        if (!response.ok) throw new Error(`voyager ${response.status}`);
        const payload = (await response.json()) as VoyagerResponse;
        if (!payload.answer?.text) throw new Error('empty answer');

        const corrected = adoptServerCount(payload.used, payload.total, new Date());
        if (corrected) rememberAllowance(corrected);
        /*
         * An answer carries the server's own figure, counted after this
         * question. It outranks the bootstrap read whichever arrives first,
         * which is what `usageSettled` is for.
         */
        usageSettled.current = true;
        setUsageKnown(true);

        const answerAt = new Date().toISOString();
        /*
         * The limit reply is the platform talking about the account, so it
         * arrives bare: no analysis under it, no sources, no action row. An
         * answer's furniture around "you have run out of questions" would
         * suggest a question was answered.
         */
        const quota = payload.quotaReached === true;
        /*
         * Everything under the text comes from this response.
         *
         * The chat used to run the scripted scenario layer alongside every
         * request and attach whatever matched a keyword to the live answer. So
         * a question about Apple could be answered correctly and then followed
         * by a written comparison of NVDA, AMD and AVGO with prices in it —
         * real-looking figures about companies nobody had asked about, under an
         * answer that had done nothing to produce them. The scripted layer now
         * appears only where the model did not answer at all, and says so.
         */
        const answer: Turn = {
          id: `a_${answerAt}`,
          role: 'assistant',
          text: payload.answer.text,
          at: answerAt,
          notice: quota,
          tools: quota ? undefined : payload.answer.tools,
          sources: quota ? undefined : payload.answer.citations,
          followUps: quota ? undefined : payload.answer.followUps,
          contentType: quota ? undefined : payload.answer.contentType,
          bullets: quota ? undefined : payload.answer.bullets,
          actions: quota ? undefined : payload.answer.actions,
          investment: quota ? undefined : payload.answer.investment,
          chart: quota ? undefined : payload.answer.chart,
          code: quota ? undefined : payload.answer.code,
          handoff: quota ? undefined : payload.answer.handoff,
          upgrade: quota ? undefined : payload.answer.upgrade,
          ticker: quota ? undefined : (voyagerContext.facts?.ticker ?? undefined),
          scripted: !quota && payload.answer.simulated === true,
        };

        setTurns((current) => [...current, answer]);
        setReveal(startReveal(answer.id));
        for (const tool of payload.answer.tools ?? []) {
          track({ name: 'voyager_tool_executed', tool: tool.replace(/\(.*$/, '') });
        }

        if (payload.quotaReached) setGate('limit');
      } catch {
        /*
         * The failure is said, not swallowed, and the question is kept.
         *
         * This is the one place the scripted layer is consulted, and it is
         * consulted *because* nothing answered. A written analysis that matches
         * the question is worth more than an apology, so it is shown — labelled
         * as written rather than answered, because a fallback that passes for a
         * live answer is the outage nobody finds out about.
         */
        const scripted = parsePlan(responseFor(question));
        const failedAt = new Date().toISOString();
        setTurns((current) => [
          ...current,
          {
            id: `a_${failedAt}`,
            role: 'assistant',
            at: failedAt,
            failed: true,
            scripted: Boolean(scripted?.plan),
            text: scripted?.plan
              ? 'I could not reach the model, so here is the written analysis this platform holds for that question. Treat it as background rather than as an answer to what you asked.'
              : 'Your question is saved and will send automatically when the connection returns.',
            output: scripted?.plan ?? undefined,
          },
        ]);
        queue({ kind: 'question', text: question });
        setGate('error');
      } finally {
        setSending(false);
        inFlight.current = null;
      }
    },
    [voyagerContext, turns, rememberAllowance, queue]
  );

  const send = useCallback(
    (text: string, framing: ChatMode = mode) => {
      const question = framed(text, framing);
      if (!question || sending || inFlight.current) return;

      const at = new Date();
      /*
       * A plan with no ceiling skips the count entirely rather than counting to
       * a number that does not apply — a Premium subscriber met the free wall
       * at ten while the strip above said unlimited.
       */
      const verdict = unlimited
        ? ({ allowed: true } as const)
        : canSend({
            text: question,
            allowance,
            at,
            authed,
            askedInDialog: askedInDialog(turns),
          });

      if (!verdict.allowed) {
        if (verdict.reason === 'empty') return;

        // Kept rather than discarded: the gate is a pause, not a bin.
        queue({ kind: 'question', text: question });
        setDraft('');

        if (verdict.reason === 'limit') {
          setGate('limit');
          track({ name: 'voyager_limit_hit', authenticated: authed });
        } else {
          setGate('auth');
          track({ name: 'voyager_auth_gate_shown', askedInDialog: askedInDialog(turns) });
        }
        return;
      }

      if (!unlimited) rememberAllowance(spend(allowance, at));
      setDraft('');
      queue(null);
      track({
        name: 'voyager_question_sent',
        contextKind: context?.kind ?? 'none',
        mode: framing,
        turns: askedInDialog(turns) + 1,
      });

      const asked = at.toISOString();
      setTurns((current) => [
        ...current,
        userTurn(`u_${asked}_${question.length}`, question, asked),
      ]);
      void deliver(question);
    },
    [mode, sending, allowance, authed, unlimited, turns, context, deliver, queue, rememberAllowance]
  );

  /*
   * The latest `send`, reachable from an effect that only runs once.
   *
   * The opening question is asked on mount and must use the rules as they stand
   * when it fires — the allowance is restored in another effect, and a closure
   * captured at first render would be checking a counter of zero.
   */
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });

  /*
   * The question carried in from another page, asked on arrival.
   *
   * The draft is consumed on read — a draft that survived being sent would be
   * re-sent on the next visit, and a question asked twice is a question the
   * person did not ask. It is held in a ref rather than a local, because in
   * development this effect runs twice and the second run would find the draft
   * already taken and ask nothing at all.
   */
  const carried = useRef<string | null | undefined>(undefined);
  const openingSent = useRef(false);

  useEffect(() => {
    if (carried.current === undefined) carried.current = seedQuestion?.trim() || takeDraft();

    const question = carried.current;
    if (!question || openingSent.current) return;

    /*
     * On the next tick rather than in the effect body. Sending sets four pieces
     * of state, and doing that synchronously while mounting is a cascading
     * render the person watches as a flicker between the empty state and the
     * first bubble.
     */
    const timer = setTimeout(() => {
      if (openingSent.current) return;
      openingSent.current = true;
      sendRef.current(question, 'explain');
    }, 0);

    return () => clearTimeout(timer);
    // Deliberately once, on the first render after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * Back online, and the queued question goes.
   *
   * The promise the error card makes — "will send automatically when the
   * connection returns" — is only true if something is listening for that.
   */
  useEffect(() => {
    const flush = () => {
      if (pending?.kind !== 'question' || sending) return;
      setGate(null);
      queue(null);
      void deliver(pending.text);
    };

    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [pending, sending, deliver, queue]);

  /* The newest answer, written out rather than pasted in. */
  useEffect(() => {
    if (!reveal) return;
    const turn = turns.find((item) => item.id === reveal.id);
    if (!turn || reveal.chars >= turn.text.length) return;

    const step = Math.max(3, Math.ceil(turn.text.length / 28));
    const timer = setTimeout(
      () => setReveal({ id: reveal.id, chars: Math.min(turn.text.length, reveal.chars + step) }),
      16
    );
    return () => clearTimeout(timer);
  }, [reveal, turns]);

  /* The newest turn is the one somebody is waiting for. */
  useEffect(() => {
    foot.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [turns.length, sending]);

  /* -------------------------------------------------------------- actions */

  /**
   * A report of something that happened, in the transcript.
   *
   * `notice` rather than an answer: it is the platform describing an act, so it
   * carries no sources, no follow-ups and nothing to act on further.
   */
  const report = useCallback((text: string, tools?: string[]) => {
    const at = new Date().toISOString();
    setTurns((current) => [
      ...current,
      { id: `a_${at}`, role: 'assistant', at, text, tools, notice: true },
    ]);
  }, []);

  const runAction = useCallback(
    (id: VoyagerActionId, turn?: Turn) => {
      const spec = specFor(id);
      track({ name: 'voyager_action_clicked', action: id, authenticated: authed });

      if (requiresAccount(id) && !authed) {
        // Queued behind the gate and run after sign-in, still as a confirmation.
        queue({ kind: 'action', id });
        setGate('auth');
        track({ name: 'voyager_auth_gate_shown', askedInDialog: askedInDialog(turns) });
        return;
      }

      if (requiresConfirmation(id)) {
        setConfirming({
          kind: 'answer',
          id,
          ticker: turn?.ticker ?? voyagerContext.facts?.ticker,
          title: lastQuestion(turns) ?? 'Voyager conversation',
          note: transcriptText(turns),
        });
        return;
      }

      /*
       * Read-only, so it navigates — making somebody confirm before a link
       * teaches them to click through confirmations.
       *
       * The destination comes from `actionRoutes`, the same table the widget
       * uses, rather than from a couple of hardcoded cases here. Two of the
       * twenty navigations were wired up; the other eighteen showed a toast
       * naming a screen and stayed where they were.
       */
      if (id === 'open_research') {
        const seed = lastQuestion(turns);
        router.push(
          seed
            ? ({ pathname: '/voyager/research', query: { q: seed } } as never)
            : ('/voyager/research' as never)
        );
        return;
      }

      const target = routeFor(id, voyagerContext);
      if (target) {
        router.push(target as never);
        return;
      }

      // `none` and `view_pine` have nowhere to go: the first continues the
      // conversation, and the second belongs to a chart this screen is not.
      if (id === 'none') {
        const label = turn?.actions?.find((action) => action.action === 'none')?.label;
        if (label) send(label, 'explain');
        return;
      }
      setNotice(`${spec.label} — ${spec.where}.`);
    },
    [authed, router, turns, queue, voyagerContext, send]
  );

  const acceptConfirmation = useCallback(async () => {
    if (!confirming || running) return;

    if (confirming.kind === 'module') {
      /*
       * A module's actions describe changes to a canvas this screen does not
       * have. Nothing is claimed for them: the card says where the action
       * belongs and the person goes there.
       */
      const action = confirming.confirmation.action;
      report(
        `That one lives in ${action.where.toLowerCase()} — I have not changed anything from here. ${action.caveat}`
      );
      setConfirming(null);
      return;
    }

    const { id, ticker, title, note } = confirming;
    setRunning(true);

    /*
     * The result decides what is said. Not the intent, not the label, and not
     * the fact that somebody pressed Confirm.
     *
     * This is the whole of §4.5: "Done — I added this to your watchlist" used
     * to be printed the moment the button was pressed, with a `watchlist.add ✓`
     * chip beside it, and no request had been made to anything. The row was not
     * in the workspace it said to look in.
     */
    const result = await runVoyagerAction({ id, ticker, title, note }).catch(() => null);
    setRunning(false);
    setConfirming(null);
    queue(null);

    if (!result) {
      report('That did not go through — I could not reach the server. Nothing was changed.');
      track({ name: 'voyager_action_failed', action: id, code: 'unreachable' });
      return;
    }

    if (!result.ok) {
      report(result.message);
      track({ name: 'voyager_action_failed', action: id, code: result.code });
      if (result.code === 'sign_in_required') {
        queue({ kind: 'action', id });
        setGate('auth');
      }
      return;
    }

    // Only here. The chip names a call that returned, and the sentence is the
    // registry's own past tense rather than a hopeful paraphrase of the label.
    report(
      `Done — I ${result.done}. It is in ${result.where.toLowerCase()}. ${result.undo}`,
      [`${result.call} ✓`]
    );
    track({ name: 'voyager_action_confirmed', action: id, execution: result.execution });
    track({ name: 'voyager_tool_executed', tool: result.call });
  }, [confirming, running, queue, report]);

  const onModuleAction = useCallback((module: VoyagerModule, actionId: string) => {
    const outcome = confirmationFor(module, actionId);
    if ('refused' in outcome) {
      setNotice(outcome.refused);
      return;
    }
    if ('navigate' in outcome) {
      setNotice(`${outcome.navigate.title} — ${outcome.navigate.where}.`);
      return;
    }
    setConfirming({ kind: 'module', confirmation: outcome.confirmation });
  }, []);

  /* --------------------------------------------------------------- derived */

  const at = now();
  const left = remaining(allowance, at);
  /*
   * The limit is only known once the server has said so.
   *
   * Before that this was computed from a browser counter that starts at zero,
   * so somebody who had already spent their ten arrived at an open composer and
   * found out by being refused. Now the composer waits the moment it takes to
   * ask, and the banner appears with the answer rather than after a wasted
   * attempt.
   */
  const limitReached = !unlimited && usageKnown && left <= 0;
  const gateShown = gate === 'auth' || (!authed && askedInDialog(turns) >= GUEST_GATE_AFTER);
  const composerDisabled = limitReached || sending;
  const counter = limitLabel(allowance, at, unlimited, usageKnown);
  const contextName = contextLabel(context);
  const empty = turns.length === 0 && !sending;

  const newChat = useCallback(() => {
    setTurns([]);
    setGate(null);
    setDraft('');
    setReveal(null);
    queue(null);
    try {
      sessionStorage.removeItem(DIALOG_KEY);
    } catch {
      /* Nothing stored, nothing to clear. */
    }
    track({ name: 'voyager_new_chat', chatCount: 0 });
  }, [queue]);

  return (
    <>
      {/* The strip that answers "what can it see, and what does it remember". */}
      <div className={styles.statusBar}>
        <div className={styles.statusRow}>
          <span className={styles.contextChip}>
            <Icon name="pin" size={12} strokeWidth={2.2} />
            Context: {contextName}
          </span>
          <span className={styles.statusChip}>Model: Voyager 3</span>
          <span className={styles.statusChip}>Tools: Charts · Market data · Compare · Simulate</span>
          <span className={styles.statusChip}>
            Memory: On ({authed ? 'account' : 'this browser'})
          </span>
          <span className={styles.statusChip}>
            <Icon name="lock" size={11} strokeWidth={2.2} className={styles.statusIcon} />
            Private — never used for ads
          </span>
          <span className={styles.statusSpacer} />
          <span className={`${styles.limitChip} ${limitReached ? styles.limitChipHot : ''}`}>
            {counter}
          </span>
        </div>
      </div>

      <div className={styles.page}>
        <div className={styles.grid}>
          {/* ------------------------------------------------------ left rail */}
          <aside className={styles.rail} aria-label="Conversation starters">
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Start a conversation</h2>
              <div className={styles.topics}>
                {TOPICS.map((topic) => (
                  <button
                    key={topic.title}
                    className={styles.topic}
                    onClick={() => send(topic.question)}
                    disabled={composerDisabled}
                  >
                    <span className={styles.topicLabel}>{topic.title}</span>
                    <Icon name="chevronRight" size={12} strokeWidth={2.4} />
                  </button>
                ))}
              </div>
            </section>

            <section className={styles.cardTight}>
              <h2 className={styles.cardTitleSm}>History</h2>
              <p className={styles.cardNote}>
                {authed ? (
                  <>Saved to your account. This conversation stays open until you start a new one.</>
                ) : (
                  <>
                    Kept in this browser.{' '}
                    <Link className={styles.inlineLink} href="/sign-in">
                      Sign in
                    </Link>{' '}
                    to keep it anywhere — an unfinished dialog is restored after sign-up.
                  </>
                )}
              </p>
              {turns.length > 0 && (
                <button className={styles.newChat} onClick={newChat}>
                  <Icon name="plus" size={13} strokeWidth={2.4} />
                  New conversation
                </button>
              )}
            </section>
          </aside>

          {/* --------------------------------------------------------- dialogue */}
          <main className={styles.thread} aria-label="Voyager conversation">
            {empty ? (
              <section className={styles.empty}>
                {/* eslint-disable-next-line @next/next/no-img-element --
                    A decorative PNG at a fixed size; next/image would add a
                    loader for an asset that is never resized. */}
                <img className={styles.robot} src="/redesign/voyager-robot.png" alt="" aria-hidden="true" />
                <h1 className={styles.emptyTitle}>
                  Ask <span className={styles.accent}>Voyager</span>
                </h1>
                <p className={styles.emptyLead}>
                  A dialog agent for money and markets. Voyager sees:{' '}
                  <b className={styles.emptyContext}>{contextName}</b> · answers cite sources · asks
                  before changing anything.
                </p>

                <form
                  className={styles.heroComposer}
                  onSubmit={(event) => {
                    event.preventDefault();
                    send(draft);
                  }}
                >
                  <input
                    ref={composer}
                    className={styles.heroInput}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Ask anything about money, markets, or investing..."
                    aria-label="Ask Voyager"
                    disabled={limitReached}
                  />
                  <button className={styles.heroSend} type="submit" disabled={composerDisabled}>
                    Send
                    <Icon name="send" size={14} strokeWidth={2.4} />
                  </button>
                </form>

                <p className={styles.emptyLimit}>
                  {counter}
                  {authed ? '' : ' · no sign-up needed to start'}
                </p>

                <div className={styles.modes} role="group" aria-label="Answer mode">
                  {MODES.map((option) => (
                    <button
                      key={option.id}
                      className={`${styles.mode} ${option.id === mode ? styles.modeOn : ''}`}
                      aria-pressed={option.id === mode}
                      onClick={() => setMode(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className={styles.suggestions}>
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      className={styles.suggestion}
                      onClick={() => send(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </section>
            ) : (
              <div className={styles.transcript}>
                {turns.map((turn) =>
                  turn.role === 'user' ? (
                    <div key={turn.id} className={styles.userRow}>
                      <p className={styles.userBubble}>{turn.text}</p>
                      <span className={styles.avatar} aria-hidden="true">
                        {(personName ?? 'G').slice(0, 1).toUpperCase()}
                      </span>
                    </div>
                  ) : (
                    <div key={turn.id} className={styles.botRow}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
                      <img className={styles.botMark} src="/redesign/voyager-robot.png" alt="" aria-hidden="true" />
                      <div
                        className={`${styles.botBubble} ${turn.failed ? styles.botBubbleFailed : ''}`}
                      >
                        {(turn.tools ?? []).map((tool) => (
                          <span key={tool} className={styles.toolChip}>
                            <Icon name="wrench" size={12} strokeWidth={2} className={styles.toolIcon} />
                            Tool: {tool}
                          </span>
                        ))}
                        {turn.contentType && (
                          <span className={styles.kindChip}>{turn.contentType}</span>
                        )}

                        <p className={styles.botText}>
                          {reveal?.id === turn.id && reveal.chars < turn.text.length ? (
                            <>
                              {turn.text.slice(0, reveal.chars)}
                              <span className={styles.caret} aria-hidden="true">
                                ▍
                              </span>
                            </>
                          ) : (
                            turn.text
                          )}
                        </p>

                        {turn.scripted && (
                          <p className={styles.writtenNote}>
                            Written by TradingNew, not generated for this question.
                          </p>
                        )}

                        {/* The observations the answer carried. Four at most; the
                            server clamps them, and the model is asked for one line each. */}
                        {turn.bullets && turn.bullets.length > 0 && (
                          <ul className={styles.bullets}>
                            {turn.bullets.map((bullet) => (
                              <li key={bullet}>{bullet}</li>
                            ))}
                          </ul>
                        )}

                        {/* The chart, drawn by the Supercharts engine from the same
                            specification the caption and this answer were written
                            from. Nothing here can describe a study the canvas did
                            not draw, because the caption is generated from the spec
                            after everything unrenderable was removed from it. */}
                        {turn.chart ? (
                          <VoyagerChart
                            spec={(turn.chart as ChartPayload).spec}
                            series={(turn.chart as ChartPayload).series}
                            onRetry={() => {
                              const text = lastQuestion(turns);
                              if (text) void deliver(text);
                            }}
                          />
                        ) : null}

                        {/* Pine, with its provenance and its never-executed sentence
                            attached by the artefact rather than by the answer text. */}
                        {turn.code ? <PineBlock artifact={turn.code as PineArtifact} /> : null}

                        {/* Where the request goes when it is bigger than this surface.
                            The link was built by code from an allowlisted host. */}
                        {turn.handoff ? (
                          <HandoffCard handoff={turn.handoff as TradingViewHandoff} />
                        ) : null}

                        {/* The deterministic assessment, when a question asked for one.
                            Every figure in it was computed and is traceable to a dated
                            source — which is why it renders as itself rather than as prose. */}
                        {turn.investment ? (
                          <InvestmentAssessmentCard data={turn.investment as InvestmentSummary} />
                        ) : null}

                        {/* The structured analysis this question produced, if any. */}
                        {turn.output ? (
                          <ModuleStack
                            plan={turn.output as VoyagerPlan}
                            onAction={onModuleAction}
                            ticked={ticked}
                            setTicked={setTicked}
                          />
                        ) : null}

                        {turn.sources && turn.sources.length > 0 && (
                          <div className={styles.sources}>
                            <div className={styles.sourcesLabel}>Sources</div>
                            <div className={styles.sourceChips}>
                              {turn.sources.map((source) => (
                                <span
                                  key={source.label}
                                  className={styles.sourceChip}
                                  title={source.detail}
                                >
                                  <span className={styles.sourceDot} aria-hidden="true" />
                                  {source.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/*
                          * The actions this answer chose, and nothing else.
                          *
                          * There used to be six here under every answer, from a
                          * constant, in the same order every time — so an
                          * explanation of what an ETF is offered *Add to
                          * watchlist*, and there was nothing it could have added.
                          * The server narrows what may be offered and the model
                          * picks from that; an answer with nothing worth doing
                          * next now shows no row at all, which is the correct
                          * number of buttons.
                          */}
                        {offersActions(turn) && (turn.actions?.length ?? 0) > 0 && (
                          <div className={styles.actionRow}>
                            {turn.actions!.map((action, index) => (
                              <button
                                key={`${action.action}_${index}`}
                                className={index === 0 ? styles.actionPrimary : styles.action}
                                /* The id behind the label. The label is the model's
                                   words and changes per answer; this is what the
                                   button will actually do, and what a test can
                                   check without reading English. */
                                data-action={action.action}
                                onClick={() => runAction(action.action, turn)}
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Decided by the policy layer from tier and screen, never by
                            the model — whether to sell somebody a plan is an
                            entitlement fact, not something to improvise mid-answer. */}
                        {turn.upgrade && (
                          <div className={styles.upgrade}>
                            <p className={styles.upgradeText}>{turn.upgrade.text}</p>
                            <Link
                              className={styles.upgradeCta}
                              href={
                                turn.upgrade.intent === 'sign_up'
                                  ? ({ pathname: '/sign-up', query: { next: '/voyager' } } as never)
                                  : '/marketplace/subscriptions'
                              }
                            >
                              {turn.upgrade.cta}
                            </Link>
                          </div>
                        )}

                        {turn.followUps && turn.followUps.length > 0 && (
                          <div className={styles.followUps}>
                            {turn.followUps.map((question) => (
                              <button
                                key={question}
                                className={styles.followUp}
                                onClick={() => send(question, 'explain')}
                              >
                                {question}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}

                {sending && (
                  <div className={styles.botRow}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
                    <img className={styles.botMark} src="/redesign/voyager-robot.png" alt="" aria-hidden="true" />
                    <div className={styles.thinking} role="status">
                      <span className={styles.dot} />
                      <span className={styles.dot} />
                      <span className={styles.dot} />
                      <span className={styles.thinkingText}>Voyager is thinking…</span>
                    </div>
                  </div>
                )}

                {gateShown && !limitReached && (
                  <div className={styles.authGate}>
                    <Icon name="lock" size={20} strokeWidth={2} className={styles.authIcon} />
                    <div className={styles.gateText}>
                      <div className={styles.gateTitle}>Sign in to continue this conversation</div>
                      <div className={styles.gateSub}>
                        We saved the dialog — it will be restored exactly here after sign-up.
                      </div>
                    </div>
                    <Link
                      className={styles.gatePrimary}
                      href={{ pathname: '/sign-in', query: { next: '/voyager' } } as never}
                    >
                      Sign in — dialog restored
                    </Link>
                  </div>
                )}

                {limitReached && (
                  <div className={styles.limitGate}>
                    <Icon name="clock" size={20} strokeWidth={2} className={styles.limitIcon} />
                    <div className={styles.gateText}>
                      <div className={styles.gateTitle}>
                        Daily free limit reached ({FREE_DAILY_LIMIT} of {FREE_DAILY_LIMIT})
                      </div>
                      <div className={styles.gateSub}>
                        Resets at midnight — or go unlimited with Premium.
                      </div>
                    </div>
                    <Link className={styles.gateSecondary} href="/marketplace/subscriptions">
                      See Plans
                    </Link>
                  </div>
                )}

                {gate === 'error' && (
                  <div className={styles.errorCard} role="alert">
                    <div className={styles.errorHead}>
                      <Icon name="alert" size={18} strokeWidth={2} className={styles.errorIcon} />
                      <span>Voyager is temporarily unavailable</span>
                    </div>
                    <p className={styles.errorBody}>
                      Your question is saved and will send automatically when the connection
                      returns. Meanwhile, everything else works:
                    </p>
                    <div className={styles.errorActions}>
                      <Link className={styles.quietLink} href="/academy">
                        Browse lessons
                      </Link>
                      <Link className={styles.quietLink} href="/explore">
                        Explore options
                      </Link>
                      <Link className={styles.quietLink} href="/news">
                        Read today&apos;s brief
                      </Link>
                      <button
                        className={styles.retry}
                        onClick={() => {
                          const text =
                            pending?.kind === 'question' ? pending.text : lastQuestion(turns);
                          if (!text) return;
                          setGate(null);
                          queue(null);
                          void deliver(text);
                        }}
                      >
                        Retry now
                      </button>
                    </div>
                  </div>
                )}

                {confirming && (
                  <div className={styles.botRow}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
                    <img className={styles.botMark} src="/redesign/voyager-robot.png" alt="" aria-hidden="true" />
                    <div
                      className={styles.confirmCard}
                      role="dialog"
                      aria-label="Confirmation required"
                    >
                      <div className={styles.confirmTitle}>Confirmation required</div>
                      <p className={styles.confirmBody}>
                        {confirming.kind === 'answer' ? (
                          <>
                            I&apos;m about to {specFor(confirming.id).about}
                            {confirming.ticker ? ` (${confirming.ticker})` : ''}. It lands in{' '}
                            <b>{specFor(confirming.id).where}</b>. Nothing changes without your OK.
                          </>
                        ) : (
                          <>
                            I&apos;m about to {confirming.confirmation.action.title.toLowerCase()}.
                            It lands in <b>{confirming.confirmation.action.where}</b>. Nothing
                            changes without your OK.
                          </>
                        )}
                      </p>
                      <p className={styles.confirmCaveat}>
                        {confirming.kind === 'answer'
                          ? specFor(confirming.id).undo
                          : `${confirming.confirmation.action.caveat} ${confirming.confirmation.action.undo}`}
                      </p>
                      <div className={styles.confirmActions}>
                        <button
                          className={styles.confirmYes}
                          onClick={() => void acceptConfirmation()}
                          disabled={running}
                        >
                          {running ? 'Working…' : 'Confirm'}
                        </button>
                        <button
                          className={styles.confirmNo}
                          disabled={running}
                          onClick={() => {
                            setConfirming(null);
                            queue(null);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <form
                  className={styles.composer}
                  onSubmit={(event) => {
                    event.preventDefault();
                    send(draft);
                  }}
                >
                  <input
                    className={styles.composerInput}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    disabled={limitReached}
                    placeholder={
                      limitReached
                        ? 'Daily free limit reached — resets at midnight'
                        : 'Ask a follow-up…'
                    }
                    aria-label="Ask Voyager"
                  />
                  <button
                    className={styles.composerSend}
                    type="submit"
                    disabled={composerDisabled}
                    aria-label="Send"
                  >
                    <Icon name="send" size={16} strokeWidth={2.2} />
                  </button>
                </form>

                <p className={styles.disclaimerLine}>
                  {counter} · Educational guidance, not financial advice.
                </p>

                <div ref={foot} />
              </div>
            )}
          </main>

          {/* ----------------------------------------------------- right rail */}
          <aside className={styles.rail} aria-label="About Voyager">
            <section className={styles.card}>
              <h2 className={styles.cardTitleSm}>Voyager vs Research Workspace</h2>
              <div className={styles.compare}>
                <div className={styles.compareOn}>
                  <div className={styles.compareHead}>
                    <span className={styles.dotMint} aria-hidden="true" />
                    Voyager — dialog agent
                  </div>
                  <p className={styles.compareBody}>Ask, get sourced answers, act. This page.</p>
                </div>
                <div className={styles.compareOff}>
                  <div className={styles.compareHead}>
                    <span className={styles.dotBlue} aria-hidden="true" />
                    Research — structured session
                  </div>
                  <p className={styles.compareBody}>
                    A saved workspace: question → evidence → conclusion. Built from any answer via
                    &ldquo;Turn this answer into research&rdquo;.
                  </p>
                </div>
              </div>
              <Link className={styles.railLink} href={'/voyager/research' as never}>
                Open Research Workspace
              </Link>
            </section>

            <section className={styles.card}>
              <h2 className={styles.cardTitleSm}>What Voyager can do here</h2>
              <ul className={styles.abilities}>
                {[
                  'Explain this page or any concept simply',
                  'Pull charts and market data (as tools, shown inline)',
                  'Compare options and run what-if simulations',
                  'Always cites sources · asks before changing anything',
                ].map((ability) => (
                  <li key={ability}>
                    <Icon name="check" size={14} strokeWidth={2.4} className={styles.abilityIcon} />
                    {ability}
                  </li>
                ))}
              </ul>
            </section>

            <section className={styles.disclaimer}>
              Educational guidance only, not financial advice. Investing involves risk, including
              possible loss of principal.
            </section>
          </aside>
        </div>
      </div>

      {notice && (
        <div className={styles.notice} role="status">
          <span>{notice}</span>
          <button
            className={styles.noticeClose}
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
            title="Dismiss"
          >
            <Icon name="close" size={13} />
          </button>
        </div>
      )}
    </>
  );
}

/**
 * The conversation as one block of text, for the actions that keep a copy.
 *
 * Bounded, and failures are left out: what somebody saves should be what they
 * read, not a transcript with "Voyager is temporarily unavailable" in the
 * middle of it. It is sealed with the person's own key on the server, like
 * every other note.
 */
function transcriptText(turns: Turn[]): string {
  return turns
    .filter((turn) => !turn.failed && !turn.notice && turn.text.trim())
    .slice(-20)
    .map((turn) => `${turn.role === 'user' ? 'You' : 'Voyager'}: ${turn.text}`)
    .join('\n\n')
    .slice(0, 4000);
}

/**
 * Where the reveal starts.
 *
 * Somebody who asked not to see motion gets the answer whole. The reveal is
 * cosmetic — the text arrived in one piece — and an animation that delays
 * reading it is the wrong kind of theatre for anyone who opted out.
 */
function startReveal(id: string): { id: string; chars: number } | null {
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  return reduced ? null : { id, chars: 0 };
}

/**
 * The modules an answer produced, under its text.
 *
 * Same cards as the research workspace and the same contract behind them: each
 * one states where its content came from, cites sources that exist, and routes
 * a mutating action through the confirmation rather than doing it.
 */
function ModuleStack({
  plan,
  onAction,
  ticked,
  setTicked,
}: {
  plan: VoyagerPlan;
  onAction: (module: VoyagerModule, actionId: string) => void;
  ticked: string[];
  setTicked: (next: string[]) => void;
}) {
  /*
   * The "You asked" card is dropped here and only here.
   *
   * On the research canvas it is the only place the question appears, so it
   * earns its card. In a conversation the question is the bubble immediately
   * above, and repeating it makes the answer look like it is talking to
   * somebody else.
   */
  const modules = (plan?.modules ?? []).filter((module) => module.id !== 'm_asked');
  if (!modules.length) return null;

  return (
    <div className={styles.modules}>
      {modules.map((module) => (
        <ModuleCard
          key={module.id}
          module={module}
          sources={plan.sources}
          onAction={onAction}
          scopeState={module.kind === 'permission-request' ? { ticked, setTicked } : undefined}
        />
      ))}
    </div>
  );
}
