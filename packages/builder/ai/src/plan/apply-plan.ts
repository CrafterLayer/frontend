import { GROUPED_DISPATCH_LABEL_MAX_LENGTH, type BuilderKernel } from '@craftkit/builder-core';
import type { Transaction } from '@craftkit/builder-schema';

import type { AiPlan, AiValidationPorts } from '../types';
import type { AiEffectiveCommandPolicy } from '../skills';
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
  /** Rechecked immediately before the live grouped door. */
  policy?: AiEffectiveCommandPolicy;
  /** Human history label. The core door validates explicitly supplied values. */
  label?: string;
}

function defaultLabel(plan: AiPlan): string {
  const detail = plan.rationale.replace(/\s+/g, ' ').trim();
  return `AI: ${detail}`.slice(0, GROUPED_DISPATCH_LABEL_MAX_LENGTH);
}

export function applyAiPlan(options: ApplyAiPlanOptions): AppliedAiPlan {
  const plan = assertValidAiPlan(
    options.plan,
    options.kernel,
    options.validationPorts,
    options.policy,
  );
  const tx = options.kernel.dispatchGroup(
    plan.commands.map((step) => ({ command: step.command, args: step.args })),
    { author: 'ai', label: options.label ?? defaultLabel(plan) },
  );
  return { mode: 'group', transactions: [tx] };
}
