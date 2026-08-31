import type { BuilderKernel } from '@craftkit/builder-core';
import type { AiContextProvider, NodeId } from '@craftkit/builder-schema';

import { assembleAiContext, type AssembleAiContextOptions } from '../context';
import {
  AI_PLAN_WIRE_VERSION,
  estimateAiPlanWireRequestTokens,
  type AiPlanWireAttempt,
  type AiPlanWireRequest,
} from '../provider/wire';
import {
  resolveAiCommandPolicy,
  type AiCommandPolicy,
  type AiEffectiveCommandPolicy,
  type AiPreparedSkillContext,
  type AiSkillRegistry,
} from '../skills';
import type {
  AiChatTurn,
  AiPlan,
  AiPlanProvider,
  AiProposeOptions,
  AiValidationPorts,
} from '../types';
import { AiPlanRejectedError, validateAiPlan } from './validate-plan';

export interface GenerateAiPlanOptions {
  kernel: BuilderKernel;
  provider: AiPlanProvider;
  request: string;
  validationPorts: AiValidationPorts;
  selection?: readonly NodeId[];
  contextProviders?: readonly AiContextProvider[];
  /** Cancels the provider's work for real; surfaces as the platform AbortError. */
  signal?: AbortSignal;
  /** Receives the provider's own live narration while it works. */
  onProgress?: (text: string) => void;
  /** The conversation so far, oldest first; lets follow-ups resolve their referent. */
  history?: readonly AiChatTurn[];
  /** Immutable catalog used to resolve expertise for this request only. */
  skillRegistry?: AiSkillRegistry;
  selectedSkillIds?: readonly string[];
  allowUntrustedSkills?: boolean;
  maxActiveSkills?: number;
  maxSkillTokens?: number;
  /** Hard bound over the complete serialized provider context. */
  maxContextTokens?: number;
  /** Session restrictions are intersected with the registry and active skills. */
  policy?: Partial<AiCommandPolicy>;
}

export const DEFAULT_AI_CONTEXT_TOKEN_BUDGET = 64_000;

export class AiContextBudgetError extends Error {
  override readonly name = 'AiContextBudgetError';

  constructor(
    readonly estimatedTokens: number,
    readonly maxTokens: number,
  ) {
    super(
      `AI context budget exceeded: estimated ${String(estimatedTokens)} tokens, maximum ${String(maxTokens)}.`,
    );
  }
}

function liveOptions(options: GenerateAiPlanOptions): AiProposeOptions {
  const live: AiProposeOptions = {};
  if (options.signal !== undefined) {
    live.signal = options.signal;
  }
  if (options.onProgress !== undefined) {
    live.onProgress = options.onProgress;
  }
  if (options.history !== undefined) {
    live.history = options.history;
  }
  return live;
}

function contextOptions(
  options: GenerateAiPlanOptions,
  skillContext: AiPreparedSkillContext | undefined,
): AssembleAiContextOptions {
  const context: AssembleAiContextOptions = {};
  if (options.selection !== undefined) {
    context.selection = options.selection;
  }
  if (options.contextProviders !== undefined) {
    context.providers = options.contextProviders;
  }
  if (skillContext !== undefined) {
    context.skillContext = skillContext;
  }
  return context;
}

function selectedBlockTypes(options: GenerateAiPlanOptions): readonly string[] {
  const state = options.kernel.context.store.getState();
  const selected = options.selection ?? state.selection;
  return [
    ...new Set(
      selected.flatMap((id) => {
        const type = state.doc.nodes[id]?.type;
        return type === undefined ? [] : [type];
      }),
    ),
  ].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

/** @internal Shared with the bounded agent runner; not part of the package export surface. */
export function prepareAiSkillsForGeneration(
  options: GenerateAiPlanOptions,
): AiPreparedSkillContext | undefined {
  if (options.skillRegistry === undefined) {
    if ((options.selectedSkillIds?.length ?? 0) > 0) {
      throw new Error('selectedSkillIds requires a skillRegistry.');
    }
    return undefined;
  }
  return options.skillRegistry.prepare({
    request: options.request,
    selectedBlockTypes: selectedBlockTypes(options),
    ...(options.selectedSkillIds === undefined
      ? {}
      : { selectedSkillIds: options.selectedSkillIds }),
    ...(options.allowUntrustedSkills === undefined
      ? {}
      : { allowUntrusted: options.allowUntrustedSkills }),
    ...(options.maxActiveSkills === undefined ? {} : { maxActiveSkills: options.maxActiveSkills }),
    ...(options.maxSkillTokens === undefined ? {} : { maxSkillTokens: options.maxSkillTokens }),
  });
}

/** @internal Shared with the bounded agent runner; not part of the package export surface. */
export function resolveAiPolicyForGeneration(
  options: GenerateAiPlanOptions,
  skills: AiPreparedSkillContext | undefined,
): AiEffectiveCommandPolicy {
  return resolveAiCommandPolicy({
    registeredCommands: options.kernel.context.registry.commandNames(),
    ...(options.policy === undefined ? {} : { session: options.policy }),
    ...(skills === undefined ? {} : { skills }),
  });
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) signal.throwIfAborted();
}

function wireRequest(
  options: GenerateAiPlanOptions,
  context: AiPlanWireRequest['context'],
  attempt?: AiPlanWireAttempt,
): AiPlanWireRequest {
  return {
    version: AI_PLAN_WIRE_VERSION,
    request: options.request,
    context,
    ...(options.history === undefined ? {} : { history: options.history }),
    ...(attempt === undefined ? {} : { attempt }),
  };
}

function assertWireRequestBudget(request: AiPlanWireRequest, maxTokens: number): void {
  const estimatedTokens = estimateAiPlanWireRequestTokens(request);
  if (estimatedTokens > maxTokens) {
    throw new AiContextBudgetError(estimatedTokens, maxTokens);
  }
}

/**
 * No provider result escapes without surviving the live registry's real kernel
 * door. A provider with a `repair` method gets exactly one correction when its
 * first proposal is rejected. The correction walks through the identical
 * command policy and scratch door; there is never a silent third model call.
 */
export async function generateAiPlan(options: GenerateAiPlanOptions): Promise<AiPlan> {
  throwIfAborted(options.signal);
  const skills = prepareAiSkillsForGeneration(options);
  return generateAiPlanWithPreparedSkills(options, skills);
}

/**
 * @internal Execute generation with an already pinned per-request skill set.
 * The runner uses this to emit resolution events without resolving twice.
 */
export async function generateAiPlanWithPreparedSkills(
  options: GenerateAiPlanOptions,
  skills: AiPreparedSkillContext | undefined,
): Promise<AiPlan> {
  throwIfAborted(options.signal);
  const policy = resolveAiPolicyForGeneration(options, skills);
  const context = assembleAiContext(options.kernel.context, contextOptions(options, skills));
  const maxContextTokens = options.maxContextTokens ?? DEFAULT_AI_CONTEXT_TOKEN_BUDGET;
  if (!Number.isSafeInteger(maxContextTokens) || maxContextTokens <= 0) {
    throw new RangeError('maxContextTokens must be a positive safe integer.');
  }
  assertWireRequestBudget(wireRequest(options, context), maxContextTokens);
  const live = liveOptions(options);
  let candidate: unknown = await options.provider.propose(options.request, context, live);
  throwIfAborted(options.signal);
  const repair = options.provider.repair?.bind(options.provider);
  const first = validateAiPlan(candidate, options.kernel, options.validationPorts, policy);
  if (first.ok) return first.plan;
  if (repair === undefined) throw new AiPlanRejectedError(first.issues);

  throwIfAborted(options.signal);
  // The parse may have failed before a structured plan existed; hand the
  // server whatever shape it sent so it can see its own mistake.
  const attempted = isPlanShaped(candidate) ? candidate : { rationale: '', commands: [] };
  assertWireRequestBudget(
    wireRequest(options, context, { plan: attempted, issues: first.issues }),
    maxContextTokens,
  );
  candidate = await repair(options.request, context, attempted, first.issues, live);
  throwIfAborted(options.signal);
  const repaired = validateAiPlan(candidate, options.kernel, options.validationPorts, policy);
  if (!repaired.ok) throw new AiPlanRejectedError(repaired.issues);
  return repaired.plan;
}

function isPlanShaped(candidate: unknown): candidate is AiPlan {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    'rationale' in candidate &&
    'commands' in candidate
  );
}
