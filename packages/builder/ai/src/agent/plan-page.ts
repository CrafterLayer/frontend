import type { BuilderKernel } from '@craftkit/builder-core';
import {
  CUSTOM_CODE_ATTRIBUTES,
  CUSTOM_CODE_TAGS,
  type AiContextProvider,
} from '@craftkit/builder-schema';

import { assembleAiContext, type AiCompositionPolicy } from '../context';
import {
  createPhotoCatalogContextProvider,
  PHOTO_CATALOG_PROVIDER_ID,
} from '../context/providers/photo-catalog';
import { normalizeArabic, summarizeDocumentForIntent, type IntentTarget } from '../intent';
import { AiContextBudgetError, DEFAULT_AI_CONTEXT_TOKEN_BUDGET } from '../plan/generate-plan';
import { AI_PLAN_WIRE_VERSION, estimateAiPlanWireRequestTokens } from '../provider/wire';
import type { AiPreparedSkillContext, AiSkillRegistry } from '../skills';
import type {
  AiChatTurn,
  AiPagePlanAttempt,
  AiPlanProvider,
  AiProposePagePlanOptions,
  AssembledAiContext,
  PagePlanCandidate,
} from '../types';
import { classifyAiRunFailure, type AiRunFailure } from './errors';
import { PAGE_PLAN_MAX_SECTIONS, type PagePlan, type PagePlanIssue } from './page-plan/types';
import { validatePagePlan } from './page-plan/validate-page-plan';
import type { AiAgentPolicy, AiPagePlanEvent, PlanAiPageOptions, PlanAiPageResult } from './types';

/*
  STEP T1 of the page build (agent-audit §3.1, 2026-09-28): one model call that
  answers with a PAGE PLAN — tokens, fonts, one contract per section — instead
  of kernel commands. `planAiPage` is Plan mode's whole run; `runAiBuild` runs
  the same step first and builds what it returns, so the plan a person saw is
  the plan that gets built (P1-7b).

  Nothing here reaches the kernel door. A plan is validated by
  `validatePagePlan`, which is to a page plan what the door is to an `AiPlan`:
  the only way untrusted model output becomes something the build acts on.
*/

/** The step's id under a build: its events carry `<build>/page-plan`. */
export const PAGE_PLAN_STEP = 'page-plan';

const DIRECTION_DECK = 'craftkit.direction-deck';
const SECTION_VARIANTS = 'craftkit.section-variants';
const COPYWRITING = 'craftkit.copywriting';
const ARABIC_RTL = 'craftkit.arabic-rtl';

const ARABIC_SCRIPT = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/u;
const ARABIC_LANG = /^ar\b/u;

/** The line the direction deck reads: "VARIANT: B in the request swaps ground and band". */
export const ANOTHER_LOOK_LINE = 'VARIANT: B';

/*
  "Try another look", in the words people type. The deck's row gives every page
  an A look and a B look (ground and band swapped), and the B look is reached
  only through this line in the request — without it the tenth regeneration of
  a café page was the first one again (page-power.md §1.2, 2026-09-28). The
  host has no button for it yet (grep 2026-09-28: no "another look" signal in
  apps/ or packages/), so the person's own words are the signal, and a host
  that grows a button sends the line itself.

  Matched on text folded by the intent router's `normalizeArabic` (hamza,
  taa marbuta, alif maqsura and tashkeel folded), whole words only.

  The indefinite nouns and the adjectives take an optional trailing alif: MSA
  accusative with tanween ("جرّب شكلاً آخر", "أريد مظهرًا مختلفًا") folds to
  "شكلا"/"مظهرا"/"مختلفا", and the wave-1 verifier found four such phrasings
  read as no request (2026-09-28). "أريد" is NOT a lead verb: "أريد تصميم
  صفحة لمطعمي" is a first build, and with a bare noun it would read as
  another look — so it counts only through the noun-adjective pair.
*/
const ANOTHER_LOOK_EN =
  /\b(?:another|different|other|alternative|second|fresh)\s+(?:look|style|design|palette|colou?r\s+scheme)\b|\bnew\s+look\b|\bvariant:?\s*b\b/iu;
const ANOTHER_LOOK_AR_NOUN =
  '(?:(?:شكل|ستايل|تصميم|مظهر|لوك)ا?|الشكل|الستايل|التصميم|المظهر|اللوك)';
const ANOTHER_LOOK_AR = new RegExp(
  [
    `(?:^|\\s)${ANOTHER_LOOK_AR_NOUN}\\s+(?:اخر|ثاني|تاني|مختلف|جديد)ا?(?=\\s|$|[.!؟?،,])`,
    `(?:^|\\s)(?:غير|غيري|غيروا|بدل|بدلي|جرب|جربي|جربوا)\\s+${ANOTHER_LOOK_AR_NOUN}(?=\\s|$|[.!؟?،,])`,
  ].join('|'),
  'u',
);

/** Whether the person asked for the other look of the page's direction. */
export function anotherLookRequested(request: string): boolean {
  if (ANOTHER_LOOK_EN.test(request)) return true;
  const folded = normalizeArabic(request).replace(/[ًٌٍَُِّْ]/gu, '');
  return ANOTHER_LOOK_AR.test(folded);
}

/** The request as the planning step sends it: the person's words, plus the B line when asked. */
export function withRequestedLook(request: string): string {
  if (!anotherLookRequested(request) || request.includes(ANOTHER_LOOK_LINE)) return request;
  return `${request}\n${ANOTHER_LOOK_LINE}`;
}

/*
  Where the page lands, said to the planner up front. The validator forces the
  host's target onto the plan's intent, and an intent's shape rules differ
  (appended sections carry no header, hero or footer): a planner that was not
  told would learn it only from a refusal, and a refusal costs a whole repair
  call.
*/
const INTENT_LINE: Readonly<Record<IntentTarget, string>> = {
  'new-page':
    'INTENT: new-page — a whole new page: optionally a header first, then one hero, then bands, optionally a footer last.',
  replace:
    'INTENT: replace — a whole page that replaces what the page holds now: optionally a header first, then one hero, then bands, optionally a footer last.',
  append:
    'INTENT: append — sections added to a page that already has its header, hero and footer: bands and calls to action only.',
};

/**
 * Where the page lands when the host did not say (P1-15): an empty page, or
 * one holding only an unfilled skeleton, is REPLACED — the "append" of a whole
 * page with a hero would be refused by the validator's shape rules, and there
 * is nothing to keep; a page with content gets sections APPENDED, the one
 * target that never removes or restyles what a person made. A host that wants
 * a new page beside this one (the router's `new-page`) adds that page and
 * builds on it.
 *
 * ONE rule for Plan mode and Build: before it was shared, a `planAiPage` with
 * no target let the model's intent stand, so on a page with seven regions
 * Plan mode's plan said 'replace' and its Build replaced the page, while a
 * direct Build there was told 'append' (wave-1 verifier, 2026-09-28).
 *
 * @internal Shared with the build.
 */
export function landingTarget(
  kernel: BuilderKernel,
  target: IntentTarget | undefined,
): IntentTarget {
  if (target !== undefined) return target;
  const summary = summarizeDocumentForIntent(kernel.getDocument());
  return summary.nodeCount === 0 || summary.placeholderOnly ? 'replace' : 'append';
}

/*
  DESIGN CODE: the markup a section writer may reach for beyond sections,
  cards and lists, each named only while the tree vocabulary admits it. The
  design-code owner is adding these to CUSTOM_CODE_TAGS and
  CUSTOM_CODE_ATTRIBUTES (2026-09-28); a brief that names a tag the door
  refuses buys one repair round per use (25-40 s measured 2026-09-27), so the
  line is read from the vocabulary, never written ahead of it. A group counts
  when its first tag, and every attribute it needs, is admitted.
*/
const DESIGN_MARKUP: readonly {
  readonly use: string;
  readonly tags: readonly string[];
  readonly attributes?: readonly string[];
}[] = [
  { use: 'a disclosure: FAQ answers, "more"', tags: ['details', 'summary'] },
  {
    use: 'a table: prices, hours, a comparison',
    tags: ['table', 'caption', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td'],
  },
  {
    use: 'svg shapes: a divider, a blob, a mark',
    tags: ['svg', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'g'],
  },
  {
    use: 'a popover: a button with popovertarget opens the element with popover',
    tags: [],
    attributes: ['popover', 'popovertarget'],
  },
  { use: 'a video: muted, looping, playsinline, with a poster', tags: ['video', 'source'] },
];

/**
 * The design markup a vocabulary admits, one `tags (use)` entry per group,
 * joined with " · "; '' when it admits none of them.
 *
 * @internal Exported for its test; `designMarkup` is the one caller.
 */
export function designMarkupFor(
  tags: ReadonlySet<string>,
  attributes: ReadonlySet<string>,
): string {
  return DESIGN_MARKUP.flatMap(({ use, tags: wanted, attributes: needs = [] }) => {
    const [first] = wanted;
    if (first !== undefined && !tags.has(first)) return [];
    if (!needs.every((name) => attributes.has(name))) return [];
    const admitted = wanted.filter((tag) => tags.has(tag));
    return [`${(admitted.length === 0 ? needs : admitted).join('/')} (${use})`];
  }).join(' · ');
}

/**
 * The design markup the tree vocabulary admits TODAY (`CUSTOM_CODE_TAGS`,
 * `CUSTOM_CODE_ATTRIBUTES`).
 *
 * @internal Shared with the build's section contract.
 */
export function designMarkup(): string {
  return designMarkupFor(
    new Set<string>(CUSTOM_CODE_TAGS),
    new Set<string>(CUSTOM_CODE_ATTRIBUTES),
  );
}

/*
  The planner decides the SIGNATURE and each section's variant, so it is told
  what the writers can build with: region css and the richer markup. Without
  it a signature was a sentence the writers could only approximate with
  utilities, and a FAQ could only ever be a list.
*/
function designLine(): string {
  const markup = designMarkup();
  return `DESIGN CODE: each section's writer may build effects in its own region css — ck- classes over var(--ck-…): gradients, masks, clip-path, grain, keyframes${markup === '' ? '' : `, and markup such as ${markup}`}. Make tokens.signature an effect a writer can build with them.`;
}

/** The request as the planner reads it: the person's words, the B line when asked, where it lands, what writers can build. */
function planningRequest(request: string, target: IntentTarget | undefined): string {
  const asked = withRequestedLook(request);
  return [asked, ...(target === undefined ? [] : [INTENT_LINE[target]]), designLine()].join('\n');
}

/** Whether the page being planned is in Arabic: the words, the page's direction, or its lang. */
export function isArabicPage(kernel: BuilderKernel, ...texts: readonly string[]): boolean {
  if (texts.some((text) => ARABIC_SCRIPT.test(text))) return true;
  const document = kernel.getDocument();
  if (document.dir === 'rtl') return true;
  const lang: unknown = document.nodes[document.rootId]?.props['lang'];
  return typeof lang === 'string' && ARABIC_LANG.test(lang);
}

/**
 * The skills a step asks for by name, each only when the registry has it, and
 * only as many as fit.
 *
 * Explicit skills are MANDATORY to the resolver: one that does not fit the
 * skill budget fails the whole run rather than being left out. A section
 * writer that could not start because a photo catalog outgrew the budget would
 * cost the page every section, so the optional names are shed from the end
 * until the set resolves. The required head is never shed — a registry that
 * cannot hold it fails the step exactly as it did before.
 *
 * @internal Shared with the build.
 */
export function fittingSkillIds(
  registry: AiSkillRegistry | undefined,
  policy: Partial<AiAgentPolicy> | undefined,
  required: readonly string[],
  optional: readonly string[],
): readonly string[] {
  if (registry === undefined) return required;
  const present = optional.filter((id) => registry.get(id) !== undefined);
  for (let keep = present.length; keep > 0; keep -= 1) {
    const ids = [...required, ...present.slice(0, keep)];
    try {
      registry.prepare({
        request: '',
        selectedSkillIds: ids,
        auto: false,
        ...(policy?.allowUntrustedSkills === undefined
          ? {}
          : { allowUntrusted: policy.allowUntrustedSkills }),
        ...(policy?.maxActiveSkills === undefined
          ? {}
          : { maxActiveSkills: policy.maxActiveSkills }),
        ...(policy?.maxSkillTokens === undefined ? {} : { maxSkillTokens: policy.maxSkillTokens }),
      });
      return Object.freeze(ids);
    } catch {
      // Too much for the budget, or refused: try with one optional skill fewer.
    }
  }
  return required;
}

/**
 * What the planner is taught: the deck (trade rows with palettes, faces and a
 * variant per section), the variant library it names from, the copy rules and,
 * on an Arabic page, the Arabic rules. Named rather than matched — the page
 * archetypes' auto skills are markup recipes, ~2.7k tokens each of rules for
 * writing sections, and a plan writes none.
 */
function planSkillIds(
  registry: AiSkillRegistry | undefined,
  policy: Partial<AiAgentPolicy> | undefined,
  arabic: boolean,
): readonly string[] {
  return fittingSkillIds(
    registry,
    policy,
    [],
    [DIRECTION_DECK, SECTION_VARIANTS, COPYWRITING, ...(arabic ? [ARABIC_RTL] : [])],
  );
}

/**
 * The catalog view a plan needs: none. A plan names section-variant ids and
 * token values, never a block type or a prop, and the document is shown as its
 * shape — every region's tree summarised to its heading — because what the
 * page already says is the only part of it a plan must not contradict.
 */
function planComposition(composition: AiCompositionPolicy | undefined): AiCompositionPolicy {
  return {
    ...composition,
    catalogMode: 'none',
    alwaysDetailedBlockTypes: [],
    documentTreeMode: 'scoped',
    treeScopeNodeIds: [],
  };
}

/** @internal What the planning step needs, from a build or from Plan mode. */
export interface PagePlanStepInput {
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
}

/** @internal What the step reports while it works. */
export type PagePlanStepNote =
  | { readonly type: 'started' }
  | { readonly type: 'context'; readonly context: AssembledAiContext }
  | { readonly type: 'skills'; readonly skills: AiPreparedSkillContext | undefined }
  | { readonly type: 'proposing'; readonly attempt: 1 | 2 }
  | { readonly type: 'progress'; readonly text: string }
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
 * Step T1: propose, validate, repair once with the validator's issues,
 * validate again. Never rejects except for the caller's abort (or a lease
 * lost), which rejects with the platform AbortError as every run does; every
 * other failure — no `proposePagePlan`, a provider error, a refusal, a plan
 * refused twice — comes back as `{ error }`, because the build falls back to
 * its skeleton run on any of them and a plan card shows them.
 *
 * @internal Shared by `planAiPage` and `runAiBuild`.
 */
export async function proposeValidatedPagePlan(
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

  try {
    assertActive();
    note({ type: 'started' });
    const request = planningRequest(input.request, input.target);
    const arabic = isArabicPage(input.kernel, input.request);
    const registry = input.skillRegistry;
    const selectedSkillIds = planSkillIds(registry, input.policy, arabic);
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

    /*
      The photos the plan may assign by subject. A host's own photo provider
      wins (its brief may be better than the request); otherwise the request
      is the brief.
    */
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
    const assertBudget = (attempt?: AiPagePlanAttempt): void => {
      const estimated = estimateAiPlanWireRequestTokens({
        version: AI_PLAN_WIRE_VERSION,
        request,
        context,
        ...(input.history === undefined ? {} : { history: input.history }),
        task: 'page-plan',
        ...(attempt === undefined ? {} : { pagePlanAttempt: attempt }),
      });
      if (estimated > maxContextTokens) throw new AiContextBudgetError(estimated, maxContextTokens);
    };

    const ask = async (attempt?: AiPagePlanAttempt) => {
      assertBudget(attempt);
      assertActive();
      note({ type: 'proposing', attempt: attempt === undefined ? 1 : 2 });
      const live: AiProposePagePlanOptions = {
        ...(input.signal === undefined ? {} : { signal: input.signal }),
        ...(input.history === undefined ? {} : { history: input.history }),
        onProgress: (text: string) => {
          if (active() && text.trim().length > 0) note({ type: 'progress', text });
        },
        ...(attempt === undefined ? {} : { attempt }),
      };
      const answer = await propose(request, context, live);
      assertActive();
      return answer;
    };

    const validation = {
      ...(input.target === undefined ? {} : { intent: input.target }),
      maxSections: input.maxSections ?? PAGE_PLAN_MAX_SECTIONS,
    };
    const first = await ask();
    const firstCandidate: PagePlanCandidate = first.pagePlan;
    const checked = validatePagePlan(firstCandidate, validation);
    if (checked.ok) {
      note({ type: 'ready', plan: checked.plan });
      return Object.freeze({
        plan: checked.plan,
        attempts: 1 as const,
        ...(first.rationale === undefined ? {} : { rationale: first.rationale }),
      });
    }

    note({ type: 'repairing', issues: checked.issues });
    const second = await ask({ pagePlan: firstCandidate, issues: checked.issues });
    const repaired = validatePagePlan(second.pagePlan, validation);
    if (!repaired.ok) return fail(rejected(repaired.issues), repaired.issues);
    note({ type: 'ready', plan: repaired.plan });
    const rationale = second.rationale ?? first.rationale;
    return Object.freeze({
      plan: repaired.plan,
      attempts: 2 as const,
      ...(rationale === undefined ? {} : { rationale }),
    });
  } catch (cause) {
    if (isAbort(cause, input.signal)) throw cause;
    return fail(classifyAiRunFailure(cause));
  }
}

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
      ...(isCurrentRun === undefined
        ? {}
        : {
            isCurrentRun: (): boolean => {
              // Read as unknown: a host port that answers anything but `true` holds no lease.
              const current: unknown = isCurrentRun(options.runId);
              return current === true;
            },
          }),
      ...(options.skillRegistry === undefined ? {} : { skillRegistry: options.skillRegistry }),
      ...(options.policy === undefined ? {} : { policy: options.policy }),
      ...(options.composition === undefined ? {} : { composition: options.composition }),
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
