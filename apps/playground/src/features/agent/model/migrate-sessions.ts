import type {
  AiBuildOutcome,
  AiBuildStopReason,
  AiPlan,
  AiPlanStep,
  AiRunFailure,
  AiRunFailureSource,
  AiSkillActivationPin,
  DroppedAiPlanStep,
} from '@craftkit/builder';

import type {
  BuildProgress,
  BuildProgressPhase,
  BuildTask,
  BuildTaskStatus,
} from './build-progress';
import {
  modeOf,
  outcomeKeyOf,
  reviveState,
  SESSIONS_KEY,
  titleOf,
  withUniqueTurnIds,
  type BuildTurn,
  type EditTurn,
  type EndTurn,
  type ErrorTurn,
  type LandingOutcome,
  type PagePlanTurn,
  type PersistedAgentState,
  type ProposalTurn,
  type Salvage,
  type Session,
  type StepPlanTurn,
  type Turn,
  type UserTurn,
} from './turns';
import type { AssistantMode } from './view-types';

/**
 * v1 → v2 conversation storage (SPEC §7.4).
 *
 * The v1 panel saved `JSON.stringify({ sessions, activeId, mode, modeChosen })` of its
 * live state under `pg-assistant-sessions-v1`, so what is in people's browsers is v1's
 * `Turn` union as JSON, runtime-only fields included (`undoable`, a proposal's
 * authority). This module reads that, maps every v1 kind onto the v2 union, and writes
 * `pg-agent-sessions-v2`. The v1 key is read and NEVER written, for one release: the v1
 * panel stays reachable behind `VITE_AGENT_PANEL=v1` until the cutover (FR-053), and it
 * must find its own data exactly as it left it.
 *
 * The v1 module is not imported: it is deleted at the cutover (SPEC §7.5), and a storage
 * format outlives the code that wrote it. Every read below goes through `unknown`,
 * because stored data can be stale, partial or hand-edited.
 *
 * Two kinds of v1 data are out there. Live state, saved as the panel ran; and what v1
 * wrote back after every load, because its persist effect saved `reviveSessions`' output
 * on mount. That revival rewrote a running build as `built` (`stopped: true`, rows still
 * `running`, no engine time) and stripped `request`, `undoable` and the undo counters from
 * every `built`, and impact, salvage, run and authority from every `plan`. Both are read.
 *
 * The mapping (SPEC §7.4), with the choices the spec leaves open:
 * - `you` → `user`, with no context (v1 never recorded any). A request whose run was
 *   stopped before any output is `notRun`.
 * - `building` → `build`, `interrupted` (a reload killed it). `awaiting` goes: nobody can
 *   answer a dead run's question.
 * - `built` → `build`, `revived`, settled (done, partial or stopped, from its own rows) when
 *   storage says how it ended: the engine's final time, the engine's own `stopped` phase,
 *   or a live ending v1 never revived (`request` or `undoable`, which v1 wrote at every
 *   ending and its revival removed). A settled build always has a report, timed by the
 *   engine, else by v1's receipt, else to its last evidence, because the record reads the
 *   ending from the report alone. Otherwise the `built` is v1's own revival of a running
 *   build, and is `interrupted`, as v1 meant and as its record shows. A Stop that threw
 *   before the engine's ending looks the same once v1 revived it; "interrupted" is the
 *   reading v1's revival produced for most of these. Sections still waiting when a build
 *   settled are `notWritten`. v1's "undone from position N" becomes one outcome per landed
 *   section at or after N.
 * - a build of either kind that never got its section list → `end` interrupted, never a
 *   record about "0/0".
 * - `thinking` → `end` interrupted.
 * - `stopped` → `edit` stopped when its receipt shows the change was being written
 *   (stage Structure or Apply); otherwise `end` "stopped before anything changed".
 * - `refused` → `error`, the failure kept for the clipboard. SPEC §7.4 reads "refused →
 *   error declined", but no class is ever pinned: the record reads it from the failure, so
 *   a 429 is "busy" and a lost connection "unreachable", each with Try again. A refusal
 *   that is words alone is v1's Plan-mode catch, which kept only the thrown error's message
 *   and settled it retryable: the message becomes the failure's, and `failure-class.ts`
 *   reads the engine's own sentences from it ("could not be reached", "status 429"). The
 *   page state is what v1 knew: an ordinary run, an apply and a preview each change the
 *   page in one transaction or not at all, so they left it `unchanged`; the build path's
 *   refusal (a failure and its request, no receipt, no failed row) replaced a build that
 *   may already have placed its skeleton and sections, and is `unknown`.
 * - `discarded` → `end` "Proposal discarded".
 * - `outline` listing sections → `page-plan`, read-only, "may differ" (Build re-plans);
 *   otherwise → `step-plan`, one step per line the model wrote.
 * - `plan` applied → `edit`, `revived` (Ask's apply is `origin: 'proposal'`); unapplied →
 *   `proposal`, inert: the plan stays readable, the authority is never revived.
 * - Deleted on the way: `progressLog`, `costTokens`, `liveLine`, `liveLog`, `undoable`,
 *   `undoneFrom`, `undoneSteps`, receipts (their times become `elapsedMs`).
 */

export const V1_SESSIONS_KEY = 'pg-assistant-sessions-v1';

/** The two calls this module makes on `window.localStorage`, so tests can spy on them. */
export interface AgentStorage {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
}

export interface LoadedAgentState {
  readonly state: PersistedAgentState | null;
  /** Where it came from: the v2 key, a v1 migration (now also saved as v2), or nowhere. */
  readonly source: 'v2' | 'v1' | 'none';
}

/* ── Reading unknown JSON ───────────────────────────────────────────────── */

type Json = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const recordOf = (value: unknown): Json | undefined => (isRecord(value) ? value : undefined);

const stringOf = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const numberOf = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const listOf = (value: unknown): readonly unknown[] =>
  Array.isArray(value) ? (value as readonly unknown[]) : [];

/**
 * `T` with `undefined` allowed on its optional fields, so a mapper can write
 * `startedAt: numberOf(...)` once instead of a conditional spread per field.
 */
type Loose<T> = {
  [K in keyof T]: T[K] | (Record<never, never> extends Pick<T, K> ? undefined : never);
};

/** The same object without its `undefined` fields, so a migrated turn is plain JSON. */
function compact<T extends object>(value: Loose<T>): T {
  return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as T;
}

/**
 * A v1 time: a build receipt's `mm:ss`, a run receipt's `mm:ss.SSS`, or a settled stage's
 * `detail` (the same `mm:ss.SSS`). Anything else (v1 also wrote "Checking" and failure
 * messages into `detail`) is not a time.
 */
function parseV1Elapsed(value: unknown): number | undefined {
  const match = /^(\d+):(\d{2})(?:\.(\d{3}))?$/u.exec(stringOf(value) ?? '');
  if (match === null) return undefined;
  const [, minutes = '0', seconds = '0', millis = '0'] = match;
  return Number(minutes) * 60_000 + Number(seconds) * 1_000 + Number(millis);
}

/** A settled v1 run's whole time: the sum of its settled rows, each measured by v1 itself. */
function v1RunElapsed(run: unknown): number | undefined {
  const stages = listOf(recordOf(run)?.['stages']);
  const times = stages
    .map((stage) => recordOf(stage))
    .filter((stage) => stage?.['status'] === 'done')
    .map((stage) => parseV1Elapsed(stage?.['detail']));
  if (times.length === 0 || times.some((time) => time === undefined)) return undefined;
  return times.reduce<number>((total, time) => total + (time ?? 0), 0);
}

const FAILURE_SOURCES: ReadonlySet<string> = new Set<AiRunFailureSource>([
  'context',
  'kernel',
  'plan',
  'policy',
  'provider',
  'run',
  'skill',
  'unknown',
]);

function failureOf(value: unknown): AiRunFailure | undefined {
  const failure = recordOf(value);
  const message = stringOf(failure?.['message']);
  if (failure === undefined || message === undefined) return undefined;
  const source = stringOf(failure['source']) ?? 'unknown';
  const status = numberOf(failure['status']);
  return {
    source: FAILURE_SOURCES.has(source) ? (source as AiRunFailureSource) : 'unknown',
    code: stringOf(failure['code']) ?? 'unknown',
    message,
    retryable: failure['retryable'] === true,
    ...(status === undefined ? {} : { status }),
  };
}

function skillsOf(value: unknown): readonly AiSkillActivationPin[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const reasons = new Set(['explicit', 'always', 'dependency', 'auto']);
  return listOf(value).flatMap((entry) => {
    const pin = recordOf(entry);
    const id = stringOf(pin?.['id']);
    const version = stringOf(pin?.['version']);
    const contentFingerprint = stringOf(pin?.['contentFingerprint']);
    const reason = stringOf(pin?.['reason']);
    if (id === undefined || version === undefined || contentFingerprint === undefined) return [];
    if (reason === undefined || !reasons.has(reason)) return [];
    return [{ id, version, contentFingerprint, reason: reason as AiSkillActivationPin['reason'] }];
  });
}

function planOf(value: unknown): AiPlan | undefined {
  const plan = recordOf(value);
  const rationale = stringOf(plan?.['rationale']);
  if (plan === undefined || rationale === undefined || !Array.isArray(plan['commands'])) {
    return undefined;
  }
  const commands = listOf(plan['commands']).flatMap((entry): AiPlanStep[] => {
    const step = recordOf(entry);
    const command = stringOf(step?.['command']);
    if (step === undefined || command === undefined) return [];
    const title = stringOf(step['title']);
    return [{ command, args: step['args'], ...(title === undefined ? {} : { title }) }];
  });
  const followUp = stringOf(plan['followUp']);
  return { rationale, commands, ...(followUp === undefined ? {} : { followUp }) };
}

function salvageOf(value: unknown): Salvage | undefined {
  const salvage = recordOf(value);
  const kept = numberOf(salvage?.['kept']);
  if (salvage === undefined || kept === undefined) return undefined;
  const dropped = listOf(salvage['dropped']).flatMap((entry): DroppedAiPlanStep[] => {
    const drop = recordOf(entry);
    const step = numberOf(drop?.['step']);
    const command = stringOf(drop?.['command']);
    const reason = stringOf(drop?.['reason']);
    return step === undefined || command === undefined || reason === undefined
      ? []
      : [{ step, command, reason }];
  });
  return { kept, dropped };
}

/* ── Builds ──────────────────────────────────────────────────────────────── */

const V2_PHASES: ReadonlySet<string> = new Set<BuildProgressPhase>([
  'scaffolding',
  'planned',
  'building',
  'stopped',
  'completed',
  'fallback',
]);

const STOP_REASONS: ReadonlySet<string> = new Set<AiBuildStopReason>([
  'signal',
  'budget',
  'max-tasks',
]);

/**
 * A v1 row's status in v2 words. v1 said `running` and `applied` where v2 says `writing`
 * and `landed`; a `skipped` section `failed`. Once the build is over, a section that
 * never landed was not written: it has no writer any more.
 */
function taskStatusOf(v1: unknown, settled: boolean): BuildTaskStatus {
  switch (v1) {
    case 'applied':
      return 'landed';
    case 'skipped':
      return 'failed';
    case 'running':
      return settled ? 'notWritten' : 'writing';
    default:
      return settled ? 'notWritten' : 'waiting';
  }
}

function taskOf(value: unknown, index: number, settled: boolean): BuildTask | null {
  const task = recordOf(value);
  const id = stringOf(task?.['id']);
  if (task === undefined || id === undefined) return null;
  const status = taskStatusOf(task['status'], settled);
  const attempts = numberOf(task['attempts']) ?? 0;
  const startedAt = numberOf(task['startedAt']);
  const elapsedMs = numberOf(task['elapsedMs']);
  const landedOrFailed = status === 'landed' || status === 'failed';
  return compact<BuildTask>({
    id,
    title: stringOf(task['title']) ?? '',
    position: numberOf(task['position']) ?? index + 1,
    status,
    attempts,
    startedAt,
    // v1 kept only the first attempt's start; for a one-attempt section it is the same.
    attemptStartedAt: attempts === 1 ? startedAt : undefined,
    elapsedMs,
    settledAt:
      landedOrFailed && startedAt !== undefined && elapsedMs !== undefined
        ? startedAt + elapsedMs
        : undefined,
    reason: stringOf(task['reason']),
  });
}

/**
 * The last moment there is EVIDENCE the v1 build was alive: v1's own `lastEvidenceAt`,
 * plus the moment its receipt was cut. A revived build is measured to this, never to now:
 * the wall clock kept running while the tab was closed, the build did not.
 */
function v1LastEvidenceAt(progress: Json, tasks: readonly BuildTask[], receiptMs?: number): number {
  const startedAt = numberOf(progress['startedAt']) ?? 0;
  const stamps = [
    startedAt,
    numberOf(recordOf(progress['run'])?.['stageSince']),
    receiptMs === undefined ? undefined : startedAt + receiptMs,
    ...tasks.map((task) => task.startedAt),
    ...tasks.map((task) =>
      task.startedAt === undefined || task.elapsedMs === undefined
        ? undefined
        : task.startedAt + task.elapsedMs,
    ),
  ];
  return Math.max(...stamps.filter((stamp) => stamp !== undefined));
}

/** How a v1 build ended, as far as storage can tell (see the mapping above). */
interface V1BuildEnding {
  readonly status: 'settled' | 'interrupted';
  /** v1's `stopped` flag: the person, the budget or the task limit ended it. */
  readonly stopped: boolean;
  /** v1's receipt time, cut at the ending (or, on revival, at the last evidence). */
  readonly receiptMs?: number | undefined;
}

/**
 * Whether a v1 `built` is settled or v1's revival of a running build. The engine's final
 * time or its own `stopped` phase settles it; so does a live ending v1 never revived,
 * which still carries the `request` and `undoable` v1 wrote at every ending.
 */
function builtStatus(v1: Json, progress: Json): V1BuildEnding['status'] {
  if (numberOf(progress['elapsedMs']) !== undefined) return 'settled';
  if (progress['phase'] === 'stopped') return 'settled';
  if (stringOf(v1['request']) !== undefined || v1['undoable'] === true) return 'settled';
  return 'interrupted';
}

/**
 * A v1 `BuildProgress` as the v2 reducer's state. Nothing v1 never recorded is invented:
 * no landing records (so no row can offer a working Undo), no writer count, no skeleton
 * rows. A settled build gets a report, because the record reads its ending from the report
 * alone (a revived build without one renders as interrupted). Its time is the engine's own
 * (`build.completed`); failing that, v1's receipt, which v1 cut at the ending; failing
 * that, the last evidence, which is v1's own rule for a receipt without an engine time.
 */
function progressOf(v1: Json, ending: V1BuildEnding): BuildProgress | null {
  const settled = ending.status === 'settled';
  const startedAt = numberOf(v1['startedAt']);
  const tasks = listOf(v1['tasks'])
    .map((task, index) => taskOf(task, index, settled))
    .filter((task) => task !== null);
  if (startedAt === undefined || tasks.length === 0) return null;
  const v1Phase = stringOf(v1['phase']) ?? '';
  const v1Reason = stringOf(v1['stopReason']) ?? '';
  const stopReason: AiBuildStopReason | undefined = STOP_REASONS.has(v1Reason)
    ? (v1Reason as AiBuildStopReason)
    : ending.stopped || v1Phase === 'stopped'
      ? 'signal'
      : undefined;
  const phase: BuildProgressPhase = settled
    ? stopReason === undefined
      ? 'completed'
      : 'stopped'
    : V2_PHASES.has(v1Phase)
      ? (v1Phase as BuildProgressPhase)
      : 'building';
  const lastEventAt = v1LastEvidenceAt(v1, tasks, ending.receiptMs);
  const outcome: AiBuildOutcome = stopReason ?? 'completed';
  return compact<BuildProgress>({
    runId: stringOf(v1['runId']) ?? '',
    phase,
    direction: stringOf(v1['direction']) ?? '',
    tasks,
    startedAt,
    writers: null,
    skeleton: null,
    stopReason: phase === 'stopped' ? stopReason : undefined,
    report: settled
      ? {
          applied: tasks.filter((task) => task.status === 'landed').length,
          skipped: tasks.filter((task) => task.status === 'failed').length,
          elapsedMs:
            numberOf(v1['elapsedMs']) ?? ending.receiptMs ?? Math.max(0, lastEventAt - startedAt),
          outcome,
        }
      : null,
    fallbackReason: stringOf(v1['fallbackReason']),
    lastEventAt,
  });
}

/** v1's "every section from position N on was undone" as one outcome per landed section. */
function undoneOutcomes(
  tasks: readonly BuildTask[],
  undoneFrom: number | undefined,
): Readonly<Record<string, LandingOutcome>> {
  if (undoneFrom === undefined) return {};
  return Object.fromEntries(
    tasks
      .filter((task) => task.status === 'landed' && task.position >= undoneFrom)
      .map((task) => [outcomeKeyOf(task), { kind: 'undone' } satisfies LandingOutcome]),
  );
}

/* ── One v1 turn ─────────────────────────────────────────────────────────── */

const end = (id: string, key: EndTurn['key']): EndTurn => ({ id, kind: 'end', key });

/** v1 wrote a request beside the answer; turns that did not carry one read it from there. */
interface Neighbours {
  readonly request: string | undefined;
}

function buildOf(
  id: string,
  v1: Json,
  near: Neighbours,
  kind: 'building' | 'built',
): BuildTurn | EndTurn {
  const recorded = recordOf(v1['progress']);
  const status =
    recorded === undefined || kind === 'building' ? 'interrupted' : builtStatus(v1, recorded);
  const progress =
    recorded === undefined
      ? null
      : progressOf(recorded, {
          status,
          stopped: v1['stopped'] === true,
          receiptMs: parseV1Elapsed(recordOf(v1['receipt'])?.['elapsed']),
        });
  // No section list, no honest record: "0/0" would be a record about nothing.
  if (progress === null) return end(id, 'interrupted');
  return compact<BuildTurn>({
    id,
    kind: 'build',
    request: stringOf(v1['request']) ?? near.request ?? '',
    progress,
    status,
    outcomes: undoneOutcomes(progress.tasks, numberOf(v1['undoneFrom'])),
    revived: true,
  });
}

function stoppedOf(id: string, v1: Json, near: Neighbours): EditTurn | EndTurn {
  const receipt = recordOf(v1['receipt']);
  const stage = receipt?.['stage'];
  // Stopped while the change was being written or applied: the edit ran, and was stopped.
  if (stage !== 'structure' && stage !== 'assembly') return end(id, 'stoppedBeforeChange');
  return compact<EditTurn>({
    id,
    kind: 'edit',
    origin: 'request',
    status: 'stopped',
    request: near.request,
    elapsedMs: parseV1Elapsed(receipt?.['elapsed']),
    changes: [],
    revived: true,
  });
}

/**
 * v1's build path is the one refusal that could follow a change: its catch replaced the
 * building turn, progress and all, with `{ text, failure, request }`. Every other refusal
 * with a failure either kept its run's receipt and failed row (the ordinary run) or has no
 * request (an apply or a preview, whose failure changed nothing). An ordinary run whose
 * receipt could not be cut reads as this too, which only withholds a claim.
 */
const isBuildPathRefusal = (v1: Json): boolean =>
  failureOf(v1['failure']) !== undefined &&
  stringOf(v1['request']) !== undefined &&
  v1['receipt'] === undefined &&
  v1['failedAt'] === undefined;

function refusedOf(id: string, v1: Json, near: Neighbours): ErrorTurn {
  const text = stringOf(v1['text']) ?? '';
  const failure = failureOf(v1['failure']);
  return compact<ErrorTurn>({
    id,
    kind: 'error',
    request: stringOf(v1['request']) ?? near.request,
    /*
      Words alone: v1's Plan-mode catch kept the thrown error's message and nothing else,
      and offered Try again. The words ARE the evidence; a class pinned beside them once
      read "The model declined" over "The assistant server could not be reached".
    */
    failure: failure ?? { source: 'unknown', code: 'unknown', message: text, retryable: true },
    pageState: isBuildPathRefusal(v1) ? { kind: 'unknown' } : { kind: 'unchanged' },
    elapsedMs: parseV1Elapsed(recordOf(v1['receipt'])?.['elapsed']),
  });
}

function outlineOf(id: string, v1: Json, near: Neighbours): PagePlanTurn | StepPlanTurn {
  const text = stringOf(v1['text']) ?? '';
  const request = stringOf(v1['request']) ?? near.request;
  const skills = skillsOf(v1['skills']);
  const followUp = stringOf(v1['followUp']);
  const sections = listOf(v1['sections']).filter((title) => typeof title === 'string');
  if (sections.length > 0) {
    const mood = text.replaceAll(/\s+/gu, ' ').trim();
    return compact<PagePlanTurn>({
      id,
      kind: 'page-plan',
      request,
      status: 'ready',
      subject: request ?? '',
      direction: mood === '' ? undefined : { mood },
      sections: sections.map((title, index) => ({ key: `section-${String(index + 1)}`, title })),
      // Titles only, from a build that wrote nothing: Build re-plans from the request.
      note: 'mayDiffer',
      editable: false,
      followUp,
      skills,
    });
  }
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== '');
  return compact<StepPlanTurn>({
    id,
    kind: 'step-plan',
    request,
    status: 'ready',
    steps: lines.map((line, index) => ({ key: `step-${String(index + 1)}`, text: line })),
    text,
    dropped: numberOf(v1['dropped']) ?? 0,
    followUp,
    skills,
  });
}

function planTurnOf(id: string, v1: Json, near: Neighbours): EditTurn | ProposalTurn {
  const plan = planOf(v1['plan']);
  // Absent in data saved before modes were recorded, which was always Ask.
  const mode: AssistantMode = modeOf(v1['mode']) ?? 'ask';
  const common = {
    id,
    request: near.request,
    mode,
    changes: [],
    salvaged: salvageOf(v1['salvaged']),
    skills: skillsOf(v1['skills']),
    followUp: plan?.followUp,
    elapsedMs: v1RunElapsed(v1['run']),
    revived: true,
  } as const;
  if (v1['applied'] === true) {
    return compact<EditTurn>({
      ...common,
      kind: 'edit',
      origin: mode === 'ask' ? 'proposal' : 'request',
      status: recordOf(v1['impact'])?.['empty'] === true ? 'noChange' : 'done',
      summary: plan?.rationale,
    });
  }
  // The authority never survives: a revived proposal is readable and cannot apply.
  return compact<ProposalTurn>({ ...common, kind: 'proposal', status: 'ready', plan });
}

function turnOf(value: unknown, near: Neighbours): Turn | null {
  const v1 = recordOf(value);
  const id = stringOf(v1?.['id']);
  if (v1 === undefined || id === undefined) return null;
  if (v1['from'] === 'you') {
    const text = stringOf(v1['text']);
    return text === undefined ? null : ({ id, kind: 'user', text, context: [] } satisfies UserTurn);
  }
  switch (v1['kind']) {
    case 'building':
    case 'built':
      return buildOf(id, v1, near, v1['kind']);
    case 'thinking':
      return end(id, 'interrupted');
    case 'stopped':
      return stoppedOf(id, v1, near);
    case 'refused':
      return refusedOf(id, v1, near);
    case 'discarded':
      return end(id, 'proposalDiscarded');
    case 'outline':
      return outlineOf(id, v1, near);
    case 'plan':
      return planTurnOf(id, v1, near);
    default:
      return null;
  }
}

/** A v1 conversation. The title is its first request, whole: v1 cut it at 32 characters. */
function sessionOf(value: unknown): Session | null {
  const v1 = recordOf(value);
  const id = stringOf(v1?.['id']);
  if (v1 === undefined || id === undefined || !Array.isArray(v1['turns'])) return null;
  const v1Turns = listOf(v1['turns']);
  const turns = v1Turns.map((turn, index) => {
    const previous = recordOf(v1Turns[index - 1]);
    const request = previous?.['from'] === 'you' ? stringOf(previous['text']) : undefined;
    return turnOf(turn, { request });
  });
  const marked = turns.map((turn, index): Turn | null => {
    const next = turns[index + 1];
    // Its run was stopped before any output: the request was sent and not run.
    return turn?.kind === 'user' && next?.kind === 'end' && next.key === 'stoppedBeforeChange'
      ? { ...turn, notRun: true }
      : turn;
  });
  const kept = marked.filter((turn) => turn !== null);
  return { id, title: titleOf(kept), turns: kept, updatedAt: null };
}

/**
 * Migrate a parsed `pg-assistant-sessions-v1` value, or null when it holds nothing
 * usable. The result is already revived: loading it again changes nothing.
 */
export function migrateV1State(raw: unknown): PersistedAgentState | null {
  const v1 = recordOf(raw);
  if (v1 === undefined || typeof v1['activeId'] !== 'string' || !Array.isArray(v1['sessions'])) {
    return null;
  }
  const sessions = withUniqueTurnIds(
    listOf(v1['sessions'])
      .map(sessionOf)
      .filter((session) => session !== null),
  );
  const first = sessions[0];
  if (first === undefined) return null;
  const mode = modeOf(v1['mode']);
  /*
    v1's rule for data saved before the marker: then the default was Ask and only the
    radios wrote Plan or Auto, so those two were chosen; a saved Ask may have been the
    default, and stays unchosen. Only a literal `true` marks a choice.
  */
  const marked: unknown = v1['modeChosen'];
  const modeChosen = marked === undefined ? mode === 'plan' || mode === 'auto' : marked === true;
  return {
    version: 2,
    sessions,
    activeId: sessions.some((session) => session.id === v1['activeId']) ? v1['activeId'] : first.id,
    ...(mode === undefined ? {} : { mode }),
    ...(modeChosen ? { modeChosen: true } : {}),
  };
}

/* ── Storage ─────────────────────────────────────────────────────────────── */

const NOTHING: LoadedAgentState = { state: null, source: 'none' };

/** A parsed key, or undefined when it is missing, unreadable or blocked. */
function readJson(storage: AgentStorage, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    return raw === null ? undefined : (JSON.parse(raw) as unknown);
  } catch {
    return undefined;
  }
}

/**
 * The saved conversations: v2 when it is readable; otherwise v1, migrated and written
 * under the v2 key so the migration runs once. The v1 key is never written. A v2 copy
 * that cannot be parsed does not shadow v1: the history is worth more than the broken
 * copy. A readable v2 copy always wins, even when every conversation in it was deleted.
 * Storage that is blocked or full never throws out of here; the panel starts fresh, or
 * keeps the migration for this session and tries the write again next time.
 */
export function loadAgentState(storage: AgentStorage | undefined): LoadedAgentState {
  if (storage === undefined) return NOTHING;
  const saved = readJson(storage, SESSIONS_KEY);
  /*
    A readable v2 store is the truth, even an empty one: the person may have deleted
    every conversation, and refilling it from v1 would bring back what they deleted.
    Only a missing or unparseable v2 falls back to v1.
  */
  if (recordOf(saved)?.['version'] === 2) return { state: reviveState(saved), source: 'v2' };
  const migrated = migrateV1State(readJson(storage, V1_SESSIONS_KEY));
  if (migrated === null) return NOTHING;
  try {
    storage.setItem(SESSIONS_KEY, JSON.stringify(migrated));
  } catch {
    // Full or blocked: this load still has the conversation; the next one migrates again.
  }
  return { state: migrated, source: 'v1' };
}
