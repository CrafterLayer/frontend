import type {
  AiAgentEvent,
  AiAgentPolicy,
  AiBuildOwnEvent,
  AiBuildRunResult,
  AiPlanProvider,
  AiSkillRegistry,
  BuilderKernel,
  NodeId,
} from '@craftkit/builder';

import type { AgentLocale } from '../AgentFace';
import type { QueuedRequestState } from '../QueuedRequestCard';
import type { AssistantMode } from './AssistantPanel.modes';
import type { RequestPath } from './AssistantPanel.runs';
import type { ProviderKind } from './catalogPolicyFor';
import type { SiteRunSeam } from './use-site-run';

/*
  The panel's public props, and the internal shapes its hooks hand each other.
  Types only.
*/

export interface AssistantPanelProps {
  kernel: BuilderKernel;
  /** Opens the code view on the proposal. Absent ⇒ the action is not offered. */
  onReviewAsCode?: (() => void) | undefined;
  /** Optional proposal source for an embedded or deterministic host. */
  planProvider?: AiPlanProvider | undefined;
  /**
   * What `planProvider` IS, declared by whoever wired it. Decides how much of
   * the block catalog each run sends: an offline provider scores schemas and
   * needs all of them; a remote model needs names. Defaults to `'offline'`,
   * which is also right for every test double that wraps the offline one —
   * inferring `'remote'` from the mere presence of a provider starved exactly
   * those doubles and was reverted.
   */
  providerKind?: ProviderKind | undefined;
  /** Models the header may offer, the current one, and the host's setter. Fewer than two ⇒ no picker. */
  models?: readonly string[] | undefined;
  model?: string | undefined;
  onSelectModel?: ((model: string) => void) | undefined;
  /** Host-owned, data-only expertise available to this assistant surface. */
  skillRegistry?: AiSkillRegistry | undefined;
  /** Explicit Skills to activate for every request on this surface. */
  selectedSkillIds?: readonly string[] | undefined;
  /** Optional host narrowing for commands, Skills, and context budgets. */
  agentPolicy?: Partial<AiAgentPolicy> | undefined;
  /** Ordered telemetry only; observer failures never acquire run authority. */
  onAgentEvent?: ((event: AiAgentEvent) => void) | undefined;
  /**
   * The split build's OWN events (`build.*`, `task.*`), when a request routes
   * to the orchestrator. Separate from `onAgentEvent` on purpose: every step of
   * a build is an ordinary run and still reports through that one, so a host
   * that only cares about runs needs no new code, and a host that wants to
   * watch the build itself does not have to filter a widened union.
   */
  onBuildEvent?: ((event: AiBuildOwnEvent) => void) | undefined;
  /**
   * localStorage key for reviving conversations across reloads. Absent ⇒ the
   * panel stays fully in-memory (the portable default: the engine never
   * assumes a browser store; the HOST opts in).
   */
  persistKey?: string | undefined;
  /**
   * The mode a person starts in until they choose one; a chosen mode is
   * remembered and wins. Default 'ask'. The product passes 'auto': every
   * change lands as undoable history, so a person who asked for a page gets
   * the page without an extra Apply.
   */
  defaultMode?: AssistantMode | undefined;
  /**
   * The language of the character's one visible line (the panel's live
   * region). Default `'ar'`: the tool is called Assistant; the person inside
   * it is أبو غضب. Not an i18n layer — the chrome stays English because
   * everything it names is Latin. `'en'` exists so tests, Storybook a11y and
   * an English-speaking reviewer see the same persona deterministically.
   */
  locale?: AgentLocale | undefined;
  /**
   * Whether this panel is the destination a person is actually looking at.
   *
   * The host keeps the assistant MOUNTED across rail destinations, because its
   * unmount aborts the run in flight — so "not visible" and "not rendered" have
   * come apart, and the panel has to be told which it is. A hidden element
   * measures zero, so anything that reads geometry (the thread following the
   * newest turn) is a no-op while it is away and has to be redone on the way
   * back. Defaults to `true`: a panel nobody told is a panel on screen.
   */
  visible?: boolean | undefined;
  /**
   * Hands the host this panel's ONE run lease.
   *
   * The site builder is its own rail destination — a build is a job, not a
   * message — but it must not be able to start a run while this panel owns one.
   * Sharing the lease rather than duplicating it is what makes that structural:
   * there is one `activeRunRef`, one `busy`, and one `stop`, whichever
   * destination a person is looking at.
   */
  onSiteSeam?: ((seam: SiteRunSeam) => void) | undefined;
}

/**
 * What a finished build left behind, kept for as long as this panel lives: the
 * kernel it wrote to, and the engine's own result — each section's landing
 * (what to put it back to, keyed by the transaction id) and every placeholder
 * no fill reached. Runtime authority, exactly like a plan's `proposal`: it is
 * never saved, so a revived report cannot act on a page it no longer knows.
 */
export interface BuildRecord {
  readonly kernel: BuilderKernel;
  readonly result: AiBuildRunResult;
}

/** The placement a build takes, from `requestPath`. */
export type BuildPlacement = Extract<RequestPath, { path: 'build' }>;

/**
 * Where a request came from, which decides whether the CATALOG may answer it.
 *
 * `suggestion` means the person pressed a chip carrying a catalog prompt
 * verbatim; `typed` means they wrote it, even if it happens to read the same.
 * The difference is not cosmetic: one is picking a named example, the other is
 * asking for something for this page.
 *
 * `build` is a planned page being built for real. It is its own origin because
 * it must not be answered from the catalog — the request is a page, not an
 * example — and because the mode control has just moved beneath it.
 */
export type AskOrigin = 'typed' | 'suggestion' | 'build';

export interface QueuedAssistantRequest {
  readonly request: string;
  readonly context: string;
  readonly selection: readonly NodeId[];
  readonly targetTypes: readonly (string | undefined)[];
  readonly state: QueuedRequestState;
}
