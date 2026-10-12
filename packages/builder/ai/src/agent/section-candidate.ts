import type { JsonValue } from '@craftkit/builder-schema';

import type { AiPlan, AiPlanValidationIssue } from '../types';
import { checkScene } from './page-plan/check-scene';
import { checkSection, type CheckSectionOptions } from './page-plan/check-section';
import type {
  LandedSection,
  PagePlan,
  SectionCheckIssue,
  SectionContract,
} from './page-plan/types';
import type { AiBuildSectionValues } from './types';

/*
  A written section as step E reads it, before it lands (split from
  run-build.ts, creative-power Phase 1 B, 2026-10-12): the region's props a
  writer's kept steps leave — tree, css and now its scene — and the one check
  that holds them to the contract (`checkSection`) and the scene to its code
  (`checkScene`), with what both found phrased for the repair round.
*/

/** A region's props as the checker and the neighbour summary read them. */
export function sectionOf(values: AiBuildSectionValues): LandedSection {
  const tree: JsonValue = values.tree ?? null;
  return {
    tree,
    ...(typeof values.css === 'string' ? { css: values.css } : {}),
    ...(typeof values.js === 'string' && values.js.trim() !== '' ? { js: values.js } : {}),
  };
}

/** A section's writer-owned props as a plan's kept steps would leave them, over the placeholder. */
export function candidateSection(
  commands: AiPlan['commands'],
  placeholder: AiBuildSectionValues,
): LandedSection {
  let section: LandedSection = sectionOf(placeholder);
  for (const step of commands) {
    if (typeof step.args !== 'object' || step.args === null) continue;
    const { key, value } = step.args as { key?: unknown; value?: unknown };
    if (key === 'tree') section = { ...section, tree: value as JsonValue };
    if ((key === 'css' || key === 'js') && typeof value === 'string') {
      section = { ...section, [key]: value };
    }
    if (key === 'jsParams') section = { ...section, jsParams: value as JsonValue };
  }
  return section;
}

/** The checker never costs a section: one that throws found nothing. */
export function guardedCheck(
  check: () => readonly SectionCheckIssue[],
): readonly SectionCheckIssue[] {
  try {
    return check();
  } catch {
    return [];
  }
}

/**
 * Step E on a written section: its contract, then its scene — the scene's
 * lookups may name any section's anchor. Each half guarded on its own, so a
 * contract check that throws never hides what the scene check found.
 */
export function checkWritten(
  plan: PagePlan,
  contract: SectionContract,
  section: LandedSection,
  options: CheckSectionOptions,
): readonly SectionCheckIssue[] {
  return [
    ...guardedCheck(() => checkSection(plan, contract, section, options)),
    ...guardedCheck(() =>
      checkScene(section, { pageIds: plan.sections.map(({ anchorId }) => anchorId) }),
    ),
  ];
}

/** The checker's findings on the repair wire: each one the instruction that fixes it. */
export function repairIssues(
  issues: readonly SectionCheckIssue[],
): readonly AiPlanValidationIssue[] {
  return issues.map(({ code, message, path }) => ({
    code: 'invalid-plan' as const,
    message: `${code}: ${message}${path === undefined ? '' : ` (at ${path})`}`,
  }));
}
