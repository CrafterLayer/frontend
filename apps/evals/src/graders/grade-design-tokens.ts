import type { EvalRunOutput } from '../harness/output';

import { hardCodedColours } from './plan-inspect';
import { failed, passed, type GradeResult } from './types';

/**
 * Did the plan colour the page through the design system, or with its own hex?
 *
 * The failure this prevents is specific and expensive: a page half in the
 * customer's brand colours and half in Tailwind blue reads as broken rather
 * than as themed, and re-pointing the theme afterwards fixes only half of it.
 *
 * The rule stops at block props. Colour inside an assistant's own custom code
 * and custom CSS is free by an explicit product decision — a gradient headline
 * or a keyframe cannot be written in token utilities, and refusing hex there
 * made the feature unusable — so `plan-inspect.ts` excludes those props and
 * this grader must never widen to them.
 */
export function gradeDesignTokens(output: EvalRunOutput): GradeResult {
  if (output.plan === null) {
    return output.outcome === 'refusal'
      ? passed('No colours to check: the run refused.')
      : failed(`The run produced no plan: ${output.failure?.message ?? 'no message'}`);
  }

  const findings = hardCodedColours(output.plan);
  if (findings.length > 0) {
    return failed(
      `The plan hard-codes ${String(findings.length)} colour(s) the theme cannot reach: ${findings
        .map((finding) => `${finding.value} on ${finding.where} (${finding.reason})`)
        .join(', ')}. Use a colour role such as bg-accent, text-text-muted, or a block's own tone prop.`,
    );
  }
  return passed('Every colour in the plan is expressed through the design system.');
}
