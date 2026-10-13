import type {
  AiContextProvider,
  BuilderDocument,
  JsonValue,
  NodeId,
} from '@craftkit/builder-schema';

import { estimateAssembledAiContextTokens } from '../context';
import { canonicalJsonStringify } from '../internal/canonical-json';
import { isCatalogPhotoUrl } from '../context/providers/photo-catalog';
import type { IntentKind, IntentTarget } from '../intent';
import { applyAiPlan, type AppliedAiPlan } from '../plan/apply-plan';
import { repairAiPlanForIssues } from '../plan/generate-plan';
import { readProviderUsage } from '../provider/usage';
import { createAiValidatedProposal, type AiValidatedProposal } from '../plan/validated-proposal';
import { AiPlanRejectedError } from '../plan/validate-plan';
import type { AiSkillPrepareOptions, AiSkillRegistry } from '../skills';
import { pixiSkillIdsFor } from '../skills/creative/pixi-selection';
import { seoAutofixPlan, SEO_AUTOFIX_LABEL } from '../seo/autofix';
import { agentToolPrompt } from '../tools/agent/catalog-prompt';
import { expandAgentTools } from '../tools/agent/expand';
import { AGENT_TOOL_COMMAND, type AgentToolLane } from '../tools/agent/types';
import { readSectionValues } from './build-revert';
import { classifyAiRunFailure, type AiRunFailure } from './errors';
import { checkSection, tokeniseColourClasses } from './page-plan/check-section';
import { completeKitSlots, fillSlotPhotos, pagePhotoPlan } from './page-plan/kit-slots';
import { planKit, planKitIndex, writerKitRoles } from './page-plan/kits';
import { sectionScriptCard } from './section-script-card';
import {
  candidateSection,
  checkedIssues,
  checkWritten,
  guardedCheck,
  repairIssues,
  sectionOf,
  type WrittenIssues,
} from './section-candidate';
import { nextSection } from './section-order';
import { fillConcurrencyFor, withWriterPermit } from './writer-pool';
import {
  buildLessons,
  creativeRequestOf,
  sectionProviders,
  withPhotoCatalog,
  writesScene,
} from './section-providers';
import { stepSkills, withHostSkills } from './host-skills';
import { summarizeNeighbours } from './page-plan/neighbours';
import {
  provisionalCandidate,
  reconcilePlans,
  sectionFingerprint,
  startPlanDraft,
  withBrief,
  type PlanDraft,
} from './page-plan/plan-draft';
import { createPlanStreamReader, type PlanStreamEvent } from './page-plan/plan-stream';
import {
  PAGE_KIT_CLASSES,
  skeletonFinish,
  skeletonFromPlan,
  type SkeletonFromPlanContext,
} from './page-plan/skeleton-from-plan';
import type {
  LandedSection,
  PagePlan,
  PagePlanIssue,
  SectionCheckIssue,
  SectionContract,
} from './page-plan/types';
import { validatePagePlan } from './page-plan/validate-page-plan';
import {
  designMarkup,
  fittingSkillIds as fittingSkills,
  landingTarget,
  PAGE_PLAN_STEP,
  proposeValidatedPagePlan,
  withRequestedLook,
  type PagePlanStepNote,
} from './plan-page';
import { runAiAgent } from './run-agent';
import type { AiPagePlanDraftEvent, AiPlan, AiPlanProvider, AiPlanStep } from '../types';
import type {
  AiAgentEvent,
  AiAgentRunResult,
  AiBuildOutcome,
  AiBuildOutOfScopeStep,
  AiBuildOwnEvent,
  AiBuildPlanAnswer,
  AiBuildPlanFallback,
  AiBuildPlannedTask,
  AiBuildRunResult,
  AiBuildSectionCheck,
  AiBuildSectionKey,
  AiBuildSectionLanding,
  AiBuildSectionValues,
  AiBuildSkipReasonCode,
  AiBuildStopReason,
  AiBuildTask,
  AiBuildTaskFact,
  AiBuildTaskReport,
  AiBuildUnfilledSection,
  RunAiAgentOptions,
  RunAiBuildOptions,
} from './types';

/** Sections a build will fill before it reports the rest as not started. */
export const DEFAULT_AI_BUILD_MAX_TASKS = 12;
/** Ceiling for ONE section. Only that section's run is aborted. */
export const DEFAULT_AI_BUILD_TASK_TIMEOUT_MS = 240_000;
/** A scene writer's ceiling when the caller set none: page code is the slowest write. */
export const DEFAULT_AI_BUILD_SCENE_TASK_TIMEOUT_MS = 420_000;
/** Ceiling for the whole build. The running section still finishes. */
export const DEFAULT_AI_BUILD_BUDGET_MS = 900_000;
// How many write at once, and the pool several builds share (T230): writer-pool.ts.
export { fillConcurrencyFor, MAX_AI_BUILD_AUTO_FILL_CONCURRENCY } from './writer-pool';

const MAX_RUN_ID_LENGTH = 160;
/** The kernel refuses a longer grouped-dispatch label outright. */
const MAX_LABEL_LENGTH = 160;
const SCAFFOLD_COMMANDS: readonly string[] = Object.freeze(['insertNode', 'setProp', 'setDocMeta']);
const FILL_COMMANDS: readonly string[] = Object.freeze(['setProp']);
/** The only props a section writer may set, and only on its own region. */
const FILL_KEYS: readonly AiBuildSectionKey[] = Object.freeze(['tree', 'css']);
/** With free code mode on a writer may also give its region a scene: its own `js`. */
const FILL_KEYS_WITH_CODE: readonly AiBuildSectionKey[] = Object.freeze(['tree', 'css', 'js']);
const SCAFFOLD_SKILL = 'craftkit.build-scaffold';
const FILL_SKILL = 'craftkit.build-fill';
/**
 * What a section writer is taught, beyond `craftkit.build-fill` and the
 * always-on manual. Chosen here, never matched from the request's words.
 */
const FILL_SKILLS: readonly string[] = Object.freeze(['craftkit.copywriting']);
const ARABIC_FILL_SKILL = 'craftkit.arabic-rtl';
/**
 * Section-level expertise another workstream is adding (2026-09-28). Asked for
 * only when the registry holds it, so the build works in either order.
 */
const PHOTO_DIRECTION_SKILL = 'craftkit.photo-direction';
/**
 * The variant library a markup writer builds from. A KIT-backed writer never
 * gets it (2026-09-30): the kit index — one line per kit — replaces its
 * ~2.8k tokens, because the kit already is the layout.
 */
const SECTION_VARIANTS_SKILL = 'craftkit.section-variants';
const FILL_SKILLS_WHEN_PRESENT: readonly string[] = Object.freeze([
  SECTION_VARIANTS_SKILL,
  PHOTO_DIRECTION_SKILL,
]);
const SCAFFOLD_SKILLS_WHEN_PRESENT: readonly string[] = Object.freeze(['craftkit.direction-deck']);
/** The block a section region is. A page plan is laid only where the registry has it. */
const REGION_TYPE = 'customCode';
const SCAFFOLD_LABEL = 'Assistant: page skeleton';
const RTL_LABEL = 'Assistant: right-to-left page';
const DIRECTION_HEADING = 'THE DIRECTION (decided for the whole page — obey it exactly):';
const SENTENCE_ENDS = /[.!?؟。\n]/gu;
/** A direction is under 60 words by contract; this only bounds one that ignored it. */
const MAX_RETRY_DIRECTION = 600;

type BuildEventPayload<T = AiBuildOwnEvent> = T extends AiBuildOwnEvent
  ? Omit<T, 'runId' | 'seq' | 'at'>
  : never;

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function assertBuildRunId(runId: string): void {
  if (
    typeof runId !== 'string' ||
    runId.trim().length === 0 ||
    runId.length > MAX_RUN_ID_LENGTH - 16
  ) {
    throw new RangeError(
      `runId must be a non-empty string of at most ${String(MAX_RUN_ID_LENGTH - 16)} characters, so every step's own run id fits inside the kernel's limit.`,
    );
  }
}

/** `<build>/<step>`: every inner event says which step it belongs to. */
function stepRunId(runId: string, step: string): string {
  return `${runId}/${step}`;
}

function stepLabel(position: number, total: number, title: string): string {
  return `Assistant: ${String(position)}/${String(total)} — ${title}`.slice(0, MAX_LABEL_LENGTH);
}

function createBuildEmitter(options: RunAiBuildOptions): (payload: BuildEventPayload) => void {
  let seq = 0;
  return (payload) => {
    const event = Object.freeze({
      ...payload,
      runId: options.runId,
      seq,
      at: options.clock.now(),
    }) as AiBuildOwnEvent;
    seq += 1;
    try {
      options.onEvent?.(event);
    } catch {
      // Observers are telemetry consumers; they cannot steer the build.
    }
  };
}

/**
 * Everything a step inherits from the caller. `apply`, `label`, `runId` and
 * `request` are the orchestrator's to decide; nothing else is reinterpreted.
 *
 * `speaking` gates the steps' events. Once the build has reported its end, a
 * writer that ignored Stop and answered late has nothing left to say: the
 * person was told the build ended, and a step event after that would be a
 * section "working" on a page that already stopped.
 */
function sharedStepOptions(
  options: RunAiBuildOptions,
  speaking: () => boolean,
): Omit<RunAiAgentOptions, 'apply' | 'label' | 'request' | 'runId'> {
  const isCurrentRun = options.isCurrentRun;
  const onEvent = options.onEvent;
  return {
    clock: options.clock,
    kernel: options.kernel,
    provider: options.provider,
    validationPorts: options.validationPorts,
    ...(options.selection === undefined ? {} : { selection: options.selection }),
    ...(options.contextProviders === undefined
      ? {}
      : { contextProviders: options.contextProviders }),
    ...(options.additionalContextProviders === undefined
      ? {}
      : { additionalContextProviders: options.additionalContextProviders }),
    ...(options.history === undefined ? {} : { history: options.history }),
    ...(options.skillRegistry === undefined ? {} : { skillRegistry: options.skillRegistry }),
    ...(options.selectedSkillIds === undefined
      ? {}
      : { selectedSkillIds: options.selectedSkillIds }),
    ...(options.policy === undefined ? {} : { policy: options.policy }),
    ...(options.composition === undefined ? {} : { composition: options.composition }),
    // Free code mode is the person's, for the whole build: every step's request carries it.
    ...(options.freeCode === true ? { freeCode: true } : {}),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    /*
      A step's run id is NOT the build's, so the caller's lease check would
      reject every step if it were forwarded as-is. It is asked about the one
      id it issued: the build's.
    */
    ...(isCurrentRun === undefined
      ? {}
      : { isCurrentRun: (): boolean => isCurrentRun(options.runId) }),
    ...(onEvent === undefined
      ? {}
      : {
          onEvent: (event) => {
            if (speaking()) onEvent(event);
          },
        }),
  };
}

/**
 * The skills a step asks for by name — see `fittingSkillIds` in plan-page.ts.
 *
 * None without a registry: naming a skill with nowhere to read it from is
 * refused by generation ("selectedSkillIds requires a skillRegistry"), and
 * a registry-less build lost every section to it — each writer asked for
 * the fill skill by name, failed twice and was skipped (found 2026-09-28 by
 * the plan-path tests, which build with no registry).
 */
function fittingSkillIds(
  options: RunAiBuildOptions,
  required: readonly string[],
  optional: readonly string[],
): readonly string[] {
  if (options.skillRegistry === undefined) return [];
  const offered = withHostSkills(options, optional, required);
  return fittingSkills(options.skillRegistry, options.policy, required, offered);
}

/**
 * The scaffold keeps the page-level expertise its request matches (it is the
 * one step that decides the page) and adds the direction deck when it exists.
 */
function scaffoldSkillIds(options: RunAiBuildOptions): readonly string[] {
  return fittingSkillIds(options, [SCAFFOLD_SKILL], SCAFFOLD_SKILLS_WHEN_PRESENT);
}

/**
 * The registry as ONE step of a build sees it: every `prepare` is asked for
 * the step's own intent, whatever the words read as.
 *
 * Generation now routes a request against the page it is about when no host
 * route is given (generate-plan `skillIntentForGeneration`, 2026-09-28): an
 * edit on a page with content no longer loads a whole-page playbook. A build
 * step is not an edit, though. The scaffold carries the person's BRIEF as
 * its request, and on a page with content a bare subject («حلويات شرقية
 * وكنافة») routes as an edit there — the trade's page skill would be gated
 * out of the one step that decides the page. So the build names each step's
 * intent itself: the page's steps `build-page`, a section writer
 * `add-section`. A view, not an option, because the step runs through
 * `runAiAgent`, which hands generation its registry and nothing else of this.
 */
function stepSkillRegistry(
  registry: AiSkillRegistry | undefined,
  intent: IntentKind,
): AiSkillRegistry | undefined {
  if (registry === undefined) return undefined;
  return Object.freeze({
    list: () => registry.list(),
    get: (id: string) => registry.get(id),
    readSkill: (id: string) => registry.readSkill(id),
    listReferences: (id: string) => registry.listReferences(id),
    readReference: (id: string, path: string) => registry.readReference(id, path),
    prepare: (prepare: AiSkillPrepareOptions) => registry.prepare({ ...prepare, intent }),
  });
}

/** The page's own steps — T1, the scaffold, the one ordinary run — build a page. */
const PAGE_STEP_INTENT: IntentKind = 'build-page';
/** A section writer writes one section of it. */
const SECTION_STEP_INTENT: IntentKind = 'add-section';

/** The skill registry override for a page step, spread over the shared step options. */
function pageStepSkills(options: RunAiBuildOptions): { skillRegistry?: AiSkillRegistry } {
  const skills = stepSkillRegistry(options.skillRegistry, PAGE_STEP_INTENT);
  return skills === undefined ? {} : { skillRegistry: skills };
}

/**
 * A section writer's skills, named rather than matched.
 *
 * Measured 2026-09-28 (agent-audit.md P1-12): with the original request in its
 * brief, keyword matching handed every writer of an Arabic café page
 * page-composition, visual-direction, conversion-recipes and
 * structure-recipes on top of its own — ~21.5k characters of skills, much of
 * it telling a writer to decide a palette the direction had already decided.
 * The writer now gets the fill skill, the copy rules, the Arabic rules on an
 * Arabic page, and the section-level skills once they exist.
 *
 * `photos: false` leaves out photo-direction: a page-plan section whose
 * contract names no image is type-led, and the skill would only teach it how
 * to place photos it must not use (~640 tokens a writer).
 */
function fillSkillIds(
  options: RunAiBuildOptions,
  arabic: boolean,
  photos = true,
  variants = true,
  creativeRequest = '',
): readonly string[] {
  const registry = options.skillRegistry;
  const named = [...FILL_SKILLS, ...(arabic ? [ARABIC_FILL_SKILL] : [])].filter(
    (id) => registry?.get(id) !== undefined,
  );
  return fittingSkillIds(
    options,
    [FILL_SKILL, ...named],
    [
      ...pixiSkillIdsFor(registry, creativeRequest),
      ...FILL_SKILLS_WHEN_PRESENT.filter(
        (id) =>
          (photos || id !== PHOTO_DIRECTION_SKILL) && (variants || id !== SECTION_VARIANTS_SKILL),
      ),
    ],
  );
}

/** The label the scaffold gave a node it created, if it gave one. */
function nodeTitle(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const props: unknown = (value as { props?: unknown }).props;
  if (typeof props !== 'object' || props === null) return undefined;
  const label: unknown = (props as { label?: unknown }).label;
  if (typeof label !== 'string') return undefined;
  const trimmed = label.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

/**
 * Correlate created regions with their titles from the SAME patch, never by
 * position: a plan's command order and its patch order are not a contract, and
 * a build that mixed up two ids would write the pricing table into the hero.
 *
 * Read by the SHAPE of the path, not its root. A document kernel reports a
 * created node at `['nodes', id]`; the page lens the product actually hands
 * the assistant reports the same insertion at
 * `['pages', i, 'document', 'nodes', id]`. Matching on the root alone made
 * every live scaffold count as zero sections, so the build silently fell back
 * to one ordinary run and the parallel writers never ran in the product
 * (found live 2026-09-05, pinned in `run-build.site-kernel.test.ts`). The
 * tail is what keeps it precise: `['nodes', id, 'props', key]` ends at a prop
 * and `['nodes']` names nothing — the same rule `insertedNodeId` in
 * builder-core settled on.
 */
function titlesByCreatedId(applied: AppliedAiPlan | undefined): Map<NodeId, string> {
  const titles = new Map<NodeId, string>();
  for (const patch of applied?.transactions[0]?.patches ?? []) {
    if (patch.op !== 'add' || patch.path.length < 2) continue;
    if (patch.path[patch.path.length - 2] !== 'nodes') continue;
    const id = patch.path[patch.path.length - 1];
    if (typeof id !== 'string') continue;
    const title = nodeTitle(patch.value);
    if (title === undefined) continue;
    titles.set(id, title);
  }
  return titles;
}

/**
 * The sections a scaffold PLAN would create, in the order it wrote them.
 *
 * Read from the plan's own commands rather than from applied patches, because
 * under `apply: 'never'` nothing was applied and there are no patches to read.
 * Command order is the only order available here — and unlike the applied path
 * it is also the only one that could be wrong, which is exactly why the applied
 * path does not use it: there, document order is knowable and truer.
 */
function plannedTitles(plan: AiPlan): readonly AiBuildPlannedTask[] {
  const planned: AiBuildPlannedTask[] = [];
  for (const step of plan.commands) {
    if (step.command !== 'insertNode') continue;
    const title = nodeTitle(step.args);
    if (title === undefined) continue;
    planned.push({ title });
  }
  return Object.freeze(planned);
}

/**
 * Reading order comes from the DOCUMENT, because that is the order the person
 * will read the page in — a scaffold is free to insert its last section first.
 */
function inDocumentOrder(
  document: BuilderDocument,
  titles: ReadonlyMap<NodeId, string>,
): readonly AiBuildTask[] {
  const ordered: AiBuildTask[] = [];
  const seen = new Set<NodeId>();
  const visit = (id: NodeId): void => {
    if (seen.has(id)) return;
    seen.add(id);
    const title = titles.get(id);
    if (title !== undefined) ordered.push({ id, title });
    const slots = document.nodes[id]?.slots;
    if (slots === undefined) return;
    for (const children of Object.values(slots)) {
      for (const child of children) visit(child);
    }
  };
  visit(document.rootId);
  // A region the walk never reached is still the build's to fill; patch order
  // is the only order left for it, and losing it silently would be worse.
  for (const [id, title] of titles) {
    if (!seen.has(id)) ordered.push({ id, title });
  }
  return Object.freeze(ordered);
}

/**
 * What a region is FOR, which decides its shell.
 *
 * Read from the skeleton, never from the position. The fill skill used to key
 * the hero on the literal "SECTION 1": the retry request never carried that
 * line, so a hero that failed once came back as a band with no page h1, and a
 * page that opened with a navbar gave the navbar the hero shell. The scaffold
 * now marks roles in its placeholders — the opening region's heading is the
 * page's one h1, site chrome is a header or footer — and this reads them back.
 */
type SectionRole = 'hero' | 'chrome' | 'band';

const ROLE_LINE: Readonly<Record<SectionRole, string>> = {
  hero: "ROLE: HERO — the page's opening screen; this region holds the page's one h1.",
  chrome:
    'ROLE: CHROME — the site header, navigation or footer its title names; no h1 and no hero shell.',
  band: 'ROLE: BAND — a content section; keep its h2 text.',
};

const CHROME_TAGS: ReadonlySet<string> = new Set(['footer', 'header', 'nav']);
const ROLE_SCAN_LIMIT = 200;

interface PlaceholderShape {
  readonly outer: string | undefined;
  readonly holdsH1: boolean;
}

/** The outer tag of a stored region tree, and whether an h1 sits anywhere in it. */
function placeholderShape(tree: unknown): PlaceholderShape {
  const children: unknown =
    typeof tree === 'object' && tree !== null ? (tree as { children?: unknown }).children : [];
  const first: unknown = Array.isArray(children) ? children[0] : undefined;
  const outer: unknown =
    typeof first === 'object' && first !== null ? (first as { tag?: unknown }).tag : undefined;
  let holdsH1 = false;
  // Bounded: a placeholder is a handful of nodes, and a hostile tree costs nothing here.
  const stack: unknown[] = [tree];
  for (let seen = 0; stack.length > 0 && seen < ROLE_SCAN_LIMIT && !holdsH1; seen += 1) {
    const node = stack.pop();
    if (typeof node !== 'object' || node === null) continue;
    const record = node as { tag?: unknown; children?: unknown };
    if (record.tag === 'h1') holdsH1 = true;
    if (Array.isArray(record.children)) stack.push(...(record.children as unknown[]));
  }
  return { outer: typeof outer === 'string' ? outer : undefined, holdsH1 };
}

/**
 * One role per task, in task order. The region holding an h1 opens the page;
 * a skeleton that marked none falls back to the first region that is not
 * chrome — the old "section 1" answer, minus the navbar it got wrong.
 */
function sectionRoles(
  document: BuilderDocument,
  tasks: readonly AiBuildTask[],
): readonly SectionRole[] {
  const shapes = tasks.map((task) => placeholderShape(document.nodes[task.id]?.props['tree']));
  const chrome = shapes.map(({ outer }) => outer !== undefined && CHROME_TAGS.has(outer));
  const marked = shapes.findIndex(({ holdsH1 }) => holdsH1);
  const hero = marked === -1 ? chrome.indexOf(false) : marked;
  return tasks.map((_task, index) =>
    index === hero ? 'hero' : chrome[index] === true ? 'chrome' : 'band',
  );
}

/** Where the section sits and what it is for — the same lines on every attempt. */
function sectionLines(
  task: AiBuildTask,
  position: number,
  total: number,
  role: SectionRole,
): readonly string[] {
  return [
    `SECTION ${String(position)} OF ${String(total)}: ${task.title}`,
    ROLE_LINE[role],
    `REGION ID: ${task.id}`,
  ];
}

function fillRequest(
  direction: string,
  task: AiBuildTask,
  position: number,
  total: number,
  role: SectionRole,
  request: string,
): string {
  return [
    DIRECTION_HEADING,
    direction,
    '',
    ...sectionLines(task, position, total, role),
    '',
    'THE ORIGINAL REQUEST (for subject matter only — the direction above wins):',
    request,
  ].join('\n');
}

/** The direction whole, unless it ran past its contract; then cut at a sentence end. */
function boundedDirection(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_RETRY_DIRECTION) return trimmed;
  const head = trimmed.slice(0, MAX_RETRY_DIRECTION);
  let end = 0;
  for (const match of head.matchAll(SENTENCE_ENDS)) end = match.index + 1;
  return end === 0 ? head : head.slice(0, end).trim();
}

/**
 * The second attempt is SHORTER, not louder. A fill that failed once usually
 * failed on size or on a contradiction inside a long brief, so the retry drops
 * the original request — and with it every page-wide skill its words matched.
 * It keeps what the section cannot be written without: the direction (its
 * palette and faces; the first sentence alone lost them), the position and
 * the role.
 */
function retryRequest(
  direction: string,
  task: AiBuildTask,
  position: number,
  total: number,
  role: SectionRole,
): string {
  return [
    DIRECTION_HEADING,
    boundedDirection(direction),
    '',
    ...sectionLines(task, position, total, role),
  ].join('\n');
}

function notStartedReason(reason: AiBuildStopReason): string {
  switch (reason) {
    case 'signal':
      return 'The build was stopped before this section started.';
    case 'budget':
      return 'The build budget ran out before this section started.';
    case 'max-tasks':
      return 'The build reached its task limit before this section started.';
  }
}

const STOPPED_WHILE_WRITING =
  'The build was stopped while this section was being written; nothing of it was applied.';
const STOPPED_BEFORE_LANDING =
  'The build was stopped before this section landed; nothing of it was applied.';

/**
 * A section attempt that failed for a reason the build names itself, as data
 * (E5): a timeout, or a writer that wrote nothing inside its region.
 */
class SectionAttemptError extends Error {
  override readonly name = 'SectionAttemptError';

  constructor(
    readonly code: AiBuildSkipReasonCode,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Why a section failed, as data a UI can translate (E5). The prose `reason`
 * stays English and exact; this is what a host shows in the person's language.
 */
function skipReasonCode(cause: unknown): AiBuildSkipReasonCode {
  if (cause instanceof SectionAttemptError) return cause.code;
  const failure: AiRunFailure = classifyAiRunFailure(cause);
  switch (failure.source) {
    case 'provider':
      return 'unreachable';
    case 'plan':
    case 'policy':
    case 'kernel':
      return 'invalid';
    default:
      return 'unknown';
  }
}

/**
 * Run `work` under the section's own deadline, WITH the caller's signal
 * chained in.
 *
 * It used to be the deadline alone — "an outer abort ends the build after
 * this section" — and measured on 2026-09-28 that meant Stop did not stop:
 * all five sections in flight landed up to 1.7 s after it, their provider
 * requests ran (and cost) to the end, and a person's Stop took as long as
 * the slowest writer (up to 240 s, 480 s with a retry). Nothing is torn out
 * from under the kernel by aborting here: a fill only PROPOSES, and nothing
 * it proposed lands after a stop.
 *
 * A deadline that fired is re-thrown as a `timeout`, so the report can say
 * the section ran out of time rather than that something went wrong.
 */
async function underDeadline<T>(
  options: RunAiBuildOptions,
  task: AiBuildTask,
  taskTimeoutMs: number,
  work: (signal: AbortSignal) => Promise<T>,
  /**
   * The section's own abort (the streamed build's): a speculative write whose
   * contract changed in the final plan is cancelled through it, and nothing
   * else is.
   */
  jobSignal?: AbortSignal,
): Promise<T> {
  const deadline = new AbortController();
  // A property, not a local: the flag is set in a timer the checker cannot see.
  const state = { timedOut: false };
  const timer = setTimeout(() => {
    state.timedOut = true;
    const timeout = new Error(
      `Section "${task.title}" exceeded its ${String(taskTimeoutMs)}ms budget.`,
    );
    timeout.name = 'AbortError';
    deadline.abort(timeout);
  }, taskTimeoutMs);
  const outer = options.signal;
  const forwardStop = (): void => {
    deadline.abort(outer?.reason);
  };
  if (outer?.aborted === true) forwardStop();
  else outer?.addEventListener('abort', forwardStop, { once: true });
  const forwardJob = (): void => {
    deadline.abort(jobSignal?.reason);
  };
  if (jobSignal?.aborted === true) forwardJob();
  else jobSignal?.addEventListener('abort', forwardJob, { once: true });
  try {
    return await work(deadline.signal);
  } catch (cause) {
    if (state.timedOut && outer?.aborted !== true) {
      throw new SectionAttemptError(
        'timeout',
        `Section "${task.title}" exceeded its ${String(taskTimeoutMs)}ms budget.`,
      );
    }
    throw cause;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', forwardStop);
    jobSignal?.removeEventListener('abort', forwardJob);
  }
}

/** A section's deadline: a scene's is longer, unless the caller set every section's. */
function sectionTimeoutMs(build: BuildRun, job: SectionJob): number {
  const scene = build.options.taskTimeoutMs === undefined && job.scene?.() === true;
  return scene ? DEFAULT_AI_BUILD_SCENE_TASK_TIMEOUT_MS : build.taskTimeoutMs;
}

/** What one section's writer is told and given; the rest of a step comes from the build. */
interface FillBrief {
  readonly request: string;
  readonly skillIds: readonly string[];
  /** The step's `additionalContextProviders` — the photo catalog briefed for this section. */
  readonly providers: readonly AiContextProvider[];
  /**
   * Whether the conversation rides along. A page-plan writer's contract says
   * everything the conversation decided, and history repeated in every writer
   * was measured at up to 12 turns per fill (agent-audit P2-20, 2026-09-28).
   */
  readonly history: boolean;
  /**
   * The plan's facts-ledger samples (2026-09-30): the tools a writer calls
   * never write them into SEO data. Absent on a scaffold build.
   */
  readonly sampleValues?: readonly string[];
  /**
   * Completes the writer's answer before the door sees it (quality pass
   * 2026-10-05): a `kit.section` step's slots get what code can derive from
   * the contract (`completeKitSlots`) and the photos the plan assigned this
   * section (`fillSlotPhotos`). Every measure-v2 run spent a repair round on
   * `kit "features-bento" needs slot "caption"` — words the contract held.
   */
  readonly completeStep?: (answer: AiPlan) => AiPlan;
}

/**
 * The provider a writer proposes through, with every answer — first and
 * repaired — completed by `complete` before validation. Forget passes through.
 */
function completingProvider(
  inner: AiPlanProvider,
  complete: (answer: AiPlan) => AiPlan,
): AiPlanProvider {
  const provider: AiPlanProvider = {
    propose: async (request, context, live) =>
      complete(await inner.propose(request, context, live)),
  };
  const repair = inner.repair?.bind(inner);
  if (repair !== undefined) {
    provider.repair = async (request, context, plan, issues, live) =>
      complete(await repair(request, context, plan, issues, live));
  }
  const forget = inner.forget?.bind(inner);
  if (forget !== undefined) provider.forget = forget;
  return provider;
}

function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A writer's answer with each `kit.section` step's slots completed for its
 * contract: derivable required slots filled, broken optional ones dropped,
 * and every catalog image given the section's assigned photo (no photo twice
 * on a page). Anything else is returned as written; never throws.
 */
export function completeKitSteps(
  plan: PagePlan,
  contract: SectionContract,
  answer: AiPlan,
): AiPlan {
  try {
    const written: unknown = (answer as { readonly commands?: unknown }).commands;
    if (!Array.isArray(written)) return answer;
    const steps = written as readonly AiPlanStep[];
    const commands = steps.map((step): AiPlanStep => {
      const args: unknown = step.args;
      if (
        step.command !== AGENT_TOOL_COMMAND ||
        !isPlainObject(args) ||
        args['name'] !== 'kit.section'
      ) {
        return step;
      }
      const input = args['input'];
      if (!isPlainObject(input)) return step;
      const kit = planKit(typeof input['kit'] === 'string' ? input['kit'] : contract.kit);
      if (kit === undefined) return step;
      const written = isPlainObject(input['slots'])
        ? (input['slots'] as Readonly<Record<string, JsonValue>>)
        : {};
      const completed = completeKitSlots(kit, written, {
        contract,
        primaryCta: plan.primaryCta,
        pageBrief: `${plan.title} ${plan.description}`,
      });
      const slots = fillSlotPhotos(
        kit,
        completed.slots,
        contract.key,
        pagePhotoPlan(plan),
        plan.locale.lang,
      );
      if (slots === input['slots']) return step;
      return { ...step, args: { ...args, input: { ...input, slots } } };
    });
    return commands.some((step, index) => step !== steps[index]) ? { ...answer, commands } : answer;
  } catch {
    // A completion that throws completes nothing: the door judges what was written.
    return answer;
  }
}

/** The composition a section writer works under: its own region whole, every other one summarised. */
function fillComposition(
  options: RunAiBuildOptions,
): NonNullable<RunAiAgentOptions['composition']> {
  return {
    ...options.composition,
    documentTreeMode: 'scoped',
    ...(options.freeCode === true ? { freeCode: true } : {}),
  };
}

const SECTION_TOOL_LANES: readonly AgentToolLane[] = Object.freeze(['section']);

function runFill(
  options: RunAiBuildOptions,
  shared: Omit<RunAiAgentOptions, 'apply' | 'label' | 'request' | 'runId'>,
  task: AiBuildTask,
  position: number,
  total: number,
  brief: FillBrief,
  signal: AbortSignal,
  invocation: number,
): Promise<AiAgentRunResult> {
  const { history, additionalContextProviders, skillRegistry, ...step } = shared;
  void additionalContextProviders;
  const skills = stepSkillRegistry(skillRegistry, SECTION_STEP_INTENT);
  /*
    The facts ledger rides with the writer so its tool steps (expanded in
    generation, before the door) keep sample values out of SEO data. Spread
    from a variable: it reaches generation only where the run forwards it.
  */
  const samples = brief.sampleValues === undefined ? {} : { sampleValues: brief.sampleValues };
  const provider =
    brief.completeStep === undefined
      ? step.provider
      : completingProvider(step.provider, brief.completeStep);
  return runAiAgent({
    ...step,
    provider,
    ...samples,
    // A writer names only the section lane's tools — the ones its prompt lists.
    toolLanes: SECTION_TOOL_LANES,
    ...(brief.history && history !== undefined ? { history } : {}),
    ...(skills === undefined ? {} : { skillRegistry: skills }),
    additionalContextProviders: buildLessons.offered(options, brief.providers),
    runId: stepRunId(
      options.runId,
      `fill-${String(position)}${invocation === 1 ? '' : `-${String(invocation)}`}`,
    ),
    request: brief.request,
    selection: [task.id],
    selectedSkillIds: brief.skillIds,
    // The request carries the page's words for subject matter; they must not
    // choose this writer's expertise as well.
    autoSkills: false,
    policy: { ...options.policy, allowedCommands: FILL_COMMANDS },
    composition: fillComposition(options),
    /*
      GENERATE only. Sections are written concurrently but must LAND in order,
      so the proposal comes back here and `applyAiPlan` runs it when its turn
      arrives. Safe because apply re-validates against the LIVE kernel, not
      against the document the proposal was made from — and because the target
      guard (`guardFill`) keeps each fill inside its own region, so nothing two
      of them touch overlaps.
    */
    apply: 'never',
    label: stepLabel(position, total, task.title),
    signal,
  });
}

interface GuardedFill {
  /** The steps that stay inside the region, in the order the writer wrote them. */
  readonly commands: AiPlan['commands'];
  /** Set when code changed a step (`SectionJob.tidy`): the run's own proposal no longer matches. */
  readonly tidied?: true;
  /** The props those steps write — what the landing records and a revert restores. */
  readonly keys: readonly AiBuildSectionKey[];
  readonly outOfScope: readonly AiBuildOutOfScopeStep[];
}

function stringArg(args: unknown, name: 'id' | 'key'): string | undefined {
  if (typeof args !== 'object' || args === null) return undefined;
  const value: unknown = (args as Record<string, unknown>)[name];
  return typeof value === 'string' ? value : undefined;
}

function isFillKey(
  key: string | undefined,
  allowed: readonly AiBuildSectionKey[],
): key is AiBuildSectionKey {
  return key !== undefined && (allowed as readonly string[]).includes(key);
}

/**
 * THE TARGET GUARD: a section writer may set its own region's `tree` and
 * `css`, and nothing else.
 *
 * The command policy only ever checked NAMES. `setProp` was allowed, so a
 * writer could set any prop on any node, and the comment that promised "each
 * fill writes only its own region's tree" was a hope. Measured 2026-09-28
 * (agent-audit.md P0-2): one writer replaced the page CSS — the skeleton's
 * font import went with it — and another overwrote the hero, and both
 * reported `applied`. Page-level skills tell writers to do exactly that
 * ("load fonts in pageCss", "KEYFRAMES live in pageCss"), so it is not rare.
 *
 * Everything outside is dropped before landing and handed back to be
 * REPORTED on the section, never silently counted as applied.
 */
function guardFill(plan: AiPlan, task: AiBuildTask, freeCode = false): GuardedFill {
  const allowed = freeCode ? FILL_KEYS_WITH_CODE : FILL_KEYS;
  const commands: AiPlan['commands'][number][] = [];
  const keys = new Set<AiBuildSectionKey>();
  const outOfScope: AiBuildOutOfScopeStep[] = [];
  for (const step of plan.commands) {
    const id = stringArg(step.args, 'id');
    const key = stringArg(step.args, 'key');
    if (step.command === 'setProp' && id === task.id && isFillKey(key, allowed)) {
      commands.push(step);
      keys.add(key);
      continue;
    }
    outOfScope.push(
      Object.freeze({
        command: step.command,
        ...(id === undefined ? {} : { id }),
        ...(key === undefined ? {} : { key }),
        reason: `A section writer may set only its own region's ${freeCode ? 'tree, css and js' : 'tree and css'} (region ${task.id}); this ${step.command}${key === undefined ? '' : ` of "${key}"`}${id === undefined ? '' : ` on ${id}`} reached outside it and was dropped.`,
      }),
    );
  }
  return {
    commands: Object.freeze(commands),
    keys: allowed.filter((key) => keys.has(key)),
    outOfScope: Object.freeze(outOfScope),
  };
}

/**
 * The proposal that lands: the writer's own when it stayed inside, otherwise
 * a new proposal of the kept steps under the SAME pinned policy, skills and
 * context — authenticated by the one constructor the door trusts, so the guard
 * narrows what lands without ever widening what may.
 */
function landingProposal(run: AiAgentRunResult, guarded: GuardedFill): AiValidatedProposal {
  if (guarded.outOfScope.length === 0 && guarded.tidied !== true) return run.proposal;
  return createAiValidatedProposal({
    plan: { ...run.proposal.plan, commands: guarded.commands },
    policy: run.proposal.policy,
    skillActivations: run.proposal.skillActivations,
    context: run.context,
  });
}

const ARABIC_LETTER = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/gu;
/** The same range, unanchored and stateless, for a yes/no question. */
const ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/u;
const ARABIC_LANG = /^ar\b/u;
const LATIN_LETTER = /[A-Za-z]/gu;

/** Every piece of text a plan writes into its trees, joined. */
function writtenText(plan: AiPlan): string {
  const texts: string[] = [];
  const stack: unknown[] = plan.commands.map((step) => step.args);
  while (stack.length > 0) {
    const value = stack.pop();
    if (Array.isArray(value)) {
      stack.push(...(value as unknown[]));
      continue;
    }
    if (typeof value !== 'object' || value === null) continue;
    const record = value as Record<string, unknown>;
    if (typeof record['text'] === 'string') texts.push(record['text']);
    stack.push(...Object.values(record));
  }
  return texts.join(' ');
}

/**
 * Whether the root block declares a prop. The product's page block declares
 * `lang`; a narrower root may not, and setting a prop its schema lacks would
 * refuse the whole step — direction included.
 */
function rootDeclares(options: RunAiBuildOptions, key: string): boolean {
  return rootField(options, key) !== undefined;
}

/** The root block's schema for one prop, when it declares that prop. */
function rootField(options: RunAiBuildOptions, key: string): unknown {
  const document = options.kernel.getDocument();
  const rootType = document.nodes[document.rootId]?.type;
  if (rootType === undefined) return undefined;
  const props: unknown = options.kernel.context.registry.block(rootType)?.schema.props;
  const shape: unknown =
    typeof props === 'object' && props !== null ? (props as { shape?: unknown }).shape : undefined;
  if (typeof shape !== 'object' || shape === null || !(key in shape)) return undefined;
  return (shape as Record<string, unknown>)[key];
}

/** The value the root block gives a prop nobody set, when it gives one. */
function rootDefault(options: RunAiBuildOptions, key: string): unknown {
  const field = rootField(options, key);
  const safeParse: unknown =
    typeof field === 'object' && field !== null
      ? (field as { safeParse?: unknown }).safeParse
      : undefined;
  if (typeof safeParse !== 'function') return undefined;
  const parsed: unknown = (safeParse as (value: unknown) => unknown).call(field, undefined);
  if (typeof parsed !== 'object' || parsed === null) return undefined;
  const { success, data } = parsed as { success?: unknown; data?: unknown };
  return success === true ? data : undefined;
}

/** Whether the page root held anything before this build laid a skeleton. */
function pageHoldsContent(options: RunAiBuildOptions): boolean {
  const document = options.kernel.getDocument();
  const slots = document.nodes[document.rootId]?.slots ?? {};
  return Object.values(slots).some((children) => children.length > 0);
}

/**
 * Whether the build may name the page's language.
 *
 * Only a language nobody chose: an empty one, or — on a page that held nothing
 * before this build — the block's own default. An explicit language is the
 * person's, Arabic words or not: a page they set to `en` stays `en`, and one
 * already in Arabic ('ar-JO') is never "corrected" to 'ar'. The last review
 * (2026-09-27) found the build overwriting any non-Arabic lang with 'ar'.
 */
function mayNameLanguage(options: RunAiBuildOptions, heldContent: boolean): boolean {
  if (!rootDeclares(options, 'lang')) return false;
  const document = options.kernel.getDocument();
  const current: unknown = document.nodes[document.rootId]?.props['lang'];
  if (current === undefined || current === '') return true;
  if (typeof current === 'string' && ARABIC_LANG.test(current)) return false;
  return !heldContent && current === rootDefault(options, 'lang');
}

/**
 * An Arabic page reads right to left, whether or not the skeleton said so.
 *
 * Measured 2026-09-27: the same Arabic request produced a skeleton with
 * `setDocMeta {dir:'rtl'}` in one run and without it in the next — one of them
 * even named "set the page RTL" as a follow-up — so an Arabic page came out
 * laid backwards about half the time. Direction is a fact about the words the
 * skeleton wrote, so it is decided here from them: its own step, its own undo,
 * and never a reason for the build to fail.
 *
 * The LANGUAGE travels with it. Direction alone left every built Arabic page
 * with lang '' — no lang attribute, so screen readers read the Arabic in the
 * host's voice and :lang(ar) rules never matched. It is set in the same step,
 * only where the root block declares `lang`, and only over a language nobody
 * chose (`mayNameLanguage`): 'ar-JO' stays, and so does an explicit 'en'.
 *
 * It is a WRITE, so it asks the same question every other write of a build
 * asks first: has the person stopped? The wave-1 verifier (2026-09-28) aborted
 * the signal from an observer of `build.planned` and watched this transaction
 * land anyway — the one write of the build that never checked.
 */
function turnArabicPageRightToLeft(
  options: RunAiBuildOptions,
  plan: AiPlan,
  heldContent: boolean,
  personStopped: () => boolean,
): void {
  if (personStopped()) return;
  const document = options.kernel.getDocument();
  const needsDir = document.dir !== 'rtl';
  const needsLang = mayNameLanguage(options, heldContent);
  if (!needsDir && !needsLang) return;
  const text = writtenText(plan);
  const arabic = text.match(ARABIC_LETTER)?.length ?? 0;
  const latin = text.match(LATIN_LETTER)?.length ?? 0;
  if (arabic === 0 || arabic <= latin) return;
  const turn = { command: 'setDocMeta', args: { dir: 'rtl' } };
  const language = { command: 'setProp', args: { id: document.rootId, key: 'lang', value: 'ar' } };
  const apply = (commands: AiPlan['commands']): void => {
    applyAiPlan({
      kernel: options.kernel,
      validationPorts: options.validationPorts,
      plan: { rationale: 'The page is written in Arabic, so it reads right to left.', commands },
      policy: {
        allowedCommands: [...new Set(commands.map(({ command }) => command))],
        maxCommands: commands.length,
      },
      label: RTL_LABEL,
    });
  };
  try {
    apply([...(needsDir ? [turn] : []), ...(needsLang ? [language] : [])]);
  } catch {
    /*
      A page that cannot turn stays as it was; the sections still get written.
      The pair is one step, so a refused language would take the direction
      down with it — and the direction is the half that was measured to matter.
    */
    if (!needsDir || !needsLang) return;
    try {
      apply([turn]);
    } catch {
      // Not even the direction: the page stays as it was.
    }
  }
}

// ── The build's shared state ────────────────────────────────────────────────

type StepOptions = Omit<RunAiAgentOptions, 'apply' | 'label' | 'request' | 'runId'>;

type AgentEventPayload<T = AiAgentEvent> = T extends AiAgentEvent
  ? Omit<T, 'runId' | 'seq' | 'at'>
  : never;

/** What every part of one build reads: its options, its clock, its voice and its Stop. */
interface BuildRun {
  readonly options: RunAiBuildOptions;
  readonly emit: (payload: BuildEventPayload) => void;
  readonly shared: StepOptions;
  readonly startedAt: number;
  readonly maxTasks: number;
  readonly taskTimeoutMs: number;
  readonly buildBudgetMs: number;
  /** Whether this build may touch the document at all. */
  readonly writes: boolean;
  /** Whether it must ask before its FIRST write — the skeleton included. */
  readonly asks: boolean;
  /** Whether the page root held anything before this build laid a skeleton. */
  readonly heldContent: boolean;
  /** The person pressed Stop, or a newer run took the surface. */
  readonly personStopped: () => boolean;
  /**
   * Time spent waiting on the person's answer to `onPlanned`. Charged to
   * neither the budget nor `elapsedMs` (E2): a person who reads the plan card
   * for ten minutes has not spent ten minutes of a 15-minute build, and the
   * wait used to be charged, so a careful reader got a build that stopped
   * starting sections before it began.
   */
  waitedMs: number;
  /** False once the build has reported its end; its steps fall silent then. */
  speaking: boolean;
}

function createBuildRun(options: RunAiBuildOptions): BuildRun {
  const writes = (options.apply ?? 'auto') === 'auto';
  const personStopped = (): boolean => {
    if (options.signal?.aborted === true) return true;
    if (options.isCurrentRun === undefined) return false;
    try {
      // Read as unknown: a host port that answers anything but `true` holds no lease.
      const current: unknown = options.isCurrentRun(options.runId);
      return current !== true;
    } catch {
      // A broken lease port is no lease: nothing lands on its word.
      return true;
    }
  };
  const build: BuildRun = {
    options,
    emit: createBuildEmitter(options),
    shared: sharedStepOptions(options, () => build.speaking),
    startedAt: options.clock.now(),
    maxTasks: options.maxTasks ?? DEFAULT_AI_BUILD_MAX_TASKS,
    taskTimeoutMs: options.taskTimeoutMs ?? DEFAULT_AI_BUILD_TASK_TIMEOUT_MS,
    buildBudgetMs: options.buildBudgetMs ?? DEFAULT_AI_BUILD_BUDGET_MS,
    writes,
    asks: writes && options.onPlanned !== undefined,
    // Read before any skeleton lands: whether this was a blank page.
    heldContent: pageHoldsContent(options),
    personStopped,
    waitedMs: 0,
    speaking: true,
  };
  return build;
}

/** Build time so far, the person's reading time excluded (E2). */
function workedMs(build: BuildRun): number {
  return build.options.clock.now() - build.startedAt - build.waitedMs;
}

/** Ask `onPlanned`, keeping the wait off the build's clock. */
async function askPerson(
  build: BuildRun,
  planned: readonly AiBuildPlannedTask[],
  direction: string,
  plan?: PagePlan,
): Promise<AiBuildPlanAnswer> {
  const onPlanned = build.options.onPlanned;
  if (onPlanned === undefined || build.personStopped()) return 'stop';
  const askedAt = build.options.clock.now();
  try {
    // Two arguments on a scaffold build, exactly as every host before page plans was called.
    return await (plan === undefined
      ? onPlanned(planned, direction)
      : onPlanned(planned, direction, plan));
  } finally {
    build.waitedMs += Math.max(0, build.options.clock.now() - askedAt);
  }
}

/**
 * The answer was "stop", or Stop was pressed while the question was open: the
 * build ends with the document exactly as it was.
 */
function refusedBuild(
  build: BuildRun,
  planned: readonly AiBuildPlannedTask[],
  direction: string,
  extra: Pick<AiBuildRunResult, 'scaffold' | 'pagePlan' | 'planFallback'>,
): AiBuildRunResult {
  const nothing: readonly AiBuildTaskReport[] = Object.freeze([]);
  const elapsedMs = workedMs(build);
  build.emit({ type: 'build.stopped', reason: 'signal' });
  build.emit({
    type: 'build.completed',
    tasks: nothing,
    applied: 0,
    skipped: 0,
    elapsedMs,
    outcome: 'signal',
  });
  build.speaking = false;
  return Object.freeze({
    runId: build.options.runId,
    tasks: nothing,
    applied: 0,
    skipped: 0,
    elapsedMs,
    ...(extra.scaffold === undefined ? {} : { scaffold: extra.scaffold }),
    direction,
    outcome: 'signal' as const,
    plannedTasks: planned,
    ...(extra.pagePlan === undefined ? {} : { pagePlan: extra.pagePlan }),
    ...(extra.planFallback === undefined ? {} : { planFallback: extra.planFallback }),
  });
}

// ── Writing and landing the sections ────────────────────────────────────────

/** One section of the page: how to write it, or that it is already written. */
interface SectionJob {
  readonly task: AiBuildTask;
  /** 1-based, on the page. */
  readonly position: number;
  readonly total: number;
  /**
   * Set when the skeleton wrote this region IN FULL from the plan (a header
   * from the nav, a footer from the facts): it needs no writer, and its
   * landing is the skeleton's transaction.
   */
  readonly complete?: AiBuildSectionLanding;
  /** The brief for attempt 1 or 2 — read when the attempt starts, so neighbours are current. */
  readonly brief?: (attempt: 1 | 2) => FillBrief;
  /** Step E: contract and scene check (and the scene's run); absent on a scaffold build. */
  readonly check?: (landed: LandedSection) => WrittenIssues;
  /** Whether its writer writes a scene: started first, given the longer deadline. */
  readonly scene?: () => boolean;
  /**
   * Code repairs on what a writer wrote, BEFORE the check (palette classes →
   * token classes): what code can fix never costs a repair round. Returns
   * the same commands when nothing changed. Absent on a scaffold build.
   */
  readonly tidy?: (commands: AiPlan['commands']) => AiPlan['commands'];
  readonly sectionKey?: string;
  /** The plan's facts for the report — read when the section is reported, so the final plan's. */
  readonly facts?: () => readonly AiBuildTaskFact[];
  /**
   * The contract a write starts from, as `sectionFingerprint` — read when a
   * writer takes the section, so a streamed build can tell a write made from
   * a provisional contract the final plan changed.
   */
  readonly fingerprint?: () => string | undefined;
  /** Told what landed, so later writers see it as written. */
  readonly onLanded?: (values: AiBuildSectionValues) => void;
}

type Written =
  | {
      readonly kind: 'ready';
      readonly proposal: AiValidatedProposal;
      readonly keys: readonly AiBuildSectionKey[];
      readonly outOfScope: readonly AiBuildOutOfScopeStep[];
      readonly attempts: number;
      readonly check?: AiBuildSectionCheck;
    }
  | {
      readonly kind: 'failed';
      readonly reason: string;
      readonly reasonCode: AiBuildSkipReasonCode;
      readonly outOfScope: readonly AiBuildOutOfScopeStep[];
      readonly attempts: number;
    }
  | {
      readonly kind: 'not-started';
      readonly reason: string;
      readonly reasonCode: AiBuildSkipReasonCode;
      readonly attempts: number;
    }
  | { readonly kind: 'complete'; readonly landing: AiBuildSectionLanding };

interface Slot {
  written: Promise<Written>;
  /** First verdict wins: a Stop may settle a slot its writer settles later. */
  settle: (written: Written) => void;
  claimed: boolean;
  settled: boolean;
  /** Attempts begun so far, for a section a Stop cuts off. */
  attempts: number;
  /** Physical writers across outer retries and changed streamed contracts. */
  invocations: number;
  /**
   * Bumped whenever the slot is opened again (a streamed build reruns a
   * section whose contract the final plan changed): a write begun under an
   * older generation is discarded, whatever it returns.
   */
  generation: number;
  /** Whether a writer may take it. A streamed build releases a section when its brief arrives. */
  released: boolean;
  /** Counted against `maxTasks` already: a rerun is the same section, not a new one. */
  counted: boolean;
  /** The contract fingerprint the current write started from. */
  fingerprint: string | undefined;
  /** Aborts the current write, and only it. */
  abort: AbortController | undefined;
}

/** A slot's verdict, open again: a fresh promise, first verdict wins. */
function armSlot(slot: Slot): void {
  let resolve!: (written: Written) => void;
  slot.written = new Promise<Written>((settle) => {
    resolve = settle;
  });
  slot.settled = false;
  slot.settle = (verdict) => {
    if (slot.settled) return;
    slot.settled = true;
    resolve(verdict);
  };
}

function createSlot(released: boolean): Slot {
  const slot: Slot = {
    written: Promise.resolve<Written>({
      kind: 'not-started',
      reason: '',
      reasonCode: 'unknown',
      attempts: 0,
    }),
    settle: () => undefined,
    claimed: false,
    settled: false,
    attempts: 0,
    invocations: 0,
    generation: 0,
    released,
    counted: false,
    fingerprint: undefined,
    abort: undefined,
  };
  armSlot(slot);
  return slot;
}

function stopReasonCode(reason: AiBuildStopReason): AiBuildSkipReasonCode {
  // A spent task limit is a spent budget of sections: the section was never begun either way.
  return reason === 'signal' ? 'stopped' : 'budget';
}

/** Events for a step the build runs itself, under `<build>/<step>`, gated like every step's. */
function stepEmitter(build: BuildRun, step: string): (payload: AgentEventPayload) => void {
  let seq = 0;
  const onEvent = build.options.onEvent;
  return (payload) => {
    if (!build.speaking || onEvent === undefined) return;
    const event = Object.freeze({
      ...payload,
      runId: stepRunId(build.options.runId, step),
      seq,
      at: build.options.clock.now(),
    }) as AiAgentEvent;
    seq += 1;
    try {
      onEvent(event);
    } catch {
      // Observers are telemetry consumers; they cannot steer the build.
    }
  };
}

/**
 * Step E, BEFORE landing (agent-audit §3.1, evaluator-optimizer): hold the
 * written section to its contract, and when it misses, send exactly what it
 * missed back in ONE repair call. Checked before the section lands, so it
 * lands once — never a wrong section followed by a second transaction that
 * fixes it.
 *
 * The repaired answer is kept only when it is inside the region and misses no
 * more than the first; otherwise the first lands, its issues on the report.
 * No repair runs after Stop, on a spent budget, or for a provider that cannot
 * repair.
 */
async function checkAndRepair(
  build: BuildRun,
  job: SectionJob,
  run: AiAgentRunResult,
  wrote: GuardedFill,
  request: string,
  placeholder: AiBuildSectionValues,
  budgetSpent: () => boolean,
  invocation: number,
  jobSignal?: AbortSignal,
): Promise<{
  readonly guarded: GuardedFill;
  readonly proposal: AiValidatedProposal;
  readonly check?: AiBuildSectionCheck;
}> {
  const tidied = job.tidy?.(wrote.commands);
  const guarded: GuardedFill =
    tidied === undefined || tidied === wrote.commands
      ? wrote
      : { ...wrote, commands: tidied, tidied: true };
  const first = { guarded, proposal: landingProposal(run, guarded) };
  if (job.check === undefined) return first;
  const issues = await checkedIssues(job, candidateSection(guarded.commands, placeholder));
  if (issues.length === 0) return { ...first, check: Object.freeze({ issues, repaired: false }) };
  const { options } = build;
  if (options.provider.repair === undefined || build.personStopped() || budgetSpent()) {
    return { ...first, check: Object.freeze({ issues, repaired: false }) };
  }

  const step = `check-${String(job.position)}${invocation === 1 ? '' : `-${String(invocation)}`}`;
  const emit = stepEmitter(build, step);
  emit({ type: 'run.started', apply: 'never' });
  emit({ type: 'plan.repairing', issues: issues.map(({ message }) => message) });
  const landedPlan: AiPlan = { ...run.proposal.plan, commands: guarded.commands };
  try {
    const repaired = await underDeadline(
      options,
      job.task,
      sectionTimeoutMs(build, job),
      (signal) => {
        const repair = options.provider.repair?.bind(options.provider);
        let reported = false;
        const provider: AiPlanProvider = {
          ...options.provider,
          repair: (repairRequest, context, plan, findings, live) => {
            if (repair === undefined) throw new Error('This provider cannot repair a plan.');
            return repair(repairRequest, context, plan, findings, {
              ...live,
              onProgress: (text) => {
                if (!signal.aborted && !build.personStopped())
                  emit({ type: 'plan.progress', text });
              },
              onUsage: (value) => {
                if (reported || signal.aborted || build.personStopped()) return;
                const usage = readProviderUsage(value);
                if (usage === undefined) return;
                reported = true;
                emit({
                  type: 'provider.usage',
                  attemptId: `${stepRunId(options.runId, step)}/attempt-1`,
                  usage,
                });
              },
            });
          },
        };
        return repairAiPlanForIssues(
          {
            kernel: options.kernel,
            provider,
            request,
            validationPorts: options.validationPorts,
            signal,
            composition: fillComposition(options),
            ...(options.policy?.maxContextTokens === undefined
              ? {}
              : { maxContextTokens: options.policy.maxContextTokens }),
          },
          run.context,
          landedPlan,
          repairIssues(issues),
          run.policy,
        );
      },
      jobSignal,
    );
    emit({ type: 'plan.validating', attempt: 2 });
    const guardedSecond = guardFill(repaired, job.task, options.freeCode === true);
    const tidiedSecond = job.tidy?.(guardedSecond.commands);
    const second =
      tidiedSecond === undefined || tidiedSecond === guardedSecond.commands
        ? guardedSecond
        : { ...guardedSecond, commands: tidiedSecond, tidied: true as const };
    const remaining =
      second.commands.length === 0
        ? undefined
        : await checkedIssues(job, candidateSection(second.commands, placeholder));
    emit({ type: 'run.completed', status: 'proposed' });
    if (remaining === undefined || remaining.length > issues.length) {
      return { ...first, check: Object.freeze({ issues, repaired: true }) };
    }
    const proposal = createAiValidatedProposal({
      plan: { ...repaired, commands: second.commands },
      policy: run.policy,
      skillActivations: run.proposal.skillActivations,
      context: run.context,
    });
    return {
      guarded: {
        ...second,
        outOfScope: Object.freeze([...guarded.outOfScope, ...second.outOfScope]),
      },
      proposal,
      check: buildLessons.learned(options, issues, remaining), // what it fixed: a lesson for later writers
    };
  } catch (cause) {
    // A repair that failed costs the repair, never the section: the first answer lands.
    emit({ type: 'run.failed', error: classifyAiRunFailure(cause) });
    return { ...first, check: Object.freeze({ issues, repaired: true }) };
  }
}

interface FilledSections {
  readonly reports: readonly AiBuildTaskReport[];
  readonly applied: number;
  readonly skipped: number;
  readonly stopped: AiBuildStopReason | undefined;
  readonly unfilled: readonly AiBuildUnfilledSection[];
}

/**
 * WRITTEN concurrently, LANDED in order.
 *
 * Two jobs. The pool writes up to `fillConcurrency` sections at a time — the
 * expensive part, minutes each — and nothing else bounds it. The lander walks
 * the list from the top and applies each section only when every section
 * above it has settled, so the page fills top to bottom however the model
 * finishes and the transaction log reads in page order.
 *
 * There used to be a WINDOW as well: a writer could run at most
 * `fillConcurrency` sections ahead of the section currently landing. Its
 * stated gains were writing against landed neighbours (under the scoped tree
 * mode a writer sees its neighbours only as "filled · N nodes" either way)
 * and not paying for work a Stop would throw away (Stop now cancels the
 * writes themselves). Its measured cost, 2026-09-28 (hol.mjs: 8 sections,
 * hero 3 s, others 0.5 s): sections 6-8 waited ~3 s on the hero while four
 * writers sat idle — on every page with more sections than writers, because
 * the hero is the slowest section to write.
 */
async function fillAndLand(
  build: BuildRun,
  jobs: readonly SectionJob[],
  placeholders: ReadonlyMap<NodeId, AiBuildSectionValues>,
): Promise<FilledSections> {
  return startFill(build, jobs, placeholders, false).done;
}

/**
 * A fill in progress, as the streamed build steers it (DESIGN §6.3,
 * 2026-10-05). A plain build never sees one: `fillAndLand` releases every
 * section at once and lands as soon as each is written.
 */
interface FillHandle {
  /** Settles once every section is reported. Never rejects. */
  readonly done: Promise<FilledSections>;
  /** A writer may take this section now. */
  release(index: number): void;
  /** No NEW write starts until the gate opens; writes in flight continue. */
  hold(): void;
  /**
   * Throw away this section's write — in flight or finished — and write it
   * again from its contract as it reads NOW. Not a second attempt: the rerun
   * has both of its own.
   */
  rewrite(index: number): void;
  /** The section was written in full by code; `landing` is that transaction. */
  complete(index: number, landing: AiBuildSectionLanding): void;
  /** Whether a writer took this section (or it was settled without one). */
  claimed(index: number): boolean;
  /** The contract fingerprint the section's current write started from. */
  writtenWith(index: number): string | undefined;
  /** Landing may begin: the final plan is validated and reconciled. */
  openGate(): void;
  /** Speculation thrown away: every write aborted, nothing lands, nothing is reported. */
  cancel(): void;
}

const NOTHING_FILLED: FilledSections = Object.freeze({
  reports: Object.freeze([]),
  applied: 0,
  skipped: 0,
  stopped: undefined,
  unfilled: Object.freeze([]),
});

function sectionAbort(message: string): Error {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

/**
 * The pool and the lander. `speculative` is the streamed build's: no section
 * is released until its brief arrives (or the final plan does), and the
 * lander waits for `openGate` — nothing a writer wrote lands before the final
 * plan is the plan.
 */
function startFill(
  build: BuildRun,
  jobs: readonly SectionJob[],
  placeholders: ReadonlyMap<NodeId, AiBuildSectionValues>,
  speculative: boolean,
): FillHandle {
  const { options, emit, personStopped } = build;
  const reports: AiBuildTaskReport[] = [];
  const fillCount = jobs.filter(({ complete }) => complete === undefined).length;
  const automatic = fillConcurrencyFor(fillCount, options.fillConcurrency);
  // A streamed build may rerun a section the skeleton did not leave to a writer at first.
  const fillConcurrency = speculative ? Math.max(1, automatic) : automatic;
  let applied = 0;
  let skipped = 0;
  let stopped: AiBuildStopReason | undefined;
  let gateOpen = !speculative;
  let held = false;
  let cancelled = false;
  let pendingStop: AiBuildStopReason | undefined;
  let openTheGate!: () => void;
  const gate = new Promise<void>((resolve) => {
    openTheGate = resolve;
  });
  if (gateOpen) openTheGate();

  const slots = jobs.map((job): Slot => {
    const slot = createSlot(!speculative);
    // Written by the skeleton: nothing to write, and nothing a Stop can take back.
    if (job.complete !== undefined) {
      slot.claimed = true;
      slot.released = true;
      slot.settle({ kind: 'complete', landing: job.complete });
    }
    return slot;
  });

  const budgetSpent = (): boolean => workedMs(build) >= build.buildBudgetMs;

  /** The reason to stop, decided once and then true for every later check. */
  const stopReason = (): AiBuildStopReason | undefined => {
    if (personStopped()) return 'signal';
    if (stopped !== undefined) return stopped;
    if (budgetSpent()) return 'budget';
    return undefined;
  };

  let announced = false;
  const halt = (reason: AiBuildStopReason): void => {
    if (!announced) {
      announced = true;
      stopped = reason;
      // A speculation still waiting on its plan says so only if it is kept.
      if (gateOpen) emit({ type: 'build.stopped', reason });
      else pendingStop = reason;
    }
    // Nobody may wait on a section that will never be written.
    for (const slot of slots) {
      if (!slot.claimed) {
        slot.claimed = true;
        slot.settle({
          kind: 'not-started',
          reason: notStartedReason(reason),
          reasonCode: stopReasonCode(reason),
          attempts: 0,
        });
      }
    }
    /*
      A person's Stop also ends the sections IN FLIGHT. Their writers were
      aborted with the same signal; settling them here means the lander need not
      wait for a provider that is slow to notice, and nothing they return later
      is ever read.
    */
    if (reason === 'signal') {
      for (const slot of slots) {
        slot.settle({
          kind: 'not-started',
          reason: STOPPED_WHILE_WRITING,
          reasonCode: 'stopped',
          attempts: slot.attempts,
        });
      }
    }
  };
  const onStop = (): void => {
    halt('signal');
  };
  options.signal?.addEventListener('abort', onStop, { once: true });

  /**
   * One section, up to two attempts, guarded, checked. Never throws. Answers
   * `undefined` when the write was thrown away (its slot opened again, or the
   * speculation cancelled) — that answer is never read.
   */
  const writeSection = async (
    slot: Slot,
    job: SectionJob,
    generation: number,
    signal: AbortSignal,
  ): Promise<Written | undefined> => {
    const stale = (): boolean => cancelled || slot.generation !== generation;
    const { task, position, total } = job;
    const placeholder = placeholders.get(task.id) ?? Object.freeze<AiBuildSectionValues>({});
    let failure: unknown;
    let outOfScope: readonly AiBuildOutOfScopeStep[] = [];
    for (const attempt of [1, 2] as const) {
      if (stale()) return undefined;
      if (attempt === 2) {
        // A retry is a new start: never after Stop, and never on a spent budget.
        if (personStopped()) break;
        if (budgetSpent()) {
          failure = new SectionAttemptError(
            skipReasonCode(failure),
            `${errorMessage(failure)} No second attempt: the build budget ran out.`,
          );
          break;
        }
      }
      slot.attempts = attempt;
      const kitMisses = attempt === 1 ? KIT_MISSES.get(task) : undefined;
      emit({
        type: 'task.started',
        position,
        total,
        task,
        attempt,
        ...(kitMisses === undefined ? {} : { kitMisses }),
      });
      const brief = job.brief?.(attempt);
      if (brief === undefined) break;
      try {
        const invocation = ++slot.invocations;
        const run = await underDeadline(
          options,
          task,
          sectionTimeoutMs(build, job),
          (deadline) =>
            runFill(options, build.shared, task, position, total, brief, deadline, invocation),
          signal,
        );
        if (stale()) return undefined;
        const guarded = guardFill(run.proposal.plan, task, options.freeCode === true);
        outOfScope = guarded.outOfScope;
        if (guarded.commands.length === 0) {
          // Everything it wrote was somewhere else: a failed attempt, not a landing.
          failure = new SectionAttemptError(
            'out-of-scope',
            `Section "${task.title}" wrote nothing inside its own region; ${String(outOfScope.length)} step${outOfScope.length === 1 ? '' : 's'} outside it ${outOfScope.length === 1 ? 'was' : 'were'} dropped.`,
          );
          continue;
        }
        const checked = await checkAndRepair(
          build,
          job,
          run,
          guarded,
          brief.request,
          placeholder,
          budgetSpent,
          invocation,
          signal,
        );
        if (stale()) return undefined;
        return {
          kind: 'ready',
          proposal: checked.proposal,
          keys: checked.guarded.keys,
          outOfScope: checked.guarded.outOfScope,
          attempts: attempt,
          ...(checked.check === undefined ? {} : { check: checked.check }),
        };
      } catch (cause) {
        if (stale()) return undefined;
        failure = cause;
      }
    }
    return {
      kind: 'failed',
      reason: errorMessage(failure),
      reasonCode: skipReasonCode(failure),
      outOfScope,
      attempts: slot.attempts,
    };
  };

  let started = 0;
  let active = 0;
  const inflight = new Set<Promise<void>>();

  /** Hand section `index` to a writer — or settle it, when the build may start nothing more. */
  const dispatch = (index: number): void => {
    const slot = slots[index];
    const job = jobs[index];
    if (slot === undefined || job === undefined) return;
    slot.claimed = true;
    const reason = stopReason();
    if (reason !== undefined) {
      slot.settle({
        kind: 'not-started',
        reason: notStartedReason(reason),
        reasonCode: stopReasonCode(reason),
        attempts: 0,
      });
      halt(reason);
      return;
    }
    if (!slot.counted) {
      if (started >= build.maxTasks) {
        slot.settle({
          kind: 'not-started',
          reason: notStartedReason('max-tasks'),
          reasonCode: stopReasonCode('max-tasks'),
          attempts: 0,
        });
        halt('max-tasks');
        return;
      }
      started += 1;
      slot.counted = true;
    }
    const generation = slot.generation;
    const abort = new AbortController();
    slot.abort = abort;
    slot.fingerprint = job.fingerprint?.();
    active += 1;
    // A site's pages share one writers' pool (T230): the write waits its turn in it.
    const write = (): Promise<Written | undefined> =>
      writeSection(slot, job, generation, abort.signal);
    const run: Promise<void> = withWriterPermit(options, abort.signal, write)
      .then((written) => {
        if (written !== undefined && slot.generation === generation) slot.settle(written);
      })
      .finally(() => {
        active -= 1;
        inflight.delete(run);
        pump();
      });
    inflight.add(run);
  };

  /** Start every released section a writer is free for, in page order. */
  function pump(): void {
    if (cancelled || (held && !gateOpen)) return;
    while (active < fillConcurrency) {
      const open = slots.flatMap(({ released, claimed, counted }, index) =>
        released && !claimed
          ? [{ index, counted, scene: () => jobs[index]?.scene?.() === true }]
          : [],
      );
      const index = nextSection(open, build.maxTasks - started);
      if (index === undefined) return;
      dispatch(index);
    }
  }

  const land = async (): Promise<FilledSections> => {
    await gate;
    if (cancelled) return NOTHING_FILLED;
    for (const [index, job] of jobs.entries()) {
      const { task, position, total } = job;
      const slot = slots[index];
      const written: Written =
        slot === undefined
          ? {
              kind: 'not-started',
              reason: notStartedReason('max-tasks'),
              reasonCode: 'budget',
              attempts: 0,
            }
          : await slot.written;
      const facts = job.facts?.() ?? [];
      const ledger = {
        ...(job.sectionKey === undefined ? {} : { sectionKey: job.sectionKey }),
        ...(facts.length === 0 ? {} : { facts }),
      };

      if (written.kind === 'complete') {
        applied += 1;
        reports.push({
          ...task,
          status: 'applied',
          attempts: 0,
          landing: written.landing,
          ...ledger,
        });
        emit({
          type: 'task.completed',
          position,
          total,
          task,
          attempts: 0,
          transactionId: written.landing.transactionId,
          label: written.landing.label,
        });
        continue;
      }
      if (written.kind === 'not-started') {
        reports.push({
          ...task,
          status: 'not-started',
          attempts: written.attempts,
          reason: written.reason,
          reasonCode: written.reasonCode,
          ...ledger,
        });
        continue;
      }
      const dropped = written.outOfScope.length === 0 ? {} : { outOfScope: written.outOfScope };
      if (written.kind === 'failed') {
        /*
          Self-recovery, never a question. A section that would not be written
          twice is recorded and left as the placeholder the skeleton laid down;
          the page keeps its shape and the next section still gets its turn.
        */
        skipped += 1;
        reports.push({
          ...task,
          status: 'skipped',
          attempts: written.attempts,
          reason: written.reason,
          reasonCode: written.reasonCode,
          ...dropped,
          ...ledger,
        });
        emit({
          type: 'task.skipped',
          position,
          total,
          task,
          attempts: written.attempts,
          reason: written.reason,
          reasonCode: written.reasonCode,
        });
        continue;
      }
      /*
        THE LANDER'S OWN CHECK. A section that finished writing before Stop and
        was waiting for the one above it to land is still work the person
        stopped: nothing lands after Stop, however it got here.
      */
      if (personStopped()) {
        halt('signal');
        reports.push({
          ...task,
          status: 'not-started',
          attempts: written.attempts,
          reason: STOPPED_BEFORE_LANDING,
          reasonCode: 'stopped',
          ...dropped,
          ...ledger,
        });
        continue;
      }

      const label = stepLabel(position, total, task.title);
      const before = readSectionValues(options.kernel.getDocument(), task.id, written.keys);
      let landed: AppliedAiPlan;
      try {
        landed = applyAiPlan({
          kernel: options.kernel,
          validationPorts: options.validationPorts,
          proposal: written.proposal,
          label,
        });
      } catch (cause) {
        /*
          Written fine, refused on landing: the page moved under it while it was
          being written. Same answer as a failed write — the section is left as
          the placeholder, and the rest of the page still lands.
        */
        const reason = errorMessage(cause);
        skipped += 1;
        reports.push({
          ...task,
          status: 'skipped',
          attempts: written.attempts,
          reason,
          reasonCode: 'page-changed',
          ...dropped,
          ...ledger,
        });
        emit({
          type: 'task.skipped',
          position,
          total,
          task,
          attempts: written.attempts,
          reason,
          reasonCode: 'page-changed',
        });
        continue;
      }

      /*
        Recorded so the section can be put back FORWARD (`revertBuildSection`):
        the one transaction it landed in, by id, and the props the fill wrote as
        they stood just before and just after.
      */
      const transaction = landed.transactions[0];
      const after = readSectionValues(options.kernel.getDocument(), task.id, written.keys);
      applied += 1;
      job.onLanded?.(readSectionValues(options.kernel.getDocument(), task.id));
      reports.push({
        ...task,
        status: 'applied',
        attempts: written.attempts,
        ...dropped,
        ...(transaction === undefined
          ? {}
          : {
              landing: Object.freeze({ transactionId: transaction.id, label, before, after }),
            }),
        ...ledger,
        ...(written.check === undefined ? {} : { check: written.check }),
      });
      emit({
        type: 'task.completed',
        position,
        total,
        task,
        attempts: written.attempts,
        ...(transaction === undefined ? {} : { transactionId: transaction.id, label }),
      });
    }

    options.signal?.removeEventListener('abort', onStop);
    /*
      Every slot is settled. Without a Stop every writer has also finished, and
      this only reaps the pool. After a Stop a writer may still be waiting on a
      provider that is slow to notice its abort; the build does not wait for it —
      whatever it returns is never read, and it never throws.
    */
    const drained = async (): Promise<void> => {
      while (inflight.size > 0) await Promise.all([...inflight]);
    };
    if (personStopped()) void drained();
    else await drained();

    const unfilled: readonly AiBuildUnfilledSection[] = Object.freeze(
      reports
        .filter(({ status }) => status !== 'applied')
        .map(({ id, title }) =>
          Object.freeze({
            id,
            title,
            placeholder: placeholders.get(id) ?? Object.freeze<AiBuildSectionValues>({}),
          }),
        ),
    );
    return { reports: Object.freeze(reports), applied, skipped, stopped, unfilled };
  };

  pump();
  const done = land();

  /** Throw the slot's current write away and open it again. */
  const reopen = (slot: Slot): void => {
    slot.abort?.abort(
      sectionAbort('The final page plan changed this section; it is written again.'),
    );
    slot.abort = undefined;
    slot.generation += 1;
    armSlot(slot);
    slot.claimed = false;
    slot.attempts = 0;
    slot.fingerprint = undefined;
  };

  return {
    done,
    release(index) {
      const slot = slots[index];
      if (slot === undefined || cancelled) return;
      slot.released = true;
      pump();
    },
    hold() {
      held = true;
    },
    rewrite(index) {
      const slot = slots[index];
      if (slot === undefined || cancelled || stopped !== undefined) return;
      if (slot.claimed) reopen(slot);
      slot.released = true;
      pump();
    },
    complete(index, landing) {
      const slot = slots[index];
      if (slot === undefined || cancelled) return;
      reopen(slot);
      slot.claimed = true;
      slot.released = true;
      slot.settle({ kind: 'complete', landing });
    },
    claimed(index) {
      return slots[index]?.claimed ?? false;
    },
    writtenWith(index) {
      return slots[index]?.fingerprint;
    },
    openGate() {
      if (gateOpen || cancelled) return;
      gateOpen = true;
      held = false;
      if (pendingStop !== undefined) emit({ type: 'build.stopped', reason: pendingStop });
      openTheGate();
      pump();
    },
    cancel() {
      if (cancelled) return;
      cancelled = true;
      options.signal?.removeEventListener('abort', onStop);
      for (const slot of slots) {
        slot.abort?.abort(
          sectionAbort('The page plan changed; this speculative write was dropped.'),
        );
        slot.claimed = true;
        slot.settle({ kind: 'not-started', reason: '', reasonCode: 'unknown', attempts: 0 });
      }
      openTheGate();
    },
  };
}

/** The build's last word, and its result. */
function finishBuild(
  build: BuildRun,
  filled: FilledSections,
  direction: string,
  extra: Pick<AiBuildRunResult, 'scaffold' | 'pagePlan' | 'planFallback'>,
): AiBuildRunResult {
  const elapsedMs = workedMs(build);
  const outcome: AiBuildOutcome = filled.stopped ?? 'completed';
  build.emit({
    type: 'build.completed',
    tasks: filled.reports,
    applied: filled.applied,
    skipped: filled.skipped,
    elapsedMs,
    outcome,
  });
  build.speaking = false;
  return Object.freeze({
    runId: build.options.runId,
    tasks: filled.reports,
    ...(extra.scaffold === undefined ? {} : { scaffold: extra.scaffold }),
    applied: filled.applied,
    skipped: filled.skipped,
    elapsedMs,
    direction,
    outcome,
    unfilled: filled.unfilled,
    ...(extra.pagePlan === undefined ? {} : { pagePlan: extra.pagePlan }),
    ...(extra.planFallback === undefined ? {} : { planFallback: extra.planFallback }),
  });
}

// ── The page-plan build: T1 plan, T2 code skeleton, contracts per writer ────

/**
 * The plan as a one-line direction, for the approval card and the result: the
 * planner's rationale, else the plan's own meta description (in the page's
 * language), else the token signature. Plain prose only. Until 2026-09-30 it
 * was `rationale — Display / Body — 1 Header · 2 Hero[split] · …`, a debug
 * string the build record read aloud with its variant tags and middle dots
 * (§4.0); the faces and swatches ride structured on `build.planned.tokens`,
 * and the sections on its `tasks`. The description comes before the
 * signature because the signature is an internal design note in English —
 * a plan handed in through `pagePlan` has no rationale, and an Arabic page
 * reported "the dish photo bled under the hero" as its direction.
 */
function planDirection(plan: PagePlan, rationale: string | undefined): string {
  const lead = rationale?.replace(/\s+/gu, ' ').trim() ?? '';
  if (lead !== '') return lead;
  const description = plan.description.replace(/\s+/gu, ' ').trim();
  return description === '' ? plan.tokens.signature.trim() : description;
}

/** A refused plan as the error the host shows: the door's own error type, so it classifies as `plan-rejected`. */
function planRejected(issues: readonly PagePlanIssue[]): AiPlanRejectedError {
  return new AiPlanRejectedError(
    issues.map(({ path, message }) => ({
      code: 'invalid-plan' as const,
      message: `${path === '' ? '' : `${path}: `}${message}`,
    })),
  );
}

/**
 * A plan handed in (`pagePlan`, or edited at `onPlanned`) passes the validator
 * again before anything is built from it: "must have passed validatePagePlan"
 * is a promise the type cannot keep, and a plan card is a form a person typed
 * into. Nothing is written when it fails.
 *
 * `intent` is where the page lands, and it is NOT the plan's to choose: an
 * edited plan is held to the intent the proposed plan was validated under (the
 * host's target, or the page's rule), a given plan to its own. Before this,
 * an edit was held to its own intent, so a plan card answering `intent:
 * "replace"` on a page the host held to `append` deleted the page (wave-1
 * verifier, v2 scenario 6: seven regions replaced, 2026-09-28). The validator
 * forces the intent, so an edit that only flips it lands as planned, and one
 * that brings a hero or footer to an appended page is refused with nothing
 * written.
 */
function revalidated(plan: PagePlan, intent: PagePlan['intent']): PagePlan {
  const result = validatePagePlan(plan, { intent });
  if (!result.ok) throw planRejected(result.issues);
  return result.plan;
}

/** The props the root block declares — the only ones the skeleton may write. */
function rootPropNames(options: RunAiBuildOptions): readonly string[] {
  const document = options.kernel.getDocument();
  const rootType = document.nodes[document.rootId]?.type;
  if (rootType === undefined) return [];
  const props: unknown = options.kernel.context.registry.block(rootType)?.schema.props;
  const shape: unknown =
    typeof props === 'object' && props !== null ? (props as { shape?: unknown }).shape : undefined;
  return typeof shape === 'object' && shape !== null ? Object.keys(shape) : [];
}

/** Whether a top-level node is the page's footer: a footer region, or a block named for one. */
function isFooter(document: BuilderDocument, id: NodeId): boolean {
  const node = document.nodes[id];
  if (node === undefined) return false;
  if (/footer/iu.test(node.type)) return true;
  return placeholderShape(node.props['tree']).outer === 'footer';
}

/**
 * Where T2 lays the regions, from the plan's intent:
 * - `replace`: the root's current children go in the SAME transaction the
 *   regions arrive in, so one Undo brings the old page back whole;
 * - `append`: after the page's content, but before its footer, so appended
 *   bands never land under the copyright line;
 * - `new-page`: into the root the build was given, removing nothing — the
 *   host adds the page and hands the build that page (its kernel or lens);
 *   the engine cannot make a page appear.
 */
function skeletonContext(options: RunAiBuildOptions, plan: PagePlan): SkeletonFromPlanContext {
  const document = options.kernel.getDocument();
  const root = document.nodes[document.rootId];
  const children = root?.slots?.['default'] ?? [];
  const pageCss: unknown = root?.props['pageCss'];
  const seo: unknown = root?.props['seo'];
  const slug: unknown = root?.props['slug'];
  const last = children.at(-1);
  const appending = plan.intent === 'append';
  return {
    parentId: document.rootId,
    regionType: REGION_TYPE,
    ...(plan.intent === 'replace' && children.length > 0 ? { replaceIds: [...children] } : {}),
    ...(appending && last !== undefined && isFooter(document, last)
      ? { index: children.length - 1 }
      : {}),
    // Only the props this root declares: one undeclared prop refuses the whole skeleton.
    rootProps: rootPropNames(options),
    // An appended plan keeps the page's own fonts, keyframes and kit.
    ...(appending && typeof pageCss === 'string' && pageCss !== ''
      ? { currentPageCss: pageCss }
      : {}),
    // The home page's site settings (seo.site) survive; a slug someone set is kept.
    ...(seo === undefined ? {} : { currentSeo: seo }),
    ...(typeof slug === 'string' ? { currentSlug: slug } : {}),
  };
}

/** Every command a plan uses, once each: the policy a code-written plan is validated under. */
function policyFor(plan: AiPlan): { allowedCommands: readonly string[]; maxCommands: number } {
  return {
    allowedCommands: [...new Set(plan.commands.map(({ command }) => command))],
    maxCommands: Math.max(1, plan.commands.length),
  };
}

/**
 * The node each region became, from the skeleton transaction's patches.
 *
 * The kernel mints ids on apply, and a group's patches arrive in step order,
 * so the n-th created node is the n-th `insertNode` step — read by the tail of
 * the path (`…, 'nodes', id]`), as the scaffold build does, so a site kernel's
 * page lens reads the same. Checked by label; a mismatch falls back to
 * matching labels in page order, never to a guess.
 */
function regionIds(
  applied: AppliedAiPlan,
  plan: AiPlan,
  regions: readonly { readonly step: number; readonly title: string }[],
  document: BuilderDocument,
): readonly (NodeId | undefined)[] {
  const created: NodeId[] = [];
  const seen = new Set<NodeId>();
  for (const patch of applied.transactions[0]?.patches ?? []) {
    if (patch.op !== 'add' || patch.path.length < 2) continue;
    if (patch.path[patch.path.length - 2] !== 'nodes') continue;
    const id = patch.path[patch.path.length - 1];
    if (typeof id !== 'string' || seen.has(id)) continue;
    seen.add(id);
    created.push(id);
  }
  const insertSteps = plan.commands.flatMap(({ command }, index) =>
    command === 'insertNode' ? [index] : [],
  );
  const byStep = regions.map(({ step }) => created[insertSteps.indexOf(step)]);
  const labelled = (id: NodeId | undefined, title: string): boolean =>
    id !== undefined && document.nodes[id]?.props['label'] === title;
  if (
    created.length === insertSteps.length &&
    byStep.every((id, index) => labelled(id, regions[index]?.title ?? ''))
  ) {
    return byStep;
  }
  const unused = [...created];
  return regions.map(({ title }) => {
    const at = unused.findIndex((id) => labelled(id, title));
    return at === -1 ? undefined : unused.splice(at, 1)[0];
  });
}

const CONTRACT_ROLE_LINE: Readonly<Record<SectionContract['role'], string>> = {
  header: ROLE_LINE.chrome,
  footer: ROLE_LINE.chrome,
  hero: ROLE_LINE.hero,
  band: ROLE_LINE.band,
  cta: 'ROLE: CTA — the closing call to action: one heading, one short line and the primary action; no h1.',
};

const PLAN_HEADING = 'THE PAGE PLAN (decided for the whole page — obey it exactly):';

function quoted(values: readonly string[]): string {
  return values.map((value) => JSON.stringify(value)).join(' · ');
}

/** Every https address in a text, as typed; the characters that cannot sit in one end it. */
const HTTPS_ADDRESS = /https:\/\/[^\s"'<>()[\]{}]+/giu;
/** Punctuation a sentence puts right after an address, never part of it. */
const ADDRESS_TAIL = /[.,;:!?،؛…]+$/u;
const IMAGE_FILE = /\.(?:avif|gif|jpe?g|png|svg|webp)$/iu;
/*
  Picture hosts whose addresses carry no file type:
  images.unsplash.com/photo-1509042239860-f550ce710b93?w=1200 is the form
  the repo's own block examples use, and it reached no writer (wave-2
  verifier, r2-fixes.mjs §1, 2026-09-28). The catalog's own addresses are
  asked of the catalog.
*/
const IMAGE_HOSTS =
  /^(?:(?:images|plus|source)\.unsplash\.com|images\.pexels\.com|cdn\.pixabay\.com|i\.imgur\.com|res\.cloudinary\.com|[a-z0-9-]+\.imgix\.net|images\.ctfassets\.net|lh[3-6]\.googleusercontent\.com|pbs\.twimg\.com|cdn\.shopify\.com|upload\.wikimedia\.org|i\.ibb\.co|picsum\.photos|i\.pinimg\.com|img\.freepik\.com|images\.squarespace-cdn\.com|cdn\.dribbble\.com|media\.istockphoto\.com)$/iu;
/** Parameters only an image service reads: `fm=jpg`, `format=webp`, `auto=format`. */
const IMAGE_QUERY =
  /[?&](?:fm|format)=(?:avif|gif|jpe?g|png|webp|auto)(?:&|$)|[?&]auto=(?:format|compress)(?:&|$)/iu;
/** Pages, whatever words come before them: a profile, a chat, a map is not a picture. */
const PAGE_HOSTS =
  /(?:^|\.)(?:instagram\.com|facebook\.com|fb\.com|x\.com|twitter\.com|tiktok\.com|youtube\.com|youtu\.be|linkedin\.com|wa\.me|whatsapp\.com|t\.me|snapchat\.com|pinterest\.com|google\.com|goo\.gl)$/iu;
/** A page path, not a picture: `.html`, `.php` and the like. */
const PAGE_FILE = /\.(?:html?|php|aspx?|jsp)$/iu;
/*
  The person SAID it is a picture, just before it, in the same sentence:
  «صورة المحل: https://…», «شعارنا https://…», "our logo https://…". Arabic
  words are read with their clitics (بالصورة، لصورتنا).
*/
const PHOTO_WORD =
  /(?:^|[^\p{L}])(?:(?:و|ف)?(?:بال|لل|ال|ب|ل)?(?:صور|لوغو|لوجو|لوقو|شعار|خلفي|غلاف|بانر)|photos?|images?|pictures?|pics?|logo|banner|background|cover|img)(?![a-z])/iu;
/** Characters of the same sentence read before an address for a photo word. */
const PHOTO_WORD_WINDOW = 48;
/** Past this many a list stops being a person's photos and becomes noise in every brief. */
const OWN_PHOTOS_MAX = 6;

/** Whether an address the person typed is a picture, read from the address and what came just before it. */
function isPictureAddress(address: string, before: string): boolean {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return false;
  }
  if (PAGE_HOSTS.test(url.hostname) || PAGE_FILE.test(url.pathname)) return false;
  if (IMAGE_FILE.test(url.pathname) || IMAGE_HOSTS.test(url.hostname)) return true;
  if (IMAGE_QUERY.test(url.search) || isCatalogPhotoUrl(address)) return true;
  // The sentence so far: a full stop, a line break or an earlier address ends what counts.
  const sentence =
    before
      .slice(-PHOTO_WORD_WINDOW)
      .split(/[.!?؟;؛\n]|https:\/\//u)
      .at(-1) ?? '';
  return PHOTO_WORD.test(sentence);
}

/**
 * The picture addresses the person typed, first seen first, each once, exactly
 * as typed — the checker admits an image only when the person's words hold
 * its address verbatim. A writer reads its contract and not the request
 * (P1-10), so without this line an address they gave reached no writer at all:
 * the checker could stop a repair from swapping it out, but nothing could make
 * the page use it.
 *
 * Any https picture, not only one named by its file type: an extension-less
 * Unsplash or Pexels address, a catalog address, an image service's
 * `?fm=jpg`, or any address the person introduced as a photo, logo or
 * background. A link to a page stays a link.
 */
function ownPhotoAddresses(personWords: string): readonly string[] {
  const found = new Set<string>();
  for (const match of personWords.matchAll(HTTPS_ADDRESS)) {
    const address = match[0].replace(ADDRESS_TAIL, '');
    if (!isPictureAddress(address, personWords.slice(0, match.index))) continue;
    found.add(address);
    if (found.size === OWN_PHOTOS_MAX) break;
  }
  return Object.freeze([...found]);
}

/*
  How a writer colours on a page plan, in the words the checker holds it to.
  The kit is the skeleton's own (PAGE_KIT_CLASSES, written into the page CSS
  in @layer components); the old line told writers to use arbitrary classes
  such as bg-[var(--ck-accent)], which the static vocabulary does not
  generate — the door refused them ("utility classes with no generated
  CSS"), or, under the live compiler, they rendered on the canvas and were
  missing from the published page (skeleton-checker F9, 2026-09-28).
*/
const KIT_LINE = `KIT — the page's classes, in its CSS already: ${PAGE_KIT_CLASSES.map(
  ({ name, use }) => `${name} (${use})`,
).join(' · ')}`;
/** A section-variants recipe is written in slots; on a page plan each slot is a kit class. */
const SLOTS_LINE =
  "SLOTS — fill a recipe's slots from the kit: bg-{ground} → ck-ground · bg-{card} → ck-card · text-{ink} → ck-ink · text-{muted} → ck-muted · text-{accent-ink} → ck-accent-ink · bg-{accent} text-{on-accent} → ck-btn on an action, ck-accent-fill on a band · bg-{band} text-{band-text} → ck-inverse (text-{band-muted} → ck-muted inside it) · any other colour → a ck- class of your own in this region's css over var(--ck-…)";

/**
 * What a writer may build with, beyond utilities: region css as a first-class
 * tool for the signature, inside the door's refusal list (custom-css.ts
 * REFUSED), and the design markup the vocabulary admits today.
 */
function designCodeLine(): string {
  const markup = designMarkup();
  return `DESIGN CODE — this region's css (its second setProp, under 8,000 characters) is a first-class tool: build the SIGNATURE and any effect a utility cannot say (a gradient ground, a mask or clip-path, grain, layered shapes, keyframes) as ck- classes coloured only with var(--ck-…) (color-mix() for tints), motion inside @media (prefers-reduced-motion:no-preference). The door refuses only @import, url() over http: or //, expression(), behavior, -moz-binding, javascript: and </style>.${markup === '' ? '' : ` Markup beyond sections and cards: ${markup}.`}`;
}

/** The IMAGES lines: the contract's photos, the person's own where they fit, or none. */
function imageLines(
  contract: SectionContract,
  ownPhotos: readonly string[],
  assigned: readonly string[] = [],
): readonly string[] {
  const images = contract.images ?? [];
  // The hero shows the person's own photo even when the plan made it type-led: they gave it for the page.
  const own = images.length > 0 || contract.role === 'hero' ? ownPhotos : [];
  const ownLine = `THEIR OWN PHOTOS (the person gave these addresses; use them exactly as written): ${own.join(' · ')}`;
  if (images.length === 0) {
    return own.length === 0
      ? ['IMAGES: none — this section is type-led; no photo']
      : [
          'IMAGES: the person’s own — show the first of THEIR OWN PHOTOS that fits this section, exactly as written',
          ownLine,
        ];
  }
  return [
    `IMAGES: ${images
      .map(({ subject, aspect, alt }) => `${subject} (${aspect}) alt ${JSON.stringify(alt)}`)
      .join(
        ' · ',
      )} — each from ${own.length === 0 ? '' : 'THEIR OWN PHOTOS where one fits, else from '}PHOTOS YOU MAY USE`,
    ...(own.length === 0 ? [] : [ownLine]),
    // The plan's photo for each image, distinct across the page (quality pass 2026-10-05).
    ...(assigned.length === 0
      ? []
      : [
          `THIS SECTION'S PHOTOS (assigned by the plan; no other section shows them — use these addresses, in order): ${assigned.join(' · ')}`,
        ]),
  ];
}

/*
  Parallel writers contradicted each other (walk 2026-10-08): grilled chicken
  cost 18 JOD in one section and 35 JOD in the menu, because each writer saw
  only its own section's facts. Every writer now also reads the facts the
  OTHER sections carry, so a dish, price, phone or hour it mentions is the
  same value everywhere on the page.
*/
const MAX_PAGE_FACTS = 24;

function pageFactsLines(plan: PagePlan, sectionKey: string): readonly string[] {
  const others = plan.facts
    .filter(({ section }) => section !== sectionKey)
    .slice(0, MAX_PAGE_FACTS);
  if (others.length === 0) return [];
  return [
    `FACTS ELSEWHERE ON THE PAGE (if this section mentions one, write the same value — never a different price, name, phone or hour; do not invent new prices for these items): ${others
      .map(({ key, sample }) => `${key}: ${sample}`)
      .join(' · ')}`,
  ];
}

/**
 * A section writer's whole brief: the page's tokens and its one contract.
 *
 * NOT the person's request and NOT the conversation (agent-audit P1-10,
 * P2-20). Measured 2026-09-28: every writer carried the whole request "for
 * subject matter", which re-activated ~10.7k characters of page-level skills,
 * and up to twelve turns of history, and still could not see what its
 * neighbours said — so the hero's numbers came back in the stats band and the
 * final CTA invented its own button label. The plan decided all of that once;
 * the contract hands each writer its part.
 */
function contractRequest(
  plan: PagePlan,
  index: number,
  task: AiBuildTask,
  neighbours: string,
  ownPhotos: readonly string[],
): string {
  const contract = plan.sections[index];
  if (contract === undefined) return '';
  const tokens = plan.tokens;
  const facts = plan.facts.filter(({ section }) => section === contract.key);
  const chrome = contract.role === 'header' || contract.role === 'footer';
  return [
    PLAN_HEADING,
    `PAGE: ${plan.title} — lang ${plan.locale.lang}, ${plan.locale.dir}`,
    `TOKENS — the page's colours and faces, on the page as CSS custom properties: --ck-bg ${tokens.bg} ground · --ck-surface ${tokens.surface} cards · --ck-ink ${tokens.ink} text · --ck-muted ${tokens.muted} secondary text · --ck-accent ${tokens.accent} brand fill · --ck-on-accent ${tokens.onAccent} text on the fill · --ck-accent-ink ${tokens.accentInk} accent-coloured text · --ck-border ${tokens.border} hairlines · --ck-radius (${tokens.radius}) · --ck-font-display "${tokens.fontDisplay.family}" headings · --ck-font-body "${tokens.fontBody.family}" text`,
    `COLOUR — only through the kit below, or var(--ck-…) in this region's css. Never a hex, a palette shade (bg-orange-700) or an arbitrary class (bg-[var(--ck-accent)]: the published page has no CSS for it); black and white utilities (ring-black/5, bg-black/60, text-white) are fine. Accent-coloured TEXT, numbers and icons are ck-accent-ink (${tokens.accentInk}), never the accent fill ${tokens.accent} as text.`,
    KIT_LINE,
    SLOTS_LINE,
    designCodeLine(),
    `SIGNATURE: ${tokens.signature}`,
    `PRIMARY ACTION: "${plan.primaryCta.label}" → ${plan.primaryCta.href} — every call-to-action button on the page says exactly this`,
    ...(chrome && plan.nav.length > 0
      ? [`NAV: ${plan.nav.map(({ label, anchorId }) => `${label} → #${anchorId}`).join(' · ')}`]
      : []),
    '',
    `SECTION ${String(index + 1)} OF ${String(plan.sections.length)}: ${contract.title}`,
    CONTRACT_ROLE_LINE[contract.role],
    `REGION ID: ${task.id}`,
    `ANCHOR: the section's outer element keeps id="${contract.anchorId}"`,
    ...(contract.variant === undefined
      ? []
      : [
          `VARIANT: ${contract.title}[${contract.variant}] — build exactly this section-variants recipe`,
        ]),
    `PURPOSE: ${contract.purpose}`,
    ...(contract.mustSay.length === 0 ? [] : [`MUST SAY: ${quoted(contract.mustSay)}`]),
    ...(contract.mustNotRepeat.length === 0
      ? []
      : [`MUST NOT REPEAT (another section says it): ${quoted(contract.mustNotRepeat)}`]),
    ...imageLines(
      contract,
      ownPhotos,
      (pagePhotoPlan(plan).bySection.get(contract.key) ?? []).map(({ url }) => url),
    ),
    ...(facts.length === 0
      ? []
      : [
          `SAMPLE FACTS (write exactly these values; the owner replaces them before publishing): ${facts
            .map(({ key, sample }) => `${key}: ${sample}`)
            .join(' · ')}`,
        ]),
    ...pageFactsLines(plan, contract.key),
    ...(neighbours.trim() === '' ? [] : ['', 'THE SECTIONS AROUND IT:', neighbours.trim()]),
  ].join('\n');
}

/** How an image slot takes a photo: a catalog subject, or an address the person gave. */
const KIT_IMAGE_LINE =
  'IMAGE SLOTS: {"subject":"<the photo topic above>","alt":"…"} for a catalog photo, {"src":"<an address the person gave, listed above>","alt":"…"} for theirs; leave an optional image slot out when IMAGES says none.';

/**
 * A kit-backed writer's brief (2026-09-30, DESIGN §B): the contract as
 * `contractRequest` states it, but the layout is a KIT — its index line and
 * the section lane's tools stand where the kit classes, the variant recipe
 * and the design-code line were — and the answer is ONE `kit.section` tool
 * step. The kit colours itself from the page's ck- classes, so no colour or
 * css rules are needed; the words are the writer's whole job.
 */
function kitContractRequest(
  plan: PagePlan,
  index: number,
  task: AiBuildTask,
  neighbours: string,
  ownPhotos: readonly string[],
): string {
  const contract = plan.sections[index];
  if (contract?.kit === undefined) return '';
  const facts = plan.facts.filter(({ section }) => section === contract.key);
  const hero = contract.role === 'hero';
  const shape = {
    command: AGENT_TOOL_COMMAND,
    args: {
      name: 'kit.section',
      input: { id: task.id, kit: contract.kit, ...(hero ? { heading: 'h1' } : {}), slots: {} },
    },
  };
  return [
    PLAN_HEADING,
    `PAGE: ${plan.title} — lang ${plan.locale.lang}, ${plan.locale.dir}`,
    `PRIMARY ACTION: "${plan.primaryCta.label}" → ${plan.primaryCta.href} — every call-to-action link in the slots says exactly this`,
    '',
    `SECTION ${String(index + 1)} OF ${String(plan.sections.length)}: ${contract.title}`,
    CONTRACT_ROLE_LINE[contract.role],
    `REGION ID: ${task.id}`,
    `ANCHOR: the section's outer element keeps id="${contract.anchorId}" (the kit keeps it for you)`,
    `PURPOSE: ${contract.purpose}`,
    ...(contract.mustSay.length === 0 ? [] : [`MUST SAY: ${quoted(contract.mustSay)}`]),
    ...(contract.mustNotRepeat.length === 0
      ? []
      : [`MUST NOT REPEAT (another section says it): ${quoted(contract.mustNotRepeat)}`]),
    // The same image lines as a markup writer's, and how an image slot takes them.
    ...imageLines(contract, ownPhotos),
    KIT_IMAGE_LINE,
    ...(facts.length === 0
      ? []
      : [
          `SAMPLE FACTS (write exactly these values; the owner replaces them before publishing): ${facts
            .map(({ key, sample }) => `${key}: ${sample}`)
            .join(' · ')}`,
        ]),
    ...pageFactsLines(plan, contract.key),
    '',
    planKitIndex(writerKitRoles(contract)),
    '',
    agentToolPrompt('section'),
    // script-wiring additions
    ...sectionScriptCard(contract, planKit(contract.kit)),
    // end script-wiring additions
    '',
    `ANSWER with ONE tool step and nothing else: ${JSON.stringify(shape)} — "id" is this region's id (${task.id}); "kit" is ${contract.kit}, or another kit listed above; fill "slots" with this section's copy in the page's language (${plan.locale.lang}): the MUST SAY claims, the SAMPLE FACTS exactly as written, every action link as the PRIMARY ACTION. No markup and no css: the kit is styled by the page.`,
    ...(neighbours.trim() === '' ? [] : ['', 'THE SECTIONS AROUND IT:', neighbours.trim()]),
  ].join('\n');
}

/** The neighbours' summary never costs a section: a summary that throws is an empty one. */
function neighbourSummary(
  plan: PagePlan,
  index: number,
  landed: ReadonlyMap<string, LandedSection>,
): string {
  try {
    return summarizeNeighbours(plan, index, landed);
  } catch {
    return '';
  }
}

/** The step events T1 sends under a build: `<build>/page-plan`, shaped as any step's. */
function planStepEvents(
  build: BuildRun,
  emit = stepEmitter(build, PAGE_PLAN_STEP),
): (note: PagePlanStepNote) => void {
  return (note) => {
    switch (note.type) {
      case 'started':
        emit({ type: 'run.started', apply: 'never' });
        return;
      case 'skills':
        emit({
          type: 'skills.resolved',
          activations: note.skills?.activations ?? [],
          omitted: note.skills?.omitted ?? [],
          totalTokens: note.skills?.totalTokens ?? 0,
        });
        return;
      case 'context':
        emit({
          type: 'context.ready',
          fragmentCount: note.context.fragments.length,
          totalTokens: estimateAssembledAiContextTokens(note.context),
        });
        return;
      case 'proposing':
        if (note.attempt === 1) emit({ type: 'plan.proposing' });
        return;
      case 'progress':
        emit({ type: 'plan.progress', text: note.text });
        return;
      case 'usage':
        emit({ type: 'provider.usage', attemptId: note.attemptId, usage: note.usage });
        return;
      case 'repairing':
        emit({
          type: 'plan.repairing',
          issues: note.issues.map(({ path, message }) => `${path}: ${message}`),
        });
        return;
      case 'ready':
        emit({ type: 'run.completed', status: 'proposed' });
        return;
      case 'failed':
        emit({ type: 'run.failed', error: note.error });
        return;
    }
  };
}

/**
 * Why the plan path gave out, as the result and the fallback event carry it.
 * `issues` are the validator's (T1) or the door's (skeleton) own words, each
 * the instruction it gave; a failure with none carries its message alone.
 */
function planFallback(
  stage: AiBuildPlanFallback['stage'],
  error: AiRunFailure,
  issues: readonly string[],
): AiBuildPlanFallback {
  return Object.freeze({
    stage,
    error,
    issues: Object.freeze(issues.length === 0 ? [error.message] : [...issues]),
  });
}

/** A refusal's own issues, or its message when it carries none. */
function refusalIssues(cause: unknown): readonly string[] {
  if (cause instanceof AiPlanRejectedError) return cause.issues.map(({ message }) => message);
  return [errorMessage(cause)];
}

/** The most sections a planned page may have: the build's task limit, never above the default. */
function planMaxSections(build: BuildRun): number {
  return Math.min(build.maxTasks, DEFAULT_AI_BUILD_MAX_TASKS);
}

/**
 * Step T1 under a build. Undefined means T1 never ran — the provider cannot
 * plan a page, or the registry has no region block — and the build is the
 * scaffold build by design. `failure` means it ran and gave out: its plan was
 * refused twice, or the provider failed; the build falls back to the scaffold
 * run, which still works everywhere it worked before, and says why.
 * Only an abort escapes: that is the person stopping, not the strategy failing.
 */
async function planStep(
  build: BuildRun,
  target: IntentTarget,
  onDraft?: (event: AiPagePlanDraftEvent) => void,
): Promise<
  | { readonly plan: PagePlan; readonly rationale?: string }
  | { readonly failure: AiBuildPlanFallback }
  | undefined
> {
  const { options } = build;
  if (options.provider.proposePagePlan === undefined) return undefined;
  // A plan is laid as `customCode` regions; a registry without them keeps the scaffold build.
  if (options.kernel.context.registry.block(REGION_TYPE) === undefined) return undefined;
  const isCurrentRun = options.isCurrentRun;
  const emit = stepEmitter(build, PAGE_PLAN_STEP);
  const result = await proposeValidatedPagePlan(
    {
      runId: stepRunId(options.runId, PAGE_PLAN_STEP),
      kernel: options.kernel,
      provider: options.provider,
      request: options.request,
      ...(options.history === undefined ? {} : { history: options.history }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(isCurrentRun === undefined
        ? {}
        : {
            isCurrentRun: (): boolean => {
              // Read as unknown: a host port that answers anything but `true` holds no lease.
              const current: unknown = isCurrentRun(options.runId);
              return current === true;
            },
          }),
      ...stepSkills(options),
      ...(options.policy === undefined ? {} : { policy: options.policy }),
      ...(options.composition === undefined ? {} : { composition: options.composition }),
      ...(options.freeCode === true ? { freeCode: true } : {}),
      ...(options.contextProviders === undefined
        ? {}
        : { contextProviders: options.contextProviders }),
      ...(options.additionalContextProviders === undefined
        ? {}
        : { additionalContextProviders: options.additionalContextProviders }),
      target,
      maxSections: planMaxSections(build),
      ...(onDraft === undefined ? {} : { onDraft }),
    },
    planStepEvents(build, emit),
  );
  if (!('plan' in result)) {
    return {
      failure: planFallback(
        'plan',
        result.error,
        (result.issues ?? []).map(
          ({ path, message }) => `${path === '' ? '' : `${path}: `}${message}`,
        ),
      ),
    };
  }
  return result.rationale === undefined
    ? { plan: result.plan }
    : { plan: result.plan, rationale: result.rationale };
}

/** What `planJobs` makes of a landed skeleton: one job per region, and what they share. */
interface PlanJobs {
  readonly tasks: readonly AiBuildTask[];
  readonly jobs: readonly SectionJob[];
  /** The section key of each job, in job order. */
  readonly keys: readonly string[];
  readonly placeholders: Map<NodeId, AiBuildSectionValues>;
  /** What each section holds once written, for the neighbours' summaries. */
  readonly landedSections: Map<string, LandedSection>;
  /** What the checker reads: the person's own words. */
  readonly checkOptions: { readonly request: string };
}

/** A section's contract in a plan, by key. */
function contractOf(plan: PagePlan, key: string): SectionContract | undefined {
  return plan.sections.find((section) => section.key === key);
}

/** A section's facts-ledger entries, for its report. */
function factsOf(plan: PagePlan, key: string): readonly AiBuildTaskFact[] {
  return Object.freeze(
    plan.facts
      .filter(({ section }) => section === key)
      .map(({ key: factKey, sample }) => Object.freeze({ key: factKey, sample })),
  );
}

/**
 * The jobs of a page-plan build, one per region the skeleton laid: the ones
 * the skeleton wrote in full are complete (their landing is its
 * transaction), every other one gets a writer briefed with its contract.
 *
 * `plan` is the plan the skeleton was written from (its outline names the
 * regions); `planFor(key)` is the plan a section is WRITTEN from, read each
 * time a writer starts, checks or reports it. On a plain build the two are
 * one plan. On a streamed build `planFor` is the provisional plan that held
 * the section's brief, and the final plan once it is in — so a rerun, a check
 * and a report read the final contract (DESIGN §6.3).
 */
function planJobs(
  build: BuildRun,
  input: {
    readonly plan: PagePlan;
    readonly planFor: (key: string) => PagePlan;
    readonly skeleton: ReturnType<typeof skeletonFromPlan>;
    readonly ids: readonly (NodeId | undefined)[];
    readonly skeletonTx: AppliedAiPlan['transactions'][number] | undefined;
  },
): PlanJobs {
  const { options } = build;
  const { plan, planFor, skeleton, ids, skeletonTx } = input;
  const document = options.kernel.getDocument();
  const tasks: AiBuildTask[] = [];
  const keys: string[] = [];
  const placeholders = new Map<NodeId, AiBuildSectionValues>();
  const landedSections = new Map<string, LandedSection>();
  /*
    What the PERSON wrote — this request and their earlier messages, never the
    assistant's — is what the checker's image rule reads: an address they
    typed is theirs to use. Handed nothing, the checker flagged the shop's own
    photo as foreign, and the repair round told the writer to swap it for a
    catalog one (wave-1 verifier, v5-own-photo: 1 issue, 1 extra model call,
    the person's photo replaced, 2026-09-28).
  */
  const checkOptions = {
    request: [
      options.request,
      ...(options.history ?? []).filter(({ role }) => role === 'user').map(({ text }) => text),
    ].join('\n'),
    scene: options, // Phase 2 E: a browser host runs (and may look at) scene sections; Stop stops it
  };
  const ownPhotos = ownPhotoAddresses(checkOptions.request);
  const jobs: SectionJob[] = [];
  const total = plan.sections.length;
  skeleton.regions.forEach((region, index) => {
    const id = ids[index];
    const outline = plan.sections[index];
    if (id === undefined || outline === undefined) return;
    const key = outline.key;
    const task: AiBuildTask = Object.freeze({ id, title: region.title });
    tasks.push(task);
    keys.push(key);
    const values = readSectionValues(document, id);
    placeholders.set(id, values);
    const common = {
      task,
      position: index + 1,
      total,
      sectionKey: key,
      facts: () => factsOf(planFor(key), key),
      fingerprint: () => sectionFingerprint(planFor(key), key),
    };
    /*
      A kit section the skeleton filled from the planner's slots is held to
      its contract like any written one; one that misses gets a writer, which
      starts from the kit it already holds.
    */
    const kitMisses =
      region.kit !== undefined &&
      kitSlotMisses(task, () => checkSection(plan, outline, sectionOf(values), checkOptions));
    const complete = region.complete === true && !kitMisses;
    if (complete && skeletonTx !== undefined) {
      landedSections.set(key, sectionOf(values));
      jobs.push({
        ...common,
        complete: Object.freeze({
          transactionId: skeletonTx.id,
          label: skeleton.label,
          before: Object.freeze({}),
          after: values,
        }),
      });
      return;
    }
    /*
      Everything a writer is handed is read from the plan it is written from,
      once per plan: on a streamed build that plan changes from the
      provisional one to the final one between a speculative write and its
      rerun.
    */
    let briefing: { readonly plan: PagePlan; readonly value: SectionBriefing } | undefined;
    const briefingFor = (current: PagePlan): SectionBriefing | undefined => {
      if (briefing?.plan === current) return briefing.value;
      const value = sectionBriefing(build, current, key, ownPhotos);
      if (value !== undefined) briefing = { plan: current, value };
      return value;
    };
    jobs.push({
      ...common,
      brief: (attempt) => {
        const current = planFor(key);
        const at = current.sections.findIndex((section) => section.key === key);
        const briefed = briefingFor(current);
        // A key the plan no longer has is never handed to a writer; the outline guarantees it.
        if (briefed === undefined || at === -1) {
          return { request: '', skillIds: [], providers: [], history: false };
        }
        const { kitBacked, kitSkillIds, skillIds, providers, sampleValues } = briefed;
        const contract = current.sections[at];
        const completeStep =
          contract === undefined
            ? undefined
            : (answer: AiPlan): AiPlan => completeKitSteps(current, contract, answer);
        /*
          A kit-backed section (2026-09-30): the writer names the kit and fills
          its slots in ONE tool step — ~30-300 output tokens instead of the
          section's markup — with the kit index in place of the variant library.
          Attempt 2 is today's markup writer, so a kit step refused twice (its
          repair round included) never costs the section.
        */
        return kitBacked && attempt === 1
          ? {
              request: kitContractRequest(
                current,
                at,
                task,
                neighbourSummary(current, at, landedSections),
                ownPhotos,
              ),
              skillIds: kitSkillIds,
              providers,
              history: false,
              sampleValues,
              ...(completeStep === undefined ? {} : { completeStep }),
            }
          : {
              // The retry is SHORTER: the neighbours go, the contract stays.
              request: contractRequest(
                current,
                at,
                task,
                attempt === 1 ? neighbourSummary(current, at, landedSections) : '',
                ownPhotos,
              ),
              skillIds,
              providers,
              history: false,
              sampleValues,
              ...(completeStep === undefined ? {} : { completeStep }),
            };
      },
      check: (section) => {
        const current = planFor(key);
        const contract = contractOf(current, key);
        return contract === undefined ? [] : checkWritten(current, contract, section, checkOptions);
      },
      scene: () => briefingFor(planFor(key))?.scene === true,
      tidy: (commands) => {
        const tokens = planFor(key).tokens;
        try {
          const next = commands.map((step) => {
            const args = tokeniseColourClasses(step.args, tokens);
            return args === step.args ? step : { ...step, args };
          });
          return next.some((step, index) => step !== commands[index]) ? next : commands;
        } catch {
          // A repair that throws repairs nothing: the check judges what was written.
          return commands;
        }
      },
      onLanded: (after) => {
        landedSections.set(key, sectionOf(after));
      },
    });
  });
  return {
    tasks: Object.freeze(tasks),
    jobs: Object.freeze(jobs),
    keys: Object.freeze(keys),
    placeholders,
    landedSections,
    checkOptions,
  };
}

/** What a section's writer is handed besides its request, as one plan decides it. */
interface SectionBriefing {
  readonly kitBacked: boolean;
  /** Its writer writes a scene (`writesScene`). */
  readonly scene: boolean;
  readonly skillIds: readonly string[];
  readonly kitSkillIds: readonly string[];
  readonly providers: readonly AiContextProvider[];
  readonly sampleValues: readonly string[];
}

function sectionBriefing(
  build: BuildRun,
  plan: PagePlan,
  key: string,
  ownPhotos: readonly string[],
): SectionBriefing | undefined {
  const { options } = build;
  const contract = contractOf(plan, key);
  if (contract === undefined) return undefined;
  const arabic = ARABIC_LANG.test(plan.locale.lang);
  // A hero is handed the person's own photos even when the plan made it type-led (see imageLines).
  const photos =
    (contract.images ?? []).length > 0 || (contract.role === 'hero' && ownPhotos.length > 0);
  const creativeRequest = creativeRequestOf(options, contract);
  const skillIds = fillSkillIds(options, arabic, photos, true, creativeRequest);
  const scene = writesScene(options, contract);
  const kitBacked =
    !scene && planKit(contract.kit) !== undefined && agentToolPrompt('section') !== '';
  return {
    kitBacked,
    scene,
    skillIds,
    kitSkillIds: kitBacked
      ? fillSkillIds(options, arabic, photos, false, creativeRequest)
      : skillIds,
    // Every data fragment the writer is handed: the catalog, and a scene's creative brief.
    providers: sectionProviders(options, plan, contract),
    sampleValues: Object.freeze(plan.facts.map(({ sample }) => sample)),
  };
}

/**
 * The page-plan build: approval on the PLAN, the skeleton written by code in
 * one transaction, and one writer per section that the skeleton did not write
 * in full — each given its contract, checked before it lands.
 *
 * Returns `refused` only when the door refused the skeleton for a plan the
 * build made itself and nobody was asked about; the caller then falls back to
 * the scaffold run — out loud: the door's reasons go on a `build.scaffolding`
 * event and on the result (`planFallback`). It was a bare `undefined` once,
 * and the wave-2 verifier (r2-silent-fallback2.mjs, 2026-09-28) watched a
 * validated plan dropped for the ~25k-character model skeleton with no event
 * and no field saying so. A plan the person approved, edited or handed in is
 * never swapped for a different build: its skeleton's refusal is thrown, with
 * nothing written.
 */
async function buildFromPlan(
  build: BuildRun,
  proposed: PagePlan,
  rationale: string | undefined,
  source: 'given' | 'planned',
): Promise<AiBuildRunResult | { readonly refused: AiBuildPlanFallback }> {
  const { options, emit } = build;
  const direction = planDirection(proposed, rationale);
  const planned: readonly AiBuildPlannedTask[] = Object.freeze(
    proposed.sections.map(({ title }) => Object.freeze({ title })),
  );

  if (!build.writes) {
    // Plan mode through the build: the plan, and nothing written.
    return Object.freeze({
      runId: options.runId,
      tasks: Object.freeze([]),
      applied: 0,
      skipped: 0,
      elapsedMs: workedMs(build),
      direction,
      outcome: 'planned' as const,
      plannedTasks: planned,
      pagePlan: proposed,
    });
  }

  let plan = proposed;
  if (build.asks) {
    const answer = await askPerson(build, planned, direction, proposed);
    if (answer === 'stop' || build.personStopped()) {
      return refusedBuild(build, planned, direction, { pagePlan: proposed });
    }
    if (typeof answer === 'object') plan = revalidated(answer.build, proposed.intent);
  }
  if (build.personStopped()) return refusedBuild(build, planned, direction, { pagePlan: plan });

  // T2: the skeleton, by code, as ONE labelled transaction through the door.
  let skeleton: ReturnType<typeof skeletonFromPlan>;
  let landed: AppliedAiPlan;
  try {
    skeleton = skeletonFromPlan(plan, skeletonContext(options, plan));
    landed = applyAiPlan({
      kernel: options.kernel,
      validationPorts: options.validationPorts,
      plan: skeleton.plan,
      policy: policyFor(skeleton.plan),
      label: skeleton.label,
    });
  } catch (cause) {
    if (source === 'planned' && !build.asks) {
      return {
        refused: planFallback('skeleton', classifyAiRunFailure(cause), refusalIssues(cause)),
      };
    }
    throw cause;
  }

  const document = options.kernel.getDocument();
  const ids = regionIds(landed, skeleton.plan, skeleton.regions, document);
  const { tasks, jobs, placeholders } = planJobs(build, {
    plan,
    planFor: () => plan,
    skeleton,
    ids,
    skeletonTx: landed.transactions[0],
  });

  // An edited plan is described as edited: the card said one thing, the build does this.
  const built = plan === proposed ? direction : planDirection(plan, rationale);
  emit({
    type: 'build.planned',
    direction: built,
    tokens: plan.tokens,
    tasks: Object.freeze(tasks),
    writers: fillConcurrencyFor(
      jobs.filter(({ complete }) => complete === undefined).length,
      options.fillConcurrency,
    ),
  });
  const filled = await fillAndLand(build, jobs, placeholders);
  // Every section landed and nobody stopped: the zero-token SEO pass, one transaction.
  const seoLanded = filled.stopped === undefined && landSeoPass(build, plan);
  return finishBuild(
    build,
    seoLanded ? rebaseLandings(filled, options.kernel.getDocument()) : filled,
    built,
    {
      pagePlan: plan,
    },
  );
}

/**
 * Why a kit section the skeleton filled from the PLANNER's slots goes to a
 * writer after all, by task — said on its first `task.started` (`kitMisses`),
 * so a slow first section can be traced to the check that sent it there.
 */
const KIT_MISSES = new WeakMap<AiBuildTask, readonly string[]>();

/**
 * A kit section filled from the planner's slots, checked like a written one —
 * except `must-say`: the planner wrote both the claim and the slots, so its
 * own wording is the contract. 2026-10-05 (English): the hero's slots said
 * "in seconds… no credit card" in other words than its mustSay, so a writer
 * rewrote it and the first section landed at 28.5 s instead of ≈ 12 s.
 */
function kitSlotMisses(task: AiBuildTask, check: () => readonly SectionCheckIssue[]): boolean {
  const misses = guardedCheck(check).filter(({ code }) => code !== 'must-say');
  if (misses.length === 0) {
    KIT_MISSES.delete(task);
    return false;
  }
  KIT_MISSES.set(task, Object.freeze(misses.map(({ code, message }) => `${code}: ${message}`)));
  return true;
}

const SEO_PASS_RATIONALE =
  'Keep the menu in step with the sections, and apply the safe SEO fixes: alt text, image sizes and loading, one h1, labelled sections, a clamped title and description.';

/**
 * The post-build pass (DESIGN §0, 2026-09-30) — zero tokens, one transaction
 * labelled `Assistant: SEO`, through the same door as every write:
 * `nav.sync` (the header and footer name the sections as they landed), then
 * every safe fix `seoAutofixPlan` finds on the page as those steps leave it.
 * The plan's fact samples go with both, so no sample value becomes SEO data.
 *
 * Never costs the build: a refused whole is retried as the SEO fixes alone,
 * then the menu alone, and a pass that still cannot land leaves the page as
 * the sections left it. Asks "has the person stopped?" before it writes.
 * What it could not fix stays for `checkSeo`, which the host's quality view
 * reads from the page.
 */
function landSeoPass(build: BuildRun, plan: PagePlan): boolean {
  const { options } = build;
  if (build.personStopped()) return false;
  const sampleValues = plan.facts.map(({ sample }) => sample);
  let navSteps: AiPlan['commands'] = [];
  /*
    A plan that names its menu keeps it (fix pass 2026-10-05): the skeleton
    wrote the header and footer from `plan.nav`, every region it links to
    stays on the page (a section that failed keeps its placeholder and its
    anchor), so a sync could only replace the curated menu with every
    section title — the English run's header listed the closing CTA and
    clipped a fifth item to "S" at 1280 px.
  */
  if (plan.nav.length === 0) {
    try {
      const expanded = expandAgentTools(
        {
          rationale: SEO_PASS_RATIONALE,
          commands: [{ command: AGENT_TOOL_COMMAND, args: { name: 'nav.sync', input: {} } }],
        },
        options.kernel,
        { sampleValues, lanes: ['build'] },
      );
      const commands: unknown = (expanded.plan as { commands?: unknown }).commands;
      if (expanded.issues.length === 0 && Array.isArray(commands)) {
        navSteps = (commands as AiPlan['commands']).filter(
          ({ command }) => command !== AGENT_TOOL_COMMAND,
        );
      }
    } catch {
      // No menu to sync is no reason to skip the SEO fixes.
    }
  }
  const trees = new Map<NodeId, unknown>();
  for (const step of navSteps) {
    const id = stringArg(step.args, 'id');
    if (step.command === 'setProp' && id !== undefined && stringArg(step.args, 'key') === 'tree') {
      trees.set(id, (step.args as { value?: unknown }).value);
    }
  }
  let seoSteps: AiPlan['commands'] = [];
  try {
    seoSteps = seoAutofixPlan(options.kernel, { sampleValues, trees })?.commands ?? [];
  } catch {
    // A checker that throws found nothing to fix.
  }
  for (const commands of [[...navSteps, ...seoSteps], seoSteps, navSteps]) {
    if (commands.length === 0) continue;
    if (build.personStopped()) return false;
    const candidate: AiPlan = { rationale: SEO_PASS_RATIONALE, commands };
    try {
      applyAiPlan({
        kernel: options.kernel,
        validationPorts: options.validationPorts,
        plan: candidate,
        policy: policyFor(candidate),
        label: SEO_AUTOFIX_LABEL,
      });
      return true;
    } catch {
      // Refused whole: try the smaller pass next.
    }
  }
  return false;
}

/**
 * The SEO/menu pass is the BUILD's own write, so each section's record of
 * what it left (`landing.after`) moves with it. Without this, per-section
 * Undo read every region the pass touched (alt text, loading, the menu) as
 * "changed since" and refused — after every build (final test 2026-09-30).
 * A revert still puts back `before`, the region as it was before its fill;
 * a person's own later edit is still recognised, since it comes after this.
 */
function rebaseLandings(filled: FilledSections, document: BuilderDocument): FilledSections {
  const reports = filled.reports.map((report) => {
    const landing = report.landing;
    if (landing === undefined) return report;
    const now = readSectionValues(
      document,
      report.id,
      Object.keys(landing.after) as AiBuildSectionKey[],
    );
    if (canonicalJsonStringify(now) === canonicalJsonStringify(landing.after)) return report;
    return { ...report, landing: Object.freeze({ ...landing, after: now }) };
  });
  const changed = reports.some((report, index) => report !== filled.reports[index]);
  return changed ? { ...filled, reports: Object.freeze(reports) } : filled;
}

// ── The streamed build: act on the plan while it is still being written ──

/*
  DESIGN §6.3 (2026-10-05). The planner's answer streams in as text; the
  reader (page-plan/plan-stream.ts) hands over each finished unit as it
  closes — the bolt.diy / open-lovable pattern, act on close. The outline
  closes first: a PROVISIONAL skeleton lands then (one transaction, the
  header complete and every other region a placeholder), so the canvas shows
  the page's shape seconds into the plan. Each brief closes next: its
  section's writer starts while the planner is still writing the others.

  The final plan stays the authority. Nothing a writer wrote lands before it
  is validated (the lander waits at a gate), and it is reconciled with the
  provisional one: the same outline keeps everything, finishes the skeleton
  (footer, kit sections, the root's seo) in one more transaction and rewrites
  only the sections whose contract changed; a different outline throws the
  speculation away and builds the final plan exactly as a plain build would.
  Measured before (baseline 2026-09-30): plan 18.9 s + 18 s repair, skeleton
  at 37 s, first section at 44 s, page at 65 s — every writer waited for the
  whole answer.
*/

/** The one transaction that takes a provisional skeleton back off the page. */
const WITHDRAWN_LABEL = 'Assistant: page skeleton (withdrawn)';

/** Whether this build may act on its plan while the plan is being written. */
function streamEligible(build: BuildRun): boolean {
  const { options } = build;
  return (
    build.writes &&
    !build.asks &&
    options.streamPlan !== false &&
    options.pagePlan === undefined &&
    options.provider.proposePagePlan !== undefined &&
    options.kernel.context.registry.block(REGION_TYPE) !== undefined
  );
}

/** What T1 answered, as `planStep` returns it. */
type PlannedStep = Awaited<ReturnType<typeof planStep>>;

/** A provisional skeleton on the page, and the writers working from it. */
interface Speculation {
  /** The validated provisional plan the skeleton was written from. */
  readonly plan: PagePlan;
  readonly context: SkeletonFromPlanContext;
  /** Section key → its region. */
  readonly regions: ReadonlyMap<string, NodeId>;
  readonly built: PlanJobs;
  readonly fill: FillHandle;
  /** The plan each section is written from: the provisional plan holding its brief, then the final one. */
  readonly snapshots: Map<string, PagePlan>;
}

/** How the streamed build ended: built from the speculation, or handed back to the plain path. */
type StreamOutcome =
  | { readonly kind: 'built'; readonly result: AiBuildRunResult }
  /** Nothing was speculated, or the final outline differs: build the final plan as usual. */
  | { readonly kind: 'classic' }
  /** The plan failed: the speculation is off the page, the scaffold build follows. */
  | { readonly kind: 'fallback' }
  /**
   * The plan failed, but the streamed draft validated: build that plan on the
   * plain path instead of the scaffold (no speculation was on the page).
   */
  | { readonly kind: 'rescued'; readonly plan: PagePlan; readonly rationale?: string };

interface PlanStream {
  /** The `live.onDraft` T1 is given. Never throws. */
  readonly onDraft: (event: AiPagePlanDraftEvent) => void;
  /** Settle the speculation against what T1 answered. */
  readonly finish: (planned: NonNullable<PlannedStep>) => Promise<StreamOutcome>;
  /** T1 was aborted (Stop, or the lease was lost): end every speculative write, write nothing. */
  readonly abandon: () => void;
}

function createPlanStream(build: BuildRun, target: IntentTarget): PlanStream {
  const { options, emit } = build;
  const reader = createPlanStreamReader();
  // completePage: the provisional plan is completed exactly as the final one is (plan-page.ts).
  const validation = { intent: target, maxSections: planMaxSections(build), completePage: true };
  /** No more speculation: a response after the speculating one began, or the plan is in. */
  let closed = false;
  const isClosed = (): boolean => closed;
  /**
   * This response's outline was refused: read nothing more of it. Unlike
   * `closed`, the next response (the repair answer) may still speculate —
   * fix pass 2026-10-05: the Arabic page got no skeleton until 264 s because
   * one refused head closed the stream for good.
   */
  let skipping = false;
  const isSkipping = (): boolean => skipping;
  let draft: PlanDraft | undefined;
  let speculation: Speculation | undefined;

  const onHead = (event: Extract<PlanStreamEvent, { kind: 'head' }>): void => {
    if (build.personStopped()) {
      closed = true;
      return;
    }
    draft = startPlanDraft(event);
    const checked = validatePagePlan(provisionalCandidate(draft), validation);
    // An outline the validator refuses is no page to lay: wait for this answer's repair, or the final plan.
    if (!checked.ok) {
      skipping = true;
      return;
    }
    const plan = checked.plan;
    const context = skeletonContext(options, plan);
    let skeleton: ReturnType<typeof skeletonFromPlan>;
    let landed: AppliedAiPlan;
    try {
      skeleton = skeletonFromPlan(plan, { ...context, provisional: true });
      landed = applyAiPlan({
        kernel: options.kernel,
        validationPorts: options.validationPorts,
        plan: skeleton.plan,
        policy: policyFor(skeleton.plan),
        label: skeleton.label,
      });
    } catch {
      // The door refused it: nothing landed, and the final plan takes the plain path.
      closed = true;
      return;
    }
    const snapshots = new Map<string, PagePlan>();
    const built = planJobs(build, {
      plan,
      planFor: (key) => snapshots.get(key) ?? plan,
      skeleton,
      ids: regionIds(landed, skeleton.plan, skeleton.regions, options.kernel.getDocument()),
      skeletonTx: landed.transactions[0],
    });
    const regions = new Map<string, NodeId>(
      built.keys.flatMap((key, index) => {
        const id = built.tasks[index]?.id;
        return id === undefined ? [] : [[key, id] as const];
      }),
    );
    emit({
      type: 'build.planned',
      direction: planDirection(plan, draft.rationale),
      tokens: plan.tokens,
      tasks: built.tasks,
      writers: fillConcurrencyFor(
        built.jobs.filter(({ complete }) => complete === undefined).length,
        options.fillConcurrency,
      ),
    });
    speculation = {
      plan,
      context,
      regions,
      built,
      fill: startFill(build, built.jobs, built.placeholders, true),
      snapshots,
    };
  };

  const onBrief = (event: Extract<PlanStreamEvent, { kind: 'brief' }>): void => {
    const current = speculation;
    if (current === undefined || draft === undefined) return;
    draft = withBrief(draft, event.brief);
    const key = event.brief['key'];
    if (typeof key !== 'string') return;
    const index = current.built.keys.indexOf(key);
    // The header is the skeleton's already; a key the outline lacks waits for the final plan.
    if (index === -1 || current.built.jobs[index]?.complete !== undefined) return;
    const checked = validatePagePlan(provisionalCandidate(draft), validation);
    if (!checked.ok) return;
    const contract = contractOf(checked.plan, key);
    /*
      Code jobs are never a writer's: the footer and a section whose slots the
      planner filled are written by the finish transaction from the final
      plan. And a brief that would move the outline the skeleton was laid
      from is not built on.
    */
    if (
      contract === undefined ||
      contract.role === 'header' ||
      contract.role === 'footer' ||
      contract.slots !== undefined ||
      !reconcilePlans(current.plan, checked.plan).sameOutline
    ) {
      return;
    }
    current.snapshots.set(key, checked.plan);
    current.fill.release(index);
  };

  const onDraft = (event: AiPagePlanDraftEvent): void => {
    if (closed) return;
    try {
      if (event.kind === 'start') {
        /*
          A response began. Until a skeleton has landed, every response may
          speculate — the first, or a later one (a transport retry, a routing
          fallback, the repair answer) after the first never laid one.
        */
        if (speculation === undefined) {
          reader.reset();
          skipping = false;
          return;
        }
        /*
          A response after the one that speculated: only the speculating one
          dispatches — the writers already running continue, everything else
          waits for the final plan.
        */
        closed = true;
        speculation.fill.hold();
        return;
      }
      if (skipping) return;
      for (const unit of reader.push(event.text)) {
        // A unit acted on may close the stream (an outline the door refused) or skip this answer.
        if (isClosed() || isSkipping()) return;
        if (unit.kind === 'head') {
          if (speculation === undefined) onHead(unit);
        } else {
          onBrief(unit);
        }
      }
    } catch {
      // Speculation is advisory: a fault in it only means the build waits for the final plan.
      closed = true;
      speculation?.fill.hold();
    }
  };

  /** The streamed draft as a validated plan, or undefined. Never throws. */
  const rescuePlan = (): PagePlan | undefined => {
    if (draft === undefined || build.personStopped()) return undefined;
    try {
      const checked = validatePagePlan(provisionalCandidate(draft), validation);
      return checked.ok ? checked.plan : undefined;
    } catch {
      return undefined;
    }
  };

  /** The speculation off the page: writes aborted, and (where asked) its regions removed in one transaction. */
  const withdraw = (current: Speculation, removeRegions: boolean): void => {
    current.fill.cancel();
    if (!removeRegions || build.personStopped()) return;
    const document = options.kernel.getDocument();
    const commands: AiPlan['commands'] = [...current.regions.values()]
      .filter((id) => document.nodes[id] !== undefined)
      .map((id) => ({ command: 'removeNode', args: { id } }));
    if (commands.length === 0) return;
    const plan: AiPlan = {
      rationale:
        'The page plan changed while it was being written; its first skeleton is taken back.',
      commands,
    };
    try {
      applyAiPlan({
        kernel: options.kernel,
        validationPorts: options.validationPorts,
        plan,
        policy: policyFor(plan),
        label: WITHDRAWN_LABEL,
      });
    } catch {
      // A page that will not give the regions back keeps them; the build goes on.
    }
  };

  return {
    onDraft,
    abandon: () => {
      closed = true;
      speculation?.fill.cancel();
    },
    finish: async (planned) => {
      closed = true;
      const current = speculation;
      if ('failure' in planned) {
        /*
          T1 gave out (refused twice, or the provider failed mid-answer). The
          streamed draft — its outline, the deck row's tokens and every brief
          that closed — is a plan code can still validate; when it does, it is
          built instead of the model-written scaffold, which cost 208 s on
          2026-10-05 against ≈ 60 s for a planned page.
        */
        const rescued = rescuePlan();
        if (current !== undefined) {
          if (rescued !== undefined && reconcilePlans(current.plan, rescued).sameOutline) {
            return {
              kind: 'built',
              result: await finishSpeculation(build, current, rescued, draft?.rationale),
            };
          }
          withdraw(current, true);
        }
        return rescued === undefined
          ? { kind: 'fallback' }
          : {
              kind: 'rescued',
              plan: rescued,
              ...(draft?.rationale === undefined ? {} : { rationale: draft.rationale }),
            };
      }
      if (current === undefined) return { kind: 'classic' };
      const final = planned.plan;
      if (!reconcilePlans(current.plan, final).sameOutline) {
        /*
          A different page. The plain path builds it: a `replace` skeleton
          takes the speculative regions with the page's children (they are
          all the page holds now); anywhere else they are removed first, so
          the page never holds two copies.
        */
        withdraw(current, final.intent !== 'replace');
        return { kind: 'classic' };
      }
      return {
        kind: 'built',
        result: await finishSpeculation(build, current, final, planned.rationale),
      };
    },
  };
}

/**
 * The finish transaction (DESIGN §6.1): what the provisional skeleton left
 * for the final plan, as ONE labelled transaction through the door.
 * Undefined when there was nothing to write or the door refused it — then
 * the footer and the kit sections go to writers like any other section.
 */
function landSkeletonFinish(
  build: BuildRun,
  current: Speculation,
  final: PagePlan,
):
  | {
      readonly complete: readonly string[];
      readonly landing: (after: AiBuildSectionValues) => AiBuildSectionLanding;
    }
  | undefined {
  const { options } = build;
  try {
    const finish = skeletonFinish({
      provisional: current.plan,
      final,
      context: current.context,
      regions: current.regions,
    });
    if (finish === undefined) return undefined;
    const transaction = applyAiPlan({
      kernel: options.kernel,
      validationPorts: options.validationPorts,
      plan: finish.plan,
      policy: policyFor(finish.plan),
      label: finish.label,
    }).transactions[0];
    if (transaction === undefined) return undefined;
    return {
      complete: finish.complete,
      landing: (after) =>
        Object.freeze({
          transactionId: transaction.id,
          label: finish.label,
          before: Object.freeze({}),
          after,
        }),
    };
  } catch {
    return undefined;
  }
}

/**
 * The final plan has the outline the skeleton was laid from: finish the
 * skeleton, rewrite what changed, open the gate, land in page order.
 */
async function finishSpeculation(
  build: BuildRun,
  current: Speculation,
  final: PagePlan,
  rationale: string | undefined,
): Promise<AiBuildRunResult> {
  const { options } = build;
  const { built, fill } = current;
  // Every section reads the final plan from here: reruns, checks and reports.
  for (const key of built.keys) current.snapshots.set(key, final);

  if (!build.personStopped()) {
    const finished = landSkeletonFinish(build, current, final);
    const document = options.kernel.getDocument();
    built.keys.forEach((key, index) => {
      const job = built.jobs[index];
      if (job === undefined) return;
      const id = job.task.id;
      if (finished?.complete.includes(key) === true) {
        const values = readSectionValues(document, id);
        const contract = contractOf(final, key);
        // A kit filled from the planner's slots is held to its contract, as on a plain build.
        const misses =
          contract?.kit !== undefined &&
          kitSlotMisses(job.task, () =>
            checkSection(final, contract, sectionOf(values), built.checkOptions),
          );
        if (!misses) {
          built.landedSections.set(key, sectionOf(values));
          fill.complete(index, finished.landing(values));
          return;
        }
      }
      if (job.complete !== undefined) {
        // The header: complete since the skeleton, redrawn by the finish when the final plan changed it.
        const values = readSectionValues(document, id);
        if (
          finished !== undefined &&
          canonicalJsonStringify(values) !== canonicalJsonStringify(job.complete.after)
        ) {
          built.landedSections.set(key, sectionOf(values));
          fill.complete(index, finished.landing(values));
        }
        return;
      }
      // A write begun from a contract the final plan changed is written again, once.
      if (fill.claimed(index) && fill.writtenWith(index) !== sectionFingerprint(final, key)) {
        fill.rewrite(index);
      } else {
        fill.release(index);
      }
    });
  }
  fill.openGate();
  const filled = await fill.done;
  // Every section landed and nobody stopped: the zero-token SEO pass, one transaction.
  const seoLanded = filled.stopped === undefined && landSeoPass(build, final);
  return finishBuild(
    build,
    seoLanded ? rebaseLandings(filled, options.kernel.getDocument()) : filled,
    planDirection(final, rationale),
    { pagePlan: final },
  );
}

// ── The scaffold build: the model lays the skeleton ─────────────────────────

/**
 * The build as it was before page plans, and the path every build takes that
 * has no plan: a provider without `proposePagePlan`, a plan refused twice, a
 * registry without `customCode`. A model run lays the skeleton; its rationale
 * is the direction every section writer obeys.
 */
async function buildFromScaffold(
  build: BuildRun,
  fellBack: AiBuildPlanFallback | undefined,
): Promise<AiBuildRunResult> {
  const { options, emit, shared, personStopped } = build;
  // Every result of a build that fell back here says so, whatever it ends as.
  const told = fellBack === undefined ? {} : { planFallback: fellBack };
  /*
    A skeleton is an EXTRA request this path invented, so its failure must cost
    nothing: the person asked for a page, not for a scaffold, and the single
    call they would have got otherwise is still available. Only an abort is
    re-thrown — that is the person stopping, not the strategy failing.
  */
  let scaffold: AiAgentRunResult | undefined;
  let scaffoldFailure: string | undefined;
  try {
    scaffold = await runAiAgent({
      ...shared,
      ...pageStepSkills(options),
      runId: stepRunId(options.runId, 'scaffold'),
      // "Try another look" reaches the deck's B row as the line it reads.
      request: withRequestedLook(options.request),
      selectedSkillIds: scaffoldSkillIds(options),
      additionalContextProviders: withPhotoCatalog(options, options.request),
      policy: { ...options.policy, allowedCommands: SCAFFOLD_COMMANDS },
      /*
        Landed at once only when nobody has to be asked. A build that asks
        PROPOSES its skeleton and lands it on approval. Measured 2026-09-28
        (agent-audit.md P0-4): Ask mode laid 3-12 empty bands on the page
        before the approval card appeared, and "Stop build" left them there.
      */
      apply: build.writes && !build.asks ? 'auto' : 'never',
      label: SCAFFOLD_LABEL,
    });
  } catch (cause) {
    if (options.signal?.aborted === true) throw cause;
    scaffoldFailure = errorMessage(cause);
  }

  const direction = scaffold?.plan.rationale ?? '';

  if (!build.writes) {
    /*
      A PLANNED build ends here, having written nothing.

      The section list is read from the scaffold's plan, not from patches: there
      are none. And there is no fallback run — falling back means "do the work a
      different way", and a build that was told not to work has nothing to fall
      back to. A skeleton that failed, or produced fewer than two sections, is
      reported as a plan with that many sections and the caller decides; that is
      strictly more information than silently spending another model call.
    */
    const plannedTasks = scaffold === undefined ? [] : plannedTitles(scaffold.plan);
    /*
      No `build.planned` event. That event carries `AiBuildTask`s, whose `id` is
      a real node — and here no node exists. Emitting synthetic ids so the shape
      fits would put a lie in the one place the panel trusts to address sections
      by, and the first consumer to look one up would ask the document for a
      node that was never created. The list travels in the RESULT instead, in a
      type that says what it is.
    */
    return Object.freeze({
      runId: options.runId,
      tasks: Object.freeze([]),
      applied: 0,
      skipped: 0,
      elapsedMs: workedMs(build),
      ...(scaffold === undefined ? {} : { scaffold }),
      direction,
      outcome: 'planned' as const,
      plannedTasks,
      ...told,
    });
  }

  // `writes` holds from here on, so a supplied `onPlanned` is exactly `asks`.
  if (build.asks && scaffold !== undefined) {
    const planned = plannedTitles(scaffold.plan);
    /*
      THE ONE QUESTION, and it is asked before anything is written.

      A list of fewer than two is not asked about: that build falls back to one
      ordinary run below, PROPOSED, and its own plan card is the question. So a
      person is never asked to approve a list and then shown a different kind of
      answer.
    */
    if (planned.length >= 2) {
      const answer = await askPerson(build, planned, direction);
      // A scaffold build has no plan to edit; `{ build }` from a host is still a yes.
      if (answer === 'stop' || personStopped()) {
        return refusedBuild(build, planned, direction, { scaffold, ...told });
      }
      /*
        Approved: the skeleton the person saw lands now, exactly as proposed,
        re-validated by the door against the page as it is NOW. A page that
        moved so far that it no longer accepts the skeleton refuses it whole,
        and that refusal is the caller's to show — nothing was written.
      */
      const landed = applyAiPlan({
        kernel: options.kernel,
        validationPorts: options.validationPorts,
        proposal: scaffold.proposal,
        label: SCAFFOLD_LABEL,
      });
      scaffold = Object.freeze({ ...scaffold, status: 'applied' as const, applied: landed });
    }
  }

  const tasks =
    scaffold === undefined
      ? []
      : inDocumentOrder(options.kernel.getDocument(), titlesByCreatedId(scaffold.applied));

  if (tasks.length < 2) {
    /*
      Not a build. One region is a page the ordinary path writes better in one
      go, and zero regions means the scaffold answered a different question —
      either way the person gets the single call they would have got anyway,
      and exactly one build event says so.
    */
    emit({
      type: 'build.skipped',
      reason:
        scaffoldFailure === undefined
          ? `The page skeleton produced ${String(tasks.length)} section${tasks.length === 1 ? '' : 's'}; a split build needs at least two, so one ordinary run was used instead.`
          : `The page skeleton failed (${scaffoldFailure}), so one ordinary run was used instead.`,
    });
    const fallback = await runAiAgent({
      ...shared,
      ...pageStepSkills(options),
      runId: stepRunId(options.runId, 'fallback'),
      request: options.request,
      /*
        The build's own authority, never a hard-coded 'auto'. A build that asks
        before writing PROPOSES its fallback: it comes back unapplied and the
        host shows it as the ordinary plan card, whose Apply is the question
        Ask mode owes the person. It used to apply at once, and the card was
        drawn as an already-applied plan.
      */
      apply: build.asks ? 'never' : 'auto',
    });
    return Object.freeze({
      runId: options.runId,
      tasks: Object.freeze([]),
      applied: 0,
      skipped: 0,
      elapsedMs: workedMs(build),
      ...(scaffold === undefined ? {} : { scaffold }),
      direction,
      outcome: 'fallback' as const,
      fallback,
      ...told,
    });
  }

  emit({
    type: 'build.planned',
    direction,
    tasks,
    writers: fillConcurrencyFor(tasks.length, options.fillConcurrency),
  });
  if (scaffold !== undefined) {
    turnArabicPageRightToLeft(options, scaffold.plan, build.heldContent, personStopped);
  }
  // Read once, from the placeholders as laid: a fill landing later never changes these.
  const laid = options.kernel.getDocument();
  const roles = sectionRoles(laid, tasks);
  const placeholders = new Map(tasks.map((task) => [task.id, readSectionValues(laid, task.id)]));
  const rootLang: unknown = laid.nodes[laid.rootId]?.props['lang'];
  const arabic =
    ARABIC_SCRIPT.test(options.request) ||
    ARABIC_SCRIPT.test(direction) ||
    laid.dir === 'rtl' ||
    (typeof rootLang === 'string' && ARABIC_LANG.test(rootLang));
  const total = tasks.length;
  const jobs: SectionJob[] = tasks.map((task, index) => {
    const position = index + 1;
    const role = roles[index] ?? 'band';
    // One provider per section, briefed with its title, read on every attempt.
    const providers = withPhotoCatalog(options, `${options.request} ${task.title}`);
    return {
      task,
      position,
      total,
      brief: (attempt) => ({
        request:
          attempt === 1
            ? fillRequest(direction, task, position, total, role, options.request)
            : retryRequest(direction, task, position, total, role),
        skillIds: fillSkillIds(
          options,
          arabic,
          true,
          true,
          `${task.title} ${role === 'hero' ? options.request : ''}`,
        ),
        providers,
        history: true,
      }),
    };
  });
  const filled = await fillAndLand(build, jobs, placeholders);
  return finishBuild(build, filled, direction, {
    ...(scaffold === undefined ? {} : { scaffold }),
    ...told,
  });
}

/**
 * Build a whole page as one plan plus one run per section, instead of one
 * model call that has to hold the entire page in its head.
 *
 * With a provider that can plan a page (`proposePagePlan`), the steps are
 * those of agent-audit §3.1 (2026-09-28):
 * - T1: one call answers with a PAGE PLAN — tokens, fonts, a contract per
 *   section — validated, and repaired once with the validator's issues
 *   (`pagePlan` skips it: the plan Plan mode showed is built verbatim);
 * - the one approval (`onPlanned`) is asked about that plan, which the person
 *   may edit (`{ build: editedPlan }`, validated again);
 * - T2: code, not the model, writes the skeleton from the plan — regions,
 *   tokens as CSS custom properties, font imports, the header and footer in
 *   full — as ONE labelled transaction ("Assistant: page skeleton"). The
 *   model-written skeleton was measured at ~25k characters of output and was
 *   the slowest step of every build;
 * - writers fill the other regions concurrently, each from its contract, each
 *   checked BEFORE it lands and repaired once when it misses (step E), each
 *   landing in page order as its own labelled transaction.
 *
 * A build that writes without asking acts on the plan WHILE it streams
 * (`streamPlan`, default on; DESIGN §6.3, 2026-10-05): the provisional
 * skeleton lands when the outline closes, each writer starts when its brief
 * closes, and the lander waits for the final validated plan — reconciled by
 * contract fingerprint, so only a section whose contract changed is written
 * again, and a changed outline throws the speculation away for the plain
 * path. A provider that streams nothing gets the plain path unchanged.
 *
 * Any provider without it, or a plan refused twice, takes the scaffold build:
 * a model run lays the skeleton and its rationale is the direction. When the
 * plan path was TRIED and gave out — T1 failed, or the door refused the
 * code-written skeleton of an automatic build — the fall back is said out
 * loud: a second `build.scaffolding` event carries `fallback` (the stage and
 * the validator's or the door's reasons), and the result carries the same as
 * `planFallback`, whatever the scaffold build then ends as.
 *
 * Either way it is a thin orchestrator: planning and validation still happen
 * inside `runAiAgent` and `validatePagePlan`, and every write goes through
 * `applyAiPlan` — the same validated grouped kernel door — as one labelled
 * transaction per step. The rule the whole design answers to: a build must
 * never be worse than the single call it replaces, so a scaffold that produced
 * fewer than two regions is abandoned for one ordinary run.
 */
export async function runAiBuild(options: RunAiBuildOptions): Promise<AiBuildRunResult> {
  assertBuildRunId(options.runId);
  const build = createBuildRun(options);
  build.emit({ type: 'build.scaffolding' });

  let fellBack: AiBuildPlanFallback | undefined;
  if (options.pagePlan !== undefined) {
    const given = revalidated(options.pagePlan, options.pagePlan.intent);
    const result = await buildFromPlan(build, given, undefined, 'given');
    // A given plan never falls back: its skeleton's refusal is thrown.
    if (!('refused' in result)) return result;
    fellBack = result.refused;
  } else {
    // Where the page lands, read ONCE: a provisional skeleton on the page must not move it.
    const target = landingTarget(options.kernel, options.target);
    const stream = streamEligible(build) ? createPlanStream(build, target) : undefined;
    let planned: PlannedStep;
    try {
      planned = await planStep(build, target, stream?.onDraft);
    } catch (cause) {
      // Stop during T1 ends the speculative writers too; nothing more is written.
      stream?.abandon();
      throw cause;
    }
    const streamed =
      stream === undefined || planned === undefined ? undefined : await stream.finish(planned);
    if (streamed?.kind === 'built') return streamed.result;
    if (streamed?.kind === 'rescued') {
      const result = await buildFromPlan(build, streamed.plan, streamed.rationale, 'planned');
      if (!('refused' in result)) return result;
      fellBack = result.refused;
    } else if (planned !== undefined && 'plan' in planned) {
      const result = await buildFromPlan(build, planned.plan, planned.rationale, 'planned');
      if (!('refused' in result)) return result;
      fellBack = result.refused;
    } else if (planned !== undefined) {
      fellBack = planned.failure;
    }
  }
  /*
    The scaffold build starts over from here, so the one event that means
    "laying the skeleton" says it again — this time with why. Hosts that read
    `build.scaffolding` as idempotent keep working; a host that reads the
    `fallback` can tell the person, and a log can count it.
  */
  if (fellBack !== undefined) build.emit({ type: 'build.scaffolding', fallback: fellBack });
  return buildFromScaffold(build, fellBack);
}
