import type { BuilderKernel } from '@craftkit/builder-core';
import type { BuilderDocument } from '@craftkit/builder-schema';

import type { AiPlan, AiValidationPorts } from '../types';
import { assertValidAiPlan, createValidationKernel } from './validate-plan';

export interface PreviewAiPlanOptions {
  kernel: BuilderKernel;
  plan: AiPlan;
  validationPorts: AiValidationPorts;
}

/**
 * The WOULD-BE document: the plan validated through the usual door, then
 * replayed on a fresh scratch kernel whose result is handed back for a UI to
 * render. Nothing here touches the live kernel, its history, or its ports —
 * preview is a rehearsal a person watches, and Apply afterwards still goes
 * through `applyAiPlan` like every other change.
 */
export function previewAiPlan(options: PreviewAiPlanOptions): BuilderDocument {
  const plan = assertValidAiPlan(options.plan, options.kernel, options.validationPorts);
  const scratch = createValidationKernel(plan, options.kernel, options.validationPorts);
  for (const step of plan.commands) {
    scratch.dispatch(step.command, step.args, 'ai');
  }
  return scratch.getDocument();
}
