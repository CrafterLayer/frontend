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
import {
  isProbedScene,
  sceneProbeRun,
  type SceneProbe,
  type SceneProbeContext,
} from './scene-probe';
import { claimSceneReview, sceneReviewFindings, type SceneCheckHost } from './scene-review';
import { testedScenePreset } from './scene-review-economy';
import type { AiBuildSectionValues } from './types';

/*
  A written section as step E reads it, before it lands (split from
  run-build.ts, creative-power Phase 1 B, 2026-10-12): the region's props a
  writer's kept steps leave — tree, css and now its scene — and the one check
  that holds them to the contract (`checkSection`) and the scene to its code
  (`checkScene`), with what both found phrased for the repair round. A
  browser host may also RUN a scene section before it lands (creative-power
  Phase 2 E, scene-probe.ts): what that finds joins the same round — and,
  once per section, what the model SEES wrong in a picture of it
  (scene-review.ts, 2026-10-13) — unless its code is a catalogued preset
  or kit unchanged, which is run but not looked at (scene-review-economy.ts).
*/

/** Step E's findings: at once, or — when a scene is run — once it has run. */
export type WrittenIssues = readonly SectionCheckIssue[] | Promise<readonly SectionCheckIssue[]>;

export interface CheckWrittenOptions extends CheckSectionOptions {
  /**
   * The build (its `RunAiBuildOptions`): its `sceneProbe` runs a scene section in a browser,
   * its provider may look at a picture of it (`visualReview`), its signal stops both.
   */
  readonly scene?: SceneCheckHost | undefined;
  /** Runs a scene section in a browser when no `scene` is given; absent, nothing runs. */
  readonly sceneProbe?: SceneProbe | undefined;
  /** The build's signal when no `scene` is given: a Stop also stops a scene being run. */
  readonly signal?: AbortSignal | undefined;
}

/** A region's props as the checker and the neighbour summary read them. */
export function sectionOf(values: AiBuildSectionValues): LandedSection {
  const tree: JsonValue = values.tree ?? null;
  return {
    tree,
    ...(typeof values.css === 'string' ? { css: values.css } : {}),
    ...(typeof values.js === 'string' && values.js.trim() !== '' ? { js: values.js } : {}),
    ...(values.jsParams === undefined ? {} : { jsParams: values.jsParams }),
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

function isPending(issues: WrittenIssues): issues is Promise<readonly SectionCheckIssue[]> {
  return typeof (issues as { then?: unknown }).then === 'function';
}

/** A check that throws or rejects found nothing: the checker never costs a section. */
export function checkedIssues(
  job: { readonly check?: ((landed: LandedSection) => WrittenIssues) | undefined },
  landed: LandedSection,
): WrittenIssues {
  const { check } = job;
  if (check === undefined) return [];
  let found: WrittenIssues;
  try {
    found = check(landed);
  } catch {
    return [];
  }
  return isPending(found) ? found.catch(() => []) : found;
}

/**
 * Step E on a written section: its contract, then its scene — the scene's
 * lookups may name any section's anchor. Each half guarded on its own, so a
 * contract check that throws never hides what the scene check found. Given a
 * `sceneProbe`, a scene section whose code the static check passed is then
 * RUN (in the page's language and direction) and what that found is added —
 * then, at the section's FIRST check only, what a look at its picture found
 * (scene-review.ts); otherwise the findings are returned at once, exactly as before.
 */
export function checkWritten(
  plan: PagePlan,
  contract: SectionContract,
  section: LandedSection,
  options: CheckWrittenOptions,
): WrittenIssues {
  const scene = guardedCheck(() =>
    checkScene(section, { pageIds: plan.sections.map(({ anchorId }) => anchorId) }),
  );
  const found = [...guardedCheck(() => checkSection(plan, contract, section, options)), ...scene];
  const host = options.scene;
  const probe = host?.sceneProbe ?? options.sceneProbe;
  if (probe === undefined || !isProbedScene(section)) return found;
  // The one look is claimed at the first check, even one the static check fails — and spent
  // without a model call on a tested preset or kit (the probe still runs it).
  const look = claimSceneReview(host, contract.key) && testedScenePreset(section) === undefined;
  if (scene.length > 0) return found;
  const { lang, dir } = plan.locale;
  const signal = host === undefined ? options.signal : host.signal;
  const context: SceneProbeContext = {
    lang,
    dir,
    ...(signal === undefined ? {} : { signal }),
    ...(look ? { thumbnails: true as const } : {}),
  };
  return sceneProbeRun(probe, section, context).then(async ({ issues: ran, report }) => {
    const seen =
      look && host !== undefined
        ? await sceneReviewFindings(host, plan, contract, report, section)
        : [];
    return [...found, ...ran, ...seen];
  });
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
