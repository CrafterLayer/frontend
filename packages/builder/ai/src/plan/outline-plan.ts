import { assembleAiContext } from '../context/assemble-context';
import type { AiPreparedSkillContext, AiSkillRegistry } from '../skills/types';
import { AiProviderError } from '../provider/errors';
import type { AiPlan, AiProposeOptions } from '../types';
import {
  contextOptionsForOutline,
  liveOptionsForOutline,
  prepareAiSkillsForGeneration,
  type GenerateAiPlanOptions,
} from './generate-plan';

/** The skill that makes a plan a plan, and makes it unable to write. */
export const AI_PLAN_MODE_SKILL_ID = 'craftkit.plan-mode';

export interface AiOutline {
  /** The plan itself, in the requester's language. Never empty. */
  readonly rationale: string;
  /** What to say next, when the provider offered one. */
  readonly followUp: string | undefined;
  /** The Skills that shaped this outline, pinned exactly as a run's are. */
  readonly skillActivations: AiPreparedSkillContext['activations'] | undefined;
  /**
   * Commands the provider returned ANYWAY, and this dropped.
   *
   * Reported rather than swallowed: a model that keeps proposing edits when it
   * was asked to plan is a fact about the model worth seeing, and a person who
   * wonders why nothing happened deserves the real answer.
   */
  readonly droppedCommands: number;
}

export type OutlineAiPlanOptions = Omit<GenerateAiPlanOptions, 'validationPorts'> &
  Partial<Pick<GenerateAiPlanOptions, 'validationPorts'>>;

/**
 * Ask for a PLAN and take no commands from the answer.
 *
 * Why this is a separate function rather than a flag on `generateAiPlan`: that
 * pipeline promises a plan of COMMANDS. It resolves a command policy and
 * refuses an empty one as a misconfiguration, then validates the answer against
 * the kernel door — and `validateAiPlan` rejects a plan with zero commands
 * outright ("An AI plan needs at least one command"). Every one of those rules
 * is correct for building and wrong for planning, and a flag threaded through
 * all three would have been three exceptions pretending to be one.
 *
 * So an outline takes the same context assembly, the same skills, the same
 * provider — and simply never goes near the door. There is nothing to validate:
 * a plan that cannot emit a command cannot produce an invalid document.
 *
 * The command policy handed to the context is EMPTY on purpose. The model is
 * shown no command vocabulary at all, which is the strongest way to say "do not
 * propose edits" — stronger than an instruction, because there is nothing to
 * name.
 */
export async function outlineAiPlan(options: OutlineAiPlanOptions): Promise<AiOutline> {
  options.signal?.throwIfAborted();

  const planSkills = withPlanMode(options.selectedSkillIds, options.skillRegistry);
  const withPlanSkill: GenerateAiPlanOptions = {
    ...options,
    validationPorts: options.validationPorts ?? UNUSED_PORTS,
    // Spread rather than assigned: `exactOptionalPropertyTypes` distinguishes
    // "absent" from "present and undefined", and the option means the first.
    ...(planSkills === undefined ? {} : { selectedSkillIds: planSkills }),
  };

  const skills = prepareAiSkillsForGeneration(withPlanSkill);
  const context = assembleAiContext(
    options.kernel.context,
    contextOptionsForOutline(withPlanSkill, skills),
  );

  const live: AiProposeOptions = liveOptionsForOutline(withPlanSkill);
  const answer: AiPlan = await options.provider.propose(options.request, context, live);
  options.signal?.throwIfAborted();

  const rationale = answer.rationale.trim();
  /*
    "Never empty" was a promise this function did not keep.

    The check that enforces it on the ordinary route lives in `validateAiPlan`
    ("An AI plan needs a non-empty rationale"), and an outline deliberately
    never reaches that door — so it dropped a guard that had nothing to do with
    commands. A conforming TypeScript surface over a malformed server therefore
    rendered a blank card, which reads as "the assistant answered and said
    nothing" rather than as the failure it is.
  */
  if (rationale === '') {
    throw new AiProviderError('The assistant returned an empty plan.', {
      code: 'invalid-output',
      retryable: true,
    });
  }
  return {
    rationale,
    followUp: answer.followUp?.trim() === '' ? undefined : answer.followUp,
    skillActivations: skills?.activations,
    droppedCommands: answer.commands.length,
  };
}

/**
 * Ports that are never used: an outline validates nothing, so it needs no clock
 * and no id source. They are required by the shared options type, and handing
 * over throwing stubs is how this stays true — if an outline ever reaches code
 * that mints an id, it fails loudly instead of quietly borrowing the live one.
 */
const UNUSED_PORTS = {
  clock: {
    now(): number {
      throw new Error('An outline validates nothing and must never read a clock.');
    },
  },
  ids: {
    newId(): string {
      throw new Error('An outline validates nothing and must never mint an id.');
    },
  },
};

/**
 * Add Plan's own skill — but only to a registry that HAS it.
 *
 * `createAiSkillRegistry` defaults to an empty catalog: the built-ins are
 * opt-in, and `AssistantPanel` publishes `skillRegistry` as a prop. A host that
 * supplies its own therefore has a registry with no `craftkit.plan-mode` in it,
 * and naming it anyway made resolution THROW `unknown-explicit-skill` — so
 * every plan that host ever asked for came back as a refusal card carrying a
 * resolution error instead of a plan.
 *
 * Asking the registry is the whole fix. A host without the skill still gets an
 * outline: the route's guarantees do not come from the instructions, they come
 * from an empty command vocabulary and from never reaching the door.
 */
function withPlanMode(
  selected: readonly string[] | undefined,
  registry: AiSkillRegistry | undefined,
): readonly string[] | undefined {
  if (registry?.get(AI_PLAN_MODE_SKILL_ID) === undefined) return selected;
  const base = selected ?? [];
  return base.includes(AI_PLAN_MODE_SKILL_ID) ? base : [...base, AI_PLAN_MODE_SKILL_ID];
}
