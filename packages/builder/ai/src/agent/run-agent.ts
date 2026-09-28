import { estimateAssembledAiContextTokens } from '../context';
import type { AiPlan, AiPlanProvider, AssembledAiContext } from '../types';
import { applyAiPlan } from '../plan/apply-plan';
import { createAiValidatedProposal } from '../plan/validated-proposal';
import {
  generateAiPlanWithPreparedSkills,
  prepareAiSkillsForGeneration,
  resolveAiPolicyForGeneration,
  type GenerateAiPlanOptions,
} from '../plan/generate-plan';
import type { SalvagedAiPlan } from '../plan/salvage-plan';
import type { AiPreparedSkillContext, AiSkillPrepareOptions, AiSkillRegistry } from '../skills';
import type { AiAgentEvent, AiAgentRunResult, RunAiAgentOptions } from './types';
import { classifyAiRunFailure } from './errors';

type EventPayload<T = AiAgentEvent> = T extends AiAgentEvent
  ? Omit<T, 'runId' | 'seq' | 'at'>
  : never;

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

function createEventEmitter(options: RunAiAgentOptions): (payload: EventPayload) => void {
  let seq = 0;
  let terminal = false;
  return (payload) => {
    if (terminal) return;
    const event = Object.freeze({
      ...payload,
      runId: options.runId,
      seq,
      at: options.clock.now(),
    }) as AiAgentEvent;
    seq += 1;
    if (TERMINAL_EVENTS.has(event.type)) terminal = true;
    try {
      options.onEvent?.(event);
    } catch {
      // Observers are telemetry consumers; they cannot acquire run authority.
    }
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

function generationOptions(
  options: RunAiAgentOptions,
  provider: AiPlanProvider,
  skillRegistry: AiSkillRegistry | undefined,
  onProgress?: (text: string) => void,
  onSalvage?: (salvaged: SalvagedAiPlan) => void,
): GenerateAiPlanOptions {
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
    ...(options.composition === undefined ? {} : { composition: options.composition }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    ...(onProgress === undefined ? {} : { onProgress }),
  };
}

function instrumentProvider(
  inner: AiPlanProvider,
  options: Pick<RunAiAgentOptions, 'isCurrentRun' | 'runId' | 'signal'>,
  emit: (payload: EventPayload) => void,
  onContext: (context: AssembledAiContext) => void,
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
      const plan = await inner.propose(request, context, live);
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
      const repaired = await repair(request, context, plan, issues, live);
      assertRunActive(options);
      emit({ type: 'plan.validating', attempt: 2 });
      assertRunActive(options);
      return repaired;
    };
  }
  return provider;
}

/**
 * Run one bounded, observable agent request. It proposes typed commands only;
 * optional application still goes through the same validated grouped kernel door.
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

    emit({ type: 'skills.resolving' });
    assertRunActive(options);
    const initialGenerationOptions = generationOptions(options, options.provider, skillRegistry);
    const skills: AiPreparedSkillContext | undefined =
      prepareAiSkillsForGeneration(initialGenerationOptions);
    emit({
      type: 'skills.resolved',
      activations: skills?.activations ?? [],
      omitted: skills?.omitted ?? [],
      totalTokens: skills?.totalTokens ?? 0,
    });
    assertRunActive(options);

    emit({ type: 'context.gathering' });
    assertRunActive(options);
    let assembledContext: AssembledAiContext | undefined;
    const provider = instrumentProvider(options.provider, options, emit, (context) => {
      assembledContext = context;
    });
    const preparedOptions = generationOptions(
      options,
      provider,
      skillRegistry,
      (text) => {
        if (mayEmitLiveProgress(options) && text.trim().length > 0) {
          emit({ type: 'plan.progress', text });
        }
      },
      ({ kept, dropped }) => {
        emit({ type: 'plan.salvaged', kept, dropped });
      },
    );
    const policy = resolveAiPolicyForGeneration(preparedOptions, skills);
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

    if (apply === 'never') {
      emit({ type: 'plan.proposed', plan: proposal.plan, proposal });
      assertRunActive(options);
      emit({ type: 'run.completed', status: 'proposed' });
      return Object.freeze({
        runId: options.runId,
        status: 'proposed',
        proposal,
        plan: proposal.plan,
        context: assembledContext,
        ...(skills === undefined ? {} : { skills }),
        policy: proposal.policy,
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
    emit({ type: 'run.completed', status: 'applied' });
    return Object.freeze({
      runId: options.runId,
      status: 'applied',
      proposal,
      plan: proposal.plan,
      context: assembledContext,
      ...(skills === undefined ? {} : { skills }),
      policy: proposal.policy,
      applied,
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
