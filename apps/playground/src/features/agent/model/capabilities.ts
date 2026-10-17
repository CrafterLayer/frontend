import * as builder from '@craftkit/builder';
import type {
  AiBuildOwnEvent,
  AiBuildTaskReport,
  PagePlan,
  RunAiBuildOptions,
} from '@craftkit/builder';

import type { AgentCapabilities } from './view-types';

/**
 * Which engine prerequisites are present (SPEC §7.3 `AgentCapabilities`, §7.6), read off
 * the engine itself rather than set by hand: a flag written `true` in the controller once
 * the engine "should" have shipped something is exactly how a panel ends up offering an
 * action the engine cannot perform.
 *
 * Two kinds of evidence, each where it can be had:
 * - a FUNCTION is looked up on the engine's runtime surface (`typeof … === 'function'`),
 *   so a build without it, or a test stub that leaves it out, drops the flag;
 * - a FIELD of an event or a report has no runtime existence until a build emits it, so it
 *   is witnessed by the engine's TYPES below: each `true satisfies Has<…>` stops compiling
 *   the day the engine removes that field, and the flag cannot outlive it silently.
 */

/** `true` when `T` declares `K` (optional or not), `false` otherwise. */
type Has<T, K extends PropertyKey> = K extends keyof T ? true : false;

type PlannedEvent = Extract<AiBuildOwnEvent, { type: 'build.planned' }>;
type SkippedEvent = Extract<AiBuildOwnEvent, { type: 'task.skipped' }>;

/* E4: each section report carries the plan's sample facts. */
const REPORTS_CARRY_FACTS: Has<AiBuildTaskReport, 'facts'> = true;
/* E5: why a section was skipped, as data, on the live event and on the report. */
const SKIPS_CARRY_REASON_CODES: Has<SkippedEvent, 'reasonCode'> = true;
const REPORTS_CARRY_REASON_CODES: Has<AiBuildTaskReport, 'reasonCode'> = true;
/* E1: how many sections are written at once, on `build.planned`. */
const PLANNED_CARRIES_WRITERS: Has<PlannedEvent, 'writers'> = true;
/* E6: a build takes a structured plan to build verbatim. */
const BUILD_TAKES_PAGE_PLAN: Has<RunAiBuildOptions, 'pagePlan'> = true;
/* E7: the structured plan carries its tokens and faces. */
const PLAN_CARRIES_TOKENS: Has<PagePlan, 'tokens'> = true;

/**
 * A fact the engine's types vouch for, as a plain boolean. The parameter is typed `true`,
 * so a witness above that turned `false` (its field gone) no longer compiles here either.
 */
function witnessed(fact: true): boolean {
  return fact;
}

/**
 * The engine's runtime surface the flags read: the `@craftkit/builder` facade satisfies
 * it, and a test passes a copy with a function taken out. `revertBuild` and
 * `restoreBefore` are SPEC §7.6 E3's names for what does not exist yet.
 */
export interface EngineSurface {
  readonly revertBuildSection?: unknown;
  readonly removeUnfilledSections?: unknown;
  readonly planAiPage?: unknown;
  readonly validatePagePlan?: unknown;
  readonly fillConcurrencyFor?: unknown;
  /** E3: undo a whole build as one forward step, skeleton included. */
  readonly revertBuild?: unknown;
  /** E3: put the page back to before a transaction, with conflict detection. */
  readonly restoreBefore?: unknown;
}

const isFunction = (value: unknown): boolean => typeof value === 'function';

/**
 * The §7.6 flags for the engine in hand (the facade by default).
 *
 * - `rowUndo`: `revertBuildSection`, one section put back forward (E0e).
 * - `undoBuild`: E3's `revertBuild`. Reverting every landed section (`revertBuildSection`)
 *   and then the placeholders (`removeUnfilledSections`) is NOT a whole-build undo: a
 *   region the skeleton wrote in full refuses as `not-landed`, and the skeleton's page
 *   CSS, font import and document meta have no revert at all, so the composite would leave
 *   half a build on the page and call it undone. Until E3, false, and the controller's
 *   kernel-undo fallback (SPEC §7.6 E3 "until present") is what the record offers.
 * - `restore`: E3's `restoreBefore`; absent, false.
 * - `facts`: section reports carry the plan's facts (E4).
 * - `failureClasses`: skips carry a reason code (E5).
 * - `editablePlan`: Plan mode can ask for a structured plan (`planAiPage`), the card can
 *   check an edit (`validatePagePlan`), and a build takes it verbatim (`pagePlan`) (E6).
 * - `structuredDirection`: the structured plan carries tokens and faces, and the card can
 *   check them (E7).
 * - `estimate`: the writer count arrives on `build.planned`, or can be computed with
 *   `fillConcurrencyFor` (E1).
 * - `canvasStage`: false. The stage is the shell's (`createStageMarks`, EditorCanvas
 *   `onStageHandle`), SPEC §7.6 E8 and WP-21, not an engine export this can look up.
 */
export function capabilitiesFromEngine(engine: EngineSurface = builder): AgentCapabilities {
  const validates = isFunction(engine.validatePagePlan);
  return {
    rowUndo: isFunction(engine.revertBuildSection),
    undoBuild: isFunction(engine.revertBuild),
    restore: isFunction(engine.restoreBefore),
    facts: witnessed(REPORTS_CARRY_FACTS),
    failureClasses: witnessed(SKIPS_CARRY_REASON_CODES) && witnessed(REPORTS_CARRY_REASON_CODES),
    editablePlan: witnessed(BUILD_TAKES_PAGE_PLAN) && validates && isFunction(engine.planAiPage),
    structuredDirection: witnessed(PLAN_CARRIES_TOKENS) && validates,
    estimate: witnessed(PLANNED_CARRIES_WRITERS) || isFunction(engine.fillConcurrencyFor),
    canvasStage: false,
  };
}
