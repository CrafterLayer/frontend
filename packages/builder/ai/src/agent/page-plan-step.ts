import type { BuilderKernel } from '@craftkit/builder-core';
import type { AiContextProvider } from '@craftkit/builder-schema';
import { withHostSkills, type AiHostSkillOptions } from './host-skills';
import { assembleAiContext, type AiCompositionPolicy } from '../context';
import {
  createPhotoCatalogContextProvider,
  PHOTO_CATALOG_PROVIDER_ID,
} from '../context/providers/photo-catalog';
import type { IntentTarget } from '../intent';
import { DEFAULT_AI_CONTEXT_TOKEN_BUDGET } from '../plan/generate-plan';
import { fitAiPlanWireHistory } from '../plan/history-budget';
import { AI_PLAN_WIRE_VERSION } from '../provider/wire';
import { readProviderUsage } from '../provider/usage';
import { pixiSkillIdsFor } from '../skills/creative/pixi-selection';
import type { AiPreparedSkillContext, AiSkillRegistry } from '../skills';
import type {
  AiChatTurn,
  AiPagePlanAttempt,
  AiPagePlanDraftEvent,
  AiPlanProvider,
  AiProposePagePlanOptions,
  AiProviderUsage,
  AssembledAiContext,
  PagePlanCandidate,
} from '../types';
import { classifyAiRunFailure, type AiRunFailure } from './errors';
import { expandCompactPagePlan } from './page-plan/compact-plan';
import { PAGE_PLAN_MAX_SECTIONS, type PagePlan, type PagePlanIssue } from './page-plan/types';
import { validatePagePlan } from './page-plan/validate-page-plan';
import type { AiAgentPolicy, PlanAiPageResult } from './types';
import {
  isArabicPage,
  kitsAvailable,
  planningRequest,
  planSkillIds,
  planComposition,
} from './page-plan-context';
import { withinRunDeadline, type AiRunDeadlineOptions } from './run-deadline';
import { normalizeCancellation } from './run-events';

export async function proposeValidatedPagePlan(
  input: PagePlanStepInput,
  note: (note: PagePlanStepNote) => void,
): Promise<PlanAiPageResult> {
  if (input.provider.proposePagePlan === undefined) return Object.freeze({ error: unsupported() });
  try {
    return await withinRunDeadline(input, (live) => proposeActivePagePlan(live, note));
  } catch (cause) {
    if (isAbort(cause, input.signal))
      throw normalizeCancellation(input.signal?.aborted === true ? input.signal.reason : cause);
    const error = classifyAiRunFailure(cause);
    note({ type: 'failed', error });
    return Object.freeze({ error });
  }
}

/** @internal What the planning step needs, from a build or from Plan mode. */
export interface PagePlanStepInput extends AiHostSkillOptions, AiRunDeadlineOptions {
  readonly runId: string;
  readonly kernel: BuilderKernel;
  readonly provider: AiPlanProvider;
  readonly request: string;
  readonly history?: readonly AiChatTurn[];
  readonly signal?: AbortSignal;
  /** The lease check, already bound to the id the host issued. */
  readonly isCurrentRun?: () => boolean;
  readonly skillRegistry?: AiSkillRegistry;
  readonly policy?: Partial<AiAgentPolicy>;
  readonly composition?: AiCompositionPolicy;
  readonly contextProviders?: readonly AiContextProvider[];
  readonly additionalContextProviders?: readonly AiContextProvider[];
  readonly target?: IntentTarget;
  readonly maxSections?: number;
  /** Free code mode (`RunAiAgentOptions.freeCode`): both attempts' requests carry `freeCode: true`. */
  readonly freeCode?: boolean;
  /**
   * The streamed answer's text (DESIGN §6.2, 2026-10-05), forwarded to the
   * provider's `live.onDraft` on BOTH attempts — a `start` opens each
   * response, so an observer can tell the repair answer from the first.
   * Advisory: the validated plan this step returns is the authority.
   */
  readonly onDraft?: (event: AiPagePlanDraftEvent) => void;
}

/** @internal What the step reports while it works. */
export type PagePlanStepNote =
  | { readonly type: 'started' }
  | { readonly type: 'context'; readonly context: AssembledAiContext }
  | { readonly type: 'skills'; readonly skills: AiPreparedSkillContext | undefined }
  | { readonly type: 'proposing'; readonly attempt: 1 | 2 }
  | { readonly type: 'progress'; readonly text: string }
  | { readonly type: 'usage'; readonly attemptId: string; readonly usage: AiProviderUsage }
  | { readonly type: 'repairing'; readonly issues: readonly PagePlanIssue[] }
  | { readonly type: 'ready'; readonly plan: PagePlan }
  | { readonly type: 'failed'; readonly error: AiRunFailure };

function abortError(message: string): Error {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

function isAbort(cause: unknown, signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true || (cause instanceof Error && cause.name === 'AbortError');
}

function unsupported(): AiRunFailure {
  return Object.freeze({
    source: 'provider' as const,
    code: 'unsupported',
    message:
      'This assistant cannot write a page plan (its provider has no proposePagePlan); the build plans with a skeleton instead.',
    retryable: false,
  });
}

function rejected(issues: readonly PagePlanIssue[]): AiRunFailure {
  return Object.freeze({
    source: 'plan' as const,
    code: 'plan-rejected',
    message: `The page plan was refused twice: ${issues
      .slice(0, 3)
      .map(({ path, message }) => `${path === '' ? '' : `${path}: `}${message}`)
      .join(' ')}`,
    retryable: false,
  });
}

/**
 * A compact answer — briefs, or an outline whose sections carry no purpose of
 * their own — in the classic shape the validator read (DESIGN §6.2). A
 * classic answer is quoted exactly as the model wrote it: the expansion also
 * fills its defaults (`mustSay: []`), and the repair should see its own plan.
 */
function classicShape(candidate: PagePlanCandidate): PagePlanCandidate {
  const sections = candidate['sections'];
  const compact =
    'briefs' in candidate ||
    (Array.isArray(sections) &&
      sections.some(
        (section: unknown) =>
          typeof section === 'object' &&
          section !== null &&
          typeof (section as { purpose?: unknown }).purpose !== 'string',
      ));
  if (!compact) return candidate;
  const expanded: unknown = expandCompactPagePlan(candidate).value;
  return typeof expanded === 'object' && expanded !== null && !Array.isArray(expanded)
    ? (expanded as PagePlanCandidate)
    : candidate;
}

/**
 * Step T1: propose, validate, repair once with the validator's issues,
 * validate again. Never rejects except for the caller's abort (or a lease
 * lost), which rejects with the platform AbortError as every run does; every
 * other failure — no `proposePagePlan`, a provider error, a refusal, a plan
 * refused twice — comes back as `{ error }`, because the build falls back to
 * its skeleton run on any of them and a plan card shows them.
 *
 * @internal Shared by `planAiPage` and `runAiBuild`.
 */
async function proposeActivePagePlan(
  input: PagePlanStepInput,
  note: (note: PagePlanStepNote) => void,
): Promise<PlanAiPageResult> {
  const propose = input.provider.proposePagePlan?.bind(input.provider);
  if (propose === undefined) return Object.freeze({ error: unsupported() });

  const active = (): boolean => {
    if (input.signal?.aborted === true) return false;
    if (input.isCurrentRun === undefined) return true;
    try {
      return input.isCurrentRun();
    } catch {
      return false;
    }
  };
  const assertActive = (): void => {
    if (input.signal?.aborted === true) input.signal.throwIfAborted();
    if (!active()) throw abortError(`AI run "${input.runId}" was superseded by a newer run.`);
  };

  const fail = (error: AiRunFailure, issues?: readonly PagePlanIssue[]): PlanAiPageResult => {
    note({ type: 'failed', error });
    return Object.freeze(issues === undefined ? { error } : { error, issues });
  };

  assertActive();
  note({ type: 'started' });
  const request = planningRequest(input.request, input.target);
  const arabic = isArabicPage(input.kernel, input.request);
  const registry = input.skillRegistry;
  const selectedSkillIds = planSkillIds(
    registry,
    input.policy,
    arabic,
    kitsAvailable(),
    withHostSkills(input, pixiSkillIdsFor(registry, input.request, 'page-plan')),
  );
  const skills = registry?.prepare({
    request,
    // A page plan is a page, whatever the words read as on the page it lands on.
    intent: 'build-page',
    selectedSkillIds,
    auto: false,
    ...(input.policy?.allowUntrustedSkills === undefined
      ? {}
      : { allowUntrusted: input.policy.allowUntrustedSkills }),
    ...(input.policy?.maxActiveSkills === undefined
      ? {}
      : { maxActiveSkills: input.policy.maxActiveSkills }),
    ...(input.policy?.maxSkillTokens === undefined
      ? {}
      : { maxSkillTokens: input.policy.maxSkillTokens }),
  });
  note({ type: 'skills', skills });

  /* The photos the plan may assign by subject. A host's own photo provider wins (its brief
       may be better than the request); otherwise the request is the brief. History over the
       budget is fitted below (history-budget.ts): oldest exchanges first. */
  const hostProviders = [
    ...(input.contextProviders ?? []),
    ...(input.additionalContextProviders ?? []),
  ];
  const hasPhotos =
    hostProviders.some(({ id }) => id === PHOTO_CATALOG_PROVIDER_ID) ||
    input.kernel.context.registry
      .aiContextProviders()
      .some(({ id }) => id === PHOTO_CATALOG_PROVIDER_ID);
  const context = assembleAiContext(input.kernel.context, {
    selection: [],
    ...(input.contextProviders === undefined ? {} : { providers: input.contextProviders }),
    additionalContextProviders: [
      ...(input.additionalContextProviders ?? []),
      ...(hasPhotos ? [] : [createPhotoCatalogContextProvider({ brief: input.request })]),
    ],
    allowedCommands: [],
    ...(skills === undefined ? {} : { skillContext: skills }),
    composition: planComposition(input.composition),
    outline: true,
  });
  note({ type: 'context', context });

  const maxContextTokens = input.policy?.maxContextTokens ?? DEFAULT_AI_CONTEXT_TOKEN_BUDGET;
  const fitted = (attempt?: AiPagePlanAttempt): readonly AiChatTurn[] | undefined =>
    fitAiPlanWireHistory(
      {
        version: AI_PLAN_WIRE_VERSION,
        request,
        context,
        ...(input.history === undefined ? {} : { history: input.history }),
        task: 'page-plan',
        ...(attempt === undefined ? {} : { pagePlanAttempt: attempt }),
      },
      maxContextTokens,
    ).history;

  const ask = async (attempt?: AiPagePlanAttempt) => {
    const history = fitted(attempt);
    assertActive();
    note({ type: 'proposing', attempt: attempt === undefined ? 1 : 2 });
    let usageReported = false;
    const live: AiProposePagePlanOptions = {
      ...(input.signal === undefined ? {} : { signal: input.signal }),
      ...(history === undefined ? {} : { history }),
      onProgress: (text: string) => {
        if (active() && text.trim().length > 0) note({ type: 'progress', text });
      },
      onUsage: (value) => {
        if (usageReported || !active()) return;
        const usage = readProviderUsage(value);
        if (usage === undefined) return;
        usageReported = true;
        note({
          type: 'usage',
          attemptId: `${input.runId}/attempt-${attempt === undefined ? '1' : '2'}`,
          usage,
        });
      },
      ...(attempt === undefined ? {} : { attempt }),
      ...(input.onDraft === undefined
        ? {}
        : {
            onDraft: (event: AiPagePlanDraftEvent) => {
              if (active()) input.onDraft?.(event);
            },
          }),
      ...(input.freeCode === true || input.composition?.freeCode === true
        ? { freeCode: true }
        : {}),
    };
    const answer = await propose(request, context, live);
    assertActive();
    return answer;
  };

  const validation = {
    ...(input.target === undefined ? {} : { intent: input.target }),
    maxSections: input.maxSections ?? PAGE_PLAN_MAX_SECTIONS,
    // The planner's answer is completed in code: header, footer, menu, hero photo, contact details.
    completePage: true,
  };
  const first = await ask();
  const firstCandidate: PagePlanCandidate = first.pagePlan;
  const checked = validatePagePlan(firstCandidate, validation);
  assertActive();
  if (checked.ok) {
    note({ type: 'ready', plan: checked.plan });
    return Object.freeze({
      plan: checked.plan,
      attempts: 1 as const,
      ...(first.rationale === undefined ? {} : { rationale: first.rationale }),
    });
  }

  note({ type: 'repairing', issues: checked.issues });
  /*
      The repair quotes the plan in the CLASSIC shape the validator read
      (DESIGN §6.2): an issue at \`sections[3].purpose\` must point at a field
      the quoted plan has, and a compact answer keeps its purposes in
      \`briefs\`. A classic answer is quoted as it was — the expansion returns
      it unchanged.
    */
  const quoted = classicShape(firstCandidate);
  const second = await ask({ pagePlan: quoted, issues: checked.issues });
  const repaired = validatePagePlan(second.pagePlan, validation);
  assertActive();
  if (!repaired.ok) return fail(rejected(repaired.issues), repaired.issues);
  note({ type: 'ready', plan: repaired.plan });
  const rationale = second.rationale ?? first.rationale;
  return Object.freeze({
    plan: repaired.plan,
    attempts: 2 as const,
    ...(rationale === undefined ? {} : { rationale }),
  });
}
