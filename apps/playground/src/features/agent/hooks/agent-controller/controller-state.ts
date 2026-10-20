/**
 * The controller's own state (the UI store's shape, the runtime the flows share), what
 * every flow reads (`Env`, `Flow`), and the small readers they all use.
 */
import {
  type AiBuildPlanAnswer,
  type AiBuildRunResult,
  type AiPlanProvider,
  type AiSkillRegistry,
  type BuilderKernel,
  createCraftkitAiSkillRegistry,
  type IntentRoute,
  type NodeId,
} from '@craftkit/builder';

import type { UseAgentMoodResult } from '../../../preview/components/AgentFace';
import type { AppliedChangeMemory } from '../../../preview/components/AssistantPanel/AssistantPanel.memory';
import type { MeasuredContext } from '../../model/context-meter';
import type { HistoryShadow } from '../../model/kernel-history';
import type { QueuedRequest } from '../../model/queue';
import type { PromptSkillSnapshot } from '../../model/prompt-skills';
import type { ActiveRunLease } from '../../model/runs';
import type { StoryBibleStore } from '../../model/story-bible';
import type { Store } from '../../model/tiny-store';
import type { SentContext } from '../../model/turns';
import type {
  AgentCapabilities,
  BuildWorkerCount,
  ClarifyQuestionView,
  ClarifyView,
  RunActivity,
} from '../../model/view-types';
import type { AgentSessions } from '../use-agent-sessions';
import type { LiveStatus } from '../use-live-status';
import type { PromptEnhancerHandle } from '../use-prompt-enhancer';

import type { AgentClock, UseAgentControllerOptions } from './options';

/* ── The controller's own state ──────────────────────────────────────────────── */

/** The run that holds the lease, as the RunBar and the flows read it. */
export interface LiveRun {
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
  readonly origin?: { readonly kernel: BuilderKernel; readonly sessionId: string };
  readonly request: string;
  readonly skillSnapshot?: PromptSkillSnapshot | undefined;
  readonly context: readonly SentContext[];
  readonly pointed: readonly NodeId[];
  readonly route: IntentRoute;
  readonly understood: string;
  readonly questions: readonly ClarifyQuestionView[];
  readonly status: ClarifyView['status'];
}

export interface UiState {
  readonly draft: string;
  readonly workers: BuildWorkerCount;
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
  /** The latest request the engine measured (`context.ready`): the meter, the focused chip. */
  readonly context: MeasuredContext | null;
}

export const INITIAL_UI: UiState = {
  draft: '',
  workers: 3,
  mentions: [],
  dismissedSelection: null,
  run: null,
  queue: null,
  clarify: null,
  previewing: null,
  composerFocused: false,
  checking: false,
  context: null,
};

/** What a finished build left behind in this session: the kernel it wrote, the result. */
interface BuildRecordRuntime {
  readonly kernel: BuilderKernel;
  readonly result?: AiBuildRunResult | undefined;
}

export interface Runtime {
  lease: ActiveRunLease | null;
  /** Settles when the flow holding the lease has finished writing its turns. */
  done: Promise<void> | null;
  /** The held `onPlanned` questions, by the plan card's turn id. */
  readonly approvals: Map<string, (answer: AiBuildPlanAnswer) => void>;
  /** Plan cards whose held question a newer request answered (not a Discard). */
  readonly superseded: Set<string>;
  readonly builds: Map<string, BuildRecordRuntime>;
  /** The page captured by each edit/proposal, including failed runs that may be retried. */
  readonly edits: Map<string, BuilderKernel>;
  /** AI transactions landed while the current run held the lease. */
  collect: { readonly runId: string; readonly ids: string[] } | null;
  /** The kernels whose history the controller follows. */
  readonly shadows: Map<BuilderKernel, HistoryShadow>;
  readonly unsubscribe: Map<BuilderKernel, () => void>;
  /** Re-render when a followed kernel's history moves. */
  bump: () => void;
}

/* ── Small readers ───────────────────────────────────────────────────────────── */

export const NO_SELECTION: readonly NodeId[] = [];
export const DEFAULT_REGISTRY = createCraftkitAiSkillRegistry();
/** "{title} is on the page" holds the RunBar this long (SPEC §4.3 `build.landed`). */
export const LANDED_LINE_MS = 2_400;

export function selectionKey(ids: readonly NodeId[]): string {
  return ids.join('\u0000');
}

export function offline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

/**
 * A page title from a request, for the host's `addPage`: one line, cut at a word boundary
 * when it runs past 60 characters. No ellipsis: a page title is a name, not a preview.
 */
export function pageTitleFrom(request: string): string {
  const flat = request.replace(/\s+/gu, ' ').trim();
  if (flat.length <= 60) return flat;
  const cut = flat.slice(0, 60);
  const space = cut.lastIndexOf(' ');
  return (space > 30 ? cut.slice(0, space) : cut).trim();
}

export function stoppedError(): Error {
  const error = new Error('The run was stopped.');
  error.name = 'AbortError';
  return error;
}

/* ── Everything a flow reads ─────────────────────────────────────────────────── */

export interface Env {
  readonly options: UseAgentControllerOptions;
  readonly provider: AiPlanProvider;
  readonly registry: AiSkillRegistry;
  readonly capabilities: AgentCapabilities;
  readonly sessions: AgentSessions;
  readonly live: LiveStatus;
  readonly mood: UseAgentMoodResult;
  readonly enhancer: PromptEnhancerHandle;
  readonly memory: AppliedChangeMemory;
  /** The project's story bible (creative agent, 2026-10-12): read by every run, taught by builds. */
  readonly storyBible: StoryBibleStore;
  readonly selection: readonly NodeId[];
  /** The catalog suggestions last on screen, by their exact words (`Outgoing.catalog`). */
  readonly shownCatalog: { readonly current: ReadonlySet<string> };
}

export interface Flow {
  readonly ui: Store<UiState>;
  readonly runtime: Runtime;
  readonly env: () => Env;
  readonly clock: AgentClock;
  /**
   * After a run: the queue's drain (`send.ts` `drainQueue`). The hook hands it in, so the
   * lease (which every flow takes) never imports the send path that takes it.
   */
  readonly drainQueue: (flow: Flow) => void;
}
