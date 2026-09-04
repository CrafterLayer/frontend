import { assembleAiContext } from '../context/assemble-context';
import type { AiPreparedSkillContext } from '../skills/types';
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

  const planSkills = withPlanMode(options.selectedSkillIds, options.skillRegistry !== undefined);
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

function withPlanMode(
  selected: readonly string[] | undefined,
  hasRegistry: boolean,
): readonly string[] | undefined {
  if (!hasRegistry) return selected;
  const base = selected ?? [];
  return base.includes(AI_PLAN_MODE_SKILL_ID) ? base : [...base, AI_PLAN_MODE_SKILL_ID];
}
