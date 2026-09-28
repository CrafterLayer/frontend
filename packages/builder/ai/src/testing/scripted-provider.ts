import type {
  AiPagePlanAttempt,
  AiPagePlanProposal,
  AiPlan,
  AiPlanProvider,
  PagePlanCandidate,
} from '../types';

export interface ScriptedAiPlanProviderOptions {
  /**
   * Makes the provider answer `proposePagePlan`: a fixed candidate, or a
   * function of the request and the repair attempt (absent on the first call),
   * so a test can script "invalid first, fixed on repair". Absent = the
   * provider has no `proposePagePlan`, like every provider written before it.
   */
  readonly pagePlan?:
    | PagePlanCandidate
    | ((request: string, attempt: AiPagePlanAttempt | undefined) => PagePlanCandidate);
  /** The `rationale` every page-plan answer carries. */
  readonly rationale?: string;
}

/** Consumer-test helper for exercising rejection and application paths without a model. */
export function createScriptedAiPlanProvider(
  plan: AiPlan,
  options: ScriptedAiPlanProviderOptions = {},
): AiPlanProvider {
  const { pagePlan, rationale } = options;
  return {
    propose() {
      return Promise.resolve(plan);
    },
    ...(pagePlan === undefined
      ? {}
      : {
          proposePagePlan(request, _context, live): Promise<AiPagePlanProposal> {
            const candidate =
              typeof pagePlan === 'function' ? pagePlan(request, live?.attempt) : pagePlan;
            return Promise.resolve({
              pagePlan: candidate,
              ...(rationale === undefined ? {} : { rationale }),
            });
          },
        }),
  };
}
