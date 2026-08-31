import type {
  ClockPort,
  ContextFragment,
  IdPort,
  JsonValue,
  NodeId,
  SlotName,
} from '@craftkit/builder-schema';

import type { AiSkillActivationPin, AiSkillManifestV1 } from './skills';

export interface AiBlockSlotContext {
  name: SlotName;
  allow: readonly string[];
  max?: number;
}

export interface AiBlockExampleContext {
  prompt: string;
  node: JsonValue;
}

export interface AiBlockContext {
  type: string;
  description: string;
  propsSchema: JsonValue;
  examples: readonly AiBlockExampleContext[];
  slots: readonly AiBlockSlotContext[];
}

export interface AiDocumentNodeContext {
  id: NodeId;
  type: string;
  /**
   * The node's full props, for EVERY node — not only the selection. "Change
   * the word X" names content, not a node id; a provider can only find that
   * word if the document context actually contains the page's text.
   */
  props: Readonly<Record<string, JsonValue>>;
  slots: Readonly<Record<SlotName, readonly NodeId[]>>;
}

export interface AiDocumentContext {
  schemaVersion: number;
  surface: string;
  dir: 'ltr' | 'rtl';
  rootId: NodeId;
  nodes: readonly AiDocumentNodeContext[];
}

/** Kept as its own name: selection marks FOCUS, even though every document node now carries props. */
export type AiSelectedNodeContext = AiDocumentNodeContext;

export interface AiSelectionContext {
  ids: readonly NodeId[];
  nodes: readonly AiSelectedNodeContext[];
}

/** A registered page/template composition that AI may insert atomically. */
export interface AiTemplateContext {
  id: string;
  name: string;
  rootType: string;
  nodeCount: number;
  blockTypes: readonly string[];
}

export interface AssembledAiContext {
  fragments: readonly ContextFragment[];
  totalTokens: number;
  blocks: readonly AiBlockContext[];
  /** Optional for backwards-compatible provider fixtures created outside the assembler. */
  templates?: readonly AiTemplateContext[];
  document: AiDocumentContext;
  selection: AiSelectionContext;
  /** Progressive-disclosure metadata; never contains instruction/reference bodies. */
  skillCatalog?: readonly AiSkillManifestV1[];
  /** Version/fingerprint pins only. Full bodies live exactly once in `fragments`. */
  skills?: readonly AiSkillActivationPin[];
}

export interface AiPlanStep {
  command: string;
  args: unknown;
  /**
   * Optional human sentence for this step, written by the provider in the
   * requester's own language ("إضافة قسم الأسعار", "Recolour the hero"). A UI
   * shows this instead of the raw command name; the command stays the truth
   * the kernel executes.
   */
  title?: string;
}

export interface AiPlan {
  rationale: string;
  commands: readonly AiPlanStep[];
  /**
   * Optional staged-work suggestion: when a request is too big for one safe
   * plan, the provider does the most valuable stage now and words the NEXT
   * request here, in the requester's language. A UI offers it as a one-tap
   * continuation; nothing applies it automatically.
   */
  followUp?: string;
}

/** One prior exchange in the conversation the request belongs to. */
export interface AiChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

/**
 * Live options for one proposal. `signal` cancels the work for real — a
 * provider must stop, not merely ignore the answer — and surfaces as the
 * platform's AbortError, never as a provider failure. `onProgress` carries the
 * provider's own words about what it is doing right now, for a UI to show
 * while the person waits. `history` is the conversation so far, so "make it
 * blue" can mean the hero the previous turn just added.
 */
export interface AiProposeOptions {
  signal?: AbortSignal;
  onProgress?: (text: string) => void;
  history?: readonly AiChatTurn[];
}

/** The provider boundary. A network-backed provider implements the same contract. */
export interface AiPlanProvider {
  propose(
    request: string,
    context: AssembledAiContext,
    options?: AiProposeOptions,
  ): Promise<AiPlan>;
  /**
   * Optional one-shot second chance: called with the rejected plan and its
   * validation issues when the first proposal fails the kernel door. The
   * repaired plan is validated exactly like the first; there is no third try.
   */
  repair?(
    request: string,
    context: AssembledAiContext,
    plan: AiPlan,
    issues: readonly AiPlanValidationIssue[],
    options?: AiProposeOptions,
  ): Promise<AiPlan>;
}

/** Dedicated deterministic capabilities for preflight; never borrow the live kernel's instances. */
export interface AiValidationPorts {
  clock: ClockPort;
  ids: IdPort;
}

export interface AiPlanValidationIssue {
  code: 'invalid-plan' | 'unknown-command' | 'invalid-args' | 'policy-rejected' | 'door-rejected';
  message: string;
  step?: number;
}

export type AiPlanValidationResult =
  { ok: true; plan: AiPlan } | { ok: false; issues: readonly AiPlanValidationIssue[] };
