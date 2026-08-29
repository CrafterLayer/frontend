import type { BuilderKernel } from '@craftkit/builder-core';
import type { Transaction } from '@craftkit/builder-schema';

import type { AiPlan, AiValidationPorts } from '../types';
import { assertValidAiPlan } from './validate-plan';

export interface AppliedAiPlan {
  /** The current kernel has no grouping API; each command passes through dispatch in order. */
  mode: 'sequence';
  transactions: readonly Transaction[];
}

export interface ApplyAiPlanOptions {
  kernel: BuilderKernel;
  plan: AiPlan;
  validationPorts: AiValidationPorts;
}

export function applyAiPlan(options: ApplyAiPlanOptions): AppliedAiPlan {
  const plan = assertValidAiPlan(options.plan, options.kernel, options.validationPorts);
  const transactions = plan.commands.map((step) =>
    options.kernel.dispatch(step.command, step.args, 'ai'),
  );
  return { mode: 'sequence', transactions };
}
