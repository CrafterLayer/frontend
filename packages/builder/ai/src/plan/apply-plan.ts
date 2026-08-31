import type { BuilderKernel } from '@craftkit/builder-core';
import type { Transaction } from '@craftkit/builder-schema';

import type { AiPlan, AiValidationPorts } from '../types';
import { assertValidAiPlan } from './validate-plan';

export interface AppliedAiPlan {
  /**
   * 'group': the whole plan went through the kernel's grouped door as ONE
   * transaction — one history entry, one undo, atomic. This is what makes the
   * panel's "one entry in history, one undo" promise literally true for
   * multi-command plans.
   */
  mode: 'group';
  transactions: readonly Transaction[];
}

export interface ApplyAiPlanOptions {
  kernel: BuilderKernel;
  plan: AiPlan;
  validationPorts: AiValidationPorts;
}

export function applyAiPlan(options: ApplyAiPlanOptions): AppliedAiPlan {
  const plan = assertValidAiPlan(options.plan, options.kernel, options.validationPorts);
  const tx = options.kernel.dispatchGroup(
    plan.commands.map((step) => ({ command: step.command, args: step.args })),
    'ai',
  );
  return { mode: 'group', transactions: [tx] };
}
