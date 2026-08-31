import type { BuilderKernel } from '@craftkit/builder-core';
import type { AiContextProvider, NodeId } from '@craftkit/builder-schema';

import { assembleAiContext, type AssembleAiContextOptions } from '../context';
import type {
  AiChatTurn,
  AiPlan,
  AiPlanProvider,
  AiProposeOptions,
  AiValidationPorts,
} from '../types';
import { AiPlanRejectedError, assertValidAiPlan, validateAiPlan } from './validate-plan';

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

function contextOptions(options: GenerateAiPlanOptions): AssembleAiContextOptions {
  const context: AssembleAiContextOptions = {};
  if (options.selection !== undefined) {
    context.selection = options.selection;
  }
  if (options.contextProviders !== undefined) {
    context.providers = options.contextProviders;
  }
  return context;
}

const REPAIR_ROUNDS = 2;

/**
 * No provider result escapes without surviving the live registry's real kernel
 * door. A provider with a `repair` method gets up to two more proposals when a
 * candidate is rejected — each round fed the LATEST failed plan and its issues,
 * so the model corrects its own correction — and every repaired plan walks
 * through the identical validation. The final failure rejects with the final
 * round's issues.
 */
export async function generateAiPlan(options: GenerateAiPlanOptions): Promise<AiPlan> {
  const context = assembleAiContext(options.kernel.context, contextOptions(options));
  const live = liveOptions(options);
  let candidate: unknown = await options.provider.propose(options.request, context, live);
  const repair = options.provider.repair?.bind(options.provider);
  if (repair === undefined) {
    return assertValidAiPlan(candidate, options.kernel, options.validationPorts);
  }
  let result = validateAiPlan(candidate, options.kernel, options.validationPorts);
  for (let round = 0; round < REPAIR_ROUNDS && !result.ok; round += 1) {
    // The parse may have failed before a structured plan existed; hand the
    // server whatever shape it sent so it can see its own mistake.
    const attempted = isPlanShaped(candidate) ? candidate : { rationale: '', commands: [] };
    candidate = await repair(options.request, context, attempted, result.issues, live);
    result = validateAiPlan(candidate, options.kernel, options.validationPorts);
  }
  if (!result.ok) {
    throw new AiPlanRejectedError(result.issues);
  }
  return result.plan;
}

function isPlanShaped(candidate: unknown): candidate is AiPlan {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    'rationale' in candidate &&
    'commands' in candidate
  );
}
