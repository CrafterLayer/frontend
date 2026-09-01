import { GROUPED_DISPATCH_LABEL_MAX_LENGTH, type BuilderKernel } from '@craftkit/builder-core';
import type { Transaction } from '@craftkit/builder-schema';

import type { AiPlan, AiValidationPorts } from '../types';
import type { AiEffectiveCommandPolicy } from '../skills';
import {
  assertAuthenticatedAiValidatedProposal,
  resolveAiProposalAuthority,
  type AiValidatedProposal,
} from './validated-proposal';
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
  /** Present when the authenticated proposal path owned this application. */
  proposal?: AiValidatedProposal;
}

interface ApplyAiPlanOptionsBase {
  kernel: BuilderKernel;
  validationPorts: AiValidationPorts;
  /** Human history label. The core door validates explicitly supplied values. */
  label?: string;
}

export interface ApplyAiValidatedProposalOptions extends ApplyAiPlanOptionsBase {
  proposal: AiValidatedProposal;
  plan?: never;
  policy?: never;
}

export interface ApplyAiPlanCompatibilityOptions extends ApplyAiPlanOptionsBase {
  proposal?: never;
  plan: AiPlan;
  /** Required at type and runtime; compatibility never infers generation authority. */
  policy: AiEffectiveCommandPolicy;
}

export type ApplyAiPlanOptions = ApplyAiValidatedProposalOptions | ApplyAiPlanCompatibilityOptions;

function defaultLabel(plan: AiPlan): string {
  const detail = plan.rationale.replace(/\s+/g, ' ').trim();
  return `AI: ${detail}`.slice(0, GROUPED_DISPATCH_LABEL_MAX_LENGTH);
}

export function applyAiPlan(options: ApplyAiPlanOptions): AppliedAiPlan {
  const authority = resolveAiProposalAuthority(options);
  const plan = assertValidAiPlan(
    authority.plan,
    options.kernel,
    options.validationPorts,
    authority.policy,
  );
  // Keep the authentication check adjacent to the only live mutation door.
  if (authority.proposal !== undefined) {
    assertAuthenticatedAiValidatedProposal(authority.proposal);
  }
  const tx = options.kernel.dispatchGroup(
    plan.commands.map((step) => ({ command: step.command, args: step.args })),
    { author: 'ai', label: options.label ?? defaultLabel(plan) },
  );
  return {
    mode: 'group',
    transactions: [tx],
    ...(authority.proposal === undefined ? {} : { proposal: authority.proposal }),
  };
}
