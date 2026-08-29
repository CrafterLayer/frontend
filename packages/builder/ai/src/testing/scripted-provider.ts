import type { AiPlan, AiPlanProvider } from '../types';

/** Consumer-test helper for exercising rejection and application paths without a model. */
export function createScriptedAiPlanProvider(plan: AiPlan): AiPlanProvider {
  return {
    propose() {
      return Promise.resolve(plan);
    },
  };
}
