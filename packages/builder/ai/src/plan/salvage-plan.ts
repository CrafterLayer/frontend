import type { BuilderKernel } from '@craftkit/builder-core';

import type { AiEffectiveCommandPolicy } from '../skills';
import type { AiPlan, AiPlanStep, AiValidationPorts } from '../types';
import { validateAiPlan, type AiDoorComposition } from './validate-plan';

/** A command the salvage left behind, and the reason the door gave for it. */
export interface DroppedAiPlanStep {
  /** Where it sat in the plan the model actually wrote, counting from 1. */
  readonly step: number;
  readonly command: string;
  /** The first issue the validator raised when this step was included. */
  readonly reason: string;
}

export interface SalvagedAiPlan {
  /** A fully validated plan built only from steps that survived. */
  readonly plan: AiPlan;
  readonly kept: number;
  readonly dropped: readonly DroppedAiPlanStep[];
}

/**
 * The last rung of the recovery ladder: keep the work that is good.
 *
 * ## The failure this removes
 *
 * A plan is all-or-nothing today. Ten commands that build a page, one of which
 * names a slot that does not exist, and the door refuses the whole thing — so a
 * request that cost minutes and tens of thousands of output tokens returns
 * nothing at all, and the person is told only that their page could not be
 * built. There was one repair round trip in between; if the model made the same
 * mistake twice, everything it got right was thrown away with everything it got
 * wrong.
 *
 * ## Why a SUBSEQUENCE, and why it is safe
 *
 * The obvious salvage — drop the offending step and apply the rest — is unsafe,
 * because plan steps are causally ordered: step 7 sets a prop on the node step 3
 * inserted. Dropping 3 leaves 7 pointing at nothing.
 *
 * So nothing here reasons about causality. It rebuilds the plan one step at a
 * time and asks the REAL validator, after every addition, whether the plan so
 * far is still legal — the same `validateAiPlan` the door uses, replaying on a
 * scratch kernel with the same policy and the same composition rules. A step
 * that would orphan a later one simply causes that later step to fail its own
 * check and be dropped in turn. Whatever comes back has passed the door in one
 * piece; it is not a plan that "should" work.
 *
 * That makes this a search, not a repair: it invents nothing, asks the model
 * nothing, and can only ever return a subset of what the model already wrote.
 *
 * ## What it costs
 *
 * One validation per step, each replaying the steps kept so far, so quadratic
 * in the number of commands. Plans are capped at a few dozen commands by policy
 * and this runs only after two attempts have already failed, which makes the
 * cost invisible next to the model call that produced the plan.
 *
 * ## What the caller owes the person
 *
 * A partial result reported as a whole one is a lie. `dropped` names every step
 * that did not survive and why, so the run can say "eight of ten steps landed,
 * and here is what the other two were" instead of quietly delivering less than
 * was asked for.
 *
 * Returns `undefined` when nothing survives — an empty plan is not a rescue,
 * and the caller should raise the original rejection rather than report success.
 */
export function salvageAiPlan(
  candidate: AiPlan,
  kernel: BuilderKernel,
  ports: AiValidationPorts,
  policy?: AiEffectiveCommandPolicy,
  composition?: AiDoorComposition,
): SalvagedAiPlan | undefined {
  const kept: AiPlanStep[] = [];
  const dropped: DroppedAiPlanStep[] = [];

  candidate.commands.forEach((step, index) => {
    const trial: AiPlan = { ...candidate, commands: [...kept, step] };
    const result = validateAiPlan(trial, kernel, ports, policy, composition);
    if (result.ok) {
      kept.push(step);
      return;
    }
    dropped.push({
      step: index + 1,
      command: step.command,
      /*
        Issue `step` is the ZERO-based index into the trial plan, so the step
        under test is at `kept.length` — the position after everything already
        kept. Everything before it is known good, so an issue naming any other
        index is about the plan as a whole (a policy limit, say) rather than
        about this command.
      */
      reason:
        result.issues.find((issue) => issue.step === kept.length)?.message ??
        result.issues[0]?.message ??
        'The door refused this step and gave no reason.',
    });
  });

  if (kept.length === 0) return undefined;

  const salvaged = validateAiPlan(
    { ...candidate, commands: kept },
    kernel,
    ports,
    policy,
    composition,
  );
  /*
    Unreachable by construction: the last accepted trial WAS this plan. It is
    checked rather than asserted because the alternative to a false belief here
    is applying an unvalidated plan to a person's document.
  */
  if (!salvaged.ok) return undefined;

  return { plan: salvaged.plan, kept: kept.length, dropped };
}
