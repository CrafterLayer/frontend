import type {
  ClockPort,
  ContextFragment,
  IdPort,
  JsonValue,
  NodeId,
  SlotName,
} from '@craftkit/builder-schema';

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
  slots: Readonly<Record<SlotName, readonly NodeId[]>>;
}

export interface AiDocumentContext {
  schemaVersion: number;
  surface: string;
  dir: 'ltr' | 'rtl';
  rootId: NodeId;
  nodes: readonly AiDocumentNodeContext[];
}

export interface AiSelectedNodeContext extends AiDocumentNodeContext {
  props: Readonly<Record<string, JsonValue>>;
}

export interface AiSelectionContext {
  ids: readonly NodeId[];
  nodes: readonly AiSelectedNodeContext[];
}

export interface AssembledAiContext {
  fragments: readonly ContextFragment[];
  totalTokens: number;
  blocks: readonly AiBlockContext[];
  document: AiDocumentContext;
  selection: AiSelectionContext;
}

export interface AiPlanStep {
  command: string;
  args: unknown;
}

export interface AiPlan {
  rationale: string;
  commands: readonly AiPlanStep[];
}

/** The provider boundary. Network-backed providers can implement the same single method later. */
export interface AiPlanProvider {
  propose(request: string, context: AssembledAiContext): Promise<AiPlan>;
}

/** Dedicated deterministic capabilities for preflight; never borrow the live kernel's instances. */
export interface AiValidationPorts {
  clock: ClockPort;
  ids: IdPort;
}

export interface AiPlanValidationIssue {
  code: 'invalid-plan' | 'unknown-command' | 'invalid-args' | 'door-rejected';
  message: string;
  step?: number;
}

export type AiPlanValidationResult =
  { ok: true; plan: AiPlan } | { ok: false; issues: readonly AiPlanValidationIssue[] };
