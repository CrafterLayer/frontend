import type { BuilderKernel } from '@craftkit/builder-core';
import type { AiContextProvider, NodeId } from '@craftkit/builder-schema';

import {
  assembleAiContext,
  type AiCompositionPolicy,
  type AssembleAiContextOptions,
} from '../context';
import {
  createPhotoCatalogContextProvider,
  PHOTO_CATALOG_FRAGMENT_TITLE,
  PHOTO_CATALOG_PROVIDER_ID,
} from '../context/providers/photo-catalog';
import {
  routeIntent,
  summarizeDocumentForIntent,
  type IntentDocumentSummary,
  type IntentKind,
  type IntentRoute,
} from '../intent';
import { isAiProviderError } from '../provider/errors';
import {
  AI_PLAN_WIRE_VERSION,
  boundAiPlanWireInvalidOutputMessage,
  type AiPlanWireAttempt,
  type AiPlanWireRequest,
} from '../provider/wire';
import {
  AiCommandPolicyError,
  resolveAiCommandPolicy,
  type AiCommandPolicy,
  type AiEffectiveCommandPolicy,
  type AiPreparedSkillContext,
  type AiSkillRegistry,
} from '../skills';
import type {
  AiChatTurn,
  AiPlan,
  AiPlanProvider,
  AiProposeOptions,
  AiPlanValidationIssue,
  AiPlanValidationResult,
  AiValidationPorts,
  AssembledAiContext,
} from '../types';
import { loadArtCatalog, planNamesArt } from '../art-catalog/load';
import { withHistoryInBudget } from './history-budget';
import type { AgentToolLane } from '../tools/agent/types';
import type { SalvagedAiPlan } from './salvage-plan';
import {
  isPlanShaped,
  judgedCandidate,
  salvageOrReject,
  type AiPlanAcceptanceOptions,
} from './judge-plan';
import { AiPlanRejectedError } from './validate-plan';
// script-wiring additions
import { attachScriptCrossPage, crossPageOnlyPlan, planHasScriptStep } from '../script/cross-page';
import type { ScriptExpansion, ScriptRunReport, ScriptSite } from '../script/expand-scripts';
import { SCRIPT_TOOL_NAME, type ScriptRunner } from '../script/types';
// end script-wiring additions

export interface GenerateAiPlanOptions extends AiPlanAcceptanceOptions {
  kernel: BuilderKernel;
  provider: AiPlanProvider;
  request: string;
  validationPorts: AiValidationPorts;
  selection?: readonly NodeId[];
  /** Backward-compatible additive alias for additionalContextProviders. */
  contextProviders?: readonly AiContextProvider[];
  additionalContextProviders?: readonly AiContextProvider[];
  /** Cancels the provider's work for real; surfaces as the platform AbortError. */
  signal?: AbortSignal;
  /** Receives the provider's own live narration while it works. */
  onProgress?: (text: string) => void;
  /** The conversation so far, oldest first; lets follow-ups resolve their referent. */
  history?: readonly AiChatTurn[];
  /**
   * Keep the part of a rejected answer the door WILL accept, instead of losing
   * the whole run. Off by default: this primitive promises a plan or an error,
   * and a caller that is handed a quietly smaller plan cannot tell. Callers that
   * report to a person turn it on and pair it with `onSalvage`.
   */
  salvage?: boolean;
  /** What the salvage kept and what it had to drop, for a run that must say so. */
  onSalvage?: (salvaged: SalvagedAiPlan) => void;
  /** Immutable catalog used to resolve expertise for this request only. */
  skillRegistry?: AiSkillRegistry;
  selectedSkillIds?: readonly string[];
  allowUntrustedSkills?: boolean;
  maxActiveSkills?: number;
  maxSkillTokens?: number;
  /** Hard bound over the whole wire request; history gives way first (history-budget.ts). */
  maxContextTokens?: number;
  /**
   * agent-tools: sample values from the plan's facts ledger. Tool steps are
   * expanded with them, and SEO tools refuse to write any of them as data.
   */
  sampleValues?: readonly string[];
  /** agent-tools: only these lanes' tools may be named (a section writer: `['section']`); absent = every tool. */
  toolLanes?: readonly AgentToolLane[];
  /**
   * How much of the block registry this run may see. Omitted ⇒ the full
   * catalog. With `catalogMode: 'scoped'` and no explicit type list, the scope
   * is the selection's own block types — "the block the user pointed at".
   */
  composition?: AiCompositionPolicy;
  /** Session restrictions are intersected with the registry and active skills. */
  policy?: Partial<AiCommandPolicy>;
  /**
   * What the request is for, when the host has already routed it
   * (`routeIntent`, or the panel's `routeRequest`). Its `kind` gates the
   * page-level skills (`activation.intents`): a whole-page playbook loads for a
   * page or a site ask, never for an edit, a new section or a question.
   *
   * Absent, the request is routed HERE against the page it is about —
   * `document`, else `kernel.getDocument()` — with the run's selection. It
   * used to be routed against a blank page, where an edit with no change verb
   * reads as a brief: measured 2026-09-28, «رقم هاتف العيادة غلط» loaded
   * clinic-page (3,205 skill tokens) and the owner watched «تغيير عنوان قسم
   * التعليم والشهادات إلى مرحبا» load cv-page into an edit of a CV page.
   */
  intent?: IntentRoute;
  /**
   * The page the request is about, as the router reads it, when the host has
   * it summarised already (`summarizeDocumentForIntent`). Read only when
   * `intent` is absent. Absent too, it is summarised from `kernel.getDocument()`.
   */
  document?: IntentDocumentSummary;
  // script-wiring additions
  /**
   * agent-script: the sandbox that runs a `script.run` step's code. Absent ⇒
   * `defaultScriptRunner()` (a browser Worker, or in-thread under Node), loaded
   * only when a plan names `script.run`.
   */
  scriptRunner?: ScriptRunner;
  /**
   * agent-script: the site the open page belongs to. With it a script reads
   * every page and may write to other pages (one transaction, one Undo, via
   * `applyAiPlan`'s `site` + `crossPage`); without it such a write is refused
   * with E_OTHER_PAGE.
   */
  scriptSite?: ScriptSite;
  /** agent-script: one report per script run (ms, calls, steps, notes, result), for the host's log. */
  onScriptRun?: (report: ScriptRunReport) => void;
  // end script-wiring additions
}

export const DEFAULT_AI_CONTEXT_TOKEN_BUDGET = 64_000;

export { AiContextBudgetError } from './history-budget';

/**
 * @internal Shared with `outlineAiPlan`, which needs the same live channel —
 * the same abort signal, the same narration, the same history — over a provider
 * call that never reaches the door.
 */
export function liveOptionsForOutline(options: GenerateAiPlanOptions): AiProposeOptions {
  // An outline proposes no commands, so there is no page code for free code mode to author.
  return channelOptions(options);
}

/**
 * @internal Shared with `outlineAiPlan`. The command policy is EMPTY by
 * construction there: an outline shows the model no command vocabulary at all,
 * which says "do not propose edits" more strongly than any instruction can,
 * because there is nothing left to name.
 */
export function contextOptionsForOutline(
  options: GenerateAiPlanOptions,
  skills: AiPreparedSkillContext | undefined,
): AssembleAiContextOptions {
  return {
    // No photos: an outline is prose, and a list it can never place is ~860 tokens of nothing.
    ...contextOptions(options, skills, { allowedCommands: [], maxCommands: 0 }, false),
    outline: true,
  };
}

function channelOptions(options: GenerateAiPlanOptions): AiProposeOptions {
  const live: AiProposeOptions = {};
  if (options.signal !== undefined) {
    live.signal = options.signal;
  }
  if (options.onProgress !== undefined) {
    live.onProgress = options.onProgress;
  }
  if (options.history !== undefined) {
    live.history = options.history;
  }
  return live;
}

/**
 * What every propose, repair and forget of one generation carries. Free code
 * mode rides here (not only on the provider wrapper) so the three calls agree
 * on it: a caching provider that keys on it must `forget` under the key it
 * stored the answer by.
 */
function liveOptions(options: GenerateAiPlanOptions): AiProposeOptions {
  const live = channelOptions(options);
  if (options.composition?.freeCode === true) {
    live.freeCode = true;
  }
  return live;
}

/**
 * The photo catalog, for a run one of whose skills tells the model to read it.
 *
 * Wave 1 (2026-09-28) shipped `craftkit.photo-direction` — "an image address
 * comes only from PHOTOS YOU MAY USE" — and page archetypes whose hero takes
 * "a photo from PHOTOS YOU MAY USE", and the verifier found no caller of the
 * provider that writes that list anywhere in the tree: every such run was told
 * to use a list that never arrived, so pages lost their photos. The test is
 * the skill's own text rather than a list of ids, so the next skill that names
 * the list gets it without anyone remembering to register it here.
 *
 * A caller that already brings a photo provider keeps it — a section writer's
 * brief is narrower than the request — and a second one would be refused by
 * the assembler as a duplicate id anyway.
 */
function photoCatalogFor(
  options: GenerateAiPlanOptions,
  skillContext: AiPreparedSkillContext | undefined,
): AiContextProvider | undefined {
  const reads = skillContext?.active.some(({ instructions }) =>
    instructions.includes(PHOTO_CATALOG_FRAGMENT_TITLE),
  );
  if (reads !== true) return undefined;
  const given = [
    ...(options.contextProviders ?? []),
    ...(options.additionalContextProviders ?? []),
    ...options.kernel.context.registry.aiContextProviders(),
  ];
  if (given.some(({ id }) => id === PHOTO_CATALOG_PROVIDER_ID)) return undefined;
  return createPhotoCatalogContextProvider({ brief: options.request });
}

function contextOptions(
  options: GenerateAiPlanOptions,
  skillContext: AiPreparedSkillContext | undefined,
  policy: AiEffectiveCommandPolicy,
  photos = true,
): AssembleAiContextOptions {
  const context: AssembleAiContextOptions = { allowedCommands: policy.allowedCommands };
  if (options.selection !== undefined) {
    context.selection = options.selection;
  }
  if (options.contextProviders !== undefined) {
    context.providers = options.contextProviders;
  }
  const catalog = photos ? photoCatalogFor(options, skillContext) : undefined;
  if (options.additionalContextProviders !== undefined || catalog !== undefined) {
    context.additionalContextProviders = [
      ...(options.additionalContextProviders ?? []),
      ...(catalog === undefined ? [] : [catalog]),
    ];
  }
  if (skillContext !== undefined) {
    context.skillContext = skillContext;
  }
  const composition = compositionPolicy(options);
  if (composition !== undefined) {
    context.composition = composition;
  }
  return context;
}

/**
 * Resolve the run's catalog policy, filling in the one thing the caller should
 * never have to restate: WHICH types are in scope.
 *
 * A host asking for `'scoped'` means "the block the user is holding". That set
 * is already derivable here from the selection, and deriving it here is what
 * keeps the two from disagreeing — a host that computed its own list would
 * drift from the selection the same request was assembled against.
 * An explicit `scopedBlockTypes` still wins, for hosts that scope by something
 * other than selection.
 */
function compositionPolicy(options: GenerateAiPlanOptions): AiCompositionPolicy | undefined {
  const requested = options.composition;
  if (requested === undefined) return undefined;
  // `scoped` and `none` both mean "the blocks the person put in front of me";
  // the selection is where those blocks are.
  const derivesFromSelection =
    requested.catalogMode === 'scoped' || requested.catalogMode === 'none';
  if (!derivesFromSelection || requested.scopedBlockTypes !== undefined) {
    return requested;
  }
  return { ...requested, scopedBlockTypes: selectedBlockTypes(options) };
}

function selectedBlockTypes(options: GenerateAiPlanOptions): readonly string[] {
  const state = options.kernel.context.store.getState();
  const selected = options.selection ?? state.selection;
  return [
    ...new Set(
      selected.flatMap((id) => {
        const type = state.doc.nodes[id]?.type;
        return type === undefined ? [] : [type];
      }),
    ),
  ].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

/**
 * The intent the page-level skills are gated on: the host's route when it
 * gave one, otherwise the request routed against the page it is about.
 *
 * The page, not a blank one. The resolver's own fallback reads every request
 * as if the page were empty — right for a brief, wrong for the edits people
 * actually send: with no change verb («رقم هاتف العيادة غلط», "the wedding
 * date is June 12 not June 10") a blank page makes them a brief, and every
 * such edit carried a whole-page playbook (2,724–3,205 skill tokens, wave-1
 * router verifier, 2026-09-28). On the page they are about they read as the
 * edits they are. A build's own steps name their intent instead (run-build:
 * T1 and the scaffold `build-page`), so a brief laid on a page with content
 * keeps its trade's page type.
 *
 * @internal Shared with the bounded agent runner; not part of the package export surface.
 */
export function skillIntentForGeneration(options: GenerateAiPlanOptions): IntentKind {
  if (options.intent !== undefined) return options.intent.kind;
  const document = options.kernel.getDocument();
  const pointed = (options.selection ?? options.kernel.context.store.getState().selection).filter(
    (id) => id !== document.rootId,
  );
  return routeIntent({
    request: options.request,
    document: options.document ?? summarizeDocumentForIntent(document),
    ...(pointed.length === 0 ? {} : { selection: pointed }),
  }).kind;
}

/** @internal Shared with the bounded agent runner; not part of the package export surface. */
export function prepareAiSkillsForGeneration(
  options: GenerateAiPlanOptions,
): AiPreparedSkillContext | undefined {
  if (options.skillRegistry === undefined) {
    if ((options.selectedSkillIds?.length ?? 0) > 0) {
      throw new Error('selectedSkillIds requires a skillRegistry.');
    }
    return undefined;
  }
  return options.skillRegistry.prepare({
    request: options.request,
    intent: skillIntentForGeneration(options),
    selectedBlockTypes: selectedBlockTypes(options),
    ...(options.selectedSkillIds === undefined
      ? {}
      : { selectedSkillIds: options.selectedSkillIds }),
    ...(options.allowUntrustedSkills === undefined
      ? {}
      : { allowUntrusted: options.allowUntrustedSkills }),
    ...(options.maxActiveSkills === undefined ? {} : { maxActiveSkills: options.maxActiveSkills }),
    ...(options.maxSkillTokens === undefined ? {} : { maxSkillTokens: options.maxSkillTokens }),
  });
}

/** @internal Shared with the bounded agent runner; not part of the package export surface. */
export function resolveAiPolicyForGeneration(
  options: GenerateAiPlanOptions,
  skills: AiPreparedSkillContext | undefined,
): AiEffectiveCommandPolicy {
  const policy = resolveAiCommandPolicy({
    registeredCommands: options.kernel.context.registry.commandNames(),
    ...(options.policy === undefined ? {} : { session: options.policy }),
    ...(skills === undefined ? {} : { skills }),
  });
  if (policy.allowedCommands.length === 0) {
    const activeSkills = skills?.activations.map(({ id }) => id).join(', ');
    const sources = [
      activeSkills === undefined || activeSkills.length === 0
        ? undefined
        : `active Skills (${activeSkills})`,
      options.policy?.allowedCommands === undefined ? undefined : 'session.allowedCommands',
      options.policy?.deniedCommands === undefined ? undefined : 'session.deniedCommands',
    ].filter((source): source is string => source !== undefined);
    throw new AiCommandPolicyError(
      'empty-effective-policy',
      `${sources.length === 0 ? 'The live command registry' : sources.join(' and ')} leave this AI run with no permitted commands.`,
    );
  }
  return policy;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) signal.throwIfAborted();
}

function wireRequest(
  options: GenerateAiPlanOptions,
  context: AiPlanWireRequest['context'],
  attempt?: AiPlanWireAttempt,
): AiPlanWireRequest {
  return {
    version: AI_PLAN_WIRE_VERSION,
    request: options.request,
    context,
    ...(options.history === undefined ? {} : { history: options.history }),
    ...(attempt === undefined ? {} : { attempt }),
  };
}

function invalidOutputRepairAttempt(message: string): AiPlanWireAttempt {
  return {
    plan: { rationale: '', commands: [] },
    issues: [
      {
        code: 'invalid-plan',
        message: boundAiPlanWireInvalidOutputMessage(message),
      },
    ],
  };
}

// script-wiring additions
/** DESIGN §A.8 E_ENGINE, for an engine that could not even be loaded. */
const SCRIPT_ENGINE_UNAVAILABLE =
  'E_ENGINE: the script engine is unavailable right now. Write the same change as plain tool steps.';

function firstScriptStep(raw: unknown): number {
  const commands = (raw as { commands?: unknown }).commands;
  if (!Array.isArray(commands)) return 0;
  const at = commands.findIndex(
    (step: unknown) =>
      typeof step === 'object' &&
      step !== null &&
      (step as { command?: unknown }).command === 'tool' &&
      ((step as { args?: { name?: unknown } }).args?.name ?? '') === SCRIPT_TOOL_NAME,
  );
  return at === -1 ? 0 : at;
}

/**
 * `judgedCandidate`, with every `script.run` step run first (agent-script
 * DESIGN §A.1/§A.7). A plan without one goes straight through — same object,
 * nothing imported. Otherwise the script runs in the sandbox, its queued
 * writes become ordinary kernel steps in the script's place, and the result
 * meets the door exactly as a hand-written plan would: one plan, one labelled
 * transaction, one Undo.
 *
 * A script that fails (E_* issues) is judged as the ORIGINAL answer, so the
 * repair round shows the model its own script step next to the message that
 * says how to fix it. Writes to other pages travel beside the validated plan
 * (`attachScriptCrossPage`), never inside it.
 */
async function judgedScriptedCandidate(
  raw: unknown,
  options: GenerateAiPlanOptions,
  policy: AiEffectiveCommandPolicy,
): Promise<{ readonly candidate: unknown; readonly result: AiPlanValidationResult }> {
  // art catalog (2026-10-14): an answer naming 'logo:…', 'character:…' or 'illustration:…' loads the art first.
  if (planNamesArt(raw)) await loadArtCatalog().catch(() => undefined);
  if (!planHasScriptStep(raw)) return judgedCandidate(raw, options, policy);
  let expansion: ScriptExpansion;
  try {
    const { expandScriptSteps } = await import('../script/expand-scripts');
    expansion = await expandScriptSteps(raw, options.kernel, {
      ...(options.toolLanes === undefined ? {} : { lanes: options.toolLanes }),
      ...(options.scriptRunner === undefined ? {} : { runner: options.scriptRunner }),
      ...(options.sampleValues === undefined ? {} : { sampleValues: options.sampleValues }),
      ...(options.scriptSite === undefined ? {} : { site: options.scriptSite }),
      policy,
      validationPorts: options.validationPorts,
    });
  } catch {
    throwIfAborted(options.signal);
    const step = firstScriptStep(raw);
    return {
      candidate: raw,
      result: {
        ok: false,
        issues: [
          {
            code: 'invalid-args',
            step,
            message: `Step ${String(step)} (tool ${SCRIPT_TOOL_NAME}): ${SCRIPT_ENGINE_UNAVAILABLE}`,
          },
        ],
      },
    };
  }
  throwIfAborted(options.signal);
  for (const run of expansion.runs) {
    try {
      options.onScriptRun?.(run);
    } catch {
      // A host's log is telemetry; it never decides what lands.
    }
  }
  if (expansion.issues.length > 0) {
    return { candidate: raw, result: { ok: false, issues: expansion.issues } };
  }
  const crossPage = expansion.crossPage;
  if (crossPage.length > 0) {
    const elsewhereOnly = crossPageOnlyPlan(expansion.plan);
    if (elsewhereOnly !== undefined) {
      return {
        candidate: expansion.plan,
        result: { ok: true, plan: attachScriptCrossPage(elsewhereOnly, crossPage) },
      };
    }
  }
  const judged = judgedCandidate(expansion.plan, options, policy);
  if (judged.result.ok && crossPage.length > 0) {
    attachScriptCrossPage(judged.result.plan, crossPage);
  }
  return judged;
}
// end script-wiring additions

/**
 * What the repair rung returns. A failed repair keeps its CANDIDATE rather than
 * throwing it away, because the salvage rung below works on the best answer the
 * model actually produced, and that is usually the corrected one.
 */
type RepairOutcome =
  | { readonly ok: true; readonly plan: AiPlan }
  | {
      readonly ok: false;
      readonly candidate: unknown;
      readonly issues: readonly AiPlanValidationIssue[];
    };

async function repairAiPlanOnce(
  options: GenerateAiPlanOptions,
  context: AiPlanWireRequest['context'],
  live: AiProposeOptions,
  policy: AiEffectiveCommandPolicy,
  repair: NonNullable<AiPlanProvider['repair']>,
  attempt: AiPlanWireAttempt,
  maxContextTokens: number,
): Promise<RepairOutcome> {
  throwIfAborted(options.signal);
  const sent = withHistoryInBudget(live, wireRequest(options, context, attempt), maxContextTokens);
  const raw = await repair(options.request, context, attempt.plan, attempt.issues, sent);
  throwIfAborted(options.signal);
  // script-wiring additions
  const { candidate, result: repaired } =
    planHasScriptStep(raw) || planNamesArt(raw)
      ? await judgedScriptedCandidate(raw, options, policy)
      : judgedCandidate(raw, options, policy);
  // end script-wiring additions
  if (!repaired.ok) return { ok: false, candidate, issues: repaired.issues };
  return { ok: true, plan: repaired.plan };
}

/**
 * ONE repair round for a plan that passed the door but failed a check the door
 * does not know — a section writer's work held to its contract by
 * `checkSection` (agent-audit §3.1 "E", the evaluator-optimizer loop,
 * 2026-09-28). The issues travel on the same repair wire a door refusal uses
 * (`AiPlanWireAttempt`), and the corrected answer walks through the identical
 * expansion, normalisation and door as any other: a repair can never widen
 * what may land.
 *
 * Rejects with `AiPlanRejectedError` when the correction fails the door, and
 * with the provider's own error when there is no `repair` or it fails; the
 * caller keeps the plan it had.
 *
 * @internal Shared with the build's section checker; not part of the package export surface.
 */
export async function repairAiPlanForIssues(
  options: GenerateAiPlanOptions,
  context: AssembledAiContext,
  plan: AiPlan,
  issues: readonly AiPlanValidationIssue[],
  policy: AiEffectiveCommandPolicy,
): Promise<AiPlan> {
  const repair = options.provider.repair?.bind(options.provider);
  if (repair === undefined) {
    throw new Error('This provider cannot repair a plan.');
  }
  const maxContextTokens = options.maxContextTokens ?? DEFAULT_AI_CONTEXT_TOKEN_BUDGET;
  const outcome = await repairAiPlanOnce(
    options,
    context,
    liveOptions(options),
    policy,
    repair,
    { plan, issues },
    maxContextTokens,
  );
  if (outcome.ok) return outcome.plan;
  throw new AiPlanRejectedError(outcome.issues);
}

/**
 * No provider result escapes without surviving the live registry's real kernel
 * door. A provider with a `repair` method gets exactly one correction when its
 * first proposal is rejected. The correction walks through the identical
 * command policy and scratch door; there is never a silent third model call.
 */
export async function generateAiPlan(options: GenerateAiPlanOptions): Promise<AiPlan> {
  throwIfAborted(options.signal);
  const skills = prepareAiSkillsForGeneration(options);
  const policy = resolveAiPolicyForGeneration(options, skills);
  return generateAiPlanWithPreparedSkills(options, skills, policy);
}

/**
 * @internal Execute generation with an already pinned per-request skill set.
 * The runner uses this to emit resolution events without resolving twice.
 */
export async function generateAiPlanWithPreparedSkills(
  given: GenerateAiPlanOptions,
  skills: AiPreparedSkillContext | undefined,
  policy: AiEffectiveCommandPolicy,
): Promise<AiPlan> {
  throwIfAborted(given.signal);
  const context = assembleAiContext(given.kernel.context, contextOptions(given, skills, policy));
  const maxContextTokens = given.maxContextTokens ?? DEFAULT_AI_CONTEXT_TOKEN_BUDGET;
  if (!Number.isSafeInteger(maxContextTokens) || maxContextTokens <= 0) {
    throw new RangeError('maxContextTokens must be a positive safe integer.');
  }
  /*
    Over the budget the oldest of the conversation gives way first, never the page, the
    selection, the skills or the request (history-budget.ts); every call below, repairs
    included, carries what is left.
  */
  const options = withHistoryInBudget(given, wireRequest(given, context), maxContextTokens);
  const live = liveOptions(options);
  const repair = options.provider.repair?.bind(options.provider);
  let raw: unknown;
  try {
    raw = await options.provider.propose(options.request, context, live);
  } catch (cause) {
    throwIfAborted(options.signal);
    if (
      !isAiProviderError(cause) ||
      cause.code !== 'invalid-output' ||
      !cause.retryable ||
      repair === undefined
    ) {
      throw cause;
    }
    const recovered = await repairAiPlanOnce(
      options,
      context,
      live,
      policy,
      repair,
      invalidOutputRepairAttempt(cause.message),
      maxContextTokens,
    );
    if (recovered.ok) return recovered.plan;
    /*
      The first answer was never a plan — it failed to parse — so there is only
      one candidate to salvage from, and it is the correction.
    */
    return salvageOrReject(options, policy, [recovered.candidate], recovered.issues);
  }
  throwIfAborted(options.signal);
  // script-wiring additions
  const { candidate, result: first } =
    planHasScriptStep(raw) || planNamesArt(raw)
      ? await judgedScriptedCandidate(raw, options, policy)
      : judgedCandidate(raw, options, policy);
  // end script-wiring additions
  if (first.ok) return first.plan;
  /*
    The answer failed the door, so the provider must not serve it again. A
    caching provider otherwise turns one rejected plan into a permanent one:
    the person retries the same request and the same dead plan returns in
    milliseconds, without the model ever being asked.
  */
  options.provider.forget?.(options.request, context, live);
  if (repair === undefined) return salvageOrReject(options, policy, [candidate], first.issues);

  throwIfAborted(options.signal);
  // The parse may have failed before a structured plan existed; hand the
  // server whatever shape it sent so it can see its own mistake.
  const attempted = isPlanShaped(candidate) ? candidate : { rationale: '', commands: [] };
  const repaired = await repairAiPlanOnce(
    options,
    context,
    live,
    policy,
    repair,
    { plan: attempted, issues: first.issues },
    maxContextTokens,
  );
  if (repaired.ok) return repaired.plan;
  /*
    Both attempts failed. The corrected answer is tried first because it is the
    model's considered second thought and usually the closer one; the original
    follows, because a repair can also make things worse.
  */
  return salvageOrReject(options, policy, [repaired.candidate, candidate], repaired.issues);
}
