/**
 * The agent panel's controller (SPEC §7.3 `AgentController`, §7.4, §8 WP-16): every run
 * path of the v1 `AssistantPanel.tsx`, designed again on the v2 model, behind one door.
 *
 * Components render `state` and call actions; they never call the engine. This hook owns:
 * - ROUTING. A request is routed by the engine's `routeIntent` over the page and what the
 *   person points at (`model/runs.ts` `routeRequest`): a page or a section to build, an
 *   edit, or a question. A site request is built as one page and says so; a new page is
 *   opened through the host's `addPage` when it offers one, else built below this page
 *   and said so; a start-over the build cannot do appends, and says so (end notes). A
 *   new section is an edit-sized run, not a build (v1 `requestPath`).
 * - BUILDS (`runAiBuild`). Auto runs straight through. Ask stops at the engine's
 *   `onPlanned` question: the build turn becomes the plan card under the same turn id,
 *   nothing is written, and Build answers the question (with the edited plan, verbatim,
 *   when it was edited); Discard answers Stop. Plan mode asks for the plan only
 *   (`planAiPage`, else the scaffold with `apply: 'never'`) and writes nothing; the
 *   card's Build then builds exactly that plan (`runAiBuild({ pagePlan })`). Card and
 *   build are one turn, inked in place through a view transition (SPEC §5 moment 4).
 * - EDITS and NEW SECTIONS (`runAiAgent`, as v1 ran them). Auto applies (the engine tries
 *   a zero-token direct edit first; it reads like any edit, with Undo); Ask proposes, and
 *   Apply / Discard answer it; Plan mode writes a change plan (`outlineAiPlan`) whose
 *   "Run this plan" runs it once with authority to apply. Edits carry their route (the
 *   engine does not read the words twice) and the host's fast `editModel` / `editEffort`;
 *   a catalog suggestion picked and sent unedited is answered from the catalog itself.
 * - QUESTIONS are answered in words (`outlineAiPlan`): nothing is written, in any mode.
 * - STOP. One `AbortController` per run; Stop aborts it, answers a held plan question
 *   with Stop and pauses the queue. Nothing is written after it, by the engine (its lander
 *   refuses after the signal) or here (every write the controller makes itself checks the
 *   lease first).
 * - THE QUEUE (FR-025/026/054): one queued request, the composer's own text; revalidated
 *   against the page before it runs; paused after Stop until Continue.
 * - HISTORY. Row Undo is `revertBuildSection` (forward, one section; a refusal is said on
 *   the row); row Redo re-lands what the writer wrote, forward; Undo build is a kernel
 *   undo of exactly the build's transactions while they are the newest history entries
 *   (SPEC §7.6 E3 fallback, `model/kernel-history.ts`); an edit's Undo likewise.
 * - SUCCESSORS. Retry, "Write the failed sections again" and "Finish the rest" write
 *   exactly the named sections, in place, into the same record (`model/successor-fill.ts`),
 *   and never post a sentence as the person's turn.
 * - IMPROVE and CLARIFY (owner request): ✨ Improve rewrites the draft (Restore puts the
 *   person's words back); a request the router is unsure of (confidence < 0.6, and not a
 *   question) is read by the enhancer first, and when it comes back with questions the
 *   request waits, docked above the composer, until they are answered (the rewrite then
 *   runs), skipped ("Send as written") or dismissed.
 * - The conversations (`use-agent-sessions`), the live region (`use-live-status`), the
 *   canvas link (`use-canvas-link`), the face (`useAgentMood`) and the view transition.
 *
 * Every async flow reads state from stores, never from a render's closure: a build writes
 * its turns minutes after it started, into the conversation it started in.
 *
 * The flows, the actions and the view live under `agent-controller/`, one concern per
 * module; this file composes them.
 */
import { createLocalAiPlanProvider, systemClock } from '@craftkit/builder';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { useAgentMood } from '../../preview/components/AgentFace';
import { useAppliedChangeMemory } from '../../preview/components/AssistantPanel/AssistantPanel.memory';
import { capabilitiesFromEngine } from '../model/capabilities';
import { createStore } from '../model/tiny-store';
import type { AgentController } from '../model/view-types';
import { createActions } from './agent-controller/actions';
import {
  DEFAULT_REGISTRY,
  INITIAL_UI,
  LANDED_LINE_MS,
  type Env,
  type Flow,
  type Runtime,
  type UiState,
} from './agent-controller/controller-state';
import { followKernel } from './agent-controller/kernel-follow';
import type { AgentClock, UseAgentControllerOptions } from './agent-controller/options';
import { drainQueue } from './agent-controller/send';
import { useAgentViewState } from './agent-controller/use-agent-view-state';
import { noSelection, stableKernelReader, subscribeNothing } from './agent-controller/view-readers';
import { useAgentSessions } from './use-agent-sessions';
import { useCanvasLink } from './use-canvas-link';
import { useLiveStatus } from './use-live-status';
import { usePromptEnhancer } from './use-prompt-enhancer';
import { useStoryBible } from './use-story-bible';

/* The host's props and the public types they name (`agent-controller/options.ts`). */
export type {
  AgentClock,
  EditEffort,
  ProposalPreview,
  SelectionSource,
  UseAgentControllerOptions,
} from './agent-controller/options';

/* ── The hook ────────────────────────────────────────────────────────────────── */

/**
 * The agent panel's controller. The host renders `AgentPanel` with it (WP-20); the file
 * header says what each run path does.
 */
export function useAgentController(options: UseAgentControllerOptions): AgentController {
  const { kernel } = options;
  const [clock] = useState<AgentClock>(() => options.clock ?? systemClock);
  const provider = useMemo(
    () => options.provider ?? createLocalAiPlanProvider(),
    [options.provider],
  );
  const registry = options.skillRegistry ?? DEFAULT_REGISTRY;
  const capabilities = useMemo(
    () => options.capabilities ?? capabilitiesFromEngine(),
    [options.capabilities],
  );

  const sessions = useAgentSessions({
    storage: options.storage,
    defaultMode: options.defaultMode,
    now: () => clock.now(),
  });
  const live = useLiveStatus({ now: () => clock.now() });
  const canvas = useCanvasLink(kernel, { onPeek: options.onPeek });
  const enhancer = usePromptEnhancer({ provider, enhancer: options.enhancer });
  const memory = useAppliedChangeMemory();
  const storyBible = useStoryBible(options.storage);
  const shownCatalog = useRef<ReadonlySet<string>>(new Set());

  /* The kernel: its document and selection, as snapshots. */
  const kernelStore = kernel.context.store;
  const subscribeKernel = useCallback(
    (listener: () => void) => kernelStore.subscribe(listener),
    [kernelStore],
  );
  // (WP-20 fix) A page lens builds a new state per read; see `stableKernelReader`.
  const readKernel = useMemo(() => stableKernelReader(kernelStore), [kernelStore]);
  const kernelState = useSyncExternalStore(subscribeKernel, readKernel, readKernel);
  const document = kernelState.doc;
  const source = options.selection;
  const external = useSyncExternalStore(
    source?.subscribe ?? subscribeNothing,
    source?.get ?? noSelection,
    source?.get ?? noSelection,
  );
  const selection = source === undefined ? kernelState.selection : external;

  /* The controller's own state. */
  const [ui] = useState(() =>
    createStore<UiState>({
      ...INITIAL_UI,
      workers: options.fillConcurrency ?? 3,
    }),
  );
  const uiState = useSyncExternalStore(ui.subscribe, ui.getState, ui.getState);

  const mood = useAgentMood({
    mode: sessions.state.mode,
    composerFocused: uiState.composerFocused,
    draftLength: uiState.draft.length,
  });

  const [historyVersion, setHistoryVersion] = useState(0);
  const [runtime] = useState<Runtime>(() => ({
    lease: null,
    done: null,
    approvals: new Map(),
    superseded: new Set(),
    builds: new Map(),
    collect: null,
    shadows: new Map(),
    unsubscribe: new Map(),
    bump: () => {
      setHistoryVersion((version) => version + 1);
    },
  }));

  const env = useRef<Env>({
    options,
    provider,
    registry,
    capabilities,
    sessions,
    live,
    mood,
    enhancer,
    memory,
    storyBible: storyBible.store,
    selection,
    shownCatalog,
  });
  useLayoutEffect(() => {
    env.current = {
      options,
      provider,
      registry,
      capabilities,
      sessions,
      live,
      mood,
      enhancer,
      memory,
      storyBible: storyBible.store,
      selection,
      shownCatalog,
    };
  });

  const [flow] = useState<Flow>(() => ({
    ui,
    runtime,
    env: () => env.current,
    clock,
    drainQueue,
  }));
  const [actions] = useState(() => createActions(flow));

  // Follow the page's history (Undo build, an edit's Undo) and collect AI transactions.
  useEffect(() => {
    followKernel(flow, kernel);
  }, [flow, kernel]);

  // Unmount: the run in flight is aborted; nothing it would write belongs anywhere now.
  useEffect(
    () => () => {
      runtime.lease?.controller.abort();
      for (const off of runtime.unsubscribe.values()) off();
      runtime.unsubscribe.clear();
    },
    [runtime],
  );

  /* The RunBar's "{title} is on the page" holds 2.4s; one timer re-renders when it ends. */
  const [tick, setTick] = useState(0);
  const lastLandingAt = uiState.run?.lastLanding?.at;
  useEffect(() => {
    if (lastLandingAt === undefined) return undefined;
    const timer = setTimeout(
      () => {
        setTick((value) => value + 1);
      },
      Math.max(0, lastLandingAt + LANDED_LINE_MS - clock.now()) + 1,
    );
    return () => {
      clearTimeout(timer);
    };
  }, [clock, lastLandingAt]);

  const state = useAgentViewState({
    options,
    capabilities,
    document,
    selection,
    uiState,
    runtime,
    historyVersion,
    sessions,
    live,
    enhancer,
    mood,
    clock,
    tick,
  });

  // What was last offered stays known after the box fills (the list hides while it has text).
  const { suggestions } = state;
  useEffect(() => {
    if (suggestions.length === 0) return;
    shownCatalog.current = new Set(
      suggestions.flatMap((suggestion) =>
        suggestion.source === 'catalog' ? [suggestion.text.trim()] : [],
      ),
    );
  }, [suggestions]);

  const { reveal, peek } = canvas;
  return { ...actions, reveal, peek, state, capabilities, storyBible: storyBible.view };
}
