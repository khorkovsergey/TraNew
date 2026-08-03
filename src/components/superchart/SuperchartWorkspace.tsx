'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Link } from '@/i18n/navigation';
import { CanvasChartEngine } from '@/lib/superchart/chart-engine/canvas';
import {
  CHART_TYPE_LABEL,
  INTERVAL_SECONDS,
  type Bar,
  type ChartInterval,
  type ChartPalette,
  type ChartType,
  type CrosshairContext,
} from '@/lib/superchart/chart-engine/types';
import { CachingDatafeed } from '@/lib/superchart/datafeed/cache';
import { DemoDatafeed, DEMO_SYMBOLS } from '@/lib/superchart/datafeed/demoAdapter';
import type { ResolvedSymbol } from '@/lib/superchart/datafeed/types';
import {
  fromScreen,
  moveDrawing,
  moveHandle,
  TOOL_LABEL,
  TOOL_POINTS,
  type DataPoint,
  type DrawingInstance,
  type DrawingTool,
} from '@/lib/superchart/drawings/types';
import {
  createIndicator,
  INDICATORS,
  type IndicatorInstance,
} from '@/lib/superchart/indicators';
import {
  LAYOUT_STORAGE_KEY,
  parseLayout,
  serializeLayout,
  type StudyChoice,
} from '@/lib/superchart/layouts/schema';
import {
  canRedo,
  canUndo,
  describe,
  EMPTY_HISTORY,
  lastTitle,
  record,
  redo,
  undo,
  unchanged,
  type History,
  type UndoableState,
} from '@/lib/superchart/transactions';
import { saveLayoutAction } from '@/app/actions/superchart';
import { buildChartContext, type ContextChipId } from '@/lib/superchart/context';
import {
  applyCommands,
  selectedCommands,
  type CommandPlan,
  type CommandState,
} from '@/lib/superchart/commands';
import type { ChartHighlight } from '@/lib/superchart/chart-engine/types';
import { VoyagerChartPanel } from './VoyagerChartPanel';
import { ScriptLab } from './ScriptLab';
import styles from './Superchart.module.css';

/**
 * The Superchart workspace — Phase 1 of the plan.
 *
 * The frame at the design's geometry, with a canvas engine drawing real bars.
 * It composes the interface and holds no market-data, AI or indicator logic:
 * the engine owns the bars and the pointer, and this component owns the layout
 * and the small amount of state a panel needs.
 *
 * What is deliberately not here yet, rather than stubbed to look present:
 * indicators, drawings, the object tree, layouts and the Voyager command bus.
 * Each has a phase, and the engine's methods for them reject rather than
 * quietly succeeding.
 */

const INTERVALS: ChartInterval[] = ['1m', '5m', '15m', '1H', '4H', '1D', '1W', '1M'];
const CHART_TYPES: ChartType[] = ['candles', 'bars', 'line', 'area', 'baseline', 'hollow', 'heikin'];

/**
 * The engine is handed resolved colours rather than reading the stylesheet.
 *
 * `check-tokens.mjs` fails the build on a token that does not exist, and it
 * cannot see a hex literal inside a canvas call. Resolving here keeps every
 * colour in `tokens.css` where the check can reach it.
 */
function readPalette(element: HTMLElement): ChartPalette {
  const style = getComputedStyle(element);
  const token = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;

  return {
    up: token('--tn-green', '#1aa966'),
    down: token('--tn-red', '#e0492f'),
    grid: token('--tn-border-card', '#eef1f6'),
    text: token('--tn-text', '#131722'),
    textMuted: token('--tn-text-muted', '#8a93a6'),
    surface: token('--tn-surface', '#ffffff'),
    border: token('--tn-border-card', '#e6eaf2'),
    crosshair: token('--tn-text-muted', '#9aa3b5'),
    volumeUp: token('--tn-green-tint', '#b6e6cd'),
    volumeDown: token('--tn-red-tint', '#f7cfc6'),
  };
}

export type SuperchartWorkspaceProps = {
  symbol: string;
  companyName: string;
  exchange: string;
};

export function SuperchartWorkspace({
  symbol,
  companyName,
  exchange,
}: SuperchartWorkspaceProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CanvasChartEngine | null>(null);

  const [interval, setInterval] = useState<ChartInterval>('1D');
  const [chartType, setChartType] = useState<ChartType>('candles');
  const [focus, setFocus] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [dockOpen, setDockOpen] = useState(false);
  const [crosshair, setCrosshair] = useState<CrosshairContext | null>(null);

  const [drawings, setDrawings] = useState<DrawingInstance[]>([]);
  /*
   * What is stored is the choice — which study, with which parameters. The
   * plotted values are derived from it and the bars, because that is what they
   * are: a pure function of both. Storing the plots meant recomputing them in an
   * effect whenever the bars changed, which is a second copy of the truth and a
   * render cascade to keep it in step.
   */
  const [studyChoices, setStudyChoices] = useState<StudyChoice[]>([]);
  const [history, setHistory] = useState<History>(EMPTY_HISTORY);
  const [panelTab, setPanelTab] = useState<'objects' | 'voyager'>('objects');
  /** Which reference the pointer is over on the chart, for the hover that runs back. */
  const [hoveredHighlight, setHoveredHighlight] = useState<string | null>(null);
  /**
   * The plan currently being previewed.
   *
   * Held here rather than in the panel because the preview has to reach the
   * chart, and the chart is rendered from this component's state. Nothing in
   * here is ever committed — `applyPlan` recomputes from the real state.
   */
  const [preview, setPreview] = useState<CommandPlan | null>(null);
  const [showBefore, setShowBefore] = useState(false);
  /** Applied plans, newest first, for the activity log. */
  const [activity, setActivity] = useState<Array<{ id: string; title: string; at: string }>>([]);
  /** Plots returned by the Pine preview worker, drawn as drafts. */
  const [scriptPlots, setScriptPlots] = useState<Array<{
    title: string;
    values: (number | null)[];
  }> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<DrawingTool | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Points collected for the drawing being created. */
  const pending = useRef<DataPoint[]>([]);
  const dragState = useRef<{ id: string; handle: number | null; from: DataPoint } | null>(null);
  /** The drawings as they were when a drag began, so the whole drag is one undo. */
  const dragBaseline = useRef<DrawingInstance[] | null>(null);

  const [resolved, setResolved] = useState<ResolvedSymbol | null>(null);
  const [bars, setBars] = useState<Bar[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [symbolId, setSymbolId] = useState(`NASDAQ:${symbol}`);

  // One instance for the life of the component: the cache is the point, and a
  // new one per render would never hit.
  const feed = useMemo(() => new CachingDatafeed(new DemoDatafeed()), []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const found = await feed.resolveSymbol(symbolId);
      if (cancelled || !found) return;
      setResolved(found);

      const step = INTERVAL_SECONDS[interval];
      const to = Math.floor(Date.now() / 1000);
      const response = await feed.getBars({
        symbolId: found.id,
        interval,
        from: to - step * 5000,
        to,
      });

      // A superseded response carries no bars; applying it would replace what
      // the person is looking at with what they left.
      if (cancelled || response.note === 'superseded') return;

      setBars(response.bars);
      setNote(response.note ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, [feed, symbolId, interval]);

  // The engine is created once and told about changes; recreating it on every
  // prop change would throw away the visible range the person just set.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const engine = new CanvasChartEngine();
    engineRef.current = engine;

    void engine.initialize(stage, {
      theme: 'light',
      chartType,
      palette: readPalette(stage),
    });

    const off = engine.subscribe('crosshair', (payload) => {
      setCrosshair(payload as CrosshairContext | null);
    });

    return () => {
      off();
      engine.destroy();
      engineRef.current = null;
    };
    // Created once: chartType and bars are pushed in below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setBars(bars);
  }, [bars]);

  useEffect(() => {
    engineRef.current?.setChartType(chartType);
  }, [chartType]);

  // The study palette is read from the stylesheet, so the colours stay in
  // tokens.css where check-tokens.mjs can see them.
  const studyPalette = useMemo(() => {
    if (typeof window === 'undefined') return [];
    const style = getComputedStyle(document.documentElement);
    return [0, 1, 2, 3].map(
      (index) => style.getPropertyValue(`--tn-study-${index}`).trim() || '#7c4dff'
    );
  }, []);


  const liveState = useMemo<CommandState>(
    () => ({ studies: studyChoices, drawings, interval, chartType }),
    [studyChoices, drawings, interval, chartType]
  );

  /*
   * What the chart shows: the real state, or the real state with the plan
   * applied on top.
   *
   * Derived rather than stored, and produced by the same `applyCommands` that
   * performs the apply. Two paths — one that draws the proposal, one that
   * performs it — is how a preview ends up showing something other than what
   * apply does, which is worse than no preview.
   *
   * Toggling Before while previewing shows the live state, so the comparison is
   * one control rather than a memory exercise.
   */
  const shownState = useMemo<CommandState>(() => {
    if (!preview || showBefore) return liveState;
    return applyCommands(liveState, selectedCommands(preview), { draft: true });
  }, [liveState, preview, showBefore]);

  // Derived, so switching interval keeps the studies a person added and
  // recomputes them against the new bars without an effect in between.
  const indicators = useMemo<IndicatorInstance[]>(
    () =>
      shownState.studies
        .map((choice) => {
          const instance = createIndicator(choice.definitionId, bars, choice.params);
          if (!instance) return null;

          // A study that is only in the preview is dashed and marked as
          // Voyager's, so nothing proposed can be read as already accepted.
          const proposed =
            Boolean(preview) &&
            !showBefore &&
            !studyChoices.some((live) => live.definitionId === choice.definitionId);

          return proposed
            ? { ...instance, draft: true, source: 'voyager' as const }
            : instance;
        })
        .filter((instance): instance is IndicatorInstance => instance !== null),
    [shownState.studies, bars, preview, showBefore, studyChoices]
  );

  /*
   * The script preview joins the studies rather than replacing them.
   *
   * It is an `IndicatorInstance` like any other so the engine needs no special
   * case, and it carries `draft` and `source: 'voyager'` so it is dashed and
   * excluded from a saved layout — the same guarantee the command preview has.
   */
  const withScriptPreview = useMemo<IndicatorInstance[]>(() => {
    if (!scriptPlots?.length) return indicators;

    return [
      ...indicators,
      {
        id: 'script_preview',
        definitionId: 'script',
        label: 'Script preview',
        pane: 'main',
        params: {},
        plots: scriptPlots.map((plot, index) => ({
          key: plot.title,
          colour: index,
          values: plot.values,
          style: 'line' as const,
        })),
        hidden: false,
        source: 'voyager',
        draft: true,
      },
    ];
  }, [indicators, scriptPlots]);

  useEffect(() => {
    engineRef.current?.setIndicators(withScriptPreview, studyPalette);
  }, [withScriptPreview, studyPalette]);

  useEffect(() => {
    engineRef.current?.setDrawings(shownState.drawings, selectedId);
  }, [shownState.drawings, selectedId]);

  /*
   * Every undoable change goes through here.
   *
   * One call is one entry in the history, which is what makes a Voyager request
   * that adds two studies and a marker undo in a single press. The description
   * is computed from the diff rather than passed in, so the history cannot
   * claim something other than what happened.
   */
  const commit = useCallback(
    (source: 'user' | 'voyager', mutate: (state: UndoableState) => UndoableState) => {
      const before: UndoableState = { studies: studyChoices, drawings };
      const after = mutate(before);

      if (unchanged(before, after)) return;

      const title = describe(before, after);
      setStudyChoices(after.studies);
      setDrawings(after.drawings);
      setHistory((current) =>
        record(current, {
          id: `tx_${current.past.length + 1}`,
          title,
          source,
          before,
          after,
          createdAt: new Date().toISOString(),
        })
      );
      setToast(title);
    },
    [studyChoices, drawings]
  );

  const applyUndo = useCallback(() => {
    setHistory((current) => {
      const step = undo(current);
      if (!step) return current;
      setStudyChoices(step.state.studies);
      setDrawings(step.state.drawings);
      setSelectedId(null);
      return step.history;
    });
  }, []);

  const applyRedo = useCallback(() => {
    setHistory((current) => {
      const step = redo(current);
      if (!step) return current;
      setStudyChoices(step.state.studies);
      setDrawings(step.state.drawings);
      return step.history;
    });
  }, []);

  const toggleIndicator = useCallback(
    (definitionId: string) => {
      commit('user', (state) => {
        const existing = state.studies.find((choice) => choice.definitionId === definitionId);
        return {
          ...state,
          studies: existing
            ? state.studies.filter((choice) => choice !== existing)
            : [...state.studies, { definitionId, params: {} }],
        };
      });
    },
    [commit]
  );

  /*
   * Drawing, selecting and dragging, on the canvas.
   *
   * All three are one pointer handler because they are one gesture from the
   * person's side: press decides which of the three is happening, and it cannot
   * be decided anywhere else.
   */
  const onStagePointerDown = useCallback(
    (event: React.PointerEvent) => {
      const engine = engineRef.current;
      const stage = stageRef.current;
      if (!engine || !stage) return;

      const rect = stage.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const point = fromScreen(x, y, engine.projection());

      if (activeTool) {
        pending.current.push(point);

        if (pending.current.length >= TOOL_POINTS[activeTool]) {
          const now = new Date().toISOString();
          commit('user', (state) => ({
            ...state,
            drawings: [
              ...state.drawings,
              {
                id: `d_${state.drawings.length + 1}_${Math.round(point.price)}`,
                tool: activeTool,
                points: [...pending.current],
                style: { colour: studyPalette[0] ?? '#7c4dff', width: 1.6, dashed: false },
                locked: false,
                hidden: false,
                source: 'user' as const,
                createdAt: now,
                updatedAt: now,
                draft: false,
              },
            ],
          }));

          pending.current = [];
          setActiveTool(null);
        }
        return;
      }

      const hit = engine.hitAt(x, y);
      setSelectedId(hit?.drawingId ?? null);
      if (hit) {
        dragState.current = { id: hit.drawingId, handle: hit.handleIndex, from: point };
        dragBaseline.current = drawings;
      }
    },
    [activeTool, studyPalette, commit, drawings]
  );

  const onStagePointerMove = useCallback((event: React.PointerEvent) => {
    const drag = dragState.current;
    const engine = engineRef.current;
    const stage = stageRef.current;
    if (!engine || !stage) return;

    const rect = stage.getBoundingClientRect();

    /*
     * The hover that runs from the chart back to the answer. Compared before
     * setting, because this fires on every pointer move and a state write per
     * pixel would re-render the panel continuously while somebody is only
     * moving the mouse across the chart.
     */
    const over = engine.highlightAt(event.clientX - rect.left)?.id ?? null;
    setHoveredHighlight((current) => (current === over ? current : over));

    if (!drag) return;
    const point = fromScreen(
      event.clientX - rect.left,
      event.clientY - rect.top,
      engine.projection()
    );

    setDrawings((current) =>
      current.map((drawing) => {
        if (drawing.id !== drag.id) return drawing;
        return drag.handle === null
          ? moveDrawing(drawing, point.barIndex - drag.from.barIndex, point.price - drag.from.price)
          : moveHandle(drawing, drag.handle, point);
      })
    );

    if (drag.handle === null) dragState.current = { ...drag, from: point };
  }, []);

  const onStagePointerUp = useCallback(() => {
    // A drag is one transaction, recorded when the pointer is released rather
    // than on every pixel of movement — otherwise dragging a line across the
    // chart fills the history with two hundred entries.
    if (dragState.current) {
      setHistory((current) =>
        record(current, {
          id: `tx_${current.past.length + 1}`,
          title: 'Moved a drawing',
          source: 'user',
          before: { studies: studyChoices, drawings: dragBaseline.current ?? drawings },
          after: { studies: studyChoices, drawings },
          createdAt: new Date().toISOString(),
        })
      );
      dragBaseline.current = null;
    }
    dragState.current = null;
  }, [studyChoices, drawings]);

  /*
   * The context, built at the moment of asking.
   *
   * Reads the visible range off the engine rather than off React state because
   * panning and zooming never enter React — the engine owns them — and a context
   * built from stale bounds would describe a stretch of chart nobody is looking
   * at.
   */
  const buildContext = useCallback(
    (excluded: ContextChipId[]) => {
      const engine = engineRef.current;
      if (!engine || !bars.length) return null;

      const range = engine.getVisibleRange();
      const selection = engine.getSelection();

      return buildChartContext({
        symbol: {
          id: symbolId,
          ticker: resolved?.ticker ?? symbolId,
          name: resolved?.name ?? symbolId,
          exchange: resolved?.exchange ?? '',
          currency: resolved?.currency ?? 'USD',
        },
        interval,
        bars,
        fromIndex: range.from,
        toIndex: range.to,
        dataStatus: resolved?.dataStatus ?? 'demo',
        /*
         * Live studies only. A proposal under preview is drawn on the chart but
         * is not on the chart, and listing it as context would have Voyager
         * describing a study nobody has accepted — while the chips promise to
         * be exactly what gets sent.
         */
        studies: indicators
          .filter((instance) => !instance.draft)
          .map((instance) => ({
            id: instance.definitionId,
            label: instance.label,
            params: instance.params,
          })),
        drawings: drawings
          .filter((drawing) => !drawing.draft)
          .map((drawing) => ({
            id: drawing.id,
            tool: drawing.tool,
            from: drawing.points[0]?.barIndex ?? 0,
            to: drawing.points[drawing.points.length - 1]?.barIndex ?? 0,
          })),
        selection: selection
          ? { fromIndex: selection.fromIndex, toIndex: selection.toIndex }
          : null,
        excluded,
      });
    },
    [bars, symbolId, interval, resolved, indicators, drawings]
  );

  /*
   * A plan applied is one transaction.
   *
   * `commit` is still the only way the undoable state changes, so a plan that
   * adds two studies and three markers is one press of undo — a plan is one
   * thing somebody asked for, and undoing it in five stages would be watching
   * the chart come apart rather than going back.
   *
   * Interval and chart type are set outside the transaction because they are
   * not part of the undoable state: they are what the chart is showing, not
   * what is on it, and undo is for objects.
   */
  const applyPlan = useCallback(
    (plan: CommandPlan) => {
      const commands = selectedCommands(plan);
      if (!commands.length) return;

      commit('voyager', (state) => {
        const next = applyCommands(
          { ...state, interval, chartType },
          commands,
          // Applied, so nothing carries the draft flag that keeps an object out
          // of the saved layout.
          { draft: false }
        );
        return { studies: next.studies, drawings: next.drawings };
      });

      const after = applyCommands({ ...liveState }, commands, { draft: false });
      if (after.interval !== interval) setInterval(after.interval);
      if (after.chartType !== chartType) setChartType(after.chartType);

      setActivity((current) => [
        { id: plan.id, title: plan.title, at: new Date().toISOString() },
        ...current,
      ]);
      setPreview(null);
      setShowBefore(false);
    },
    [commit, liveState, interval, chartType]
  );

  const applyHighlights = useCallback((highlights: ChartHighlight[], activeId: string | null) => {
    engineRef.current?.setHighlights(highlights, activeId);
  }, []);

  const saveLayout = useCallback(async () => {
    const layout = serializeLayout('current', 'My layout', {
      symbolId,
      interval,
      chartType,
      studies: studyChoices,
      drawings,
      panelOpen,
      dockOpen,
    });

    // The browser copy is written first and unconditionally: it is what makes
    // the workspace survive a reload for someone who is not signed in, and it
    // must not depend on a request succeeding.
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    } catch {
      /* Private mode. The account copy below may still work. */
    }

    const result = await saveLayoutAction({ name: 'My layout', layout }).catch(() => null);

    setToast(
      result?.status === 'saved'
        ? 'Layout saved to your account'
        : result?.status === 'sign_in_required'
          ? 'Layout saved in this browser. An account keeps it anywhere.'
          : 'Layout saved in this browser.'
    );
  }, [symbolId, interval, chartType, studyChoices, drawings, panelOpen, dockOpen]);

  const removeDrawing = useCallback(
    (id: string) => {
      commit('user', (state) => ({
        ...state,
        drawings: state.drawings.filter((drawing) => drawing.id !== id),
      }));
      setSelectedId((current) => (current === id ? null : current));
    },
    [commit]
  );

  const toggleDrawingFlag = useCallback((id: string, flag: 'hidden' | 'locked') => {
    setDrawings((current) =>
      current.map((drawing) =>
        drawing.id === id ? { ...drawing, [flag]: !drawing[flag] } : drawing
      )
    );
  }, []);

  const cycleChartType = useCallback(() => {
    setChartType((current) => CHART_TYPES[(CHART_TYPES.indexOf(current) + 1) % CHART_TYPES.length]);
  }, []);

  /*
   * Restored once, on arrival, from the browser copy.
   *
   * Read here rather than through `usePending` because a layout is not a live
   * value the component follows — it is a starting point, and re-reading it
   * later would undo whatever the person had since changed.
   */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (!raw) return;

      const layout = parseLayout(JSON.parse(raw));
      if (!layout) return;

      /*
       * setState in an effect, deliberately.
       *
       * The alternative is a lazy initialiser reading localStorage during
       * render, and the server already rendered this component with the
       * defaults — so that produces a hydration mismatch on every restored
       * workspace. Deriving does not apply either: a layout is a starting
       * point the person then edits, not a value the component follows.
       */
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSymbolId(layout.state.symbolId);
      setInterval(layout.state.interval);
      setChartType(layout.state.chartType);
      setStudyChoices(layout.state.studies);
      setDrawings(layout.state.drawings);
      setPanelOpen(layout.state.panelOpen);
      setDockOpen(layout.state.dockOpen);
    } catch {
      /* Unreadable storage means starting fresh, which is the safe default. */
    }
    // Once, deliberately: this is a starting point, not a subscription.
  }, []);

  // The toast clears itself; a confirmation that stays is a notification.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // `F` toggles focus and Escape leaves it, per the design's keyboard map.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) applyRedo();
        else applyUndo();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveLayout();
        return;
      }

      if (event.key === 'f' || event.key === 'F') setFocus((value) => !value);
      if (event.key === 'Escape') {
        // Escape cancels the gesture before it touches the workspace: a
        // half-drawn line and a selection are more likely what someone wants
        // out of than focus mode.
        if (activeTool || pending.current.length) {
          setActiveTool(null);
          pending.current = [];
        } else if (selectedId) setSelectedId(null);
        else setFocus(false);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeTool, selectedId, applyUndo, applyRedo, saveLayout]);

  const last = bars[bars.length - 1];
  const previous = bars[bars.length - 2];
  const change = last && previous ? last.close - previous.close : 0;
  const changePercent = previous ? (change / previous.close) * 100 : 0;
  const up = change >= 0;

  const shown = crosshair?.bar ?? last;

  return (
    <div className={`${styles.workspace} ${focus ? styles.focused : ''}`}>
      {/*
        * The workspace covers the portal chrome, so it carries its own header
        * and its own way back.
        *
        * Phase 1 dropped this header as a duplicate. That was the wrong
        * diagnosis: the duplicate existed because the workspace was drawn
        * inside the portal layout, not because the header was redundant. A
        * full-viewport terminal with no navigation is a trap.
        */}
      {!focus && (
        <header className={styles.globalHeader}>
          <Link className={styles.back} href="/">
            <span className={styles.brandMark} aria-hidden="true">TN</span>
            <span className={styles.brand}>TradingNew</span>
          </Link>
          <Link
            className={styles.headerLink}
            href={{ pathname: '/symbols/[ticker]', params: { ticker: resolved?.ticker ?? symbol } }}
          >
            Leave chart
          </Link>
          <div className={styles.spacer} />
          <button className={styles.headerButton} onClick={() => setFocus(true)} title="Focus mode (F)">
            Focus
          </button>
        </header>
      )}

      {focus && (
        <button className={styles.restoreStrip} onClick={() => setFocus(false)}>
          Restore header · press F
        </button>
      )}

      <div className={styles.chartHeader}>

        <div className={styles.symbolWrap}>
          <button
            className={styles.symbolButton}
            aria-expanded={pickerOpen}
            aria-haspopup="listbox"
            onClick={() => setPickerOpen((open) => !open)}
          >
            <Icon name="search" size={14} />
            <span className={styles.ticker}>{resolved?.ticker ?? symbol}</span>
            <span className={styles.exchange}>{resolved?.exchange ?? exchange}</span>
          </button>

          {pickerOpen && (
            <div className={styles.picker} role="listbox" aria-label="Choose a symbol">
              {DEMO_SYMBOLS.map((entry) => (
                <button
                  key={entry.id}
                  role="option"
                  aria-selected={entry.id === symbolId}
                  className={`${styles.pickerRow} ${entry.id === symbolId ? styles.pickerRowOn : ''}`}
                  onClick={() => {
                    setSymbolId(entry.id);
                    setPickerOpen(false);
                  }}
                >
                  <span className={styles.pickerTicker}>{entry.ticker}</span>
                  <span className={styles.pickerName}>{entry.name}</span>
                  <span className={styles.pickerExchange}>{entry.exchange}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.quote}>
          <span className={`${styles.price} tn-num`}>{last?.close.toFixed(2)}</span>
          <span className={`${styles.change} ${up ? styles.up : styles.down} tn-num`}>
            {/* The glyph carries direction as well as the colour. */}
            {up ? '▲' : '▼'} {change.toFixed(2)} ({changePercent.toFixed(2)}%)
          </span>
          <span className={styles.quoteSub}>
            {resolved?.name ?? companyName} · {resolved?.dataStatus ?? 'demo'}
          </span>
        </div>

        <span className={styles.divider} aria-hidden="true" />

        <div className={styles.intervalGroup} role="group" aria-label="Timeframe">
          {(resolved?.supportedIntervals ?? INTERVALS).map((item) => (
            <button
              key={item}
              className={`${styles.intervalItem} ${item === interval ? styles.intervalActive : ''}`}
              aria-pressed={item === interval}
              onClick={() => setInterval(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <button className={styles.typeButton} onClick={cycleChartType}>
          {CHART_TYPE_LABEL[chartType]}
        </button>

        <div className={styles.spacer} />

        <button
          className={styles.panelToggle}
          disabled={!canUndo(history)}
          onClick={applyUndo}
          title={canUndo(history) ? `Undo: ${lastTitle(history)}` : 'Nothing to undo'}
        >
          Undo
        </button>
        <button
          className={styles.panelToggle}
          disabled={!canRedo(history)}
          onClick={applyRedo}
          title="Redo"
        >
          Redo
        </button>
        <button className={styles.panelToggle} onClick={() => void saveLayout()} title="Save layout (⌘S)">
          Save
        </button>

        <button
          className={styles.panelToggle}
          aria-pressed={panelOpen}
          onClick={() => setPanelOpen((value) => !value)}
        >
          Panel
        </button>
        <button
          className={styles.panelToggle}
          aria-pressed={dockOpen}
          onClick={() => setDockOpen((value) => !value)}
        >
          Dock
        </button>
      </div>

      <div className={styles.body}>
        <nav className={styles.toolRail} aria-label="Chart tools">
          <button
            className={`${styles.tool} ${activeTool === null ? styles.toolOn : ''}`}
            title="Select"
            aria-label="Select"
            aria-pressed={activeTool === null}
            onClick={() => {
              setActiveTool(null);
              pending.current = [];
            }}
          >
            <Icon name="arrowRight" size={17} />
          </button>

          {(['trendLine', 'horizontalLine', 'verticalLine', 'rectangle', 'text'] as DrawingTool[]).map(
            (tool) => (
              <button
                key={tool}
                className={`${styles.tool} ${activeTool === tool ? styles.toolOn : ''}`}
                title={TOOL_LABEL[tool]}
                aria-label={TOOL_LABEL[tool]}
                aria-pressed={activeTool === tool}
                onClick={() => {
                  setActiveTool(tool);
                  pending.current = [];
                }}
              >
                <Icon name="chart" size={17} />
              </button>
            )
          )}
        </nav>

        <div className={styles.stageColumn}>
          <div className={styles.legend}>
            <span className={styles.legendSymbol}>
              {symbol} · {interval} · {exchange}
            </span>
            <span className={styles.demoPill}>
              {resolved?.dataStatus === 'demo'
                ? 'Demo data — generated, not a market feed.'
                : 'Delayed data'}
            </span>
            {note && <span className={styles.note}>{note}</span>}

            {shown && (
              <span className={`${styles.ohlc} tn-num`}>
                O {shown.open.toFixed(2)} H {shown.high.toFixed(2)} L {shown.low.toFixed(2)} C{' '}
                {shown.close.toFixed(2)}
                {shown.volume ? ` Vol ${(shown.volume / 1e6).toFixed(1)}M` : ''}
              </span>
            )}
          </div>

          {/* The canvas is aria-hidden; this is the series a screen reader gets. */}
          <div
            className={styles.stage}
            ref={stageRef}
            onPointerDown={onStagePointerDown}
            onPointerMove={onStagePointerMove}
            onPointerUp={onStagePointerUp}
          />
          {activeTool && (
            <div className={styles.toolHint} role="status">
              {TOOL_LABEL[activeTool]}: click {TOOL_POINTS[activeTool]} point
              {TOOL_POINTS[activeTool] > 1 ? 's' : ''} on the chart. Escape cancels.
            </div>
          )}
          <p className={styles.srOnly}>
            {symbol} at {interval}, {bars.length} bars. Latest close {last?.close.toFixed(2)},{' '}
            {up ? 'up' : 'down'} {Math.abs(changePercent).toFixed(2)} percent on the previous bar.
          </p>
        </div>

        {panelOpen && (
          <aside className={styles.rightPanel} aria-label="Chart panels">
            <div className={styles.panelTabs} role="tablist">
              <button
                role="tab"
                aria-selected={panelTab === 'objects'}
                className={`${styles.panelTab} ${panelTab === 'objects' ? styles.panelTabActive : ''}`}
                onClick={() => setPanelTab('objects')}
              >
                Objects &amp; data
              </button>
              <button
                role="tab"
                aria-selected={panelTab === 'voyager'}
                className={`${styles.panelTab} ${panelTab === 'voyager' ? styles.panelTabActive : ''}`}
                onClick={() => setPanelTab('voyager')}
              >
                Voyager
              </button>
            </div>

            {panelTab === 'voyager' && (
              <VoyagerChartPanel
                buildContext={buildContext}
                onHighlights={applyHighlights}
                hoveredFromChart={hoveredHighlight}
                plan={preview}
                onPlan={setPreview}
                liveState={liveState}
                showBefore={showBefore}
                onToggleBefore={setShowBefore}
                onApply={applyPlan}
                activity={activity}
              />
            )}

            <div className={styles.objectTree} hidden={panelTab !== 'objects'}>
              <div className={styles.dataTitle}>STUDIES</div>
              {Object.values(INDICATORS).map((definition) => {
                const on = indicators.some(
                  (instance) => instance.definitionId === definition.id
                );
                return (
                  <button
                    key={definition.id}
                    className={`${styles.objectRow} ${on ? styles.objectRowOn : ''}`}
                    aria-pressed={on}
                    onClick={() => toggleIndicator(definition.id)}
                  >
                    <span className={styles.objectName}>{definition.name}</span>
                    <span className={styles.objectMeta}>{on ? 'On' : 'Add'}</span>
                  </button>
                );
              })}

              <div className={styles.dataTitle} style={{ marginTop: 14 }}>
                DRAWINGS ({drawings.length})
              </div>
              {drawings.length === 0 && (
                <p className={styles.emptyNote}>
                  Nothing drawn yet. Pick a tool on the left, then click the chart.
                </p>
              )}
              {drawings.map((drawing) => (
                <div
                  key={drawing.id}
                  className={`${styles.objectRow} ${drawing.id === selectedId ? styles.objectRowOn : ''}`}
                >
                  <button
                    className={styles.objectName}
                    onClick={() => setSelectedId(drawing.id)}
                  >
                    {TOOL_LABEL[drawing.tool]}
                  </button>
                  <span className={styles.objectActions}>
                    <button
                      onClick={() => toggleDrawingFlag(drawing.id, 'hidden')}
                      title={drawing.hidden ? 'Show' : 'Hide'}
                      aria-label={drawing.hidden ? 'Show' : 'Hide'}
                    >
                      {drawing.hidden ? 'Show' : 'Hide'}
                    </button>
                    <button
                      onClick={() => toggleDrawingFlag(drawing.id, 'locked')}
                      title={drawing.locked ? 'Unlock' : 'Lock'}
                      aria-label={drawing.locked ? 'Unlock' : 'Lock'}
                    >
                      {drawing.locked ? 'Unlock' : 'Lock'}
                    </button>
                    <button
                      onClick={() => removeDrawing(drawing.id)}
                      title="Remove"
                      aria-label="Remove"
                    >
                      Remove
                    </button>
                  </span>
                </div>
              ))}
            </div>

            <div className={styles.dataWindow} hidden={panelTab !== 'objects'}>
              <div className={styles.dataTitle}>
                DATA WINDOW ·{' '}
                {shown ? new Date(shown.time * 1000).toISOString().slice(0, 10) : '—'} · {interval}
              </div>
              {shown &&
                (
                  [
                    ['Open', shown.open.toFixed(2)],
                    ['High', shown.high.toFixed(2)],
                    ['Low', shown.low.toFixed(2)],
                    ['Close', shown.close.toFixed(2)],
                    ['Volume', shown.volume ? `${(shown.volume / 1e6).toFixed(2)}M` : '—'],
                  ] as Array<[string, string]>
                ).map(([label, value]) => (
                  <div className={styles.dataRow} key={label}>
                    <span>{label}</span>
                    <span className="tn-num">{value}</span>
                  </div>
                ))}
            </div>
          </aside>
        )}
      </div>

      {toast && (
        <div className={styles.toast} role="status">
          <span>{toast}</span>
          {canUndo(history) && (
            <button className={styles.toastUndo} onClick={applyUndo}>
              Undo
            </button>
          )}
        </div>
      )}

      {dockOpen && (
        <div className={styles.dock}>
          <div className={styles.dockTabs}>
            <span className={`${styles.dockTab} ${styles.dockTabActive}`}>Script Lab</span>
            <span className={styles.dockTabSoon}>Strategy Tester · Coming next</span>
          </div>
          <ScriptLab
            studies={studyChoices}
            symbolTicker={resolved?.ticker ?? symbolId}
            bars={bars}
            onPreview={setScriptPlots}
          />
        </div>
      )}
    </div>
  );
}
