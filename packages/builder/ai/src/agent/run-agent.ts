import { estimateAssembledAiContextTokens } from '../context';
import { assembleDirectEditContext } from '../context/assemble-context';
import { resolveAiCompositionPolicy } from '../context/composition-policy';
import { resolveDocumentFocus, type AiDocumentFocus } from '../context/document-tree-mode';
import {
  routeIntent,
  summarizeDocumentForIntent,
  type IntentDocumentSummary,
  type IntentRoute,
} from '../intent';
import type { AiPlan, AiPlanProvider, AiProposeOptions, AssembledAiContext } from '../types';
import { applyAiPlan } from '../plan/apply-plan';
import { tryDirectEdit } from '../plan/direct-edit';
import { tryDirectTool } from '../tools/agent/direct-tool';
import { AiPlanRejectedError, validateAiPlan } from '../plan/validate-plan';
import { createAiValidatedProposal } from '../plan/validated-proposal';
import {
  generateAiPlanWithPreparedSkills,
  prepareAiSkillsForGeneration,
  resolveAiPolicyForGeneration,
  type GenerateAiPlanOptions,
} from '../plan/generate-plan';
import type { SalvagedAiPlan } from '../plan/salvage-plan';
import { AI_PLAN_WIRE_VERSION, estimateAiPlanWireRequestTokens } from '../provider/wire';
import type {
  AiEffectiveCommandPolicy,
  AiPreparedSkillContext,
  AiSkillPrepareOptions,
  AiSkillManifestV1,
  AiSkillRegistry,
} from '../skills';
import type {
  AiAgentEvent,
  AiAgentRunResult,
  AiDirectEditReport,
  AiRunModelChoice,
  RunAiAgentOptions,
} from './types';
import { classifyAiRunFailure } from './errors';

type EventPayload<T = AiAgentEvent> = T extends AiAgentEvent
  ? Omit<T, 'runId' | 'seq' | 'at'>
  : never;

type Emit = (payload: EventPayload) => AiAgentEvent | undefined;

const TERMINAL_EVENTS: ReadonlySet<AiAgentEvent['type']> = new Set([
  'run.completed',
  'run.cancelled',
  'run.failed',
]);

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function normalizeCancellation(cause: unknown): Error {
  if (cause instanceof Error && cause.name === 'AbortError') return cause;
  const error = new Error(errorMessage(cause));
  error.name = 'AbortError';
  return error;
}

function supersededRunError(runId: string): Error {
  const error = new Error(`AI run "${runId}" was superseded by a newer run.`);
  error.name = 'AbortError';
  return error;
}

function assertRunActive(
  options: Pick<RunAiAgentOptions, 'isCurrentRun' | 'runId' | 'signal'>,
): void {
  if (options.signal?.aborted === true) options.signal.throwIfAborted();
  if (options.isCurrentRun !== undefined) {
    const current: unknown = options.isCurrentRun(options.runId);
    if (current !== true) throw supersededRunError(options.runId);
  }
}

function mayEmitLiveProgress(
  options: Pick<RunAiAgentOptions, 'isCurrentRun' | 'runId' | 'signal'>,
): boolean {
  if (options.signal?.aborted === true) return false;
  try {
    if (options.isCurrentRun === undefined) return true;
    const current: unknown = options.isCurrentRun(options.runId);
    return current === true;
  } catch {
    // A broken lease port is surfaced at the next guarded run boundary. It
    // must never let late provider narration escape in the meantime.
    return false;
  }
}

function normalizeApplyMode(value: unknown): 'never' | 'auto' {
  if (value === undefined || value === 'never') return 'never';
  if (value === 'auto') return 'auto';
  throw new RangeError('apply must be either "never" or "auto".');
}

function isCancellation(cause: unknown, signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true || (cause instanceof Error && cause.name === 'AbortError');
}

/**
 * Every event is stamped once from the run's clock — one `clock.now()` per
 * event, as before — and an event that says where its plan came from
 * (`source`) also carries `elapsedMs` since `run.started`, measured between
 * those same stamps, so timing a run never adds a clock read.
 */
function createEventEmitter(options: RunAiAgentOptions): Emit {
  let seq = 0;
  let terminal = false;
  let startedAt: number | undefined;
  return (payload) => {
    if (terminal) return undefined;
    const at = options.clock.now();
    startedAt ??= at;
    const event = Object.freeze({
      ...payload,
      ...(payload.source === undefined ? {} : { elapsedMs: Math.max(0, at - startedAt) }),
      runId: options.runId,
      seq,
      at,
    }) as AiAgentEvent;
    seq += 1;
    if (TERMINAL_EVENTS.has(event.type)) terminal = true;
    try {
      options.onEvent?.(event);
    } catch {
      // Observers are telemetry consumers; they cannot acquire run authority.
    }
    return event;
  };
}

/**
 * The registry as a run with `autoSkills: false` sees it: every read passes
 * through, and every `prepare` is asked with `auto: false`, so only explicit,
 * always-on and dependency skills can activate.
 *
 * A view rather than a new option on generation, because the resolver already
 * has the switch (`AiSkillPrepareOptions.auto`) and the one call site that
 * prepares skills for a run reads the registry it is handed. Methods are
 * delegated by name, not spread: a host registry may keep them on a prototype.
 */
function explicitSkillsOnly(registry: AiSkillRegistry): AiSkillRegistry {
  return Object.freeze({
    list: () => registry.list(),
    get: (id: string) => registry.get(id),
    readSkill: (id: string) => registry.readSkill(id),
    listReferences: (id: string) => registry.listReferences(id),
    readReference: (id: string, path: string) => registry.readReference(id, path),
    prepare: (prepare: AiSkillPrepareOptions) => registry.prepare({ ...prepare, auto: false }),
  });
}

function skillRegistryFor(options: RunAiAgentOptions): AiSkillRegistry | undefined {
  const registry = options.skillRegistry;
  if (registry === undefined || options.autoSkills !== false) return registry;
  return explicitSkillsOnly(registry);
}

// ── What the run reads off the request before any provider is asked ─────────

/**
 * The route, the page summary it was read against, the sections an edit is
 * about, and the model an edit asks for (fast-edits, 2026-09-28).
 */
interface RunReading {
  readonly route: IntentRoute;
  readonly document: IntentDocumentSummary;
  readonly focus?: AiDocumentFocus;
  readonly model?: AiRunModelChoice;
}

/**
 * A build's own steps are named `<runId>/<step>` (AiBuildEventBase): the
 * scaffold carries the person's brief, a section writer its contract. None
 * of them is a person's edit, so none is routed here, focused, answered
 * directly or moved to the edit model — each step keeps exactly the context
 * and model the build chose for it.
 */
function isBuildStep(options: RunAiAgentOptions): boolean {
  return options.runId.includes('/');
}

function readRequest(options: RunAiAgentOptions): RunReading | undefined {
  if (isBuildStep(options)) return undefined;
  const page = options.kernel.getDocument();
  const pointed = (options.selection ?? options.kernel.context.store.getState().selection).filter(
    (id) => id !== page.rootId,
  );
  const document = options.document ?? summarizeDocumentForIntent(page);
  const route =
    options.intent ??
    routeIntent({
      request: options.request,
      document,
      ...(pointed.length === 0 ? {} : { selection: pointed }),
    });
  const editing = route.kind === 'edit' || route.kind === 'add-section';
  /*
    A host that chose how the page is shown (`documentTreeMode`,
    `treeScopeNodeIds`, its own `documentFocus`) keeps its choice.
  */
  const composition = options.composition;
  const hostChoseDocument =
    composition?.documentTreeMode !== undefined ||
    composition?.treeScopeNodeIds !== undefined ||
    composition?.documentFocus !== undefined;
  const focus =
    editing && !hostChoseDocument
      ? resolveDocumentFocus({
          request: options.request,
          document: page,
          selection: pointed,
          intent: route.kind,
        })
      : undefined;
  const model = options.editModel?.trim() ?? '';
  return {
    route,
    document,
    ...(focus === undefined ? {} : { focus }),
    ...(editing && model !== ''
      ? {
          model: {
            model,
            ...(options.editEffort === undefined ? {} : { effort: options.editEffort }),
          },
        }
      : {}),
  };
}

function generationOptions(
  options: RunAiAgentOptions,
  provider: AiPlanProvider,
  skillRegistry: AiSkillRegistry | undefined,
  reading: RunReading | undefined,
  onProgress?: (text: string) => void,
  onSalvage?: (salvaged: SalvagedAiPlan) => void,
): GenerateAiPlanOptions {
  const composition =
    reading?.focus === undefined
      ? options.composition
      : { ...options.composition, documentFocus: reading.focus };
  return {
    kernel: options.kernel,
    /*
      A run that reports to a person may keep the part of a rejected answer the
      door accepts, because losing ten minutes of work over one bad step is a
      worse answer than nine sections and a sentence saying which one was
      dropped. The primitive leaves this off; the event below is what makes it
      honest.
    */
    salvage: true,
    ...(onSalvage === undefined ? {} : { onSalvage }),
    provider,
    request: options.request,
    validationPorts: options.validationPorts,
    ...(options.selection === undefined ? {} : { selection: options.selection }),
    ...(options.contextProviders === undefined
      ? {}
      : { contextProviders: options.contextProviders }),
    ...(options.additionalContextProviders === undefined
      ? {}
      : { additionalContextProviders: options.additionalContextProviders }),
    ...(options.history === undefined ? {} : { history: options.history }),
    ...(skillRegistry === undefined ? {} : { skillRegistry }),
    ...(options.selectedSkillIds === undefined
      ? {}
      : { selectedSkillIds: options.selectedSkillIds }),
    ...(options.policy?.allowUntrustedSkills === undefined
      ? {}
      : { allowUntrustedSkills: options.policy.allowUntrustedSkills }),
    ...(options.policy?.maxActiveSkills === undefined
      ? {}
      : { maxActiveSkills: options.policy.maxActiveSkills }),
    ...(options.policy?.maxSkillTokens === undefined
      ? {}
      : { maxSkillTokens: options.policy.maxSkillTokens }),
    ...(options.policy?.maxContextTokens === undefined
      ? {}
      : { maxContextTokens: options.policy.maxContextTokens }),
    ...(options.policy === undefined ? {} : { policy: options.policy }),
    ...(composition === undefined ? {} : { composition }),
    ...(options.sampleValues === undefined ? {} : { sampleValues: options.sampleValues }),
    ...(options.toolLanes === undefined ? {} : { toolLanes: options.toolLanes }),
    /*
      The route this run read (or the host's), so the page-level skills are
      gated on what the request is FOR: measured 2026-09-28, an edit routed
      against a blank page loaded a whole-page playbook (2,724–3,205 skill
      tokens). A build step names its own intent through its registry view.
    */
    ...(reading === undefined ? {} : { intent: reading.route, document: reading.document }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    ...(onProgress === undefined ? {} : { onProgress }),
  };
}

/** The live options a provider call carries, with the edit model's choice when there is one. */
function withModel(
  live: AiProposeOptions | undefined,
  model: AiRunModelChoice | undefined,
): AiProposeOptions | undefined {
  if (model === undefined) return live;
  const chosen: AiProposeOptions & AiRunModelChoice = {
    ...live,
    model: model.model,
    ...(model.effort === undefined ? {} : { effort: model.effort }),
  };
  return chosen;
}

function instrumentProvider(
  inner: AiPlanProvider,
  options: Pick<RunAiAgentOptions, 'isCurrentRun' | 'runId' | 'signal'>,
  emit: Emit,
  onContext: (context: AssembledAiContext) => void,
  model: AiRunModelChoice | undefined,
  onRequestTokens: (tokens: number) => void,
): AiPlanProvider {
  let contextSeen = false;
  const provider: AiPlanProvider = {
    async propose(request, context, live): Promise<AiPlan> {
      assertRunActive(options);
      if (!contextSeen) {
        contextSeen = true;
        onContext(context);
        emit({
          type: 'context.ready',
          fragmentCount: context.fragments.length,
          totalTokens: estimateAssembledAiContextTokens(context),
        });
      }
      assertRunActive(options);
      emit({ type: 'plan.proposing' });
      assertRunActive(options);
      onRequestTokens(
        estimateAiPlanWireRequestTokens({
          version: AI_PLAN_WIRE_VERSION,
          request,
          context,
          ...(live?.history === undefined ? {} : { history: live.history }),
        }),
      );
      const plan = await inner.propose(request, context, withModel(live, model));
      assertRunActive(options);
      emit({ type: 'plan.validating', attempt: 1 });
      assertRunActive(options);
      return plan;
    },
  };

  const repair = inner.repair?.bind(inner);
  if (repair !== undefined) {
    provider.repair = async (request, context, plan, issues, live) => {
      assertRunActive(options);
      emit({ type: 'plan.repairing', issues: issues.map(({ message }) => message) });
      assertRunActive(options);
      onRequestTokens(
        estimateAiPlanWireRequestTokens({
          version: AI_PLAN_WIRE_VERSION,
          request,
          context,
          ...(live?.history === undefined ? {} : { history: live.history }),
          attempt: { plan, issues },
        }),
      );
      const repaired = await repair(request, context, plan, issues, withModel(live, model));
      assertRunActive(options);
      emit({ type: 'plan.validating', attempt: 2 });
      assertRunActive(options);
      return repaired;
    };
  }
  /*
    Passed through: generation tells the provider to forget an answer the
    door refused, and a caching provider behind this wrapper otherwise served
    the same rejected plan to every retry of the same request (only the
    repair round was ever fresh).
  */
  const forget = inner.forget?.bind(inner);
  if (forget !== undefined) provider.forget = forget;
  return provider;
}

// ── The zero-token path ───────────────────────────────────────────────────────

/**
 * Whether no skill that narrows the command policy can activate on this run:
 * nothing selected by id, and every skill with `restrictToCommands` — or one
 * that depends on such a skill, however deeply — is explicit-only. Then the
 * policy without skills equals the policy with them.
 */
function skillsCannotNarrow(
  options: RunAiAgentOptions,
  registry: AiSkillRegistry | undefined,
): boolean {
  if ((options.selectedSkillIds?.length ?? 0) > 0) return false;
  if (registry === undefined) return true;
  let manifests: readonly AiSkillManifestV1[];
  try {
    manifests = registry.list();
  } catch {
    return false;
  }
  const narrowing = new Set(
    manifests.filter(({ restrictToCommands }) => restrictToCommands !== undefined).map(({ id }) => id),
  );
  for (let grew = true; grew; ) {
    grew = false;
    for (const { id, dependencies } of manifests) {
      if (!narrowing.has(id) && dependencies.some((dependency) => narrowing.has(dependency))) {
        narrowing.add(id);
        grew = true;
      }
    }
  }
  return manifests.every(({ id, activation }) => !narrowing.has(id) || activation.mode === 'explicit');
}

/**
 * A small edit stated in full, made with no provider call (fast-edits,
 * 2026-09-28): parsed, pointed at its one element and validated by
 * `tryDirectEdit`, then proposed or applied exactly as a model's plan would
 * be — the same proposal authentication, the same grouped door, one labelled
 * transaction. `undefined` whenever it does not apply; the model path then
 * runs as it always did.
 *
 * Auto rehearses the plan ONCE, in `applyAiPlan` (final test, 2026-09-28): a
 * rehearsal rebuilds and re-validates the whole page, and the edit paid for
 * two — `tryDirectEdit`'s, then the door's own, microseconds apart on the
 * same document with the same ports and policy. Only while the run's
 * composition checks what the door checks (the vocabulary enforced, colours
 * free); a stricter or looser run keeps its own rehearsal. The door refuses
 * before any write, so a refused plan still falls back to the model with
 * nothing written. The events keep their order — `plan.applying` before the
 * write, which the panel reads as the "before" of its change list.
 */
function directRun(
  options: RunAiAgentOptions,
  reading: RunReading | undefined,
  policy: AiEffectiveCommandPolicy | undefined,
  apply: 'never' | 'auto',
  emit: Emit,
  /** Called once the edit is parsed and about to be made, before its first event. */
  onTaken?: () => void,
): AiAgentRunResult | undefined {
  // The run's own command policy, skills included: a run whose policy failed to resolve is the model path's to report.
  if (options.directEdits === false || reading === undefined || policy === undefined) {
    return undefined;
  }
  // agent-tools additions: a request no direct edit reads may still be a zero-token tool (tryDirectTool).
  if (reading.route.kind !== 'edit') return directToolRun(options, reading, policy, apply, emit, onTaken);
  // end agent-tools additions
  const selection = options.selection ?? options.kernel.context.store.getState().selection;
  let direct: ReturnType<typeof tryDirectEdit>;
  try {
    direct = tryDirectEdit(options.request, options.kernel, {
      selection,
      route: reading.route,
      validationPorts: options.validationPorts,
      policy,
      ...(options.composition === undefined ? {} : { composition: options.composition }),
      // Auto: `applyAiPlan` below is the one rehearsal. Ask: this one, so a refused plan is never proposed.
      ...(apply === 'auto' && doorRehearsesAsTheRun(options) ? { dryRun: false } : {}),
    });
  } catch {
    // An optimisation that fails must never cost the person their edit: the model path runs.
    return undefined;
  }
  if (direct === null) return directToolRun(options, reading, policy, apply, emit, onTaken);
  onTaken?.();

  const context = assembleDirectEditContext(options.kernel.context, {
    nodeIds: direct.target.changes.map(({ nodeId }) => nodeId),
    selection,
  });
  const proposal = createAiValidatedProposal({
    plan: direct.plan,
    policy,
    skillActivations: [],
    context,
  });
  const directEdit: AiDirectEditReport = Object.freeze({
    target: direct.target,
    summary: direct.summary,
    language: direct.language,
  });
  const common = {
    runId: options.runId,
    proposal,
    plan: proposal.plan,
    context,
    policy: proposal.policy,
    source: 'direct' as const,
    tokens: 0,
    route: reading.route,
    directEdit,
  };

  emit({ type: 'context.gathering' });
  assertRunActive(options);
  emit({ type: 'context.ready', fragmentCount: 0, totalTokens: 0, source: 'direct', tokens: 0 });
  assertRunActive(options);
  if (apply === 'never') {
    emit({ type: 'plan.proposed', plan: proposal.plan, proposal, source: 'direct', tokens: 0 });
    assertRunActive(options);
    const done = emit({ type: 'run.completed', status: 'proposed', source: 'direct', tokens: 0 });
    return Object.freeze({ ...common, status: 'proposed', elapsedMs: done?.elapsedMs ?? 0 });
  }
  emit({ type: 'plan.applying', source: 'direct', tokens: 0 });
  assertRunActive(options);
  let applied: ReturnType<typeof applyAiPlan>;
  try {
    applied = applyAiPlan({
      kernel: options.kernel,
      proposal,
      validationPorts: options.validationPorts,
      ...(options.label === undefined ? {} : { label: options.label }),
    });
  } catch (cause) {
    /*
      The door's rehearsal refused it before any write (an existing tree the
      vocabulary refuses, a policy without setProp): the model path runs, as
      it did when `tryDirectEdit`'s own rehearsal refused it. Its events
      follow this attempt's; nothing was written.
    */
    if (cause instanceof AiPlanRejectedError) return undefined;
    throw cause;
  }
  const done = emit({ type: 'run.completed', status: 'applied', source: 'direct', tokens: 0 });
  return Object.freeze({ ...common, status: 'applied', applied, elapsedMs: done?.elapsedMs ?? 0 });
}

// agent-tools additions
/**
 * A zero-token TOOL (agent-tools, 2026-09-30): «غيّر اللون إلى الأخضر»,
 * "use font Cairo", «احذف قسم الأسعار» — a request `tryDirectTool` reads in
 * full becomes its tool plan, expanded and validated with no model, then
 * proposed or applied exactly as a direct edit is: one validated proposal,
 * the same grouped door, one labelled transaction. A page or site build is
 * never a tool. The plan is re-judged under the run's own policy and
 * composition first, so a Plan-mode skill that allows nothing still wins;
 * anything that fails returns undefined and the model path runs.
 */
function directToolRun(
  options: RunAiAgentOptions,
  reading: RunReading,
  policy: AiEffectiveCommandPolicy,
  apply: 'never' | 'auto',
  emit: Emit,
  onTaken?: () => void,
): AiAgentRunResult | undefined {
  if (reading.route.kind === 'build-page' || reading.route.kind === 'build-site') return undefined;
  let plan: AiPlan;
  try {
    const direct = tryDirectTool(options.request, options.kernel);
    if (direct === undefined) return undefined;
    const verdict = validateAiPlan(
      direct.plan,
      options.kernel,
      options.validationPorts,
      policy,
      resolveAiCompositionPolicy(options.composition),
    );
    if (!verdict.ok) return undefined;
    plan = verdict.plan;
  } catch {
    // An optimisation that fails must never cost the person their edit: the model path runs.
    return undefined;
  }
  onTaken?.();

  const nodeIds = [
    ...new Set(
      plan.commands.flatMap(({ args }) => {
        const id = (args as { id?: unknown } | undefined)?.id;
        return typeof id === 'string' ? [id] : [];
      }),
    ),
  ];
  const selection = options.selection ?? options.kernel.context.store.getState().selection;
  const context = assembleDirectEditContext(options.kernel.context, { nodeIds, selection });
  const proposal = createAiValidatedProposal({ plan, policy, skillActivations: [], context });
  const common = {
    runId: options.runId,
    proposal,
    plan: proposal.plan,
    context,
    policy: proposal.policy,
    source: 'direct' as const,
    tokens: 0,
    route: reading.route,
  };

  emit({ type: 'context.gathering' });
  assertRunActive(options);
  emit({ type: 'context.ready', fragmentCount: 0, totalTokens: 0, source: 'direct', tokens: 0 });
  assertRunActive(options);
  if (apply === 'never') {
    emit({ type: 'plan.proposed', plan: proposal.plan, proposal, source: 'direct', tokens: 0 });
    assertRunActive(options);
    const done = emit({ type: 'run.completed', status: 'proposed', source: 'direct', tokens: 0 });
    return Object.freeze({ ...common, status: 'proposed', elapsedMs: done?.elapsedMs ?? 0 });
  }
  emit({ type: 'plan.applying', source: 'direct', tokens: 0 });
  assertRunActive(options);
  let applied: ReturnType<typeof applyAiPlan>;
  try {
    applied = applyAiPlan({
      kernel: options.kernel,
      proposal,
      validationPorts: options.validationPorts,
      ...(options.label === undefined ? {} : { label: options.label }),
    });
  } catch (cause) {
    // Refused before any write: the model path runs, as it does for a refused direct edit.
    if (cause instanceof AiPlanRejectedError) return undefined;
    throw cause;
  }
  const done = emit({ type: 'run.completed', status: 'applied', source: 'direct', tokens: 0 });
  return Object.freeze({ ...common, status: 'applied', applied, elapsedMs: done?.elapsedMs ?? 0 });
}
// end agent-tools additions

/**
 * Whether `applyAiPlan`'s rehearsal checks what this run's would: the door
 * validates with the default composition (the vocabulary enforced, colours
 * free), the run with its own.
 */
function doorRehearsesAsTheRun(options: RunAiAgentOptions): boolean {
  const composition = resolveAiCompositionPolicy(options.composition);
  return composition.enforceUtilityVocabulary && composition.colourPolicy === 'free';
}

/**
 * Run one bounded, observable agent request. It proposes typed commands only;
 * optional application still goes through the same validated grouped kernel door.
 *
 * Before any provider call (fast-edits, 2026-09-28): the request is routed
 * against the page; an edit stated in full is made directly, with no model
 * (`directEdits`); an edit that names its section shows the model that
 * section and an outline of the rest; an edit or a new section runs on
 * `editModel` when the host gave one. A build's own steps are exempt.
 */
export async function runAiAgent(options: RunAiAgentOptions): Promise<AiAgentRunResult> {
  if (
    typeof options.runId !== 'string' ||
    options.runId.trim().length === 0 ||
    options.runId.length > 160
  ) {
    throw new RangeError('runId must be a non-empty string of at most 160 characters.');
  }
  const apply = normalizeApplyMode(options.apply);
  const emit = createEventEmitter(options);
  const skillRegistry = skillRegistryFor(options);

  try {
    emit({ type: 'run.started', apply });
    assertRunActive(options);
    const reading = readRequest(options);

    emit({ type: 'skills.resolving' });
    assertRunActive(options);
    const initialGenerationOptions = generationOptions(
      options,
      options.provider,
      skillRegistry,
      reading,
    );

    /*
      Final test (2026-09-30): the first direct edit of a session took
      422–534 ms, 50–130 of them resolving skills a direct edit never reads.
      Skills touch a direct edit through one thing only — a restriction that
      narrows the command policy — so when no skill that restricts can
      activate on this run, the skill-free policy IS the run's policy and the
      edit is tried before any skill is resolved. Its `skills.resolved` is
      the honest one: nothing activated.
    */
    let policy: AiEffectiveCommandPolicy | undefined;
    let policyFailure: { readonly cause: unknown } | undefined;
    const policyIsSkillFree = skillsCannotNarrow(options, skillRegistry);
    if (policyIsSkillFree) {
      // Resolved ONCE (see below): this is the run's policy for both paths.
      try {
        policy = resolveAiPolicyForGeneration(initialGenerationOptions, undefined);
      } catch (cause) {
        policyFailure = { cause };
      }
      const direct = directRun(options, reading, policy, apply, emit, () => {
        emit({ type: 'skills.resolved', activations: [], omitted: [], totalTokens: 0 });
        assertRunActive(options);
      });
      if (direct !== undefined) return direct;
    }

    const skills: AiPreparedSkillContext | undefined =
      prepareAiSkillsForGeneration(initialGenerationOptions);
    emit({
      type: 'skills.resolved',
      activations: skills?.activations ?? [],
      omitted: skills?.omitted ?? [],
      totalTokens: skills?.totalTokens ?? 0,
    });
    assertRunActive(options);

    /*
      The effective policy is resolved ONCE, here, and pins both paths: a
      direct edit is held to exactly the commands a model's plan would be
      (a Plan-mode skill that allows nothing leaves nothing to apply). A
      policy that cannot resolve fails where it always failed, after
      `context.gathering`.
    */
    if (!policyIsSkillFree) {
      try {
        policy = resolveAiPolicyForGeneration(initialGenerationOptions, skills);
      } catch (cause) {
        policyFailure = { cause };
      }

      const direct = directRun(options, reading, policy, apply, emit);
      if (direct !== undefined) return direct;
    }

    emit({ type: 'context.gathering' });
    assertRunActive(options);
    if (policyFailure !== undefined || policy === undefined) {
      throw policyFailure === undefined ? new Error('The AI run has no command policy.') : policyFailure.cause;
    }
    let assembledContext: AssembledAiContext | undefined;
    let requestTokens = 0;
    const model = reading?.model;
    const provider = instrumentProvider(
      options.provider,
      options,
      emit,
      (context) => {
        assembledContext = context;
      },
      model,
      (tokens) => {
        requestTokens += tokens;
      },
    );
    const preparedOptions = generationOptions(
      options,
      provider,
      skillRegistry,
      reading,
      (text) => {
        if (mayEmitLiveProgress(options) && text.trim().length > 0) {
          emit({ type: 'plan.progress', text });
        }
      },
      ({ kept, dropped }) => {
        emit({ type: 'plan.salvaged', kept, dropped });
      },
    );
    const plan = await generateAiPlanWithPreparedSkills(preparedOptions, skills, policy);
    assertRunActive(options);
    if (assembledContext === undefined) {
      throw new Error('The AI provider was not given an assembled context.');
    }
    const proposal = createAiValidatedProposal({
      plan,
      policy,
      skillActivations: skills?.activations ?? [],
      context: assembledContext,
    });
    const origin = {
      source: 'model' as const,
      tokens: requestTokens,
      ...(model === undefined ? {} : { model: model.model }),
    };
    const reported = {
      ...origin,
      ...(reading === undefined ? {} : { route: reading.route }),
      ...(reading?.focus === undefined ? {} : { focus: reading.focus }),
    };

    if (apply === 'never') {
      emit({ type: 'plan.proposed', plan: proposal.plan, proposal, ...origin });
      assertRunActive(options);
      const done = emit({ type: 'run.completed', status: 'proposed', ...origin });
      return Object.freeze({
        runId: options.runId,
        status: 'proposed',
        proposal,
        plan: proposal.plan,
        context: assembledContext,
        ...(skills === undefined ? {} : { skills }),
        policy: proposal.policy,
        ...reported,
        elapsedMs: done?.elapsedMs ?? 0,
      });
    }

    emit({ type: 'plan.applying' });
    assertRunActive(options);
    const applied = applyAiPlan({
      kernel: options.kernel,
      proposal,
      validationPorts: options.validationPorts,
      ...(options.label === undefined ? {} : { label: options.label }),
    });
    const done = emit({ type: 'run.completed', status: 'applied', ...origin });
    return Object.freeze({
      runId: options.runId,
      status: 'applied',
      proposal,
      plan: proposal.plan,
      context: assembledContext,
      ...(skills === undefined ? {} : { skills }),
      policy: proposal.policy,
      applied,
      ...reported,
      elapsedMs: done?.elapsedMs ?? 0,
    });
  } catch (cause) {
    if (isCancellation(cause, options.signal)) {
      const cancellation = normalizeCancellation(cause);
      emit({ type: 'run.cancelled', error: classifyAiRunFailure(cancellation) });
      throw cancellation;
    }
    emit({ type: 'run.failed', error: classifyAiRunFailure(cause) });
    throw cause;
  }
}
