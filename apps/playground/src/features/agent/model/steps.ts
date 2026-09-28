import type { PlanStep } from './turns';

/**
 * A change plan's steps (SPEC §4.12 StepPlanCard): one numbered, read-only step per line
 * the model wrote, in its own words. Plan mode's answer to an edit request is prose (the
 * engine's `outlineAiPlan`), and the card numbers the steps itself, so a leading list
 * marker the model typed ("1.", "-", "•", «١.») is taken off rather than shown twice.
 * Each step names the block the request was about, when it was about one.
 */

const LIST_MARKER = /^(?:[-*•–]\s*|(?:\d+|[٠-٩]+)[.)،:-]\s*|#+\s+)/u;

export function stepsOf(text: string, target?: string): readonly PlanStep[] {
  return text
    .split(/\r?\n/u)
    .map((line) => line.trim().replace(LIST_MARKER, '').trim())
    .filter((line) => line !== '')
    .map((line, index) => ({
      key: `step-${String(index + 1)}`,
      text: line,
      ...(target === undefined || target === '' ? {} : { target }),
    }));
}
