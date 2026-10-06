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
 */
import {
  AiBuildRevertError,
  applyAiPlan,
  classifyAiRunFailure,
  isAiNeedsInputError,
  createCraftkitAiSkillRegistry,
  createDirectPlanProvider,
  createLocalAiPlanProvider,
  customCodeSchema,
  outlineAiPlan,
  planAiPage,
  previewAiPlan,
  removeUnfilledSections,
  revertBuildSection,
  runAiAgent,
  runAiBuild,
  summarizeDocumentForIntent,
  systemClock,
  type AiAgentEvent,
  type AiAgentPolicy,
  type AiAgentRunResult,
  type AiBuildEvent,
  type AiBuildOwnEvent,
  type AiBuildPlanAnswer,
  type AiBuildPlannedTask,
  type AiBuildRunResult,
  type AiBuildSectionLanding,
  type AiBuildTaskReport,
  type AiPlanProvider,
  type AiRunFailure,
  type AiSkillRegistry,
  type AiValidatedProposal,
  type BuilderDocument,
  type BuilderKernel,
  type IntentRoute,
  type IntentTarget,
  type NodeId,
  type PagePlan,
  validatePagePlan,
  type RunAiAgentOptions,
  type RunAiBuildOptions,
} from '@craftkit/builder';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { t, type Key } from '../copy';
import { useAgentMood, type UseAgentMoodResult } from '../../preview/components/AgentFace';
import {
  useAppliedChangeMemory,
  type AppliedChangeMemory,
} from '../../preview/components/AssistantPanel/AssistantPanel.memory';
import {
  catalogPolicyFor,
  type ProviderKind,
} from '../../preview/components/AssistantPanel/catalogPolicyFor';
import {
  buildEndAnnouncement,
  editEndAnnouncement,
  runStartAnnouncement,
  visibleStatus,
  type ImmediateAnnouncementKey,
  type RunStatusInput,
  type VisibleStatus,
} from '../model/agent-status';
import { blockName, blockTypeName } from '../model/block-name';
import {
  initialBuildProgress,
  landedCount,
  lastEvidenceAt,
  reduceBuildProgress,
  type BuildProgress,
  type BuildTask,
} from '../model/build-progress';
import { capabilitiesFromEngine } from '../model/capabilities';
import {
  answersOf,
  clarifyQuestionsOf,
  isUnsureBuild,
  needsClarifying,
  requestWithAnswers,
  type EnhanceInput,
  type PromptEnhancer,
} from '../model/enhance';
import { impactLines, planImpact, schemaImpactNaming, type ImpactLine } from '../model/impact';
import {
  EMPTY_HISTORY,
  isNewest,
  isNextRedo,
  recordApplied,
  recordRedone,
  recordUndone,
  type HistoryShadow,
} from '../model/kernel-history';
import { consumeMentionFragment, mentionCandidatesFor, mentionQuery } from '../model/mentions';
import type { AgentStorage } from '../model/migrate-sessions';
import { effortSelection } from '../model/effort';
import { modelSelection } from '../model/model-label';
import {
  applyPlanOp,
  draftFromEnginePagePlan,
  isEdited,
  planDraftOf,
  toEnginePagePlan,
} from '../model/page-plan-draft';
import { queueRequest, queueView, revalidateQueue, type QueuedRequest } from '../model/queue';
import { initialRunProgress, reduceRunProgress } from '../model/run-progress';
import {
  lastDropped,
  lastFollowUp,
  ownsRun,
  ranOnPage,
  preflightPorts,
  routeRequest,
  skillsForMode,
  type ActiveRunLease,
} from '../model/runs';
import { sendState } from '../model/send-state';
import { stepsOf } from '../model/steps';
import {
  FILL_SKILL_ID,
  SUCCESSOR_WRITERS,
  failedKeys,
  guardSection,
  holdsValues,
  relandCommands,
  reopenForSuccessor,
  sectionLabel,
  sectionValues,
  successorBrief,
  successorCompletedEvent,
  taskCompletedEvent,
  taskSkippedEvent,
  taskStartedEvent,
  unwrittenKeys,
} from '../model/successor-fill';
import { panelSuggestions, starterSuggestions } from '../model/suggestions';
import { createStore, type Store } from '../model/tiny-store';
import { turnViewsOf, withPendingRequest, type TurnViewContext } from '../model/turn-views';
import {
  answerFromPlan,
  historyOf,
  outcomeKeyOf,
  type BuildTurn,
  type EditTurn,
  type ErrorTurn,
  type LandingOutcome,
  type PagePlanTurn,
  type ProposalTurn,
  type Salvage,
  type SentContext,
  type Session,
  type StepPlanTurn,
  type Turn,
} from '../model/turns';
import {
  isAwaitingDecision,
  type AgentCapabilities,
  type AgentController,
  type AgentViewState,
  type AssistantMode,
  type EffortLevel,
  type ClarifyQuestionView,
  type ClarifyView,
  type ContextChipView,
  type CopyParams,
  type CopyTarget,
  type EmptyStateView,
  type EndNoteKey,
  type FaceView,
  type Locale,
  type MentionView,
  type PlanOp,
  type RestoreResult,
  type RunActivity,
  type RunBarView,
  type SuggestionView,
  type TurnView,
} from '../model/view-types';
import { useAgentSessions, type AgentSessions } from './use-agent-sessions';
import { useCanvasLink } from './use-canvas-link';
import { useLiveStatus, type LiveStatus } from './use-live-status';
import { usePromptEnhancer, type PromptEnhancerHandle } from './use-prompt-enhancer';
import { runViewTransition } from './use-view-transition';

/* ── The host's props ────────────────────────────────────────────────────────── */

/** The canvas selection, when the host keeps it somewhere other than the kernel. */
export interface SelectionSource {
  readonly get: () => readonly NodeId[];
  readonly subscribe: (listener: () => void) => () => void;
}

/** A proposal shown on the canvas without writing it (SPEC §4.13 Preview). */
export interface ProposalPreview {
  readonly turnId: string;
  readonly document: BuilderDocument;
}

/** The run clock (`ClockPort`): the facade names it only through the run options. */
export type AgentClock = RunAiAgentOptions['clock'];

/** The reasoning budget a fast edit model runs at (`low` | `medium`, the engine's `AiEditEffort`). */
export type EditEffort = NonNullable<RunAiAgentOptions['editEffort']>;

export interface UseAgentControllerOptions {
  /** The page the panel edits. */
  readonly kernel: BuilderKernel;
  /** The UI locale (SPEC §4.0; Arabic is the default). */
  readonly locale: Locale;
  /** The plan provider; the deterministic local one when absent. */
  readonly provider?: AiPlanProvider | undefined;
  /** What the provider IS (`catalogPolicyFor`); `offline` when absent. */
  readonly providerKind?: ProviderKind | undefined;
  /**
   * Opens a new page for a "new page" request and hands back its kernel; the build then
   * lands there. Absent: the page is built below this one, and the thread says so.
   */
  readonly addPage?: ((title: string) => Promise<{ readonly kernel: BuilderKernel }>) | undefined;
  /** Where the canvas selection lives; the kernel's own when absent. */
  readonly selection?: SelectionSource | undefined;
  /**
   * The fast model an edit or a new section runs on (the engine's
   * `RunAiAgentOptions.editModel`); a page build keeps the provider's own model.
   */
  readonly editModel?: string | undefined;
  /** Its reasoning effort (the engine's `RunAiAgentOptions.editEffort`). */
  readonly editEffort?: EditEffort | undefined;
  /** Models ModelMenu offers, the chosen one, and the host's setter. */
  readonly models?: readonly string[] | undefined;
  readonly model?: string | undefined;
  readonly onSelectModel?: ((id: string) => void) | undefined;
  /**
   * The reasoning budget in force and the host's setter. Without the setter no effort menu
   * is drawn: a host with no server to take a budget has none to offer.
   */
  readonly effort?: EffortLevel | undefined;
  readonly onSelectEffort?: ((level: EffortLevel) => void) | undefined;
  readonly skillRegistry?: AiSkillRegistry | undefined;
  readonly selectedSkillIds?: readonly string[] | undefined;
  readonly agentPolicy?: Partial<AiAgentPolicy> | undefined;
  /** Every ordinary run's events (telemetry; never run authority). */
  readonly onAgentEvent?: ((event: AiAgentEvent) => void) | undefined;
  /** A build's own events (`build.*`, `task.*`). */
  readonly onBuildEvent?: ((event: AiBuildOwnEvent) => void) | undefined;
  /** Conversation storage: `undefined` localStorage, `null` memory only. */
  readonly storage?: AgentStorage | null | undefined;
  /** The mode a person starts in until they choose one (default `auto`). */
  readonly defaultMode?: AssistantMode | undefined;
  /** The engine's prerequisites; read off the engine when absent (`capabilitiesFromEngine`). */
  readonly capabilities?: AgentCapabilities | undefined;
  /** The developer flag: record menus offer Technical details (SPEC §4.15). */
  readonly developer?: boolean | undefined;
  /** ✨ Improve's enhancer; `null` turns it off; absent: the engine's, when it has one. */
  readonly enhancer?: PromptEnhancer | null | undefined;
  /** The clock runs and the live region read; injected by tests. */
  readonly clock?: AgentClock | undefined;
  /** Where "Copy" writes; `navigator.clipboard` when absent. */
  readonly clipboard?: ((text: string) => Promise<void>) | undefined;
  /** Shows a proposal on the canvas (`null` ends the preview). */
  readonly onPreview?: ((preview: ProposalPreview | null) => void) | undefined;
  /** Opens the code view on a proposal (RecordMenu "View as code"). */
  readonly onViewAsCode?: ((turnId: string) => void) | undefined;
  /** Opens the page's restore points (the revived caption's "Page history"). */
  readonly onOpenPageHistory?: (() => void) | undefined;
  /** Opens Technical details for a record (developer flag). */
  readonly onTechnicalDetails?: ((turnId: string) => void) | undefined;
  /** Phase 2: the canvas stage's pointed outline. */
  readonly onPeek?: ((nodeId: NodeId | null) => void) | undefined;
}

/* ── The controller's own state ──────────────────────────────────────────────── */

/** The run that holds the lease, as the RunBar and the flows read it. */
interface LiveRun {
  readonly runId: string;
  /** The record turn the run writes (a build, an edit, a proposal, a plan, an answer). */
  readonly turnId: string;
  readonly sessionId: string;
  readonly activity: RunActivity;
  readonly startedAt: number;
  readonly stopping: boolean;
  /** An Ask build is holding at its plan: the plan card is the decision, not a RunBar. */
  readonly awaiting: boolean;
  /** The newest landing, for the RunBar's 2.4s "{title} is on the page". */
  readonly lastLanding?: { readonly title: string; readonly at: number } | undefined;
}

/** A request docked above the composer while its questions are answered. */
interface Clarifying {
  readonly request: string;
  readonly context: readonly SentContext[];
  readonly pointed: readonly NodeId[];
  readonly route: IntentRoute;
  readonly understood: string;
  readonly questions: readonly ClarifyQuestionView[];
  readonly status: ClarifyView['status'];
}

interface UiState {
  readonly draft: string;
  /** Mention chips, by node id, with the label they had when picked. */
  readonly mentions: readonly { readonly id: NodeId; readonly label: string }[];
  /** A selection the person took off the request (its ids joined); shown again once it changes. */
  readonly dismissedSelection: string | null;
  readonly run: LiveRun | null;
  readonly queue: QueuedRequest | null;
  readonly clarify: Clarifying | null;
  readonly previewing: string | null;
  readonly composerFocused: boolean;
  /** A clarify check is in flight for the request being sent. */
  readonly checking: boolean;
}

const INITIAL_UI: UiState = {
  draft: '',
  mentions: [],
  dismissedSelection: null,
  run: null,
  queue: null,
  clarify: null,
  previewing: null,
  composerFocused: false,
  checking: false,
};

/** What a finished build left behind in this session: the kernel it wrote, the result. */
interface BuildRecordRuntime {
  readonly kernel: BuilderKernel;
  readonly result?: AiBuildRunResult | undefined;
}

interface Runtime {
  lease: ActiveRunLease | null;
  /** Settles when the flow holding the lease has finished writing its turns. */
  done: Promise<void> | null;
  /** The held `onPlanned` questions, by the plan card's turn id. */
  readonly approvals: Map<string, (answer: AiBuildPlanAnswer) => void>;
  /** Plan cards whose held question a newer request answered (not a Discard). */
  readonly superseded: Set<string>;
  readonly builds: Map<string, BuildRecordRuntime>;
  /** AI transactions landed while the current run held the lease. */
  collect: { readonly runId: string; readonly ids: string[] } | null;
  /** The kernels whose history the controller follows. */
  readonly shadows: Map<BuilderKernel, HistoryShadow>;
  readonly unsubscribe: Map<BuilderKernel, () => void>;
  /** Re-render when a followed kernel's history moves. */
  bump: () => void;
}

/* ── Small readers ───────────────────────────────────────────────────────────── */

const NO_SELECTION: readonly NodeId[] = [];
const DEFAULT_REGISTRY = createCraftkitAiSkillRegistry();
/** "{title} is on the page" holds the RunBar this long (SPEC §4.3 `build.landed`). */
const LANDED_LINE_MS = 2_400;

function selectionKey(ids: readonly NodeId[]): string {
  return ids.join('\u0000');
}

function offline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

/**
 * A page title from a request, for the host's `addPage`: one line, cut at a word boundary
 * when it runs past 60 characters. No ellipsis: a page title is a name, not a preview.
 */
function pageTitleFrom(request: string): string {
  const flat = request.replace(/\s+/gu, ' ').trim();
  if (flat.length <= 60) return flat;
  const cut = flat.slice(0, 60);
  const space = cut.lastIndexOf(' ');
  return (space > 30 ? cut.slice(0, space) : cut).trim();
}

function stoppedError(): Error {
  const error = new Error('The run was stopped.');
  error.name = 'AbortError';
  return error;
}

/* ── Everything a flow reads ─────────────────────────────────────────────────── */

interface Env {
  readonly options: UseAgentControllerOptions;
  readonly provider: AiPlanProvider;
  readonly registry: AiSkillRegistry;
  readonly capabilities: AgentCapabilities;
  readonly sessions: AgentSessions;
  readonly live: LiveStatus;
  readonly mood: UseAgentMoodResult;
  readonly enhancer: PromptEnhancerHandle;
  readonly memory: AppliedChangeMemory;
  readonly selection: readonly NodeId[];
  /** The catalog suggestions last on screen, by their exact words (`Outgoing.catalog`). */
  readonly shownCatalog: { readonly current: ReadonlySet<string> };
}

interface Flow {
  readonly ui: Store<UiState>;
  readonly runtime: Runtime;
  readonly env: () => Env;
  readonly clock: AgentClock;
}

/* ── Turn plumbing ───────────────────────────────────────────────────────────── */

function sessionOf(flow: Flow, sessionId: string): Session | undefined {
  return flow
    .env()
    .sessions.store.getState()
    .sessions.find((session) => session.id === sessionId);
}

function locateTurn(
  flow: Flow,
  turnId: string,
): { readonly sessionId: string; readonly turn: Turn; readonly index: number } | null {
  for (const session of flow.env().sessions.store.getState().sessions) {
    const index = session.turns.findIndex((turn) => turn.id === turnId);
    const turn = session.turns[index];
    if (turn !== undefined) return { sessionId: session.id, turn, index };
  }
  return null;
}

function patchTurn(
  flow: Flow,
  sessionId: string,
  turnId: string,
  change: (turn: Turn) => Turn,
): void {
  flow.env().sessions.updateTurns(sessionId, (turns) => {
    const next = turns.map((turn) => (turn.id === turnId ? change(turn) : turn));
    // Unchanged stays the same array: the conversation is neither re-dated nor re-saved.
    return next.some((turn, index) => turn !== turns[index]) ? next : turns;
  });
}

/** Change a turn only while it is still of `kind` (a plan card may have become an ending). */
function patchKind<K extends Turn['kind']>(
  flow: Flow,
  sessionId: string,
  turnId: string,
  kind: K,
  change: (turn: Extract<Turn, { kind: K }>) => Turn,
): void {
  patchTurn(flow, sessionId, turnId, (turn) =>
    turn.kind === kind ? change(turn as Extract<Turn, { kind: K }>) : turn,
  );
}

function insertAfter(
  flow: Flow,
  sessionId: string,
  anchorId: string | null,
  added: readonly Turn[],
): void {
  if (added.length === 0) return;
  flow.env().sessions.updateTurns(sessionId, (turns) => {
    const index = anchorId === null ? -1 : turns.findIndex((turn) => turn.id === anchorId);
    return index === -1 ? [...turns, ...added] : turns.toSpliced(index + 1, 0, ...added);
  });
}

/** Put `record` at `turnId`: replace it when it is there, else add it after `anchorId`. */
function placeRecord(
  flow: Flow,
  sessionId: string,
  anchorId: string | null,
  record: Turn,
): void {
  const exists = sessionOf(flow, sessionId)?.turns.some((turn) => turn.id === record.id) ?? false;
  if (exists) {
    patchTurn(flow, sessionId, record.id, () => record);
    return;
  }
  insertAfter(flow, sessionId, anchorId, [record]);
}

/** The request a record answers: its own `request`, else the person's turn before it. */
function requestOf(
  flow: Flow,
  turnId: string,
): { readonly text: string; readonly context: readonly SentContext[] } | null {
  const located = locateTurn(flow, turnId);
  if (located === null) return null;
  const turns = sessionOf(flow, located.sessionId)?.turns ?? [];
  const user = turns.slice(0, located.index).findLast((turn) => turn.kind === 'user');
  if (user?.kind === 'user') return { text: user.text, context: user.context };
  const own = 'request' in located.turn ? located.turn.request : undefined;
  return own === undefined ? null : { text: own, context: [] };
}

/* ── The lease ───────────────────────────────────────────────────────────────── */

interface Slot {
  readonly sessionId: string;
  readonly turnId: string;
  readonly runId: string;
  readonly controller: AbortController;
}

/**
 * Take the one lease for a run writing `turnId`. Null when a run already holds it: the
 * send path queues instead, so this only refuses a second action racing the first.
 */
function claim(flow: Flow, sessionId: string, turnId: string, activity: RunActivity): Slot | null {
  if (flow.runtime.lease !== null) return null;
  const runId = flow.env().sessions.nextId('run');
  const controller = new AbortController();
  flow.runtime.lease = { runId, controller };
  flow.runtime.collect = { runId, ids: [] };
  flow.ui.setState((ui) => ({
    ...ui,
    run: {
      runId,
      turnId,
      sessionId,
      activity,
      startedAt: flow.clock.now(),
      stopping: false,
      awaiting: false,
    },
  }));
  return { sessionId, turnId, runId, controller };
}

/** The run still owns the lease and was not stopped: it may write. */
function holds(flow: Flow, slot: Slot): boolean {
  return ownsRun(flow.runtime.lease, slot.runId) && !slot.controller.signal.aborted;
}

function setRun(flow: Flow, slot: Slot, patch: Partial<LiveRun>): void {
  flow.ui.setState((ui) =>
    ui.run?.runId === slot.runId ? { ...ui, run: { ...ui.run, ...patch } } : ui,
  );
}

/** The AI transactions this run landed so far, oldest first. */
function collected(flow: Flow, slot: Slot): readonly string[] {
  return flow.runtime.collect?.runId === slot.runId ? [...flow.runtime.collect.ids] : [];
}

/** Give the lease back and let the queue run. */
function release(flow: Flow, slot: Slot): void {
  if (!ownsRun(flow.runtime.lease, slot.runId)) return;
  flow.runtime.lease = null;
  flow.runtime.collect = null;
  const stopped = slot.controller.signal.aborted;
  flow.ui.setState((ui) => ({
    ...ui,
    run: null,
    queue: ui.queue === null ? null : stopped ? { ...ui.queue, paused: true } : ui.queue,
    // After a Stop the queue keeps its own text and the composer empties (SPEC §3.10).
    draft: stopped && ui.queue !== null ? '' : ui.draft,
  }));
  if (!stopped) {
    queueMicrotask(() => {
      drainQueue(flow);
    });
  }
}

/** Run `work` as the flow holding the lease; `done` settles when it wrote its turns. */
function track(flow: Flow, work: Promise<void>): Promise<void> {
  const done = work.catch(() => undefined);
  flow.runtime.done = done;
  void done.then(() => {
    if (flow.runtime.done === done) flow.runtime.done = null;
  });
  return done;
}

/* ── Kernel history (Undo build, an edit's Undo) ─────────────────────────────── */

function followKernel(flow: Flow, kernel: BuilderKernel): void {
  const { runtime } = flow;
  if (runtime.unsubscribe.has(kernel)) return;
  runtime.shadows.set(kernel, runtime.shadows.get(kernel) ?? EMPTY_HISTORY);
  const set = (next: (shadow: HistoryShadow) => HistoryShadow): void => {
    runtime.shadows.set(kernel, next(runtime.shadows.get(kernel) ?? EMPTY_HISTORY));
    runtime.bump();
  };
  const events = kernel.context.events;
  const offs = [
    events.on('tx.applied', ({ tx }) => {
      set((shadow) => recordApplied(shadow, tx));
      const collect = runtime.collect;
      if (collect !== null && tx.author === 'ai' && runtime.lease?.runId === collect.runId) {
        collect.ids.push(tx.id);
      }
    }),
    events.on('history.undone', ({ tx }) => {
      set((shadow) => recordUndone(shadow, tx));
    }),
    events.on('history.redone', ({ tx }) => {
      set((shadow) => recordRedone(shadow, tx));
    }),
  ];
  runtime.unsubscribe.set(kernel, () => {
    for (const off of offs) off();
  });
}

function shadowOf(flow: Flow, kernel: BuilderKernel): HistoryShadow {
  return flow.runtime.shadows.get(kernel) ?? EMPTY_HISTORY;
}

function kernelOfBuild(flow: Flow, turnId: string): BuilderKernel {
  return flow.runtime.builds.get(turnId)?.kernel ?? flow.env().options.kernel;
}

/* ── Shared run options ──────────────────────────────────────────────────────── */

function commonRunOptions(
  flow: Flow,
  kernel: BuilderKernel,
  slot: Slot,
  request: string,
  selection: readonly NodeId[],
  history: RunAiAgentOptions['history'],
): Omit<RunAiAgentOptions, 'apply' | 'onEvent' | 'label'> {
  const env = flow.env();
  const { options } = env;
  return {
    runId: slot.runId,
    clock: flow.clock,
    kernel,
    provider: env.provider,
    request,
    validationPorts: preflightPorts(),
    selection,
    ...(history === undefined ? {} : { history }),
    ...(env.memory.hasRecords() ? { additionalContextProviders: [env.memory.provider] } : {}),
    skillRegistry: env.registry,
    ...(options.selectedSkillIds === undefined
      ? {}
      : { selectedSkillIds: options.selectedSkillIds }),
    ...catalogPolicyFor(options.providerKind ?? 'offline', selection, options.agentPolicy),
    signal: slot.controller.signal,
    isCurrentRun: (candidate) => flow.runtime.lease?.runId === candidate,
  };
}

/**
 * The fast model an edit runs on (owner request: a one-word change must not wait on the
 * page-building model). The engine uses it only for an edit or a new section; a direct
 * edit it can make with no model at all never reaches it.
 */
function editModelOptions(flow: Flow): Pick<RunAiAgentOptions, 'editModel' | 'editEffort'> {
  const { editModel, editEffort } = flow.env().options;
  return {
    ...(editModel === undefined || editModel === '' ? {} : { editModel }),
    ...(editEffort === undefined ? {} : { editEffort }),
  };
}

/** A ChangeLines naming in the panel's locale, from the registry's own names. */
function namingFor(flow: Flow, kernel: BuilderKernel) {
  const { locale } = flow.env().options;
  return schemaImpactNaming(
    (key) => t(locale, key),
    (type) => kernel.context.registry.block(type)?.schema,
  );
}

interface Changes {
  readonly lines: readonly ImpactLine[];
  readonly empty: boolean;
}

/** What a proposal would change, rehearsed on a scratch kernel; nothing when it cannot be. */
function rehearse(flow: Flow, kernel: BuilderKernel, proposal: AiValidatedProposal): Changes {
  try {
    const before = kernel.getDocument();
    const after = previewAiPlan({ kernel, proposal, validationPorts: preflightPorts() });
    return {
      lines: impactLines(before, after, namingFor(flow, kernel)),
      empty: planImpact(before, after).empty,
    };
  } catch {
    // A proposal that cannot be rehearsed is still one to read; the card just says less.
    return { lines: [], empty: false };
  }
}

/** What an applied change did, between two documents. */
function compare(flow: Flow, kernel: BuilderKernel, before: BuilderDocument, after: BuilderDocument): Changes {
  return {
    lines: impactLines(before, after, namingFor(flow, kernel)),
    empty: planImpact(before, after).empty,
  };
}

function failureTurn(
  id: string,
  request: string,
  cause: unknown,
  pageState: ErrorTurn['pageState'],
  elapsedMs: number,
): ErrorTurn {
  const failure: AiRunFailure = failureOf(cause);
  return {
    id,
    kind: 'error',
    request,
    failure,
    ...(offline() ? { offline: true } : {}),
    pageState,
    elapsedMs,
  };
}

function failureOf(cause: unknown): AiRunFailure {
  return typeof cause === 'object' && cause !== null && 'failure' in cause
    ? (cause as { readonly failure: AiRunFailure }).failure
    : classifyAiRunFailure(cause);
}

function say(flow: Flow, key: ImmediateAnnouncementKey, params?: CopyParams): void {
  flow.env().live.say(key, params);
}

/* ── Where a run's turns go ──────────────────────────────────────────────────── */

/** What was sent: the person's words, their context chips, the blocks they point at. */
interface Outgoing {
  readonly text: string;
  readonly context: readonly SentContext[];
  readonly pointed: readonly NodeId[];
  /** What the engine is asked, when it is more than the words (a change to a plan). */
  readonly request?: string | undefined;
  /** The words are a catalog suggestion, picked and sent unedited (answered from the catalog). */
  readonly catalog?: boolean | undefined;
}

/**
 * The provider with the block catalog in front of it (v1's `catalogFirstProvider`): a
 * catalog suggestion carries a block's own example prompt, and the catalog already holds
 * the node that prompt produces, so asking a model would spend a round trip to be told a
 * value the page already has. Only a suggestion the person PICKED reaches this; typed
 * words that happen to read the same are the person's own request (`Outgoing.catalog`).
 * An example that no longer matches falls through to the provider, unchanged.
 */
function catalogFirst(kernel: BuilderKernel, fallback: AiPlanProvider): AiPlanProvider {
  return createDirectPlanProvider({
    catalog: () =>
      kernel.context.registry.blocks(kernel.context.surface).map(({ schema }) => ({
        type: schema.type,
        examples: schema.examples,
      })),
    fallback,
  });
}

/** What a provider said when it answered in words alone: no command at all. */
interface WordsOnly {
  readonly rationale: string;
  readonly commands: readonly unknown[];
  readonly followUp?: string | undefined;
}

function wordsOnly(answer: unknown): WordsOnly | null {
  if (typeof answer !== 'object' || answer === null) return null;
  const record = answer as Record<string, unknown>;
  const { rationale, commands, followUp } = record;
  if (typeof rationale !== 'string' || !Array.isArray(commands) || commands.length > 0) return null;
  return {
    rationale,
    commands: [],
    ...(typeof followUp === 'string' ? { followUp } : {}),
  };
}

/**
 * The provider with a note of its last words-only answer. The engine's door refuses a plan
 * with no command ("An AI plan needs at least one command"), and it refuses it before any
 * event carries the plan, so a model asking back ("Which page should the link open?") would
 * read as a failure. The note lets the edit tell the two apart: words and no command are an
 * answer; a refusal of real commands stays a failure. Every other member passes through.
 */
function recordingWords(provider: AiPlanProvider): {
  readonly provider: AiPlanProvider;
  readonly words: () => WordsOnly | null;
} {
  let last: WordsOnly | null = null;
  const note = (answer: unknown): unknown => {
    last = wordsOnly(answer);
    return answer;
  };
  const wrapped = new Proxy(provider, {
    get(target, property, receiver) {
      const value: unknown = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') return value;
      if (property === 'propose' || property === 'repair') {
        return async (...args: unknown[]) =>
          note(await (value as (...rest: unknown[]) => Promise<unknown>).apply(target, args));
      }
      return (value as (...rest: unknown[]) => unknown).bind(target);
    },
  });
  return { provider: wrapped, words: () => last };
}

/**
 * A run the door refused only because the model answered in words: the refusal is
 * `plan-rejected`, the last answer had no command and something to say, and nothing landed.
 */
function spokeInWords(
  cause: unknown,
  heard: (() => WordsOnly | null) | undefined,
  kernel: BuilderKernel,
  logBefore: number,
): boolean {
  if (heard === undefined || kernel.transactions().length !== logBefore) return false;
  if (classifyAiRunFailure(cause).code !== 'plan-rejected') return false;
  const said = wordsSaid(cause, heard);
  if (said === null) return false;
  return said.rationale.trim() !== '' || (said.followUp?.trim() ?? '') !== '';
}

/**
 * The words a refused run said: the engine's own question (media-motion fix pass,
 * 2026-10-06: a video with no link is asked for with no model), else the model's.
 */
function wordsSaid(cause: unknown, heard: (() => WordsOnly | null) | undefined): WordsOnly | null {
  if (isAiNeedsInputError(cause)) return { rationale: cause.words.rationale, commands: [] };
  return heard?.() ?? null;
}

function engineRequest(outgoing: Outgoing): string {
  return outgoing.request ?? outgoing.text;
}

/** A new exchange, or an existing record re-run in place (Try again, Build, Run this plan). */
interface Placement {
  readonly sessionId: string;
  readonly recordTurnId?: string | undefined;
  /** The history the run carries, computed before the record changed. */
  readonly history?: RunAiAgentOptions['history'];
}

/**
 * Open the run's place in the thread: the person's turn and the record (a new exchange),
 * or the record re-run in place. `record: null` opens the person's turn alone (an answer
 * appears when it is ready). Returns the turn the record goes after.
 */
function openExchange(
  flow: Flow,
  placement: Placement,
  outgoing: Outgoing,
  record: Turn | null,
): string | null {
  const { sessions } = flow.env();
  const reuse = placement.recordTurnId;
  if (reuse !== undefined) {
    const located = locateTurn(flow, reuse);
    const turns = sessionOf(flow, placement.sessionId)?.turns ?? [];
    const anchor = located === null ? null : (turns[located.index - 1]?.id ?? null);
    if (record === null) {
      sessions.updateTurns(placement.sessionId, (current) => current.filter((turn) => turn.id !== reuse));
    } else {
      patchTurn(flow, placement.sessionId, reuse, () => record);
    }
    return anchor;
  }
  const userId = sessions.nextId('turn');
  sessions.updateTurns(placement.sessionId, (turns) => [
    ...turns,
    { id: userId, kind: 'user', text: outgoing.text, context: outgoing.context },
    ...(record === null ? [] : [record]),
  ]);
  return userId;
}

/** The person's turn before `turnId` was stopped before any output (SPEC §4.5 "Not run"). */
function markNotRun(flow: Flow, sessionId: string, anchorId: string | null): void {
  if (anchorId === null) return;
  patchKind(flow, sessionId, anchorId, 'user', (turn) => ({ ...turn, notRun: true }));
}

function historyFor(flow: Flow, placement: Placement): RunAiAgentOptions['history'] {
  if (placement.history !== undefined) return placement.history;
  return historyOf(sessionOf(flow, placement.sessionId)?.turns ?? []);
}

async function dispatchRequest(
  flow: Flow,
  outgoing: Outgoing,
  route: IntentRoute,
  placement: Placement,
  mode: AssistantMode,
  /** Planned only because the router was unsure (`PagePlanTurn.unsure`). */
  unsure = false,
): Promise<void> {
  switch (route.kind) {
    case 'question':
      await runWords(flow, outgoing, placement, 'answer');
      return;
    case 'build-page':
    case 'build-site':
      if (mode === 'plan') {
        await runPlanPage(flow, outgoing, placement, route.target, unsure);
        return;
      }
      await runPage(flow, outgoing, placement, route, mode);
      return;
    case 'add-section':
    case 'edit':
      if (mode === 'plan') {
        await runWords(flow, outgoing, placement, 'steps');
        return;
      }
      await runEdit(flow, outgoing, placement, mode === 'ask' ? 'never' : 'auto', route);
      return;
  }
}

/* ── Words only: answers and change plans ────────────────────────────────────── */

function targetOf(outgoing: Outgoing): { readonly label?: string; readonly id?: NodeId } {
  // An inferred type predicate: `target` is a block chip here, never the page scope.
  const target = outgoing.context.find((entry) => entry.kind !== 'page');
  return target === undefined ? {} : { label: target.label, id: target.id };
}

async function runWords(
  flow: Flow,
  outgoing: Outgoing,
  placement: Placement,
  kind: 'answer' | 'steps',
): Promise<void> {
  const env = flow.env();
  const kernel = env.options.kernel;
  const turnId = placement.recordTurnId ?? env.sessions.nextId('turn');
  const history = historyFor(flow, placement);
  const target = targetOf(outgoing);
  const slot = claim(flow, placement.sessionId, turnId, kind === 'answer' ? 'answer' : 'plan');
  if (slot === null) return;
  const request = engineRequest(outgoing);
  // An answer has no drafting record: the RunBar says it is reading, the answer arrives whole.
  const anchor = openExchange(
    flow,
    placement,
    outgoing,
    kind === 'steps'
      ? { id: turnId, kind: 'step-plan', request, status: 'drafting', steps: [], text: '', dropped: 0 }
      : null,
  );
  env.mood.beginRun(slot.runId, target.label ?? '');
  if (kind === 'steps') say(flow, 'plan.drafting');
  const startedAt = flow.clock.now();
  try {
    const selectedSkillIds =
      kind === 'steps'
        ? skillsForMode('plan', env.options.selectedSkillIds)
        : env.options.selectedSkillIds;
    const outline = await outlineAiPlan({
      kernel,
      provider: env.provider,
      request,
      selection: outgoing.pointed,
      ...(history === undefined ? {} : { history }),
      skillRegistry: env.registry,
      ...(selectedSkillIds === undefined ? {} : { selectedSkillIds }),
      ...catalogPolicyFor(
        env.options.providerKind ?? 'offline',
        outgoing.pointed,
        env.options.agentPolicy,
      ),
      signal: slot.controller.signal,
    });
    if (!holds(flow, slot)) throw stoppedError();
    const skills = outline.skillActivations;
    const followUp = outline.followUp === undefined ? {} : { followUp: outline.followUp };
    if (kind === 'answer') {
      placeRecord(flow, slot.sessionId, anchor, {
        id: turnId,
        kind: 'answer',
        text: outline.rationale,
        request,
        ...followUp,
        ...(skills === undefined ? {} : { skills }),
      });
      say(flow, 'answer.ready');
    } else {
      const steps: StepPlanTurn = {
        id: turnId,
        kind: 'step-plan',
        request,
        status: 'ready',
        steps: stepsOf(outline.rationale, target.label),
        text: outline.rationale,
        dropped: outline.droppedCommands,
        ...followUp,
        ...(skills === undefined ? {} : { skills }),
      };
      placeRecord(flow, slot.sessionId, anchor, steps);
      say(flow, 'plan.ready');
    }
    env.mood.settleTurn({ runId: slot.runId, outcome: 'plan', applied: false });
  } catch (cause: unknown) {
    if (slot.controller.signal.aborted) {
      placeRecord(flow, slot.sessionId, anchor, { id: turnId, kind: 'end', key: 'stoppedBeforeChange' });
      markNotRun(flow, slot.sessionId, anchor);
      say(flow, 'stopped.none');
      env.mood.settleTurn({ runId: slot.runId, outcome: 'stopped' });
    } else {
      const failure = failureOf(cause);
      placeRecord(
        flow,
        slot.sessionId,
        anchor,
        failureTurn(turnId, request, cause, { kind: 'unchanged' }, flow.clock.now() - startedAt),
      );
      say(flow, 'failed');
      env.mood.settleTurn({ runId: slot.runId, outcome: 'refused', retryable: failure.retryable });
    }
  } finally {
    release(flow, slot);
  }
}

/* ── Edits ───────────────────────────────────────────────────────────────────── */

/**
 * The section a zero-token direct edit wrote, as the record's target, when the person
 * named no block and every change sits in that one section. Without it the record reads
 * «عُدِّلت الصفحة» for an edit that changed one heading. Empty when the person's own chip
 * names the target, or when the edit was a model's.
 */
function directTarget(
  kernel: BuilderKernel,
  result: Pick<AiAgentRunResult, 'directEdit'>,
  chosen: string | undefined,
): { readonly target?: string; readonly targetNodeId?: string } {
  const direct = result.directEdit?.target;
  if (chosen !== undefined || direct === undefined) return {};
  if (!direct.changes.every((change) => change.sectionId === direct.sectionId)) return {};
  if (kernel.getDocument().nodes[direct.sectionId] === undefined) return {};
  const name = direct.sectionName?.trim();
  return {
    target: name === undefined || name === '' ? blockName(kernel, direct.sectionId) : name,
    targetNodeId: direct.sectionId,
  };
}

async function runEdit(
  flow: Flow,
  outgoing: Outgoing,
  placement: Placement,
  apply: 'auto' | 'never',
  route?: IntentRoute,
): Promise<void> {
  const env = flow.env();
  const kernel = env.options.kernel;
  const turnId = placement.recordTurnId ?? env.sessions.nextId('turn');
  const history = historyFor(flow, placement);
  const target = targetOf(outgoing);
  const activity: RunActivity = apply === 'auto' ? 'edit' : 'proposal';
  const slot = claim(flow, placement.sessionId, turnId, activity);
  if (slot === null) return;
  followKernel(flow, kernel);
  const request = engineRequest(outgoing);
  const startedAt = flow.clock.now();
  const run = initialRunProgress(apply, startedAt);
  const common = {
    id: turnId,
    request,
    ...(target.label === undefined ? {} : { target: target.label }),
    ...(target.id === undefined ? {} : { targetNodeId: target.id }),
  };
  const drafting: Turn =
    apply === 'auto'
      ? { ...common, kind: 'edit', origin: 'request', status: 'running', mode: 'auto', run, changes: [] }
      : { ...common, kind: 'proposal', status: 'drafting', mode: 'ask', run, changes: [] };
  const anchor = openExchange(flow, placement, outgoing, drafting);
  env.mood.beginRun(slot.runId, target.label ?? '');
  const start = runStartAnnouncement(
    activity === 'edit' ? { activity: 'edit', target: target.label ?? null } : { activity: 'proposal' },
  );
  if (start !== null) say(flow, start.key, start.params);
  const logBefore = kernel.transactions().length;
  const documentBefore = kernel.getDocument();
  let beforeApply: BuilderDocument | undefined;
  let salvaged: Salvage | undefined;
  let proposed: Changes | undefined;
  const liveRun = (turn: Turn) =>
    (turn.kind === 'edit' || turn.kind === 'proposal') && turn.run !== undefined ? turn.run : run;
  let heard: (() => WordsOnly | null) | undefined;
  try {
    const base = commonRunOptions(flow, kernel, slot, request, outgoing.pointed, history);
    // A catalog example picked by name is answered from the catalog: no model, no wait.
    const recording = recordingWords(
      outgoing.catalog === true ? catalogFirst(kernel, base.provider) : base.provider,
    );
    heard = recording.words;
    const runOptions: RunAiAgentOptions = {
      ...base,
      provider: recording.provider,
      ...editModelOptions(flow),
      // The route this request was sent on: the engine does not read the words twice.
      ...(route === undefined ? {} : { intent: route }),
      apply,
      onEvent: (event) => {
        env.mood.onEvent(event);
        env.options.onAgentEvent?.(event);
        if (event.type === 'plan.salvaged') salvaged = { kept: event.kept, dropped: event.dropped };
        if (event.type === 'plan.proposed' && apply === 'never') {
          proposed = rehearse(flow, kernel, event.proposal);
        }
        if (event.type === 'plan.applying') beforeApply = kernel.getDocument();
        patchTurn(flow, slot.sessionId, turnId, (turn) => {
          if ((turn.kind !== 'edit' && turn.kind !== 'proposal') || turn.run === undefined) return turn;
          const next = reduceRunProgress(turn.run, event);
          return next === turn.run ? turn : { ...turn, run: next };
        });
      },
    };
    const result: AiAgentRunResult = await runAiAgent(runOptions);
    const endedAt = flow.clock.now();
    const plan = result.plan;
    const shared = {
      ...(plan.followUp === undefined ? {} : { followUp: plan.followUp }),
      ...(salvaged === undefined ? {} : { salvaged }),
      skills: result.proposal.skillActivations,
    };
    /*
      Words and no command (most often the model asking what was meant): an answer, not
      an edit that "already matched what you asked for" (`answerFromPlan`). Only when
      nothing landed and nothing was salvaged away: a plan whose commands were all
      dropped would describe changes that never happened.
    */
    const words =
      salvaged === undefined && kernel.transactions().length === logBefore
        ? answerFromPlan({ id: turnId, request, plan, skills: result.proposal.skillActivations })
        : null;
    if (words !== null) {
      patchTurn(flow, slot.sessionId, turnId, () => words);
      say(flow, 'answer.ready');
      env.mood.settleTurn({ runId: slot.runId, outcome: 'plan', applied: false });
    } else if (result.status === 'applied') {
      env.memory.note(result.proposal);
      const ids = kernel
        .transactions()
        .slice(logBefore)
        .filter((tx) => tx.author === 'ai')
        .map((tx) => tx.id);
      const transactionId = ids.at(-1);
      // What the one transaction did (a direct edit too, which proposes nothing to rehearse).
      const changes = compare(flow, kernel, beforeApply ?? documentBefore, kernel.getDocument());
      const status = transactionId !== undefined && !changes.empty ? 'done' : 'noChange';
      // A zero-token edit knows the one section it wrote: the record names it (SPEC §3.6).
      const named = directTarget(kernel, result, target.label);
      patchTurn(flow, slot.sessionId, turnId, (turn): Turn => ({
        ...common,
        ...named,
        kind: 'edit',
        origin: 'request',
        status,
        mode: 'auto',
        run: liveRun(turn),
        elapsedMs: endedAt - startedAt,
        changes: changes.lines,
        summary: plan.rationale,
        ...(transactionId === undefined || status === 'noChange' ? {} : { transactionId }),
        ...shared,
      }));
      const end = editEndAnnouncement({ status, target: named.target ?? target.label ?? null });
      say(flow, end.key, end.params);
      env.mood.settleTurn({ runId: slot.runId, outcome: 'plan', applied: true });
    } else {
      const touched = kernel.transactions().length > logBefore;
      const changes = proposed ?? rehearse(flow, kernel, result.proposal);
      patchTurn(flow, slot.sessionId, turnId, (turn): Turn => ({
        ...common,
        kind: 'proposal',
        status: 'ready',
        mode: 'ask',
        plan,
        proposal: result.proposal,
        changes: changes.lines,
        run: liveRun(turn),
        elapsedMs: endedAt - startedAt,
        ...(touched ? { pageTouched: true } : {}),
        ...shared,
      }));
      say(flow, 'proposal.ready');
      env.mood.settleTurn({ runId: slot.runId, outcome: 'plan', applied: false });
    }
  } catch (cause: unknown) {
    const endedAt = flow.clock.now();
    if (slot.controller.signal.aborted) {
      if (apply === 'auto') {
        patchTurn(flow, slot.sessionId, turnId, (turn): Turn => ({
          ...common,
          kind: 'edit',
          origin: 'request',
          status: 'stopped',
          mode: 'auto',
          run: liveRun(turn),
          elapsedMs: endedAt - startedAt,
          changes: [],
        }));
      } else {
        patchTurn(flow, slot.sessionId, turnId, () => ({ id: turnId, kind: 'end', key: 'stoppedBeforeChange' }));
        markNotRun(flow, slot.sessionId, anchor);
      }
      say(flow, 'stopped.none');
      env.mood.settleTurn({ runId: slot.runId, outcome: 'stopped' });
    } else if (spokeInWords(cause, heard, kernel, logBefore)) {
      // The model answered in words (most often asking what was meant): its answer.
      const said = wordsSaid(cause, heard);
      const words =
        said === null ? null : answerFromPlan({ id: turnId, request, plan: said });
      if (words !== null) patchTurn(flow, slot.sessionId, turnId, () => words);
      say(flow, 'answer.ready');
      env.mood.settleTurn({ runId: slot.runId, outcome: 'plan', applied: false });
    } else {
      const failure = failureOf(cause);
      patchTurn(flow, slot.sessionId, turnId, () =>
        failureTurn(turnId, request, cause, { kind: 'unchanged' }, endedAt - startedAt),
      );
      say(flow, 'failed');
      env.mood.settleTurn({ runId: slot.runId, outcome: 'refused', retryable: failure.retryable });
    }
  } finally {
    release(flow, slot);
  }
}

/* ── Builds ──────────────────────────────────────────────────────────────────── */

interface BuildPlan {
  /** Where the page lands. */
  readonly target?: IntentTarget | undefined;
  /** Build exactly this plan (Plan mode's Build). */
  readonly pagePlan?: PagePlan | undefined;
  /** Hold at the plan for the person's Build (Ask, or a start-over in Auto). */
  readonly approval: boolean;
  /** The page it lands on (a new page's kernel), when not the panel's own. */
  readonly kernel?: BuilderKernel | undefined;
  /** What the thread says after the record, once the build landed something. */
  readonly notes: readonly EndNoteKey[];
}

/**
 * Whether a build here can remove what is on the page before laying its own: only a
 * page-plan build does (`replace`), and only with a provider that can plan a page and a
 * registry holding the region block a plan is laid as (`run-build.ts` `planStep`).
 */
function canStartOver(flow: Flow, kernel: BuilderKernel): boolean {
  return (
    flow.env().provider.proposePagePlan !== undefined &&
    kernel.context.registry.block(customCodeSchema.type) !== undefined
  );
}

/** Where a page build lands, and what the thread says about it afterwards. */
interface Landing {
  readonly kernel: BuilderKernel;
  readonly target: IntentTarget | undefined;
  readonly notes: readonly EndNoteKey[];
  /** A start-over on a page with content: the plan card asks first, even in Auto. */
  readonly confirm: boolean;
}

/**
 * The landing decisions every page build shares (v1 `requestPath`): a new page opens
 * through the host's `addPage` when it offers one, else the page is built below this one
 * and the thread says so; a start-over the build cannot do appends, and says so; a
 * start-over it can do asks first.
 */
async function landingFor(
  flow: Flow,
  wanted: IntentTarget | undefined,
  request: string,
  notes: readonly EndNoteKey[],
): Promise<Landing> {
  const env = flow.env();
  let kernel = env.options.kernel;
  const said = [...notes];
  let target = wanted;
  if (target === 'new-page') {
    const addPage = env.options.addPage;
    if (addPage === undefined) {
      target = 'append';
      said.push('newPageAppended');
    } else {
      try {
        kernel = (await addPage(pageTitleFrom(request))).kernel;
      } catch {
        target = 'append';
        said.push('newPageAppended');
      }
    }
  }
  const page = summarizeDocumentForIntent(kernel.getDocument());
  const holdsContent = page.nodeCount > 0 && !page.placeholderOnly;
  let confirm = false;
  if (target === 'replace' && holdsContent) {
    if (canStartOver(flow, kernel)) {
      // A misread "start over" must not take a person's page without a question, even in Auto.
      confirm = true;
    } else {
      target = 'append';
      said.push('appendedNotReplaced');
    }
  }
  return { kernel, target, notes: said, confirm };
}

async function runPage(
  flow: Flow,
  outgoing: Outgoing,
  placement: Placement,
  route: IntentRoute,
  mode: AssistantMode,
): Promise<void> {
  const landing = await landingFor(
    flow,
    route.target,
    outgoing.text,
    route.kind === 'build-site' ? ['siteAsOnePage'] : [],
  );
  await runBuild(flow, outgoing, placement, {
    target: landing.target,
    approval: mode === 'ask' || landing.confirm,
    kernel: landing.kernel,
    notes: landing.notes,
  });
}

/**
 * Plan mode's Build: the plan on the card, built verbatim, where its intent says (a new
 * page through the host, else below this one, and said). The card WAS the question, so
 * nothing is asked again. A titles-only card (no engine plan) is built from its request,
 * as a page, and may differ (SPEC §7.6 E6 `plan.note.mayDiffer`).
 */
async function buildPlanned(
  flow: Flow,
  outgoing: Outgoing,
  placement: Placement,
  pagePlan: PagePlan | undefined,
): Promise<void> {
  if (pagePlan === undefined) {
    const routed = routeRequest(outgoing.text, {
      kernel: flow.env().options.kernel,
      mentions: [],
      selection: [],
    });
    const route: IntentRoute =
      routed.kind === 'build-page' || routed.kind === 'build-site'
        ? routed
        : { kind: 'build-page', confidence: 1, reason: 'Built from a page plan.' };
    await runPage(flow, outgoing, placement, route, 'auto');
    return;
  }
  const landing = await landingFor(flow, pagePlan.intent, outgoing.text, []);
  let plan: PagePlan | undefined = pagePlan;
  if (landing.target !== undefined && landing.target !== pagePlan.intent) {
    // Landing elsewhere than planned: the same plan, held to the new intent, or re-planned.
    const moved = validatePagePlan(pagePlan, { intent: landing.target });
    plan = moved.ok ? moved.plan : undefined;
  }
  await runBuild(flow, outgoing, placement, {
    ...(plan === undefined ? {} : { pagePlan: plan }),
    target: landing.target,
    approval: false,
    kernel: landing.kernel,
    notes: landing.notes,
  });
}

function plannedSections(planned: readonly AiBuildPlannedTask[]): PagePlanTurn['sections'] {
  return planned.map((task, index) => ({ key: `section-${String(index + 1)}`, title: task.title }));
}

/** The plan card an Ask build holds at (SPEC §3.7 "Waiting for your approval"). */
function approvalTurn(
  turnId: string,
  request: string,
  planned: readonly AiBuildPlannedTask[],
  direction: string,
  plan: PagePlan | undefined,
  held: BuildProgress,
  touched: boolean,
): PagePlanTurn {
  const common = {
    id: turnId,
    kind: 'page-plan',
    request,
    status: 'ready',
    // Build answers the held question: exactly these sections land (SPEC §7.6 E6).
    note: 'exact',
    approval: true,
    heldBuild: held,
    ...(touched ? { pageTouched: true as const } : {}),
  } as const;
  if (plan !== undefined) {
    const draft = draftFromEnginePagePlan(plan);
    return {
      ...common,
      subject: draft.subject,
      ...(draft.direction === undefined ? {} : { direction: draft.direction }),
      sections: draft.sections,
      enginePlan: plan,
      editable: true,
    };
  }
  const mood = direction.replace(/\s+/gu, ' ').trim();
  return {
    ...common,
    subject: request,
    ...(mood === '' ? {} : { direction: { mood } }),
    sections: plannedSections(planned),
    editable: false,
  };
}

/**
 * One page build, from the first event to the record it leaves. `recordTurnId` re-runs
 * into an existing turn (a plan card's Build), so the list inks in place.
 */
async function runBuild(
  flow: Flow,
  outgoing: Outgoing,
  placement: Placement,
  plan: BuildPlan,
): Promise<void> {
  const env = flow.env();
  const kernel = plan.kernel ?? env.options.kernel;
  const turnId = placement.recordTurnId ?? env.sessions.nextId('turn');
  const history = historyFor(flow, placement);
  const slot = claim(flow, placement.sessionId, turnId, 'build');
  if (slot === null) return;
  followKernel(flow, kernel);
  const request = engineRequest(outgoing);
  const building: BuildTurn = {
    id: turnId,
    kind: 'build',
    request,
    progress: initialBuildProgress(slot.runId, flow.clock.now()),
    status: 'running',
    outcomes: {},
  };
  const anchor = openExchange(flow, placement, outgoing, building);
  env.mood.beginRun(slot.runId, '');
  say(flow, 'build.started');
  const logBefore = kernel.transactions().length;
  const documentBefore = kernel.getDocument();

  const patchBuild = (change: (turn: BuildTurn) => Turn): void => {
    patchKind(flow, slot.sessionId, turnId, 'build', change);
  };

  /*
    The ONE approval, on the list. Asked before anything is written: the build turn
    becomes the plan card under the same id, and the run waits on this promise. Stop in
    the composer answers it too (the abort listener), so a person who wants out never has
    to find a second button.
  */
  const askToBuild = (
    planned: readonly AiBuildPlannedTask[],
    direction: string,
    pagePlan?: PagePlan,
  ): Promise<AiBuildPlanAnswer> =>
    new Promise<AiBuildPlanAnswer>((resolve) => {
      if (slot.controller.signal.aborted) {
        resolve('stop');
        return;
      }
      const settle = (answer: AiBuildPlanAnswer): void => {
        if (flow.runtime.approvals.get(turnId) !== settle) return;
        flow.runtime.approvals.delete(turnId);
        setRun(flow, slot, { awaiting: false });
        resolve(answer);
      };
      flow.runtime.approvals.set(turnId, settle);
      slot.controller.signal.addEventListener(
        'abort',
        () => {
          settle('stop');
        },
        { once: true },
      );
      const touched = kernel.transactions().length > logBefore;
      patchBuild((turn) =>
        approvalTurn(turnId, request, planned, direction, pagePlan, turn.progress, touched),
      );
      setRun(flow, slot, { awaiting: true, activity: 'plan' });
      say(flow, 'plan.ready');
    });

  const onEvent = (event: AiBuildEvent): void => {
    env.mood.onEvent(event);
    if (event.type.startsWith('build.') || event.type.startsWith('task.')) {
      env.options.onBuildEvent?.(event as AiBuildOwnEvent);
    } else {
      env.options.onAgentEvent?.(event as AiAgentEvent);
    }
    if (event.type === 'build.planned') {
      // The skeleton just landed: what each region holds now IS its placeholder.
      const document = kernel.getDocument();
      const placeholders = Object.fromEntries(
        event.tasks.map((task) => [task.id, sectionValues(document, task.id)]),
      );
      patchBuild((turn) => ({ ...turn, placeholders }));
      setRun(flow, slot, { activity: 'build', awaiting: false });
      say(flow, 'build.planned', { n: event.tasks.length });
    }
    patchBuild((turn) => {
      const progress = reduceBuildProgress(turn.progress, event);
      return progress === turn.progress ? turn : { ...turn, progress };
    });
    if (event.type === 'task.completed') {
      const record = locateTurn(flow, turnId)?.turn;
      if (record?.kind === 'build') {
        env.live.landed(landedCount(record.progress), record.progress.tasks.length);
      }
      setRun(flow, slot, { lastLanding: { title: event.task.title, at: flow.clock.now() } });
    }
  };

  try {
    const buildOptions: RunAiBuildOptions = {
      ...commonRunOptions(flow, kernel, slot, request, outgoing.pointed, history),
      ...(plan.target === undefined ? {} : { target: plan.target }),
      ...(plan.pagePlan === undefined ? {} : { pagePlan: plan.pagePlan }),
      ...(plan.approval ? { onPlanned: askToBuild } : {}),
      onEvent,
    };
    const result = await runAiBuild(buildOptions);
    settleBuild(flow, slot, turnId, anchor, kernel, result, plan, { logBefore, documentBefore });
  } catch (cause: unknown) {
    failBuild(flow, slot, turnId, anchor, request, cause);
  } finally {
    flow.runtime.approvals.delete(turnId);
    if (flow.runtime.superseded.delete(turnId)) {
      patchTurn(flow, slot.sessionId, turnId, (turn) =>
        turn.kind === 'page-plan' || turn.kind === 'end' || (turn.kind === 'build' && turn.progress.tasks.length === 0)
          ? { id: turnId, kind: 'end', key: 'planSuperseded' }
          : turn,
      );
    }
    release(flow, slot);
  }
}

/** A build's transactions: every AI transaction it landed (direction, skeleton, sections). */
function buildTransactions(flow: Flow, slot: Slot, kernel: BuilderKernel, logBefore: number): readonly string[] {
  const seen = collected(flow, slot);
  if (seen.length > 0) return seen;
  return kernel
    .transactions()
    .slice(logBefore)
    .filter((tx) => tx.author === 'ai')
    .map((tx) => tx.id);
}

/**
 * The build's own `build.completed`, for a result whose event never reached the record
 * (an observer that threw): the result is the build's last word.
 */
function completedFrom(progress: BuildProgress, result: AiBuildRunResult): AiBuildOwnEvent {
  return {
    type: 'build.completed',
    runId: progress.runId,
    seq: Number.MAX_SAFE_INTEGER,
    at: progress.lastEventAt,
    tasks: result.tasks,
    applied: result.applied,
    skipped: result.skipped,
    elapsedMs: result.elapsedMs,
    outcome: result.outcome,
  };
}

function settleBuild(
  flow: Flow,
  slot: Slot,
  turnId: string,
  anchor: string | null,
  kernel: BuilderKernel,
  result: AiBuildRunResult,
  plan: BuildPlan,
  before: { readonly logBefore: number; readonly documentBefore: BuilderDocument },
): void {
  const env = flow.env();
  const { logBefore } = before;
  const current = locateTurn(flow, turnId)?.turn;

  if (result.outcome === 'fallback' && result.fallback !== undefined) {
    /*
      NOT a build: fewer than two regions, so one ordinary run replaced it. It reads as
      the edit (or, asked in Ask, the proposal) it was, never as a build.
    */
    const fallback = result.fallback;
    const request = current !== undefined && 'request' in current ? (current.request ?? '') : '';
    // Words and no command: an answer, as `runEdit` reads one (`answerFromPlan`).
    const words =
      kernel.transactions().length === logBefore
        ? answerFromPlan({
            id: turnId,
            request,
            plan: fallback.plan,
            skills: fallback.proposal.skillActivations,
          })
        : null;
    if (words !== null) {
      patchTurn(flow, slot.sessionId, turnId, () => words);
      say(flow, 'answer.ready');
      env.mood.settleTurn({ runId: slot.runId, outcome: 'plan', applied: false });
    } else if (fallback.status === 'applied') {
      env.memory.note(fallback.proposal);
      const ids = buildTransactions(flow, slot, kernel, logBefore);
      const transactionId = ids.at(-1);
      const changes = compare(flow, kernel, before.documentBefore, kernel.getDocument());
      const edit: EditTurn = {
        id: turnId,
        kind: 'edit',
        request,
        origin: 'request',
        status: transactionId === undefined || changes.empty ? 'noChange' : 'done',
        mode: 'auto',
        run: initialRunProgress('auto', flow.clock.now() - result.elapsedMs),
        elapsedMs: result.elapsedMs,
        changes: changes.lines,
        summary: fallback.plan.rationale,
        ...(transactionId === undefined ? {} : { transactionId }),
        skills: fallback.proposal.skillActivations,
      };
      patchTurn(flow, slot.sessionId, turnId, () => edit);
      say(flow, 'edit.donePage');
      env.mood.settleTurn({ runId: slot.runId, outcome: 'plan', applied: true });
    } else {
      const proposal: ProposalTurn = {
        id: turnId,
        kind: 'proposal',
        request,
        status: 'ready',
        mode: 'ask',
        plan: fallback.plan,
        proposal: fallback.proposal,
        changes: rehearse(flow, kernel, fallback.proposal).lines,
        elapsedMs: result.elapsedMs,
        skills: fallback.proposal.skillActivations,
      };
      patchTurn(flow, slot.sessionId, turnId, () => proposal);
      say(flow, 'proposal.ready');
      env.mood.settleTurn({ runId: slot.runId, outcome: 'plan', applied: false });
    }
    return;
  }

  if (result.tasks.length === 0) {
    /*
      NOTHING WAS WRITTEN: refused at the question, stopped while it was open, or stopped
      before the skeleton landed. A card that a Discard or a newer request answered keeps
      its own ending; anything else is a plain stop, with nothing to undo.
    */
    if (current?.kind === 'page-plan' && !flow.runtime.superseded.has(turnId)) {
      patchTurn(flow, slot.sessionId, turnId, () => ({ id: turnId, kind: 'end', key: 'planDiscarded' }));
    } else if (current?.kind === 'build') {
      patchTurn(flow, slot.sessionId, turnId, () => ({ id: turnId, kind: 'end', key: 'stoppedBeforeChange' }));
      markNotRun(flow, slot.sessionId, anchor);
      say(flow, 'stopped.none');
    }
    env.mood.settleTurn({ runId: slot.runId, outcome: 'stopped' });
    return;
  }

  if (result.scaffold?.status === 'applied') env.memory.note(result.scaffold.proposal);
  flow.runtime.builds.set(turnId, { kernel, result });
  const transactionIds = buildTransactions(flow, slot, kernel, logBefore);
  patchKind(flow, slot.sessionId, turnId, 'build', (turn) => ({
    ...turn,
    progress:
      turn.progress.report === null
        ? reduceBuildProgress(turn.progress, completedFrom(turn.progress, result))
        : turn.progress,
    status: 'settled',
    ...(result.pagePlan === undefined ? {} : { pagePlan: result.pagePlan }),
    transactionIds,
  }));
  const after = locateTurn(flow, turnId)?.turn;
  if (after?.kind !== 'build') return;
  const landed = landedCount(after.progress);
  const total = after.progress.tasks.length;
  const stopped = result.outcome === 'signal' || result.outcome === 'budget' || result.outcome === 'max-tasks';
  const announcement = buildEndAnnouncement({
    phase: stopped ? 'stopped' : landed === total ? 'done' : landed === 0 ? 'failed' : 'partial',
    stopReason:
      result.outcome === 'budget' ? 'budget' : result.outcome === 'max-tasks' ? 'maxTasks' : 'signal',
    landed,
    total,
    skeleton: after.progress.tasks.some((task) => task.status !== 'landed'),
  });
  if (announcement !== null) say(flow, announcement.key, announcement.params);
  if (landed > 0) {
    insertAfter(
      flow,
      slot.sessionId,
      turnId,
      plan.notes.map((key): Turn => ({ id: env.sessions.nextId('turn'), kind: 'end', key })),
    );
  }
  env.mood.settleTurn(
    stopped
      ? { runId: slot.runId, outcome: 'stopped' }
      : { runId: slot.runId, outcome: 'plan', applied: landed > 0 },
  );
}

function failBuild(
  flow: Flow,
  slot: Slot,
  turnId: string,
  anchor: string | null,
  request: string,
  cause: unknown,
): void {
  const env = flow.env();
  const turn = locateTurn(flow, turnId)?.turn;
  if (turn?.kind === 'page-plan') {
    // Answered by Discard or by a newer request while it was held.
    if (!flow.runtime.superseded.has(turnId)) {
      patchTurn(flow, slot.sessionId, turnId, () => ({ id: turnId, kind: 'end', key: 'planDiscarded' }));
    }
    env.mood.settleTurn({ runId: slot.runId, outcome: 'stopped' });
    return;
  }
  if (turn?.kind !== 'build') return;
  const progress = turn.progress;
  const landed = landedCount(progress);
  if (slot.controller.signal.aborted) {
    if (progress.tasks.length === 0) {
      patchTurn(flow, slot.sessionId, turnId, () => ({ id: turnId, kind: 'end', key: 'stoppedBeforeChange' }));
      markNotRun(flow, slot.sessionId, anchor);
      say(flow, 'stopped.none');
    } else {
      // Stopped mid-build: the rows the engine settled stay, the rest were not written.
      patchKind(flow, slot.sessionId, turnId, 'build', (current) => {
        const { stopping: _stopping, ...rest } = current;
        void _stopping;
        return { ...rest, status: 'settled', transactionIds: collected(flow, slot) };
      });
      const announcement = buildEndAnnouncement({
        phase: 'stopped',
        stopReason: 'signal',
        landed,
        total: progress.tasks.length,
        skeleton: true,
      });
      if (announcement !== null) say(flow, announcement.key, announcement.params);
    }
    env.mood.settleTurn({ runId: slot.runId, outcome: 'stopped' });
    return;
  }
  const failure = failureOf(cause);
  if (progress.tasks.length === 0) {
    patchTurn(flow, slot.sessionId, turnId, () =>
      failureTurn(turnId, request, cause, { kind: 'unchanged' }, flow.clock.now() - progress.startedAt),
    );
    say(flow, 'failed');
  } else {
    patchKind(flow, slot.sessionId, turnId, 'build', (current) => ({
      ...current,
      status: 'failed',
      failure,
      transactionIds: collected(flow, slot),
    }));
    say(flow, landed > 0 ? 'failed.kept' : 'failed.skeleton');
  }
  env.mood.settleTurn({ runId: slot.runId, outcome: 'refused', retryable: failure.retryable });
}

/* ── Plan mode: the page plan, and nothing written ───────────────────────────── */

async function runPlanPage(
  flow: Flow,
  outgoing: Outgoing,
  placement: Placement,
  target: IntentTarget | undefined,
  unsure = false,
): Promise<void> {
  const env = flow.env();
  const kernel = env.options.kernel;
  const turnId = placement.recordTurnId ?? env.sessions.nextId('turn');
  const history = historyFor(flow, placement);
  const slot = claim(flow, placement.sessionId, turnId, 'plan');
  if (slot === null) return;
  const request = engineRequest(outgoing);
  const anchor = openExchange(flow, placement, outgoing, {
    id: turnId,
    kind: 'page-plan',
    request,
    status: 'drafting',
    subject: outgoing.text,
    sections: [],
    note: 'exact',
    editable: false,
  });
  env.mood.beginRun(slot.runId, '');
  say(flow, 'plan.drafting');
  const startedAt = flow.clock.now();
  /*
    A new page is planned as a page of its own (`new-page`: a header, a hero, a footer), and
    no page is opened until Build decides where it lands. Left unsaid, the engine's landing
    rule reads the page on screen: one with content means `append`, whose shape rules refuse
    the hero and footer a whole page has, twice, at the cost of two planning calls.
  */
  const landing = target;
  try {
    let ready: PagePlanTurn | null = null;
    if (env.capabilities.editablePlan && env.provider.proposePagePlan !== undefined) {
      const answer = await planAiPage(request, {
        ...commonRunOptions(flow, kernel, slot, request, outgoing.pointed, history),
        ...(landing === undefined ? {} : { target: landing }),
      });
      if (!holds(flow, slot)) throw stoppedError();
      if ('plan' in answer) {
        const draft = draftFromEnginePagePlan(answer.plan);
        ready = {
          id: turnId,
          kind: 'page-plan',
          request,
          status: 'ready',
          subject: draft.subject,
          ...(draft.direction === undefined ? {} : { direction: draft.direction }),
          sections: draft.sections,
          enginePlan: answer.plan,
          note: 'exact',
          editable: true,
        };
      } else if (answer.error.code !== 'unsupported') {
        throw Object.assign(new Error(answer.error.message), { failure: answer.error });
      }
    }
    if (ready === null) {
      // The scaffold's planning: the section list and the direction, nothing written.
      const result = await runAiBuild({
        ...commonRunOptions(flow, kernel, slot, request, outgoing.pointed, history),
        ...(landing === undefined ? {} : { target: landing }),
        apply: 'never',
      });
      if (!holds(flow, slot)) throw stoppedError();
      const mood = result.direction.replace(/\s+/gu, ' ').trim();
      ready = {
        id: turnId,
        kind: 'page-plan',
        request,
        status: 'ready',
        subject: outgoing.text,
        ...(mood === '' ? {} : { direction: { mood } }),
        sections: plannedSections(result.plannedTasks ?? []),
        // Titles only: Build re-plans from the request (SPEC §7.6 E6).
        note: 'mayDiffer',
        editable: false,
      };
    }
    const plan: PagePlanTurn = unsure ? { ...ready, unsure: true } : ready;
    patchTurn(flow, slot.sessionId, turnId, () => plan);
    say(flow, 'plan.ready');
    env.mood.settleTurn({ runId: slot.runId, outcome: 'plan', applied: false });
  } catch (cause: unknown) {
    if (slot.controller.signal.aborted) {
      patchTurn(flow, slot.sessionId, turnId, () => ({ id: turnId, kind: 'end', key: 'stoppedBeforeChange' }));
      markNotRun(flow, slot.sessionId, anchor);
      say(flow, 'stopped.none');
      env.mood.settleTurn({ runId: slot.runId, outcome: 'stopped' });
    } else {
      const failure = failureOf(cause);
      patchTurn(flow, slot.sessionId, turnId, () =>
        failureTurn(turnId, request, cause, { kind: 'unchanged' }, flow.clock.now() - startedAt),
      );
      say(flow, 'failed');
      env.mood.settleTurn({ runId: slot.runId, outcome: 'refused', retryable: failure.retryable });
    }
  } finally {
    release(flow, slot);
  }
}

/* ── Successor runs: exactly the named sections, in place ────────────────────── */

interface Written {
  readonly task: BuildTask;
  readonly result?: AiAgentRunResult | undefined;
  readonly error?: unknown;
}

async function runSuccessor(flow: Flow, turnId: string, keys: readonly string[]): Promise<void> {
  const env = flow.env();
  const located = locateTurn(flow, turnId);
  if (located?.turn.kind !== 'build' || keys.length === 0) return;
  const original = located.turn;
  const kernel = kernelOfBuild(flow, turnId);
  const wanted = new Set(keys);
  const document = kernel.getDocument();
  // Only sections whose region is still on the page can be written into.
  const tasks = original.progress.tasks.filter(
    (task) => wanted.has(task.id) && task.status !== 'landed' && document.nodes[task.id] !== undefined,
  );
  if (tasks.length === 0) return;
  const slot = claim(flow, located.sessionId, turnId, 'build');
  if (slot === null) return;
  followKernel(flow, kernel);
  const startedAt = flow.clock.now();
  const priorElapsedMs =
    original.progress.report?.elapsedMs ??
    Math.max(0, lastEvidenceAt(original.progress) - original.progress.startedAt);
  const reopened = reopenForSuccessor(original.progress, new Set(tasks.map((task) => task.id)), startedAt);
  const { revived: _revived, undone: _undone, failure: _failure, stopping: _stopping, ...rest } = original;
  void _revived;
  void _undone;
  void _failure;
  void _stopping;
  patchTurn(flow, slot.sessionId, turnId, (): Turn => ({ ...rest, progress: reopened, status: 'running' }));
  env.mood.beginRun(slot.runId, '');
  say(flow, 'build.started');
  let seq = 0;
  const feed = (event: AiBuildEvent): void => {
    patchKind(flow, slot.sessionId, turnId, 'build', (turn) => {
      const progress = reduceBuildProgress(turn.progress, event);
      return progress === turn.progress ? turn : { ...turn, progress };
    });
  };
  const progressNow = (): BuildProgress => {
    const turn = locateTurn(flow, turnId)?.turn;
    return turn?.kind === 'build' ? turn.progress : reopened;
  };
  const total = reopened.tasks.length;
  const hasFillSkill = env.registry.get(FILL_SKILL_ID) !== undefined;
  const landings = new Map<string, AiBuildSectionLanding>();
  const landedIds: string[] = [];

  /* Writers run a few at a time; sections still land one by one, in page order. */
  const write = async (task: BuildTask): Promise<Written> => {
    feed(taskStartedEvent(progressNow(), task, flow.clock.now(), (seq += 1)));
    const brief = successorBrief({
      direction: original.progress.direction,
      request: original.request,
      task,
      total,
      plan: original.pagePlan,
    });
    const base = commonRunOptions(flow, kernel, slot, brief, [task.id], undefined);
    try {
      const result = await runAiAgent({
        ...base,
        runId: `${original.progress.runId}/fill-${String(task.position)}`,
        isCurrentRun: () => flow.runtime.lease?.runId === slot.runId,
        ...(hasFillSkill ? { selectedSkillIds: [FILL_SKILL_ID] } : {}),
        autoSkills: false,
        // The build's own writer policy: `setProp` only, its own region whole, the rest summarised.
        policy: { ...base.policy, allowedCommands: ['setProp'] },
        composition: { ...base.composition, documentTreeMode: 'scoped' },
        apply: 'never',
        onEvent: (event) => {
          env.options.onAgentEvent?.(event);
          feed(event);
        },
      });
      return { task, result };
    } catch (error: unknown) {
      return { task, error };
    }
  };
  const waiting = [...tasks];
  const pending = new Map<string, Promise<Written>>();
  const startNext = (): void => {
    while (pending.size < SUCCESSOR_WRITERS && waiting.length > 0) {
      const next = waiting.shift();
      if (next !== undefined) pending.set(next.id, write(next));
    }
  };
  let stopped = false;
  try {
    startNext();
    for (const task of tasks) {
      const outcome = await pending.get(task.id);
      pending.delete(task.id);
      if (!holds(flow, slot)) {
        stopped = true;
        break;
      }
      startNext();
      if (outcome === undefined) continue;
      if (outcome.result === undefined) {
        const failure = classifyAiRunFailure(outcome.error);
        feed(
          taskSkippedEvent(
            progressNow(),
            task,
            {
              reason: failure.message,
              reasonCode: failure.source === 'provider' ? 'unreachable' : 'invalid',
            },
            flow.clock.now(),
            (seq += 1),
          ),
        );
        continue;
      }
      const guarded = guardSection(outcome.result.plan, task.id);
      if (guarded === null) {
        feed(
          taskSkippedEvent(
            progressNow(),
            task,
            {
              reason: `Section "${task.title}" wrote nothing inside its own region.`,
              reasonCode: 'out-of-scope',
            },
            flow.clock.now(),
            (seq += 1),
          ),
        );
        continue;
      }
      const before = sectionValues(kernel.getDocument(), task.id);
      try {
        const label = sectionLabel(task.position, total, task.title);
        const applied = applyAiPlan({
          kernel,
          validationPorts: preflightPorts(),
          plan: guarded.plan,
          policy: { allowedCommands: ['setProp'], maxCommands: guarded.plan.commands.length },
          label,
        });
        const tx = applied.transactions.at(-1);
        if (tx !== undefined) {
          landings.set(task.id, {
            transactionId: tx.id,
            label,
            before,
            after: sectionValues(kernel.getDocument(), task.id),
          });
          landedIds.push(tx.id);
        }
        feed(taskCompletedEvent(progressNow(), task, flow.clock.now(), (seq += 1)));
        const now = progressNow();
        env.live.landed(landedCount(now), now.tasks.length);
        setRun(flow, slot, { lastLanding: { title: task.title, at: flow.clock.now() } });
      } catch (cause: unknown) {
        feed(
          taskSkippedEvent(
            progressNow(),
            task,
            {
              reason: cause instanceof Error ? cause.message : 'The section was refused on landing.',
              reasonCode: 'page-changed',
            },
            flow.clock.now(),
            (seq += 1),
          ),
        );
      }
    }
    if (slot.controller.signal.aborted) stopped = true;
  } finally {
    // Whatever is still being written is dropped: nothing lands after Stop.
    const final = progressNow();
    const rows: BuildProgress = stopped
      ? {
          ...final,
          tasks: final.tasks.map((task) =>
            task.status === 'writing' || task.status === 'drafted' || task.status === 'waiting'
              ? { ...task, status: 'notWritten' as const }
              : task,
          ),
        }
      : final;
    const completed = successorCompletedEvent(rows, landings, {
      stopped,
      priorElapsedMs,
      elapsedMs: flow.clock.now() - startedAt,
      at: flow.clock.now(),
      seq: (seq += 1),
    });
    patchKind(flow, slot.sessionId, turnId, 'build', (turn) => ({
      ...turn,
      progress: reduceBuildProgress(rows, completed),
      status: 'settled',
      transactionIds: [...(turn.transactionIds ?? []), ...landedIds],
    }));
    const record = locateTurn(flow, turnId)?.turn;
    if (record?.kind === 'build') {
      const landed = landedCount(record.progress);
      const all = record.progress.tasks.length;
      const announcement = buildEndAnnouncement({
        phase: stopped ? 'stopped' : landed === all ? 'done' : 'partial',
        stopReason: 'signal',
        landed,
        total: all,
        skeleton: record.progress.tasks.some((task) => task.status !== 'landed'),
      });
      if (announcement !== null) say(flow, announcement.key, announcement.params);
    }
    env.mood.settleTurn(
      stopped
        ? { runId: slot.runId, outcome: 'stopped' }
        : { runId: slot.runId, outcome: 'plan', applied: true },
    );
    release(flow, slot);
  }
}

/* ── The queue ───────────────────────────────────────────────────────────────── */

/** After a run: revalidate the queued request against the page, then run it (FR-026). */
function drainQueue(flow: Flow): void {
  const ui = flow.ui.getState();
  const queue = ui.queue;
  if (queue === null || queue.paused || flow.runtime.lease !== null || ui.run !== null) return;
  const document = flow.env().options.kernel.getDocument();
  if (revalidateQueue(queue, document) === 'missing') {
    // It cannot run until the person picks another target (SPEC §4.17 `queue.missing`).
    flow.ui.setState((state) =>
      state.queue === null ? state : { ...state, queue: { ...state.queue, missing: true } },
    );
    return;
  }
  flow.ui.setState((state) => ({ ...state, queue: null, draft: '' }));
  say(flow, 'queue.started');
  const pointed = queue.targets.map((target) => target.id);
  void send(flow, { text: queue.text, context: queue.context, pointed }, { skipClarify: true });
}

/* ── Sending ─────────────────────────────────────────────────────────────────── */

interface SendOptions {
  /** A request that was already accepted (a queued one, an answered one): no clarify check. */
  readonly skipClarify?: boolean | undefined;
  /** The route, when it is already known. */
  readonly route?: IntentRoute | undefined;
}

function selectionShown(ui: UiState, selection: readonly NodeId[]): readonly NodeId[] {
  return ui.dismissedSelection !== null && ui.dismissedSelection === selectionKey(selection)
    ? NO_SELECTION
    : selection;
}

/** The context a draft is sent with (SPEC §4.5), and the blocks it points at. */
function outgoingOf(flow: Flow, text: string): Outgoing {
  const env = flow.env();
  const ui = flow.ui.getState();
  const kernel = env.options.kernel;
  const document = kernel.getDocument();
  const selection = selectionShown(ui, env.selection).filter(
    (id) => document.nodes[id] !== undefined && id !== document.rootId,
  );
  const blocks: SentContext[] = [
    ...selection.map((id) => ({ kind: 'selection' as const, id, label: blockName(kernel, id) })),
    ...ui.mentions
      .filter((mention) => !selection.includes(mention.id) && document.nodes[mention.id] !== undefined)
      .map((mention) => ({ kind: 'mention' as const, id: mention.id, label: mention.label })),
  ];
  return {
    text,
    context: blocks.length === 0 ? [{ kind: 'page' }] : blocks,
    pointed: blocks.flatMap((entry) => (entry.kind === 'page' ? [] : [entry.id])),
    // A suggestion fills the box and never sends; sent unedited, it was picked by name.
    ...(env.shownCatalog.current.has(text) ? { catalog: true } : {}),
  };
}

/**
 * The newest plan card still waiting on the person, in the active conversation. A card
 * planned only because the router was unsure (`PagePlanTurn.unsure`) is not one a newer
 * request changes: that request is routed, and checked, on its own words.
 */
function pendingPlan(flow: Flow): { readonly sessionId: string; readonly turn: PagePlanTurn } | null {
  const sessions = flow.env().sessions.store.getState();
  const session = sessions.sessions.find((entry) => entry.id === sessions.activeId);
  const turn = session?.turns.at(-1);
  if (session === undefined || turn?.kind !== 'page-plan' || turn.status !== 'ready') return null;
  if (turn.unsure === true) return null;
  return { sessionId: session.id, turn };
}

function enhanceInputOf(flow: Flow, outgoing: Outgoing, route: IntentRoute): EnhanceInput {
  const env = flow.env();
  return {
    text: outgoing.text,
    locale: env.options.locale,
    intent: route.kind,
    confidence: route.confidence,
    page: summarizeDocumentForIntent(env.options.kernel.getDocument()),
    selection: outgoing.context.flatMap((entry) => (entry.kind === 'page' ? [] : [entry.label])),
  };
}

async function send(flow: Flow, input: Outgoing, options: SendOptions = {}): Promise<void> {
  const env = flow.env();
  const sessionsState = env.sessions.store.getState();
  const mode = sessionsState.mode;
  let outgoing = input;
  // The clarify check failed on an unsure build: it is planned, whatever the mode.
  let planOnly = false;
  let route =
    options.route ??
    routeRequest(input.text, {
      kernel: env.options.kernel,
      mentions: input.pointed,
      selection: input.pointed,
    });

  /*
    A request sent while a plan card waits is a change to that plan: it is planned again,
    as a page, from the plan's request and this one, and the old card says it was
    replaced. An Ask card's held build is answered Stop first, so nothing is written. A
    question is only answered, when nothing holds the lease.
  */
  const pending = options.route === undefined ? pendingPlan(flow) : null;
  const held = pending === null ? undefined : flow.runtime.approvals.get(pending.turn.id);
  if (pending !== null && (route.kind !== 'question' || held !== undefined)) {
    flow.runtime.superseded.add(pending.turn.id);
    if (held !== undefined) {
      held('stop');
      await flow.runtime.done;
    } else {
      flow.runtime.superseded.delete(pending.turn.id);
      patchTurn(flow, pending.sessionId, pending.turn.id, () => ({
        id: pending.turn.id,
        kind: 'end',
        key: 'planSuperseded',
      }));
    }
    outgoing = { ...input, request: `${pending.turn.request ?? pending.turn.subject}\n${input.text}` };
    route = { kind: 'build-page', confidence: 1, reason: 'A change to the plan on screen.' };
  }

  if (
    options.skipClarify !== true &&
    pending === null &&
    needsClarifying(route) &&
    env.enhancer.available
  ) {
    flow.ui.setState((ui) => ({ ...ui, checking: true }));
    try {
      const result = await env.enhancer.ask(enhanceInputOf(flow, outgoing, route), { busy: true });
      if (result.questions.length > 0) {
        const routed = route;
        flow.ui.setState((ui) => ({
          ...ui,
          checking: false,
          ...(ui.draft.trim() === input.text.trim() ? { draft: '', mentions: [] } : {}),
          clarify: {
            request: outgoing.text,
            context: outgoing.context,
            pointed: outgoing.pointed,
            route: routed,
            understood: result.understood,
            questions: clarifyQuestionsOf(result),
            status: 'asking',
          },
        }));
        say(flow, 'clarify.ready');
        return;
      }
    } catch {
      /*
        The check is a courtesy: when it fails, the request runs as it was written, but
        never as a build the router is unsure of (`isUnsureBuild`). That is the costliest
        misreading the check exists to prevent, so it is PLANNED instead: the plan card
        shows what was read, nothing is written and no page is opened until Build.
      */
      if (isUnsureBuild(route)) planOnly = true;
    }
    flow.ui.setState((ui) => ({ ...ui, checking: false }));
  }

  if (flow.runtime.lease !== null) {
    // A run started while this one was being checked: it waits its turn, never lost.
    const document = env.options.kernel.getDocument();
    flow.ui.setState((ui) => ({
      ...ui,
      draft: ui.queue === null ? outgoing.text : ui.draft,
      queue: ui.queue ?? queueRequest(outgoing.text, outgoing.context, document),
    }));
    say(flow, 'queue.queued');
    return;
  }
  flow.ui.setState((ui) =>
    // The box empties only while it still reads what was sent: words typed meanwhile stay.
    ui.draft.trim() === input.text.trim()
      ? { ...ui, draft: '', mentions: [], clarify: null }
      : { ...ui, clarify: null },
  );
  await track(
    flow,
    dispatchRequest(
      flow,
      outgoing,
      route,
      { sessionId: sessionsState.activeId },
      planOnly ? 'plan' : mode,
      planOnly,
    ),
  );
}

/* ── The actions ─────────────────────────────────────────────────────────────── */

type Actions = Omit<AgentController, 'state' | 'capabilities'>;

function createActions(flow: Flow): Actions {
  const env = flow.env;

  const buildTurnOf = (turnId: string): { readonly sessionId: string; readonly turn: BuildTurn } | null => {
    const located = locateTurn(flow, turnId);
    return located?.turn.kind === 'build' ? { sessionId: located.sessionId, turn: located.turn } : null;
  };

  const setOutcome = (sessionId: string, turnId: string, key: string, outcome: LandingOutcome): void => {
    patchKind(flow, sessionId, turnId, 'build', (turn) => ({
      ...turn,
      outcomes: { ...turn.outcomes, [key]: outcome },
    }));
  };

  const endPreview = (turnId: string): void => {
    if (flow.ui.getState().previewing !== turnId) return;
    flow.ui.setState((ui) => ({ ...ui, previewing: null }));
    env().options.onPreview?.(null);
  };

  const sendDraft = (): void => {
    const ui = flow.ui.getState();
    const text = ui.draft.trim();
    if (text === '' || ui.checking) return;
    const run = ui.run;
    if (run !== null && !run.awaiting) {
      // Running: the draft becomes the ONE queued request, and stays in the composer.
      if (ui.queue !== null && !ui.queue.paused) {
        say(flow, 'queue.already');
        return;
      }
      const outgoing = outgoingOf(flow, text);
      flow.ui.setState((state) => ({
        ...state,
        queue: queueRequest(text, outgoing.context, env().options.kernel.getDocument()),
      }));
      say(flow, 'queue.queued');
      return;
    }
    void send(flow, outgoingOf(flow, text));
  };

  const stop = (): void => {
    const lease = flow.runtime.lease;
    if (lease === null || lease.controller.signal.aborted) return;
    const run = flow.ui.getState().run;
    flow.ui.setState((ui) =>
      ui.run === null
        ? ui
        : {
            ...ui,
            run: { ...ui.run, stopping: true },
            queue: ui.queue === null ? null : { ...ui.queue, paused: true },
          },
    );
    if (run !== null) {
      patchTurn(flow, run.sessionId, run.turnId, (turn) =>
        turn.kind === 'build' || turn.kind === 'edit' ? { ...turn, stopping: true } : turn,
      );
    }
    say(flow, 'stopping');
    lease.controller.abort();
  };

  const apply = (turnId: string): void => {
    const located = locateTurn(flow, turnId);
    const turn = located?.turn;
    if (located === null || turn?.kind !== 'proposal' || turn.proposal === undefined) return;
    if (flow.runtime.lease !== null) return;
    const kernel = env().options.kernel;
    const proposal = turn.proposal;
    endPreview(turnId);
    followKernel(flow, kernel);
    try {
      const applied = applyAiPlan({ kernel, proposal, validationPorts: preflightPorts() });
      env().memory.note(proposal);
      const transactionId = applied.transactions.at(-1)?.id;
      const edit: EditTurn = {
        id: turnId,
        kind: 'edit',
        ...(turn.request === undefined ? {} : { request: turn.request }),
        origin: 'proposal',
        status: 'done',
        mode: 'ask',
        ...(turn.target === undefined ? {} : { target: turn.target }),
        ...(turn.targetNodeId === undefined ? {} : { targetNodeId: turn.targetNodeId }),
        ...(turn.run === undefined ? {} : { run: turn.run }),
        ...(turn.elapsedMs === undefined ? {} : { elapsedMs: turn.elapsedMs }),
        changes: turn.changes,
        ...(turn.plan === undefined ? {} : { summary: turn.plan.rationale }),
        ...(turn.followUp === undefined ? {} : { followUp: turn.followUp }),
        ...(turn.salvaged === undefined ? {} : { salvaged: turn.salvaged }),
        ...(transactionId === undefined ? {} : { transactionId }),
      };
      patchTurn(flow, located.sessionId, turnId, () => edit);
      const end = editEndAnnouncement({ status: 'done', target: turn.target ?? null });
      say(flow, end.key, end.params);
      env().mood.noteTurn('applied');
    } catch (cause: unknown) {
      patchTurn(flow, located.sessionId, turnId, () =>
        failureTurn(turnId, turn.request ?? '', cause, { kind: 'unchanged' }, turn.elapsedMs ?? 0),
      );
      say(flow, 'failed');
    }
  };

  const discard = (turnId: string): void => {
    const located = locateTurn(flow, turnId);
    const turn = located?.turn;
    if (located === null || turn === undefined) return;
    if (turn.kind === 'proposal') {
      endPreview(turnId);
      patchTurn(flow, located.sessionId, turnId, () => ({ id: turnId, kind: 'end', key: 'proposalDiscarded' }));
      env().mood.noteTurn('discarded');
      return;
    }
    if (turn.kind === 'page-plan' || turn.kind === 'step-plan') {
      patchTurn(flow, located.sessionId, turnId, () => ({ id: turnId, kind: 'end', key: 'planDiscarded' }));
      // An Ask card's held build is answered Stop: nothing is written.
      flow.runtime.approvals.get(turnId)?.('stop');
      env().mood.noteTurn('discarded');
    }
  };

  const build = (turnId: string): void => {
    const located = locateTurn(flow, turnId);
    const turn = located?.turn;
    if (located === null || turn?.kind !== 'page-plan' || turn.status !== 'ready') return;
    const draft = planDraftOf(turn);
    const checked = turn.enginePlan === undefined ? undefined : toEnginePagePlan(draft);
    // A plan the engine would refuse is not built; the card says why (`problems`).
    if (checked !== undefined && !checked.ok) return;
    const pagePlan = checked?.ok === true ? checked.plan : undefined;
    const request = turn.request ?? turn.subject;
    const held = flow.runtime.approvals.get(turnId);
    const inked = (progress: BuildProgress): BuildTurn => ({
      id: turnId,
      kind: 'build',
      request,
      progress,
      status: 'running',
      outcomes: {},
    });
    if (held !== undefined) {
      const edited =
        turn.enginePlan !== undefined && isEdited(draftFromEnginePagePlan(turn.enginePlan), draft);
      /*
        The card inks into its build in place (SPEC §5 moment 4): the turn becomes the
        build inside the transition, and the held question is answered only then, so no
        build event can arrive while the turn is still the card.
      */
      runViewTransition(() => {
        patchTurn(flow, located.sessionId, turnId, () =>
          inked(turn.heldBuild ?? initialBuildProgress(flow.runtime.lease?.runId ?? turnId, flow.clock.now())),
        );
        flow.ui.setState((ui) =>
          ui.run === null ? ui : { ...ui, run: { ...ui.run, activity: 'build', awaiting: false } },
        );
        held(pagePlan !== undefined && edited ? { build: pagePlan } : 'build');
      });
      return;
    }
    if (flow.runtime.lease !== null) return;
    // Plan mode: a new run builds exactly the plan on the card (or re-plans: "may differ").
    const history = historyOf(sessionOf(flow, located.sessionId)?.turns ?? []);
    const outgoing: Outgoing = { text: request, context: [{ kind: 'page' }], pointed: [] };
    runViewTransition(() => {
      patchTurn(flow, located.sessionId, turnId, () => inked(initialBuildProgress(turnId, flow.clock.now())));
      void track(
        flow,
        buildPlanned(
          flow,
          outgoing,
          { sessionId: located.sessionId, recordTurnId: turnId, history },
          pagePlan,
        ),
      );
    });
  };

  const runSteps = (turnId: string): void => {
    const located = locateTurn(flow, turnId);
    const turn = located?.turn;
    if (located === null || turn?.kind !== 'step-plan' || turn.status !== 'ready') return;
    if (flow.runtime.lease !== null) return;
    const origin = requestOf(flow, turnId);
    const text = turn.request ?? origin?.text ?? '';
    if (text === '') return;
    const document = env().options.kernel.getDocument();
    const context = (origin?.context ?? []).filter(
      (entry) => entry.kind === 'page' || document.nodes[entry.id] !== undefined,
    );
    const pointed = context.flatMap((entry) => (entry.kind === 'page' ? [] : [entry.id]));
    // The plan itself rides in the history, so the run follows what the card showed.
    const turns = sessionOf(flow, located.sessionId)?.turns ?? [];
    const history = historyOf(turns.slice(0, located.index + 1));
    // Once, with authority to apply; the chosen mode does not change (SPEC §4.12).
    void track(
      flow,
      runEdit(
        flow,
        { text, context: context.length === 0 ? [{ kind: 'page' }] : context, pointed },
        { sessionId: located.sessionId, recordTurnId: turnId, history },
        'auto',
      ),
    );
  };

  const editPlan = (turnId: string, op: PlanOp): void => {
    const located = locateTurn(flow, turnId);
    const turn = located?.turn;
    if (located === null || turn?.kind !== 'page-plan' || turn.status !== 'ready') return;
    if (!turn.editable || turn.enginePlan === undefined || !env().capabilities.editablePlan) return;
    const draft = planDraftOf(turn);
    const next = applyPlanOp(draft, op);
    if (next === draft) return;
    const edited = isEdited(draftFromEnginePagePlan(turn.enginePlan), next);
    const { edited: _was, direction: _direction, ...rest } = turn;
    void _was;
    void _direction;
    const updated: PagePlanTurn = {
      ...rest,
      subject: next.subject,
      sections: next.sections,
      ...(next.direction === undefined ? {} : { direction: next.direction }),
      ...(edited ? { edited: true } : {}),
    };
    patchTurn(flow, located.sessionId, turnId, () => updated);
    if (op.kind === 'move') {
      const index = next.sections.findIndex((section) => section.key === op.key);
      say(flow, 'plan.moved', {
        title: next.sections[index]?.title ?? '',
        i: index + 1,
        n: next.sections.length,
      });
    } else if (op.kind === 'remove') {
      say(flow, 'plan.removed', {
        title: draft.sections.find((section) => section.key === op.key)?.title ?? '',
      });
    }
  };

  const undoSection = (turnId: string, key: string): void => {
    const found = buildTurnOf(turnId);
    if (found === null || found.turn.revived === true || flow.runtime.lease !== null) return;
    const task = found.turn.progress.tasks.find((candidate) => candidate.id === key);
    if (task?.landing === undefined || task.status !== 'landed') return;
    const outcomeKey = outcomeKeyOf(task);
    if (found.turn.outcomes[outcomeKey]?.kind === 'undone') return;
    const kernel = kernelOfBuild(flow, turnId);
    const report: AiBuildTaskReport = {
      id: task.id,
      title: task.title,
      status: 'applied',
      attempts: task.attempts,
      landing: task.landing,
    };
    try {
      const applied = revertBuildSection(kernel, report, preflightPorts());
      const transactionId = applied.transactions.at(-1)?.id;
      setOutcome(found.sessionId, turnId, outcomeKey, {
        kind: 'undone',
        ...(transactionId === undefined ? {} : { transactionId }),
      });
      say(flow, 'undone', { title: task.title });
      env().mood.noteTurn('discarded');
    } catch (cause: unknown) {
      // A refusal writes nothing and is said on the row, in the section's own terms.
      if (cause instanceof AiBuildRevertError) {
        if (cause.code === 'not-landed') return;
        setOutcome(found.sessionId, turnId, outcomeKey, {
          kind: 'refused',
          why: cause.code === 'changed-since' ? 'changedSince' : 'regionMissing',
        });
        return;
      }
      setOutcome(found.sessionId, turnId, outcomeKey, { kind: 'refused', why: 'changedSince' });
    }
  };

  const redoSection = (turnId: string, key: string): void => {
    const found = buildTurnOf(turnId);
    if (found === null || found.turn.revived === true || flow.runtime.lease !== null) return;
    const task = found.turn.progress.tasks.find((candidate) => candidate.id === key);
    const landing = task?.landing;
    if (task === undefined || landing === undefined) return;
    const outcomeKey = outcomeKeyOf(task);
    if (found.turn.outcomes[outcomeKey]?.kind !== 'undone') return;
    const kernel = kernelOfBuild(flow, turnId);
    const document = kernel.getDocument();
    // Forward, like the Undo: only while the region still holds what the Undo put back.
    if (!holdsValues(document, task.id, landing.before)) {
      setOutcome(found.sessionId, turnId, outcomeKey, {
        kind: 'refused',
        why: document.nodes[task.id] === undefined ? 'regionMissing' : 'changedSince',
      });
      return;
    }
    const commands = relandCommands(task.id, landing);
    if (commands.length === 0) return;
    try {
      const applied = applyAiPlan({
        kernel,
        validationPorts: preflightPorts(),
        plan: { rationale: `Put the section "${task.title}" back as it was built.`, commands },
        policy: { allowedCommands: ['setProp'], maxCommands: commands.length },
        label: `Assistant: redo ${landing.label.replace(/^Assistant: /u, '')}`.slice(0, 160),
      });
      const transactionId = applied.transactions.at(-1)?.id;
      if (transactionId !== undefined) {
        setOutcome(found.sessionId, turnId, outcomeKey, { kind: 'redone', transactionId });
      }
      say(flow, 'redone', { title: task.title });
    } catch {
      setOutcome(found.sessionId, turnId, outcomeKey, { kind: 'refused', why: 'changedSince' });
    }
  };

  const removeEmpty = (turnId: string): void => {
    const found = buildTurnOf(turnId);
    if (found === null || flow.runtime.lease !== null) return;
    const kernel = kernelOfBuild(flow, turnId);
    const placeholders = found.turn.placeholders;
    const unfilled =
      placeholders === undefined
        ? (flow.runtime.builds.get(turnId)?.result?.unfilled ?? [])
        : found.turn.progress.tasks.flatMap((task) => {
            const placeholder = placeholders[task.id];
            return task.status === 'landed' || placeholder === undefined
              ? []
              : [{ id: task.id, title: task.title, placeholder }];
          });
    if (unfilled.length === 0) return;
    try {
      const removal = removeUnfilledSections(kernel, { unfilled }, preflightPorts());
      if (removal.removed.length > 0) {
        patchKind(flow, found.sessionId, turnId, 'build', (turn) => ({ ...turn, placeholdersRemoved: true }));
        env().mood.noteTurn('discarded');
      }
    } catch {
      // Refused whole, so nothing was removed: the offer stays, and is still honest.
    }
  };

  const undoBuild = (turnId: string): void => {
    const found = buildTurnOf(turnId);
    if (found === null || found.turn.revived === true || found.turn.undone === true) return;
    if (found.turn.status !== 'settled' || flow.runtime.lease !== null) return;
    const kernel = kernelOfBuild(flow, turnId);
    const ids = found.turn.transactionIds ?? [];
    if (isNewest(shadowOf(flow, kernel), ids)) {
      // Exactly the build's own transactions, newest first: the skeleton goes too.
      ids.forEach(() => {
        kernel.undo();
      });
      patchKind(flow, found.sessionId, turnId, 'build', (turn) => ({ ...turn, undone: true }));
      say(flow, 'undone', { title: found.turn.request });
      env().mood.noteTurn('discarded');
      return;
    }
    if (!env().capabilities.rowUndo || !env().capabilities.undoBuild) return;
    // Engine E3 present: every landed section back, newest first, then the empty regions.
    const landed = [...found.turn.progress.tasks].reverse().filter((task) => task.status === 'landed');
    for (const task of landed) undoSection(turnId, task.id);
    removeEmpty(turnId);
    const after = buildTurnOf(turnId)?.turn;
    const reverted = landed.filter(
      (task) => after?.outcomes[outcomeKeyOf(task)]?.kind === 'undone',
    ).length;
    if (reverted === 0) return;
    // "Undone" only when every section went back; a refused row says why on its own line.
    if (reverted === landed.length) {
      patchKind(flow, found.sessionId, turnId, 'build', (turn) => ({ ...turn, undone: true }));
    }
    say(flow, 'undone', { title: found.turn.request });
    env().mood.noteTurn('discarded');
  };

  const redoBuild = (turnId: string): void => {
    const found = buildTurnOf(turnId);
    if (found?.turn.undone !== true || flow.runtime.lease !== null) return;
    const kernel = kernelOfBuild(flow, turnId);
    const ids = found.turn.transactionIds ?? [];
    if (!isNextRedo(shadowOf(flow, kernel), ids)) return;
    ids.forEach(() => {
      kernel.redo();
    });
    patchKind(flow, found.sessionId, turnId, 'build', (turn) => {
      const { undone: _undone, ...rest } = turn;
      void _undone;
      return rest;
    });
    say(flow, 'redone', { title: found.turn.request });
  };

  const undoEdit = (turnId: string): void => {
    const located = locateTurn(flow, turnId);
    const turn = located?.turn;
    if (located === null || turn?.kind !== 'edit' || turn.revived === true) return;
    if (turn.outcome?.kind === 'undone' || flow.runtime.lease !== null) return;
    const transactionId = turn.outcome?.kind === 'redone' ? turn.outcome.transactionId : turn.transactionId;
    const kernel = env().options.kernel;
    if (transactionId === undefined || !isNewest(shadowOf(flow, kernel), [transactionId])) return;
    kernel.undo();
    patchKind(flow, located.sessionId, turnId, 'edit', (current) => ({
      ...current,
      outcome: { kind: 'undone', transactionId },
    }));
    say(flow, 'undone', { title: turn.target ?? turn.request ?? '' });
    env().mood.noteTurn('discarded');
  };

  const redoEdit = (turnId: string): void => {
    const located = locateTurn(flow, turnId);
    const turn = located?.turn;
    if (located === null || turn?.kind !== 'edit' || turn.outcome?.kind !== 'undone') return;
    if (flow.runtime.lease !== null) return;
    const transactionId = turn.outcome.transactionId;
    const kernel = env().options.kernel;
    if (transactionId === undefined || !isNextRedo(shadowOf(flow, kernel), [transactionId])) return;
    kernel.redo();
    patchKind(flow, located.sessionId, turnId, 'edit', (current) => ({
      ...current,
      outcome: { kind: 'redone', transactionId },
    }));
    say(flow, 'redone', { title: turn.target ?? turn.request ?? '' });
  };

  const retrySections = (turnId: string, keys: readonly string[]): void => {
    const found = buildTurnOf(turnId);
    if (found === null || flow.runtime.lease !== null) return;
    const wanted = keys.length === 0 ? failedKeys(found.turn.progress) : keys;
    void track(flow, runSuccessor(flow, turnId, wanted));
  };

  const finishRest = (turnId: string): void => {
    const found = buildTurnOf(turnId);
    if (found === null || flow.runtime.lease !== null) return;
    void track(flow, runSuccessor(flow, turnId, unwrittenKeys(found.turn.progress)));
  };

  const tryAgain = (turnId: string): void => {
    if (flow.runtime.lease !== null) return;
    const located = locateTurn(flow, turnId);
    const origin = requestOf(flow, turnId);
    if (located === null || origin === null || origin.text.trim() === '') return;
    const kernel = env().options.kernel;
    const document = kernel.getDocument();
    // The blocks it pointed at, while they are still there.
    const context = origin.context.filter(
      (entry) => entry.kind === 'page' || document.nodes[entry.id] !== undefined,
    );
    const pointed = context.flatMap((entry) => (entry.kind === 'page' ? [] : [entry.id]));
    const turns = sessionOf(flow, located.sessionId)?.turns ?? [];
    // The history as it was when the request was first sent.
    const history = historyOf(turns.slice(0, Math.max(0, located.index - 1)));
    const route = routeRequest(origin.text, { kernel, mentions: pointed, selection: pointed });
    const mode = env().sessions.store.getState().mode;
    void track(
      flow,
      dispatchRequest(
        flow,
        { text: origin.text, context: context.length === 0 ? [{ kind: 'page' }] : context, pointed },
        route,
        { sessionId: located.sessionId, recordTurnId: turnId, history },
        mode,
      ),
    );
  };

  const reuse = (turnId: string): void => {
    const origin = requestOf(flow, turnId);
    if (origin === null) return;
    const document = env().options.kernel.getDocument();
    flow.ui.setState((ui) => ({
      ...ui,
      draft: origin.text,
      mentions: origin.context.flatMap((entry) =>
        entry.kind === 'page' || document.nodes[entry.id] === undefined
          ? []
          : [{ id: entry.id, label: entry.label }],
      ),
    }));
    env().enhancer.edited(origin.text);
  };

  const setDraft = (text: string): void => {
    const enhancer = env().enhancer;
    // Typing over an Improve in flight: the person's words win.
    if (enhancer.view.status === 'enhancing' && !flow.ui.getState().checking) enhancer.cancel();
    flow.ui.setState((ui) => {
      if (ui.draft === text) return ui;
      const queue = ui.queue;
      // While running, the queued request IS the composer's text (SPEC §3.9).
      const live = queue !== null && !queue.paused && ui.run !== null;
      return {
        ...ui,
        draft: text,
        queue: live ? (text.trim() === '' ? null : { ...queue, text: text.trim() }) : queue,
      };
    });
    enhancer.edited(text);
  };

  const removeChip = (id: string): void => {
    flow.ui.setState((ui) => {
      if (ui.mentions.some((entry) => entry.id === id)) {
        return { ...ui, mentions: ui.mentions.filter((entry) => entry.id !== id) };
      }
      const selection = env().selection;
      return selection.includes(id) ? { ...ui, dismissedSelection: selectionKey(selection) } : ui;
    });
  };

  const addMention = (nodeId: string): void => {
    const kernel = env().options.kernel;
    if (kernel.getDocument().nodes[nodeId] === undefined) return;
    flow.ui.setState((ui) => ({
      ...ui,
      draft: consumeMentionFragment(ui.draft).text,
      mentions: ui.mentions.some((entry) => entry.id === nodeId)
        ? ui.mentions
        : [...ui.mentions, { id: nodeId, label: blockName(kernel, nodeId) }],
    }));
    env().enhancer.edited(flow.ui.getState().draft);
  };

  const enhanceDraft = (): void => {
    const text = flow.ui.getState().draft.trim();
    const enhancer = env().enhancer;
    if (text === '' || !enhancer.available || enhancer.view.status === 'enhancing') return;
    const outgoing = outgoingOf(flow, text);
    const route = routeRequest(text, {
      kernel: env().options.kernel,
      mentions: outgoing.pointed,
      selection: outgoing.pointed,
    });
    void enhancer.improve(enhanceInputOf(flow, outgoing, route)).then((rewritten) => {
      if (rewritten === null) return;
      // Only while the draft is still what was sent to be improved; else the note goes too.
      const now = flow.ui.getState().draft;
      if (now.trim() !== text) {
        env().enhancer.edited(now);
        return;
      }
      flow.ui.setState((ui) => ({ ...ui, draft: rewritten }));
      say(flow, 'enhance.ready');
    });
  };

  const restoreDraft = (): void => {
    const original = env().enhancer.restore();
    if (original === null) return;
    flow.ui.setState((ui) => ({ ...ui, draft: original }));
  };

  const answerClarify = (questionId: string, answer: string): void => {
    const clarify = flow.ui.getState().clarify;
    if (clarify?.status !== 'asking' || answer.trim() === '') return;
    const questions = clarify.questions.map((question) =>
      question.id === questionId ? { ...question, answer: answer.trim() } : question,
    );
    const complete = questions.every((question) => question.answer !== undefined);
    flow.ui.setState((ui) =>
      ui.clarify === null
        ? ui
        : { ...ui, clarify: { ...ui.clarify, questions, status: complete ? 'rewriting' : 'asking' } },
    );
    if (!complete) return;
    const outgoing: Outgoing = { text: clarify.request, context: clarify.context, pointed: clarify.pointed };
    void (async () => {
      let text = requestWithAnswers(clarify.request, questions);
      try {
        const result = await env().enhancer.ask({
          ...enhanceInputOf(flow, outgoing, clarify.route),
          answers: answersOf(questions),
        });
        if (result.enhanced.trim() !== '') text = result.enhanced.trim();
      } catch {
        // The rewrite failed: the person's own words and their own answers run instead.
      }
      // Dismissed (or replaced) while it was rewriting: the request is the person's again.
      const now = flow.ui.getState().clarify;
      if (now?.status !== 'rewriting' || now.request !== clarify.request) return;
      flow.ui.setState((ui) => ({ ...ui, clarify: null }));
      const route = routeRequest(text, {
        kernel: env().options.kernel,
        mentions: clarify.pointed,
        selection: clarify.pointed,
      });
      // The person's turn shows the rewritten request: it is the request that runs.
      await send(flow, { ...outgoing, text }, { skipClarify: true, route });
    })();
  };

  const sendAsWritten = (): void => {
    const clarify = flow.ui.getState().clarify;
    if (clarify === null) return;
    flow.ui.setState((ui) => ({ ...ui, clarify: null }));
    void send(
      flow,
      { text: clarify.request, context: clarify.context, pointed: clarify.pointed },
      { skipClarify: true, route: clarify.route },
    );
  };

  const dismissClarify = (): void => {
    const clarify = flow.ui.getState().clarify;
    if (clarify === null) return;
    // The words, and the blocks they were sent about by name, go back into the box.
    const document = env().options.kernel.getDocument();
    flow.ui.setState((ui) => ({
      ...ui,
      clarify: null,
      draft: clarify.request,
      mentions: clarify.context.flatMap((entry) =>
        entry.kind === 'mention' && document.nodes[entry.id] !== undefined
          ? [{ id: entry.id, label: entry.label }]
          : [],
      ),
    }));
    env().enhancer.edited(clarify.request);
  };

  const removeQueued = (): void => {
    flow.ui.setState((ui) => ({
      ...ui,
      queue: null,
      // The queued request was the composer's own text: [×] clears the box (SPEC §3.9).
      draft: ui.queue !== null && !ui.queue.paused ? '' : ui.draft,
    }));
  };

  const continueQueued = (): void => {
    if (flow.ui.getState().queue === null || flow.runtime.lease !== null) return;
    flow.ui.setState((ui) =>
      ui.queue === null ? ui : { ...ui, queue: { ...ui.queue, paused: false, missing: false } },
    );
    drainQueue(flow);
  };

  const togglePreview = (turnId: string): void => {
    if (flow.ui.getState().previewing === turnId) {
      endPreview(turnId);
      return;
    }
    const turn = locateTurn(flow, turnId)?.turn;
    if (turn?.kind !== 'proposal' || turn.proposal === undefined) return;
    try {
      const document = previewAiPlan({
        kernel: env().options.kernel,
        proposal: turn.proposal,
        validationPorts: preflightPorts(),
      });
      flow.ui.setState((ui) => ({ ...ui, previewing: turnId }));
      env().options.onPreview?.({ turnId, document });
    } catch {
      // A proposal that cannot be rehearsed has nothing to show; the card stays as it is.
    }
  };

  const copy = (turnId: string, what: CopyTarget): void => {
    const text = copyText(flow, turnId, what);
    if (text === null) return;
    // jsdom and insecure origins have no clipboard, whatever the DOM types say.
    const clipboard: Clipboard | undefined =
      typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    const write =
      env().options.clipboard ??
      ((value: string): Promise<void> =>
        clipboard === undefined
          ? Promise.reject(new Error('No clipboard.'))
          : clipboard.writeText(value));
    void write(text).then(
      () => {
        say(flow, 'copied');
      },
      () => undefined,
    );
  };

  const newConversation = (): void => {
    // "Available when the current work ends" (SPEC §4.2 `header.new.busy`).
    if (flow.runtime.lease !== null) return;
    env().sessions.newConversation();
    flow.ui.setState((ui) => ({ ...ui, draft: '', mentions: [], queue: null, clarify: null, previewing: null }));
    env().enhancer.edited('');
    env().mood.reset();
  };

  const openConversation = (id: string): void => {
    env().sessions.openConversation(id);
    flow.ui.setState((ui) => (ui.clarify === null ? ui : { ...ui, clarify: null }));
  };

  const deleteConversation = (id: string): void => {
    const run = flow.ui.getState().run;
    if (run?.sessionId === id) flow.runtime.lease?.controller.abort();
    env().sessions.deleteConversation(id);
  };

  return {
    send: sendDraft,
    stop,
    removeQueued,
    continueQueued,
    apply,
    discard,
    build,
    runSteps,
    editPlan,
    undoSection,
    redoSection,
    undoBuild,
    retrySections,
    finishRest,
    removeEmpty,
    tryAgain,
    // The canvas link is the hook's (`use-canvas-link`); these are replaced below.
    reveal: () => undefined,
    peek: () => undefined,
    reuse,
    setDraft,
    setMode: (mode) => {
      env().sessions.chooseMode(mode);
    },
    setModel: (id) => {
      env().options.onSelectModel?.(id);
    },
    setEffort: (level) => {
      env().options.onSelectEffort?.(level);
    },
    newConversation,
    openConversation,
    deleteConversation,
    redoBuild,
    undoEdit,
    redoEdit,
    togglePreview,
    viewAsCode: (turnId) => {
      env().options.onViewAsCode?.(turnId);
    },
    copy,
    // Engine E3 (`restoreBefore`) is absent: the menu hides Restore; a direct call refuses.
    restore: (): Promise<RestoreResult> => Promise.resolve('conflict'),
    showTechnicalDetails: (turnId) => {
      env().options.onTechnicalDetails?.(turnId);
    },
    openPageHistory: () => {
      env().options.onOpenPageHistory?.();
    },
    removeChip,
    addMention,
    enhanceDraft,
    restoreDraft,
    answerClarify,
    sendAsWritten,
    dismissClarify,
    setComposerFocused: (focused) => {
      flow.ui.setState((ui) => (ui.composerFocused === focused ? ui : { ...ui, composerFocused: focused }));
    },
  };
}

/* ── Copy ────────────────────────────────────────────────────────────────────── */

function copyText(flow: Flow, turnId: string, what: CopyTarget): string | null {
  const turn = locateTurn(flow, turnId)?.turn;
  if (turn === undefined) return null;
  const { locale } = flow.env().options;
  const line = (key: Key, params?: CopyParams): string => t(locale, key, params);
  const details = (failure: AiRunFailure): string =>
    `${failure.source}/${String(failure.code)}${failure.status === undefined ? '' : ` ${String(failure.status)}`}: ${failure.message}`;
  switch (what) {
    case 'answer':
      return turn.kind === 'answer' ? turn.text : null;
    case 'error':
      if (turn.kind === 'error') return details(turn.failure);
      if (turn.kind === 'build' && turn.failure !== undefined) return details(turn.failure);
      return null;
    case 'summary':
      if (turn.kind === 'build') {
        return [
          line('build.caption.done', { n: landedCount(turn.progress) }),
          ...turn.progress.tasks.map((task) => `${String(task.position)}. ${task.title}`),
        ].join('\n');
      }
      if (turn.kind === 'edit') {
        const title =
          turn.target === undefined
            ? line('edit.title.runningPage')
            : line('edit.title.done', { target: turn.target });
        return [
          title,
          ...turn.changes.map((change) =>
            change.kind === 'changed'
              ? `${change.label}: ${change.before} / ${change.after}`
              : `${change.label}: ${change.value}`,
          ),
        ].join('\n');
      }
      return null;
  }
}

/* ── The RunBar's input ──────────────────────────────────────────────────────── */

function runStatusInput(run: LiveRun, record: TurnView | null): RunStatusInput {
  const { stopping } = run;
  if (record?.kind === 'build') {
    return {
      activity: 'build',
      phase: record.view.phase,
      rows: record.view.rows.map((row) => ({ title: row.title, state: row.state })),
      lastLanding: run.lastLanding,
      stopping,
    };
  }
  if (record?.kind === 'edit') {
    return { activity: 'edit', stage: record.view.stage ?? 'edit.started', stopping };
  }
  switch (run.activity) {
    case 'edit':
      return { activity: 'edit', stage: 'edit.started', stopping };
    case 'build':
      return { activity: 'build', phase: 'skeleton', rows: [], stopping };
    case 'routing':
    case 'plan':
    case 'proposal':
    case 'answer':
      return { activity: run.activity, stopping };
  }
}

/* ── The hook ────────────────────────────────────────────────────────────────── */

const noop = (): void => undefined;
const subscribeNothing = (): (() => void) => noop;
const noSelection = (): readonly NodeId[] => NO_SELECTION;

type KernelSnapshot = ReturnType<BuilderKernel['context']['store']['getState']>;

function sameKernelState(last: KernelSnapshot, next: KernelSnapshot): boolean {
  return (
    last.doc === next.doc &&
    last.seq === next.seq &&
    last.elementFocus === next.elementFocus &&
    last.selection.length === next.selection.length &&
    last.selection.every((id, index) => id === next.selection[index])
  );
}

/**
 * (WP-20 fix) The kernel's state as a `useSyncExternalStore` snapshot. A page lens
 * (`siteKernel.page(id)`, the kernel the app hands the panel) builds a new state object on
 * every `getState()`, so a snapshot read straight from it never compared equal and the
 * panel re-rendered until React gave up ("Maximum update depth exceeded"). The last
 * snapshot is kept while its document, selection, focus and sequence are the same.
 */
function stableKernelReader(store: BuilderKernel['context']['store']): () => KernelSnapshot {
  let last: KernelSnapshot | undefined;
  return () => {
    const next = store.getState();
    if (last !== undefined && sameKernelState(last, next)) return last;
    last = next;
    return next;
  };
}

/**
 * The agent panel's controller. The host renders `AgentPanel` with it (WP-20); the file
 * header says what each run path does.
 */
export function useAgentController(options: UseAgentControllerOptions): AgentController {
  const { kernel, locale } = options;
  const [clock] = useState<AgentClock>(() => options.clock ?? systemClock);
  const provider = useMemo(() => options.provider ?? createLocalAiPlanProvider(), [options.provider]);
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
  const [ui] = useState(() => createStore<UiState>(INITIAL_UI));
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
      selection,
      shownCatalog,
    };
  });

  const [flow] = useState<Flow>(() => ({ ui, runtime, env: () => env.current, clock }));
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

  /* ── The view ─────────────────────────────────────────────────────────────── */

  const developer = options.developer === true;
  const previewing = uiState.previewing;
  const viewContext = useMemo((): TurnViewContext => {
    void historyVersion;
    return {
      capabilities,
      developer,
      document,
      previewing,
      buildHistory: (turn: BuildTurn) => {
        if (turn.revived === true || turn.status !== 'settled') return undefined;
        const shadow = runtime.shadows.get(runtime.builds.get(turn.id)?.kernel ?? kernel) ?? EMPTY_HISTORY;
        const ids = turn.transactionIds ?? [];
        return {
          undone: turn.undone === true,
          canUndo: turn.undone !== true && (isNewest(shadow, ids) || capabilities.undoBuild),
          canRedo: turn.undone === true && isNextRedo(shadow, ids),
        };
      },
      editHistory: (turn: EditTurn) => {
        if (turn.revived === true) return undefined;
        const shadow = runtime.shadows.get(kernel) ?? EMPTY_HISTORY;
        const undoneId = turn.outcome?.kind === 'undone' ? turn.outcome.transactionId : undefined;
        const liveId = turn.outcome?.kind === 'redone' ? turn.outcome.transactionId : turn.transactionId;
        return {
          canUndo: liveId !== undefined && isNewest(shadow, [liveId]),
          canRedo: undoneId !== undefined && isNextRedo(shadow, [undoneId]),
        };
      },
    };
  }, [capabilities, developer, document, previewing, runtime, kernel, historyVersion]);

  const activeTurns = sessions.active.turns;
  const turns = useMemo(() => turnViewsOf(activeTurns, viewContext), [activeTurns, viewContext]);

  /* The live run's record, from whichever conversation it writes. */
  const liveRun = uiState.run;
  const allSessions = sessions.state.sessions;
  const runRecord = useMemo((): TurnView | null => {
    if (liveRun === null) return null;
    const turn = allSessions
      .find((session) => session.id === liveRun.sessionId)
      ?.turns.find((candidate) => candidate.id === liveRun.turnId);
    return turn === undefined ? null : (turnViewsOf([turn], viewContext)[0] ?? null);
  }, [liveRun, allSessions, viewContext]);

  const visible = useMemo((): VisibleStatus | null => {
    void tick;
    if (liveRun === null || liveRun.awaiting) return null;
    return visibleStatus(runStatusInput(liveRun, runRecord), clock.now());
  }, [liveRun, runRecord, clock, tick]);

  // The live region hears the RunBar line change: how a blocked episode starts and ends.
  const statusLine = visible === null ? null : `${visible.statusKey} ${JSON.stringify(visible.params)}`;
  const reportStatus = live.status;
  useEffect(() => {
    reportStatus(visible);
    // Keyed on the line's value: `visible` is a new object on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusLine, reportStatus]);

  const runBar: RunBarView | null =
    liveRun === null || visible === null
      ? null
      : {
          turnId: liveRun.turnId,
          activity: liveRun.activity,
          statusKey: visible.statusKey,
          params: visible.params,
          startedAt: liveRun.startedAt,
          stopping: liveRun.stopping,
        };

  const shownSelection = useMemo(
    () =>
      selectionShown(uiState, selection).filter(
        (id) => document.nodes[id] !== undefined && id !== document.rootId,
      ),
    [uiState, selection, document],
  );

  const chips = useMemo((): readonly ContextChipView[] => {
    const blocks: ContextChipView[] = [
      ...shownSelection.map((id) => ({
        kind: 'selection' as const,
        id,
        label: blockName(kernel, id),
        stale: false,
      })),
      ...uiState.mentions
        .filter((entry) => !shownSelection.includes(entry.id))
        .map((entry) => ({
          kind: 'mention' as const,
          id: entry.id,
          label: entry.label,
          stale: document.nodes[entry.id] === undefined,
        })),
    ];
    return blocks.length === 0 ? [{ kind: 'page', id: 'page' }] : blocks;
  }, [shownSelection, uiState.mentions, document, kernel]);

  const query = mentionQuery(uiState.draft);
  const mention: MentionView | null =
    query === null
      ? null
      : {
          query,
          candidates: mentionCandidatesFor(document, query, {
            nameOf: (id) => blockName(kernel, id),
            exclude: chips.flatMap((chip) => (chip.kind === 'page' ? [] : [chip.id])),
          }),
        };

  const runLife: 'idle' | 'live' | 'stopping' =
    liveRun === null || liveRun.awaiting ? 'idle' : liveRun.stopping ? 'stopping' : 'live';
  const queued = uiState.queue !== null && !uiState.queue.paused;
  const sendSlot = sendState({ run: runLife, draft: uiState.draft, queued });

  const awaiting = turns.some(isAwaitingDecision);
  const quiet =
    liveRun !== null || uiState.draft.trim() !== '' || awaiting || uiState.clarify !== null;
  // The registry is mutable: an extension registered later changes the catalog, not its identity.
  const catalogVersion = kernel.extensions.version();
  const suggestions = useMemo((): readonly SuggestionView[] => {
    void catalogVersion;
    // Hidden while running, while the box has text, while a decision waits (SPEC §4.16).
    if (quiet) return [];
    const page = summarizeDocumentForIntent(document);
    if ((page.nodeCount === 0 || page.placeholderOnly) && activeTurns.length === 0) {
      return starterSuggestions(locale);
    }
    const first = shownSelection[0];
    const type = first === undefined ? undefined : document.nodes[first]?.type;
    const schema = type === undefined ? undefined : kernel.context.registry.block(type)?.schema;
    const dropped = lastDropped(activeTurns);
    const newest = activeTurns.findLast((turn) => turn.kind === 'edit' || turn.kind === 'proposal');
    const salvaged =
      dropped !== undefined && dropped.length > 0 && newest !== undefined && 'target' in newest
        ? newest.target
        : undefined;
    return panelSuggestions({
      blocks: kernel.context.registry.blocks(kernel.context.surface),
      nameOf: (block) =>
        block.nodeId === undefined ? blockTypeName(block.type) : blockName(kernel, block.nodeId),
      ...(first !== undefined && schema !== undefined ? { selected: { nodeId: first, schema } } : {}),
      followUp: lastFollowUp(activeTurns),
      ...(salvaged === undefined ? {} : { salvaged: [salvaged] }),
      ...(ranOnPage(activeTurns) ? { pageSections: page.sectionLabels } : {}),
      locale,
      limit: activeTurns.length === 0 ? 4 : 3,
    });
  }, [quiet, document, activeTurns, locale, kernel, shownSelection, catalogVersion]);

  // What was last offered stays known after the box fills (the list hides while it has text).
  useEffect(() => {
    if (suggestions.length === 0) return;
    shownCatalog.current = new Set(
      suggestions.flatMap((suggestion) => (suggestion.source === 'catalog' ? [suggestion.text.trim()] : [])),
    );
  }, [suggestions]);

  const empty = useMemo((): EmptyStateView => {
    const first = shownSelection[0];
    if (first !== undefined) return { kind: 'selection', title: blockName(kernel, first) };
    const sections = Object.values(document.nodes[document.rootId]?.slots ?? {}).flat().length;
    const page = summarizeDocumentForIntent(document);
    return sections > 0 && !page.placeholderOnly ? { kind: 'hasContent', sections } : { kind: 'greeting' };
  }, [shownSelection, document, kernel]);

  const snapshot = mood.snapshot;
  const face = useMemo(
    (): FaceView => ({
      mood: snapshot.mood,
      ...(snapshot.variant === undefined ? {} : { variant: snapshot.variant }),
      ...(snapshot.outcome === undefined ? {} : { outcome: snapshot.outcome }),
      typing: snapshot.typing,
    }),
    [snapshot],
  );

  const clarify = useMemo(
    (): ClarifyView | null =>
      uiState.clarify === null
        ? null
        : {
            request: uiState.clarify.request,
            understood: uiState.clarify.understood,
            questions: uiState.clarify.questions,
            status: uiState.clarify.status,
          },
    [uiState.clarify],
  );

  const model = useMemo(
    () => modelSelection(options.models ?? [], options.model),
    [options.models, options.model],
  );
  const effort = useMemo(
    () => effortSelection(options.effort, options.onSelectEffort !== undefined),
    [options.effort, options.onSelectEffort],
  );
  const queue = useMemo(
    () => (uiState.queue === null ? null : queueView(uiState.queue, document)),
    [uiState.queue, document],
  );

  // The request the clarify panel asks about is the person's bubble while it asks.
  const clarifying = uiState.clarify;
  const shownTurns = useMemo(
    () => withPendingRequest(turns, clarifying, document),
    [turns, clarifying, document],
  );

  const state: AgentViewState = {
    locale,
    turns: shownTurns,
    draft: uiState.draft,
    chips,
    mention,
    mode: sessions.state.mode,
    model,
    effort,
    send: sendSlot,
    run: runBar,
    queue,
    sessions: sessions.summaries,
    suggestions,
    empty,
    announcement: live.announcement,
    enhancement: enhancer.view,
    clarify,
    face,
  };

  const { reveal, peek } = canvas;
  return { ...actions, reveal, peek, state, capabilities };
}
