import type { BuilderKernel } from '@craftkit/builder-core';
import type { AiContextProvider, NodeId } from '@craftkit/builder-schema';

import {
  assembleAiContext,
  resolveAiCompositionPolicy,
  type AiCompositionPolicy,
  type AssembleAiContextOptions,
} from '../context';
import { isAiProviderError } from '../provider/errors';
import {
  AI_PLAN_WIRE_VERSION,
  boundAiPlanWireInvalidOutputMessage,
  estimateAiPlanWireRequestTokens,
  type AiPlanWireAttempt,
  type AiPlanWireRequest,
} from '../provider/wire';
import {
  AiCommandPolicyError,
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
  /** Backward-compatible additive alias for additionalContextProviders. */
  contextProviders?: readonly AiContextProvider[];
  additionalContextProviders?: readonly AiContextProvider[];
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
  /**
   * How much of the block registry this run may see. Omitted ⇒ the full
   * catalog. With `catalogMode: 'scoped'` and no explicit type list, the scope
   * is the selection's own block types — "the block the user pointed at".
   */
  composition?: AiCompositionPolicy;
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
  policy: AiEffectiveCommandPolicy,
): AssembleAiContextOptions {
  const context: AssembleAiContextOptions = { allowedCommands: policy.allowedCommands };
  if (options.selection !== undefined) {
    context.selection = options.selection;
  }
  if (options.contextProviders !== undefined) {
    context.providers = options.contextProviders;
  }
  if (options.additionalContextProviders !== undefined) {
    context.additionalContextProviders = options.additionalContextProviders;
  }
  if (skillContext !== undefined) {
    context.skillContext = skillContext;
  }
  const composition = compositionPolicy(options);
  if (composition !== undefined) {
    context.composition = composition;
  }
  return context;
}

/**
 * Resolve the run's catalog policy, filling in the one thing the caller should
 * never have to restate: WHICH types are in scope.
 *
 * A host asking for `'scoped'` means "the block the user is holding". That set
 * is already derivable here from the selection, and deriving it here is what
 * keeps the two from disagreeing — a host that computed its own list would
 * drift from the selection the same request was assembled against.
 * An explicit `scopedBlockTypes` still wins, for hosts that scope by something
 * other than selection.
 */
function compositionPolicy(options: GenerateAiPlanOptions): AiCompositionPolicy | undefined {
  const requested = options.composition;
  if (requested === undefined) return undefined;
  // `scoped` and `none` both mean "the blocks the person put in front of me";
  // the selection is where those blocks are.
  const derivesFromSelection =
    requested.catalogMode === 'scoped' || requested.catalogMode === 'none';
  if (!derivesFromSelection || requested.scopedBlockTypes !== undefined) {
    return requested;
  }
  return { ...requested, scopedBlockTypes: selectedBlockTypes(options) };
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
  const policy = resolveAiCommandPolicy({
    registeredCommands: options.kernel.context.registry.commandNames(),
    ...(options.policy === undefined ? {} : { session: options.policy }),
    ...(skills === undefined ? {} : { skills }),
  });
  if (policy.allowedCommands.length === 0) {
    const activeSkills = skills?.activations.map(({ id }) => id).join(', ');
    const sources = [
      activeSkills === undefined || activeSkills.length === 0
        ? undefined
        : `active Skills (${activeSkills})`,
      options.policy?.allowedCommands === undefined ? undefined : 'session.allowedCommands',
      options.policy?.deniedCommands === undefined ? undefined : 'session.deniedCommands',
    ].filter((source): source is string => source !== undefined);
    throw new AiCommandPolicyError(
      'empty-effective-policy',
      `${sources.length === 0 ? 'The live command registry' : sources.join(' and ')} leave this AI run with no permitted commands.`,
    );
  }
  return policy;
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

function invalidOutputRepairAttempt(message: string): AiPlanWireAttempt {
  return {
    plan: { rationale: '', commands: [] },
    issues: [
      {
        code: 'invalid-plan',
        message: boundAiPlanWireInvalidOutputMessage(message),
      },
    ],
  };
}

async function repairAiPlanOnce(
  options: GenerateAiPlanOptions,
  context: AiPlanWireRequest['context'],
  live: AiProposeOptions,
  policy: AiEffectiveCommandPolicy,
  repair: NonNullable<AiPlanProvider['repair']>,
  attempt: AiPlanWireAttempt,
  maxContextTokens: number,
): Promise<AiPlan> {
  throwIfAborted(options.signal);
  assertWireRequestBudget(wireRequest(options, context, attempt), maxContextTokens);
  const candidate = await repair(options.request, context, attempt.plan, attempt.issues, live);
  throwIfAborted(options.signal);
  const repaired = validateAiPlan(
    candidate,
    options.kernel,
    options.validationPorts,
    policy,
    resolveAiCompositionPolicy(options.composition),
  );
  if (!repaired.ok) throw new AiPlanRejectedError(repaired.issues);
  return repaired.plan;
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
  const policy = resolveAiPolicyForGeneration(options, skills);
  return generateAiPlanWithPreparedSkills(options, skills, policy);
}

/**
 * @internal Execute generation with an already pinned per-request skill set.
 * The runner uses this to emit resolution events without resolving twice.
 */
export async function generateAiPlanWithPreparedSkills(
  options: GenerateAiPlanOptions,
  skills: AiPreparedSkillContext | undefined,
  policy: AiEffectiveCommandPolicy,
): Promise<AiPlan> {
  throwIfAborted(options.signal);
  const context = assembleAiContext(
    options.kernel.context,
    contextOptions(options, skills, policy),
  );
  const maxContextTokens = options.maxContextTokens ?? DEFAULT_AI_CONTEXT_TOKEN_BUDGET;
  if (!Number.isSafeInteger(maxContextTokens) || maxContextTokens <= 0) {
    throw new RangeError('maxContextTokens must be a positive safe integer.');
  }
  assertWireRequestBudget(wireRequest(options, context), maxContextTokens);
  const live = liveOptions(options);
  const repair = options.provider.repair?.bind(options.provider);
  let candidate: unknown;
  try {
    candidate = await options.provider.propose(options.request, context, live);
  } catch (cause) {
    throwIfAborted(options.signal);
    if (
      !isAiProviderError(cause) ||
      cause.code !== 'invalid-output' ||
      !cause.retryable ||
      repair === undefined
    ) {
      throw cause;
    }
    return repairAiPlanOnce(
      options,
      context,
      live,
      policy,
      repair,
      invalidOutputRepairAttempt(cause.message),
      maxContextTokens,
    );
  }
  throwIfAborted(options.signal);
  const first = validateAiPlan(
    candidate,
    options.kernel,
    options.validationPorts,
    policy,
    resolveAiCompositionPolicy(options.composition),
  );
  if (first.ok) return first.plan;
  /*
    The answer failed the door, so the provider must not serve it again. A
    caching provider otherwise turns one rejected plan into a permanent one:
    the person retries the same request and the same dead plan returns in
    milliseconds, without the model ever being asked.
  */
  options.provider.forget?.(options.request, context, live);
  if (repair === undefined) throw new AiPlanRejectedError(first.issues);

  throwIfAborted(options.signal);
  // The parse may have failed before a structured plan existed; hand the
  // server whatever shape it sent so it can see its own mistake.
  const attempted = isPlanShaped(candidate) ? candidate : { rationale: '', commands: [] };
  return repairAiPlanOnce(
    options,
    context,
    live,
    policy,
    repair,
    { plan: attempted, issues: first.issues },
    maxContextTokens,
  );
}

function isPlanShaped(candidate: unknown): candidate is AiPlan {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    'rationale' in candidate &&
    'commands' in candidate
  );
}
