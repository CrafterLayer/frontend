import type { BuilderKernel } from '@craftkit/builder-core';
import type { AiContextProvider, NodeId } from '@craftkit/builder-schema';

import { assembleAiContext, type AssembleAiContextOptions } from '../context';
import type { AiPlan, AiPlanProvider, AiValidationPorts } from '../types';
import { assertValidAiPlan } from './validate-plan';

export interface GenerateAiPlanOptions {
  kernel: BuilderKernel;
  provider: AiPlanProvider;
  request: string;
  validationPorts: AiValidationPorts;
  selection?: readonly NodeId[];
  contextProviders?: readonly AiContextProvider[];
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

/** No provider result escapes without surviving the live registry's real kernel door. */
export async function generateAiPlan(options: GenerateAiPlanOptions): Promise<AiPlan> {
  const context = assembleAiContext(options.kernel.context, contextOptions(options));
  const candidate = await options.provider.propose(options.request, context);
  return assertValidAiPlan(candidate, options.kernel, options.validationPorts);
}
