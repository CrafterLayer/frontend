/**
 * The host's props for `useAgentController`, and the small public types they name
 * (the selection source, a proposal preview, the run clock, the edit effort).
 * `use-agent-controller.ts` re-exports every one of them.
 */
import type {
  AiAgentEvent,
  AiAgentPolicy,
  AiBuildOwnEvent,
  AiPlanProvider,
  AiSkillRegistry,
  BuilderDocument,
  BuilderKernel,
  NodeId,
  RunAiAgentOptions,
} from '@craftkit/builder';

import type { ProviderKind } from '../../../preview/components/AssistantPanel/catalogPolicyFor';
import type { PromptEnhancer } from '../../model/enhance';
import type { AgentStorage } from '../../model/migrate-sessions';
import type {
  AgentCapabilities,
  AssistantMode,
  BuildWorkerCount,
  EffortLevel,
  Locale,
} from '../../model/view-types';

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
  /**
   * The free-code switch (the engine's `RunAiAgentOptions.freeCode`): on, the agent may write
   * JavaScript and full PixiJS scenes. Without the setter no switch is drawn.
   */
  readonly freeCode?: boolean | undefined;
  readonly onToggleFreeCode?: ((enabled: boolean) => void) | undefined;
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
  /** Initial independent section-worker limit; three by default. Captured per run. */
  readonly fillConcurrency?: BuildWorkerCount | undefined;
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
