import type { PlanAiPageOptions, PlanAiPageResult } from '../types';

/**
 * Plan mode: step T1 alone. One `provider.proposePagePlan` call (plus at most
 * one repair round, fed `validatePagePlan`'s issues), returning the validated
 * plan. Writes NOTHING — no door, no transaction — so a person can read and
 * edit the plan before any section is paid for; `runAiBuild({ pagePlan })`
 * then builds exactly that plan.
 *
 * Never rejects for a provider failure, a refusal, an invalid plan or a
 * missing `proposePagePlan`: each becomes `{ error }` (the last case with code
 * `'unsupported'`). The caller's abort rejects with the platform AbortError,
 * as every run does.
 */
export function planAiPage(request: string, options: PlanAiPageOptions): Promise<PlanAiPageResult> {
  void request;
  void options;
  return Promise.reject(new Error('not implemented: planAiPage'));
}
