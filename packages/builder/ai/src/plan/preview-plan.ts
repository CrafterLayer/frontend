import { isSiteCommandName, type BuilderKernel } from '@craftkit/builder-core';
import type { BuilderDocument } from '@craftkit/builder-schema';

import type { AiPlan, AiValidationPorts } from '../types';
import type { AiEffectiveCommandPolicy } from '../skills';
import {
  assertAuthenticatedAiValidatedProposal,
  resolveAiProposalAuthority,
  type AiValidatedProposal,
} from './validated-proposal';
import { assertValidAiPlan, createValidationKernel } from './validate-plan';

interface PreviewAiPlanOptionsBase {
  kernel: BuilderKernel;
  validationPorts: AiValidationPorts;
}

export interface PreviewAiValidatedProposalOptions extends PreviewAiPlanOptionsBase {
  proposal: AiValidatedProposal;
  plan?: never;
  policy?: never;
}

export interface PreviewAiPlanCompatibilityOptions extends PreviewAiPlanOptionsBase {
  proposal?: never;
  plan: AiPlan;
  policy: AiEffectiveCommandPolicy;
}

export type PreviewAiPlanOptions =
  PreviewAiValidatedProposalOptions | PreviewAiPlanCompatibilityOptions;

/**
 * The WOULD-BE document: the plan validated through the usual door, then
 * replayed on a fresh scratch kernel whose result is handed back for a UI to
 * render. Nothing here touches the live kernel, its history, or its ports —
 * preview is a rehearsal a person watches, and Apply afterwards still goes
 * through `applyAiPlan` like every other change.
 */
export function previewAiPlan(options: PreviewAiPlanOptions): BuilderDocument {
  const authority = resolveAiProposalAuthority(options);
  const plan = assertValidAiPlan(
    authority.plan,
    options.kernel,
    options.validationPorts,
    authority.policy,
  );
  const scratch = createValidationKernel(plan, options.kernel, options.validationPorts);
  if (authority.proposal !== undefined) {
    assertAuthenticatedAiValidatedProposal(authority.proposal);
  }
  // The would-be PAGE: site steps (palette, named styles) change the site, not this document.
  const pageSteps = plan.commands.filter((step) => !isSiteCommandName(step.command));
  if (pageSteps.length === 0) return scratch.getDocument();
  scratch.dispatchGroup(
    pageSteps.map((step) => ({ command: step.command, args: step.args })),
    { author: 'ai', label: 'AI plan preview' },
  );
  return scratch.getDocument();
}
