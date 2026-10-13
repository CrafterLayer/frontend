import { stepSkills } from './host-skills';
import { landingTarget } from './page-plan-context';
import { proposeValidatedPagePlan } from './page-plan-step';
import type { AiPagePlanEvent, PlanAiPageOptions, PlanAiPageResult } from './types';

export {
  PAGE_PLAN_STEP,
  ANOTHER_LOOK_LINE,
  anotherLookRequested,
  withRequestedLook,
  landingTarget,
  designMarkupFor,
  designMarkup,
  isArabicPage,
  fittingSkillIds,
  pagePlanningBrief,
} from './page-plan-context';
export { proposeValidatedPagePlan } from './page-plan-step';
export type { PagePlanStepInput, PagePlanStepNote } from './page-plan-step';

/**
 * Plan mode: step T1 alone. One `provider.proposePagePlan` call (plus at most
 * one repair round, fed `validatePagePlan`'s issues), returning the validated
 * plan. Writes NOTHING — no door, no transaction — so a person can read and
 * edit the plan before any section is paid for; `runAiBuild({ pagePlan })`
 * then builds exactly that plan.
 *
 * The step names its own skills (the direction deck, the section variants,
 * the copy rules, and the Arabic rules on an Arabic page) with auto-matching
 * off, so `selectedSkillIds` and `autoSkills` are not read. The photo catalog
 * is added for the request unless the host brings its own.
 *
 * With no `target`, the page decides by the build's own rule
 * (`landingTarget`): an empty or skeleton-only page is `replace`d, a page
 * with content is `append`ed to — so Plan mode, then Build, lands the page
 * exactly where a direct Build would.
 *
 * Never rejects for a provider failure, a refusal, an invalid plan or a
 * missing `proposePagePlan`: each becomes `{ error }` (the last case with code
 * `'unsupported'`). The caller's abort rejects with the platform AbortError,
 * as every run does.
 */
export async function planAiPage(
  request: string,
  options: PlanAiPageOptions,
): Promise<PlanAiPageResult> {
  if (
    typeof options.runId !== 'string' ||
    options.runId.trim().length === 0 ||
    options.runId.length > 160
  ) {
    throw new RangeError('runId must be a non-empty string of at most 160 characters.');
  }
  let seq = 0;
  const emit = (payload: DistributiveOmit<AiPagePlanEvent, 'runId' | 'seq' | 'at'>): void => {
    const event = Object.freeze({
      ...payload,
      runId: options.runId,
      seq,
      at: options.clock.now(),
    }) as AiPagePlanEvent;
    seq += 1;
    try {
      options.onEvent?.(event);
    } catch {
      // Observers are telemetry consumers; they cannot steer the plan.
    }
  };
  const isCurrentRun = options.isCurrentRun;
  return proposeValidatedPagePlan(
    {
      runId: options.runId,
      kernel: options.kernel,
      provider: options.provider,
      request,
      ...(options.history === undefined ? {} : { history: options.history }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
      ...(isCurrentRun === undefined
        ? {}
        : {
            isCurrentRun: (): boolean => {
              // Read as unknown: a host port that answers anything but `true` holds no lease.
              const current: unknown = isCurrentRun(options.runId);
              return current === true;
            },
          }),
      ...stepSkills(options),
      ...(options.policy === undefined ? {} : { policy: options.policy }),
      ...(options.composition === undefined ? {} : { composition: options.composition }),
      ...(options.freeCode === true ? { freeCode: true } : {}),
      ...(options.contextProviders === undefined
        ? {}
        : { contextProviders: options.contextProviders }),
      ...(options.additionalContextProviders === undefined
        ? {}
        : { additionalContextProviders: options.additionalContextProviders }),
      target: landingTarget(options.kernel, options.target),
      ...(options.maxSections === undefined ? {} : { maxSections: options.maxSections }),
    },
    (step) => {
      switch (step.type) {
        case 'started':
          emit({ type: 'page-plan.started' });
          return;
        case 'progress':
          emit({ type: 'page-plan.progress', text: step.text });
          return;
        case 'proposing':
          emit({ type: 'page-plan.proposing', attempt: step.attempt });
          return;
        case 'usage':
          emit({ type: 'provider.usage', attemptId: step.attemptId, usage: step.usage });
          return;
        case 'repairing':
          emit({ type: 'page-plan.repairing', issues: step.issues });
          return;
        case 'ready':
          emit({ type: 'page-plan.ready', plan: step.plan });
          return;
        case 'failed':
          emit({ type: 'page-plan.failed', error: step.error });
          return;
        default:
          return;
      }
    },
  );
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
