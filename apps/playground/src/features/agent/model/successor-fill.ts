import type {
  AiBuildOwnEvent,
  AiBuildSectionLanding,
  AiBuildSectionValues,
  AiBuildTaskReport,
  AiPlan,
  BuilderDocument,
  JsonValue,
  NodeId,
  PagePlan,
} from '@craftkit/builder';

import type { BuildProgress, BuildTask } from './build-progress';

/**
 * Successor runs: "Retry", "Write the failed sections again" and "Finish the rest"
 * (SPEC §4.8 footer, FR-054) write EXACTLY the named sections, in place, into the regions
 * the build already laid, and never post a sentence as the person's turn.
 *
 * The engine has no "fill these regions" entry point: `runAiBuild({ pagePlan })` lays a
 * NEW skeleton (a subset plan would append fresh regions below the page and leave the
 * empty ones where they were, and `validatePagePlan` refuses a one-section plan). So the
 * controller runs each writer the way `run-build.ts` runs a fill (a `runAiAgent` scoped to
 * the region, `apply: 'never'`, the build-fill skill, `setProp` only), lands it through
 * `applyAiPlan` in page order, and feeds the SAME build record the build's own events, so
 * the rows ink in place: ink still means landed (SPEC §1).
 *
 * This module is the pure half: the writer's brief, the target guard, the landing record,
 * and the events that move the record. `hooks/agent-controller/successor-flow.ts` runs the loop.
 */

/** The two props a section writer owns on its region (`AiBuildSectionKey`). */
export const SECTION_KEYS = ['tree', 'css'] as const;
const WRITTEN_KEYS = [...SECTION_KEYS, 'js', 'jsMeta', 'jsParams'] as const;

/** The build-fill skill the engine's own writers carry (`run-build.ts` `FILL_SKILL`). */
export const FILL_SKILL_ID = 'craftkit.build-fill';

/** The kernel refuses a longer grouped-dispatch label. */
const MAX_LABEL_LENGTH = 160;

/** How many successor writers run at once; they still land one by one, in page order. */
export const SUCCESSOR_WRITERS = 3;

/** `Assistant: 3/8 — Services`: the build's own history label for a section. */
export function sectionLabel(position: number, total: number, title: string): string {
  return `Assistant: ${String(position)}/${String(total)} — ${title}`.slice(0, MAX_LABEL_LENGTH);
}

/** A key-sorted JSON, so two snapshots of the same value compare equal. */
function stable(value: unknown): string {
  // `undefined` (and a function or a symbol) has no JSON: it still needs a spelling of its own.
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return 'undefined';
  }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stable(record[key])}`)
    .join(',')}}`;
}

/** A region's writer-owned props as they stand; a prop the node lacks is absent. */
export function sectionValues(
  document: BuilderDocument,
  id: NodeId,
  keys: readonly (typeof WRITTEN_KEYS)[number][] = SECTION_KEYS,
): AiBuildSectionValues {
  const props = document.nodes[id]?.props;
  const values: Partial<Record<(typeof WRITTEN_KEYS)[number], JsonValue>> = {};
  if (props === undefined) return values;
  for (const key of keys) {
    const value = props[key] ?? (key === 'jsMeta' || key === 'jsParams' ? {} : undefined);
    if (value !== undefined) values[key] = value;
  }
  return values;
}

/** Whether every prop `expected` names still holds exactly that value in the region. */
export function holdsValues(
  document: BuilderDocument,
  id: NodeId,
  expected: AiBuildSectionValues,
): boolean {
  if (document.nodes[id] === undefined) return false;
  const current = sectionValues(document, id, WRITTEN_KEYS);
  return WRITTEN_KEYS.filter((key) => key in expected).every(
    (key) => stable(current[key]) === stable(expected[key]),
  );
}

/** The one section of the plan a region was built from, when the build had a plan. */
function contractOf(plan: PagePlan | undefined, task: BuildTask) {
  if (plan === undefined) return undefined;
  return (
    plan.sections.find((section) => section.key === task.sectionKey) ??
    plan.sections.find((section) => section.title === task.title)
  );
}

export interface SuccessorBriefInput {
  /** The build's direction: the scaffold's rationale, or the plan's summary line. */
  readonly direction: string;
  /** The person's original request, for subject matter only. */
  readonly request: string;
  readonly task: BuildTask;
  readonly total: number;
  readonly plan?: PagePlan | undefined;
}

/**
 * What one successor writer is told: the build's direction, where its section sits and
 * what the section is for (the plan's contract when there is one), its region, and the
 * original request for subject matter. Model-facing text, never rendered and never a turn.
 */
export function successorBrief(input: SuccessorBriefInput): string {
  const contract = contractOf(input.plan, input.task);
  const mustSay = contract?.mustSay ?? [];
  return [
    'THE DIRECTION THIS PAGE WAS BUILT TO (decided; follow it):',
    input.direction.trim(),
    '',
    `SECTION ${String(input.task.position)} OF ${String(input.total)}: ${input.task.title}`,
    ...(contract === undefined ? [] : [`ROLE: ${contract.role.toUpperCase()}`]),
    ...(contract === undefined ? [] : [`PURPOSE: ${contract.purpose}`]),
    ...(mustSay.length === 0
      ? []
      : [`MUST SAY: ${mustSay.map((line) => `"${line}"`).join(', ')}`]),
    `REGION ID: ${input.task.id}`,
    '',
    'Write this one section inside its region: set only its tree, and its css when it needs',
    'one. Every other section of the page is written already; leave them as they are.',
    '',
    'THE ORIGINAL REQUEST (for subject matter only — the direction above wins):',
    input.request,
  ].join('\n');
}

export interface GuardedSection {
  readonly plan: AiPlan;
  /** Steps that reached outside the region and were dropped. */
  readonly dropped: number;
}

function stringArg(args: unknown, name: 'id' | 'key'): string | undefined {
  if (typeof args !== 'object' || args === null) return undefined;
  const value: unknown = (args as Readonly<Record<string, unknown>>)[name];
  return typeof value === 'string' ? value : undefined;
}

/**
 * The engine's target guard (`guardFill`), for a successor writer: it may set its own
 * region's `tree` and `css` and nothing else. Null when nothing inside the region is left.
 */
export function guardSection(plan: AiPlan, regionId: NodeId): GuardedSection | null {
  const kept = plan.commands.filter((step) => {
    const key = stringArg(step.args, 'key');
    return (
      step.command === 'setProp' &&
      stringArg(step.args, 'id') === regionId &&
      (key === 'tree' || key === 'css')
    );
  });
  if (kept.length === 0) return null;
  return { plan: { ...plan, commands: kept }, dropped: plan.commands.length - kept.length };
}

/**
 * The commands that put a landed section back as its writer left it (row Redo, after a
 * forward revert): `landing.after`, prop by prop.
 */
export function relandCommands(regionId: NodeId, landing: AiBuildSectionLanding): AiPlan['commands'] {
  return WRITTEN_KEYS.flatMap((key) => {
    const value = landing.after[key];
    return value === undefined ? [] : [{ command: 'setProp', args: { id: regionId, key, value } }];
  });
}

/* ── The record, reopened and moved by the successor's own events ─────────────── */

/**
 * The build record, reopened for a successor over `keys`: the named sections go back to
 * waiting, every other row keeps what it was (a landed section stays ink), and the
 * report is cleared so the record reads as building again.
 */
export function reopenForSuccessor(
  progress: BuildProgress,
  keys: ReadonlySet<string>,
  now: number,
): BuildProgress {
  const tasks = progress.tasks.map((task): BuildTask => {
    if (!keys.has(task.id) || task.status === 'landed') return task;
    // A fresh row: the old attempt's times, failure and reason belong to the old attempt.
    return {
      id: task.id,
      title: task.title,
      position: task.position,
      status: 'waiting',
      attempts: 0,
      ...(task.sectionKey === undefined ? {} : { sectionKey: task.sectionKey }),
      ...(task.facts === undefined ? {} : { facts: task.facts }),
    };
  });
  const { stopReason, ...rest } = progress;
  void stopReason;
  return {
    ...rest,
    phase: 'building',
    tasks,
    report: null,
    lastEventAt: Math.max(progress.lastEventAt, now),
  };
}

type OwnEvent<T extends AiBuildOwnEvent['type']> = Extract<AiBuildOwnEvent, { type: T }>;

/** A synthetic `task.started` for a successor writer, attributed to the build's run id. */
export function taskStartedEvent(
  progress: BuildProgress,
  task: BuildTask,
  at: number,
  seq: number,
): OwnEvent<'task.started'> {
  return {
    type: 'task.started',
    runId: progress.runId,
    seq,
    at,
    position: task.position,
    total: progress.tasks.length,
    task: { id: task.id, title: task.title },
    attempt: 1,
  };
}

export function taskCompletedEvent(
  progress: BuildProgress,
  task: BuildTask,
  at: number,
  seq: number,
): OwnEvent<'task.completed'> {
  return {
    type: 'task.completed',
    runId: progress.runId,
    seq,
    at,
    position: task.position,
    total: progress.tasks.length,
    task: { id: task.id, title: task.title },
    attempts: 1,
  };
}

export function taskSkippedEvent(
  progress: BuildProgress,
  task: BuildTask,
  failure: { readonly reason: string; readonly reasonCode: AiBuildTaskReport['reasonCode'] },
  at: number,
  seq: number,
): OwnEvent<'task.skipped'> {
  return {
    type: 'task.skipped',
    runId: progress.runId,
    seq,
    at,
    position: task.position,
    total: progress.tasks.length,
    task: { id: task.id, title: task.title },
    attempts: 1,
    reason: failure.reason,
    ...(failure.reasonCode === undefined ? {} : { reasonCode: failure.reasonCode }),
  };
}

/** One row as the build's final report reads it. */
function reportOf(
  task: BuildTask,
  landings: ReadonlyMap<string, AiBuildSectionLanding>,
  stopped: boolean,
): AiBuildTaskReport {
  const landing = landings.get(task.id) ?? task.landing;
  const common = {
    id: task.id,
    title: task.title,
    attempts: task.attempts,
    ...(task.sectionKey === undefined ? {} : { sectionKey: task.sectionKey }),
    ...(task.facts === undefined ? {} : { facts: task.facts }),
  };
  if (task.status === 'landed' && landing !== undefined) {
    return { ...common, status: 'applied', landing };
  }
  if (task.status === 'landed') return { ...common, status: 'applied' };
  if (task.status === 'failed') {
    return {
      ...common,
      status: 'skipped',
      reason: task.reason ?? 'This section could not be written.',
      ...(task.reasonCode === undefined ? {} : { reasonCode: task.reasonCode }),
    };
  }
  return {
    ...common,
    status: 'not-started',
    reason: stopped
      ? 'The build was stopped before this section landed; nothing of it was applied.'
      : 'This section was not written.',
    reasonCode: stopped ? 'stopped' : 'unknown',
  };
}

/**
 * The successor's `build.completed`: every row's final report (the new landings keyed by
 * region id), the counts over the WHOLE record, and the time the record has worked in
 * all (`priorElapsedMs`, the build's own, plus the successor's).
 */
export function successorCompletedEvent(
  progress: BuildProgress,
  landings: ReadonlyMap<string, AiBuildSectionLanding>,
  options: {
    readonly stopped: boolean;
    readonly priorElapsedMs: number;
    readonly elapsedMs: number;
    readonly at: number;
    readonly seq: number;
  },
): OwnEvent<'build.completed'> {
  const tasks = progress.tasks.map((task) => reportOf(task, landings, options.stopped));
  return {
    type: 'build.completed',
    runId: progress.runId,
    seq: options.seq,
    at: options.at,
    tasks,
    applied: tasks.filter((task) => task.status === 'applied').length,
    skipped: tasks.filter((task) => task.status === 'skipped').length,
    elapsedMs: Math.max(0, options.priorElapsedMs) + Math.max(0, options.elapsedMs),
    outcome: options.stopped ? 'signal' : 'completed',
  };
}

/** The not-started sections a stopped or interrupted record can still finish, in page order. */
export function unwrittenKeys(progress: BuildProgress): readonly string[] {
  return progress.tasks
    .filter((task) => task.status !== 'landed' && task.status !== 'failed')
    .map((task) => task.id);
}

/** The failed sections, in page order. */
export function failedKeys(progress: BuildProgress): readonly string[] {
  return progress.tasks.filter((task) => task.status === 'failed').map((task) => task.id);
}
