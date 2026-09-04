import type { BuilderDocument, NodeId } from '@craftkit/builder-schema';

import { applyAiPlan, type AppliedAiPlan } from '../plan/apply-plan';
import { runAiAgent } from './run-agent';
import type {
  AiAgentRunResult,
  AiBuildOutcome,
  AiBuildOwnEvent,
  AiBuildRunResult,
  AiBuildStopReason,
  AiBuildTask,
  AiBuildTaskReport,
  RunAiAgentOptions,
  RunAiBuildOptions,
} from './types';

/** Sections a build will fill before it reports the rest as not started. */
export const DEFAULT_AI_BUILD_MAX_TASKS = 12;
/** Ceiling for ONE section. Only that section's run is aborted. */
export const DEFAULT_AI_BUILD_TASK_TIMEOUT_MS = 240_000;
/** Ceiling for the whole build. The running section still finishes. */
export const DEFAULT_AI_BUILD_BUDGET_MS = 900_000;
/**
 * Sections written at once.
 *
 * Three, not one and not all of them. Sequential was measured on a real
 * backend at three to seven minutes PER section, which puts a seven-section
 * page past half an hour — longer than anyone will sit through, so
 * concurrency here is not a nicety. All-at-once is the other mistake: a local
 * CLI backend spawns a process per call, and a burst of ten would thrash the
 * machine the person is working on. Three keeps every wave short while leaving
 * the box usable, and the option exists because the right number belongs to
 * the backend, not to this file.
 */
export const DEFAULT_AI_BUILD_FILL_CONCURRENCY = 3;

const MAX_RUN_ID_LENGTH = 160;
/** The kernel refuses a longer grouped-dispatch label outright. */
const MAX_LABEL_LENGTH = 160;
const SCAFFOLD_COMMANDS: readonly string[] = Object.freeze(['insertNode', 'setProp', 'setDocMeta']);
const FILL_COMMANDS: readonly string[] = Object.freeze(['setProp']);
const SCAFFOLD_LABEL = 'Assistant: page skeleton';
const DIRECTION_HEADING = 'THE DIRECTION (decided for the whole page — obey it exactly):';
const SENTENCE_END = /[.!?؟。\n]/u;
const MAX_SHORT_DIRECTION = 240;

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
 */
function sharedStepOptions(
  options: RunAiBuildOptions,
): Omit<RunAiAgentOptions, 'apply' | 'label' | 'request' | 'runId'> {
  const isCurrentRun = options.isCurrentRun;
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
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    /*
      A step's run id is NOT the build's, so the caller's lease check would
      reject every step if it were forwarded as-is. It is asked about the one
      id it issued: the build's.
    */
    ...(isCurrentRun === undefined
      ? {}
      : { isCurrentRun: (): boolean => isCurrentRun(options.runId) }),
    ...(options.onEvent === undefined ? {} : { onEvent: options.onEvent }),
  };
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
 */
function titlesByCreatedId(applied: AppliedAiPlan | undefined): Map<NodeId, string> {
  const titles = new Map<NodeId, string>();
  for (const patch of applied?.transactions[0]?.patches ?? []) {
    if (patch.op !== 'add') continue;
    if (patch.path.length !== 2 || patch.path[0] !== 'nodes') continue;
    const id = patch.path[1];
    if (typeof id !== 'string') continue;
    const title = nodeTitle(patch.value);
    if (title === undefined) continue;
    titles.set(id, title);
  }
  return titles;
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

function firstSentence(text: string): string {
  const trimmed = text.trim();
  const match = SENTENCE_END.exec(trimmed);
  return match === null ? trimmed.slice(0, MAX_SHORT_DIRECTION) : trimmed.slice(0, match.index + 1);
}

function fillRequest(
  direction: string,
  task: AiBuildTask,
  position: number,
  total: number,
  request: string,
): string {
  return [
    DIRECTION_HEADING,
    direction,
    '',
    `SECTION ${String(position)} OF ${String(total)}: ${task.title}`,
    `REGION ID: ${task.id}`,
    '',
    'THE ORIGINAL REQUEST (for subject matter only — the direction above wins):',
    request,
  ].join('\n');
}

/**
 * The second attempt is SHORTER, not louder. A fill that failed once usually
 * failed on size or on a contradiction inside a long brief, so the retry keeps
 * only what the section cannot be written without.
 */
function retryRequest(direction: string, task: AiBuildTask): string {
  return [
    DIRECTION_HEADING,
    firstSentence(direction),
    '',
    `SECTION: ${task.title}`,
    `REGION ID: ${task.id}`,
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

function runFill(
  options: RunAiBuildOptions,
  shared: Omit<RunAiAgentOptions, 'apply' | 'label' | 'request' | 'runId'>,
  task: AiBuildTask,
  position: number,
  total: number,
  request: string,
  taskTimeoutMs: number,
): Promise<AiAgentRunResult> {
  /*
    The section's OWN deadline. The caller's signal is deliberately not chained
    in: an outer abort ends the build after this section, it does not tear a
    half-written section out from under the kernel.
  */
  const deadline = new AbortController();
  const timer = setTimeout(() => {
    const timeout = new Error(
      `Section "${task.title}" exceeded its ${String(taskTimeoutMs)}ms budget.`,
    );
    timeout.name = 'AbortError';
    deadline.abort(timeout);
  }, taskTimeoutMs);
  const run = runAiAgent({
    ...shared,
    runId: stepRunId(options.runId, `fill-${String(position)}`),
    request,
    selection: [task.id],
    selectedSkillIds: ['craftkit.build-fill'],
    policy: { ...options.policy, allowedCommands: FILL_COMMANDS },
    composition: { ...options.composition, documentTreeMode: 'scoped' },
    /*
      GENERATE only. Sections are written concurrently but must LAND in order,
      so the proposal comes back here and `applyAiPlan` runs it when its turn
      arrives. Safe because apply re-validates against the LIVE kernel, not
      against the document the proposal was made from — and because each fill
      writes only its own region's tree, so nothing two of them touch overlaps.
      Ordered landing is what keeps "undo Pricing" meaning exactly one section.
    */
    apply: 'never',
    label: stepLabel(position, total, task.title),
    signal: deadline.signal,
  });
  return run.finally(() => {
    clearTimeout(timer);
  });
}

/**
 * Build a whole page as a scaffold plus one run per section, instead of one
 * plan that has to hold the entire page in its head.
 *
 * It is a thin orchestrator: planning, validation and application all still
 * happen inside `runAiAgent`, once per step, through the same validated
 * grouped kernel door. What it adds is the split itself, the direction that
 * keeps the sections looking like one page, and the promise that a failure
 * inside one section costs that section and nothing else.
 *
 * The rule the whole design answers to: a build must never be worse than the
 * single call it replaces. So a scaffold that produced fewer than two regions
 * is not built on — it is abandoned for one ordinary run.
 */
export async function runAiBuild(options: RunAiBuildOptions): Promise<AiBuildRunResult> {
  assertBuildRunId(options.runId);
  const maxTasks = options.maxTasks ?? DEFAULT_AI_BUILD_MAX_TASKS;
  const taskTimeoutMs = options.taskTimeoutMs ?? DEFAULT_AI_BUILD_TASK_TIMEOUT_MS;
  const buildBudgetMs = options.buildBudgetMs ?? DEFAULT_AI_BUILD_BUDGET_MS;
  const fillConcurrency = Math.max(1, options.fillConcurrency ?? DEFAULT_AI_BUILD_FILL_CONCURRENCY);
  const emit = createBuildEmitter(options);
  const shared = sharedStepOptions(options);
  const startedAt = options.clock.now();

  emit({ type: 'build.scaffolding' });
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
      runId: stepRunId(options.runId, 'scaffold'),
      request: options.request,
      selectedSkillIds: ['craftkit.build-scaffold'],
      policy: { ...options.policy, allowedCommands: SCAFFOLD_COMMANDS },
      apply: 'auto',
      label: SCAFFOLD_LABEL,
    });
  } catch (cause) {
    if (options.signal?.aborted === true) throw cause;
    scaffoldFailure = cause instanceof Error ? cause.message : String(cause);
  }

  const direction = scaffold?.plan.rationale ?? '';
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
      runId: stepRunId(options.runId, 'fallback'),
      request: options.request,
      apply: 'auto',
    });
    return Object.freeze({
      runId: options.runId,
      tasks: Object.freeze([]),
      applied: 0,
      skipped: 0,
      elapsedMs: options.clock.now() - startedAt,
      ...(scaffold === undefined ? {} : { scaffold }),
      direction,
      outcome: 'fallback' as const,
      fallback,
    });
  }

  emit({ type: 'build.planned', direction, tasks });

  const reports: AiBuildTaskReport[] = [];
  const total = tasks.length;
  let applied = 0;
  let skipped = 0;
  let stopped: AiBuildStopReason | undefined;

  /*
    The one place a person is asked anything. After it, the build answers its
    own failures to the end — the whole point of the split is that a long build
    does not stop to ask.
  */
  if (options.onPlanned !== undefined && (await options.onPlanned(tasks, direction)) === 'stop') {
    stopped = 'signal';
  }

  /*
    WRITTEN concurrently, LANDED in order.

    Two jobs that used to be one. The pool writes up to `fillConcurrency`
    sections at a time — the expensive part, minutes each — while the lander
    walks the list from the top and applies each section only when every
    section above it has settled. So the page fills top to bottom however the
    model finishes, the transaction log reads in page order, and "undo
    Pricing" still removes exactly Pricing.

    A section that finishes early simply waits; nothing is discarded.
  */
  type Written =
    | { readonly kind: 'ready'; readonly run: AiAgentRunResult; readonly attempts: number }
    | { readonly kind: 'failed'; readonly reason: string; readonly attempts: number }
    | { readonly kind: 'not-started'; readonly reason: string };

  const slots = tasks.map(() => {
    let settle!: (written: Written) => void;
    const written = new Promise<Written>((resolve) => {
      settle = resolve;
    });
    let land!: () => void;
    const landed = new Promise<void>((resolve) => {
      land = resolve;
    });
    return { written, settle, landed, land, claimed: false };
  });

  /** The reason to stop, decided once and then true for every later check. */
  const stopReason = (): AiBuildStopReason | undefined => {
    if (stopped !== undefined) return stopped;
    if (options.signal?.aborted === true) return 'signal';
    if (options.clock.now() - startedAt >= buildBudgetMs) return 'budget';
    return undefined;
  };

  let announced = false;
  const halt = (reason: AiBuildStopReason): void => {
    if (!announced) {
      announced = true;
      stopped = reason;
      emit({ type: 'build.stopped', reason });
    }
    // Nobody may wait on a section that will never be written.
    for (const slot of slots) {
      if (!slot.claimed) {
        slot.claimed = true;
        slot.settle({ kind: 'not-started', reason: notStartedReason(reason) });
      }
    }
  };

  // A scaffold that already decided to stop still owes the caller the event and
  // owes every section its `not-started` verdict; `halt` is the one door for both.
  if (stopped !== undefined) halt(stopped);

  let nextToWrite = 0;
  let started = 0;
  const writer = async (): Promise<void> => {
    for (;;) {
      const index = nextToWrite;
      nextToWrite += 1;
      const slot = slots[index];
      if (slot === undefined) return;
      if (slot.claimed) continue;
      slot.claimed = true;

      /*
        The window, not just the pool. A writer may run at most
        `fillConcurrency` sections AHEAD of the section currently landing:
        section 4 waits for section 1 to land before it is written. Without
        this the pool empties the whole list into flight the moment one
        section is slow — paying for work a stop would throw away, and writing
        the end of the page before the beginning of it exists.
      */
      const behind = slots[index - fillConcurrency];
      if (behind !== undefined) await behind.landed;

      const reason = stopReason();
      if (reason !== undefined) {
        slot.settle({ kind: 'not-started', reason: notStartedReason(reason) });
        halt(reason);
        return;
      }
      if (started >= maxTasks) {
        slot.settle({ kind: 'not-started', reason: notStartedReason('max-tasks') });
        halt('max-tasks');
        return;
      }
      started += 1;
      const task = tasks[index];
      if (task === undefined) {
        slot.settle({ kind: 'not-started', reason: notStartedReason('max-tasks') });
        return;
      }
      const position = index + 1;

      let attempts = 0;
      let failure: unknown;
      let run: AiAgentRunResult | undefined;
      for (const attempt of [1, 2] as const) {
        attempts = attempt;
        emit({ type: 'task.started', position, total, task, attempt });
        try {
          run = await runFill(
            options,
            shared,
            task,
            position,
            total,
            attempt === 1
              ? fillRequest(direction, task, position, total, options.request)
              : retryRequest(direction, task),
            taskTimeoutMs,
          );
          break;
        } catch (cause) {
          failure = cause;
        }
      }
      slot.settle(
        run === undefined
          ? { kind: 'failed', reason: errorMessage(failure), attempts }
          : { kind: 'ready', run, attempts },
      );
    }
  };

  const writers = Array.from({ length: Math.min(fillConcurrency, tasks.length) }, () => writer());

  for (const [index, task] of tasks.entries()) {
    const position = index + 1;
    const slot = slots[index];
    const written: Written =
      slot === undefined
        ? { kind: 'not-started', reason: notStartedReason('max-tasks') }
        : await slot.written;

    /*
      Whatever this section's fate — landed, skipped, never started — the
      writer waiting `fillConcurrency` places behind it may now begin. The
      window slides on the LANDING, so a section is always written against a
      document in which its predecessors already exist.
    */
    try {
      if (written.kind === 'not-started') {
        reports.push({ ...task, status: 'not-started', attempts: 0, reason: written.reason });
        continue;
      }
      if (written.kind === 'failed') {
        /*
          Self-recovery, never a question. A section that would not be written
          twice is recorded and left as the placeholder the scaffold laid down;
          the page keeps its shape and the next section still gets its turn.
        */
        skipped += 1;
        reports.push({
          ...task,
          status: 'skipped',
          attempts: written.attempts,
          reason: written.reason,
        });
        emit({
          type: 'task.skipped',
          position,
          total,
          task,
          attempts: written.attempts,
          reason: written.reason,
        });
        continue;
      }

      const proposal = written.run.proposal;
      try {
        applyAiPlan({
          kernel: options.kernel,
          validationPorts: options.validationPorts,
          proposal,
          label: stepLabel(position, total, task.title),
        });
      } catch (cause) {
        /*
          Written fine, refused on landing: the page moved under it while it was
          being written. Same answer as a failed write — the section is left as
          the placeholder, and the rest of the page still lands.
        */
        const reason = errorMessage(cause);
        skipped += 1;
        reports.push({ ...task, status: 'skipped', attempts: written.attempts, reason });
        emit({ type: 'task.skipped', position, total, task, attempts: written.attempts, reason });
        continue;
      }

      applied += 1;
      reports.push({ ...task, status: 'applied', attempts: written.attempts });
      emit({ type: 'task.completed', position, total, task, attempts: written.attempts });
    } finally {
      slot?.land();
    }
  }

  // Every writer has already settled its slot; this only reaps the pool.
  await Promise.all(writers);

  const elapsedMs = options.clock.now() - startedAt;
  const outcome: AiBuildOutcome = stopped ?? 'completed';
  const frozenReports = Object.freeze(reports);
  emit({
    type: 'build.completed',
    tasks: frozenReports,
    applied,
    skipped,
    elapsedMs,
    outcome,
  });
  return Object.freeze({
    runId: options.runId,
    tasks: frozenReports,
    ...(scaffold === undefined ? {} : { scaffold }),
    applied,
    skipped,
    elapsedMs,
    direction,
    outcome,
  });
}
