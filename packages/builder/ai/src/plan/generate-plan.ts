import type { BuilderKernel } from '@craftkit/builder-core';
import type { AiContextProvider, NodeId } from '@craftkit/builder-schema';

import { assembleAiContext, type AssembleAiContextOptions } from '../context';
import type { AiPlan, AiPlanProvider, AiProposeOptions, AiValidationPorts } from '../types';
import { assertValidAiPlan, validateAiPlan } from './validate-plan';

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
}

function liveOptions(options: GenerateAiPlanOptions): AiProposeOptions {
  const live: AiProposeOptions = {};
  if (options.signal !== undefined) {
    live.signal = options.signal;
  }
  if (options.onProgress !== undefined) {
    live.onProgress = options.onProgress;
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

/**
 * No provider result escapes without surviving the live registry's real kernel
 * door. A provider with a `repair` method gets exactly one more proposal when
 * the first is rejected — fed the rejected plan and its issues — and that
 * repaired plan walks through the identical validation.
 */
export async function generateAiPlan(options: GenerateAiPlanOptions): Promise<AiPlan> {
  const context = assembleAiContext(options.kernel.context, contextOptions(options));
  const live = liveOptions(options);
  const candidate = await options.provider.propose(options.request, context, live);
  const repair = options.provider.repair?.bind(options.provider);
  if (repair === undefined) {
    return assertValidAiPlan(candidate, options.kernel, options.validationPorts);
  }
  const first = validateAiPlan(candidate, options.kernel, options.validationPorts);
  if (first.ok) {
    return first.plan;
  }
  // The parse may have failed before a structured plan existed; hand the
  // server whatever shape it sent so it can see its own mistake.
  const attempted = isPlanShaped(candidate) ? candidate : { rationale: '', commands: [] };
  const repaired = await repair(options.request, context, attempted, first.issues, live);
  return assertValidAiPlan(repaired, options.kernel, options.validationPorts);
}

function isPlanShaped(candidate: unknown): candidate is AiPlan {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    'rationale' in candidate &&
    'commands' in candidate
  );
}
