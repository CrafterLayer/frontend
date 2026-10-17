/**
 * v1 → v2 storage (SPEC §7.4): real v1 data in, v2 turns out, one test per v1 kind.
 *
 * The fixtures in `testing/v1-sessions.json` are what the v1 panel actually wrote:
 * `JSON.stringify` of its live state, so runtime-only fields (`undoable`, a proposal's
 * authority) are in there, exactly as they are in people's browsers today; and what v1
 * wrote back after every load (`revivedByV1`), which is most of what is out there. The v1
 * key is read and never written (SPEC §7.4 "for one release"), and a storage spy proves
 * it. A migrated build is also rendered through `buildRecordView`, so the data and the
 * record it becomes cannot disagree about how the build ended.
 */
import { describe, expect, it } from 'vitest';

import fixtures from '../testing/v1-sessions.json';
import { classifyRunFailure, isRetryableErrorClass } from './failure-class';
import {
  loadAgentState,
  migrateV1State,
  V1_SESSIONS_KEY,
  type AgentStorage,
} from './migrate-sessions';
import {
  buildRecordInputOf,
  buildRecordView,
  errorRecordInputOf,
  errorRecordView,
  type RunViewContext,
} from './run-view';
import {
  reviveState,
  SESSIONS_KEY,
  type BuildTurn,
  type EditTurn,
  type ErrorTurn,
  type PagePlanTurn,
  type ProposalTurn,
  type StepPlanTurn,
  type Turn,
  type UserTurn,
} from './turns';
import { TURN_KINDS } from './view-types';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/** The fixture as the ids this file reads; the JSON's own inferred type is a 16-way union. */
const EVERY_KIND: {
  readonly sessions: readonly { readonly turns: readonly { readonly id: string }[] }[];
} = fixtures.everyKind;

function migrated(raw: unknown = fixtures.everyKind) {
  const state = migrateV1State(structuredClone(raw));
  if (state === null) throw new Error('the fixture must migrate');
  return state;
}

/** Every migrated turn by its v1 id (each fixture's ids are unique). */
function turnsById(raw: unknown): ReadonlyMap<string, Turn> {
  return new Map(migrated(raw).sessions.flatMap((session) => session.turns.map((t) => [t.id, t])));
}

function turnIn<K extends Turn['kind']>(
  raw: unknown,
  id: string,
  kind: K,
): Extract<Turn, { kind: K }> {
  const found = turnsById(raw).get(id);
  expect(found?.kind).toBe(kind);
  return found as Extract<Turn, { kind: K }>;
}

const turn = <K extends Turn['kind']>(id: string, kind: K) => turnIn(fixtures.everyKind, id, kind);
const revived = <K extends Turn['kind']>(id: string, kind: K) =>
  turnIn(fixtures.revivedByV1, id, kind);

const VIEW_CONTEXT: RunViewContext = {
  developer: false,
  capabilities: {
    rowUndo: false,
    undoBuild: false,
    restore: false,
    facts: false,
    failureClasses: true,
    editablePlan: false,
    structuredDirection: false,
    estimate: false,
    canvasStage: false,
  },
};

/** The record a migrated build becomes, handed over the way the controller hands it. */
function recordOf(build: BuildTurn, context: RunViewContext = VIEW_CONTEXT) {
  return buildRecordView(buildRecordInputOf(build), context);
}

/** Storage that records every write, and can be told to throw. */
function spyStorage(initial: Readonly<Record<string, string>> = {}, broken = false) {
  const store = new Map(Object.entries(initial));
  const writes: [string, string][] = [];
  const storage: AgentStorage = {
    getItem: (key) => {
      if (broken) throw new Error('SecurityError: storage is blocked');
      return store.get(key) ?? null;
    },
    setItem: (key, value) => {
      if (broken) throw new Error('QuotaExceededError');
      writes.push([key, value]);
      store.set(key, value);
    },
  };
  return { storage, store, writes };
}

/* ── Every v1 kind ───────────────────────────────────────────────────────── */

describe('migrateV1State: every v1 kind maps as SPEC §7.4 says', () => {
  it.each<[string, string, Turn['kind'], Record<string, unknown>]>([
    ['you → user', 'turn-3', 'user', { text: 'صفحة لعيادة أسنان في عمّان، والحجز عبر واتساب' }],
    ['built (completed) → build, revived', 'turn-4', 'build', { status: 'settled', revived: true }],
    [
      'plan (applied, Auto) → edit, revived',
      'turn-6',
      'edit',
      { status: 'done', origin: 'request', revived: true },
    ],
    [
      'plan (unapplied, Ask) → proposal, inert',
      'turn-8',
      'proposal',
      { status: 'ready', revived: true },
    ],
    ['discarded → end', 'turn-10', 'end', { key: 'proposalDiscarded' }],
    [
      'refused with a classified failure → error, classed by that failure',
      'turn-12',
      'error',
      { pageState: { kind: 'unchanged' } },
    ],
    ['stopped mid-writing → edit stopped', 'turn-14', 'edit', { status: 'stopped', revived: true }],
    ['stopped while reading → end', 'turn-16', 'end', { key: 'stoppedBeforeChange' }],
    ['thinking → end interrupted', 'turn-18', 'end', { key: 'interrupted' }],
    [
      'outline listing sections → page-plan, read-only',
      'turn-21',
      'page-plan',
      { editable: false, note: 'mayDiffer' },
    ],
    ['outline without sections → step-plan', 'turn-23', 'step-plan', { status: 'ready' }],
    [
      'built (stopped) → build stopped, revived',
      'turn-25',
      'build',
      { status: 'settled', revived: true },
    ],
    ['building → build interrupted', 'turn-27', 'build', { status: 'interrupted', revived: true }],
    [
      'building awaiting approval → build interrupted',
      'turn-29',
      'build',
      { status: 'interrupted' },
    ],
    ['plan (unapplied, Plan) → proposal, inert', 'turn-31', 'proposal', { status: 'ready' }],
    [
      'built (budget) → build stopped, revived',
      'turn-33',
      'build',
      { status: 'settled', revived: true },
    ],
    [
      'built (stopped by the person before the engine ended it) → build stopped, revived',
      'turn-35',
      'build',
      { status: 'settled', revived: true },
    ],
  ])('%s', (_name, id, kind, fields) => {
    expect(turn(id, kind)).toMatchObject(fields);
  });

  it('produces only v2 kinds, and keeps every conversation and turn in order', () => {
    const state = migrated();
    const v1Turns = EVERY_KIND.sessions.flatMap((session) => session.turns);
    const v2Turns = state.sessions.flatMap((session) => session.turns);
    expect(v2Turns.map((t) => t.id)).toEqual(v1Turns.map((t) => t.id));
    for (const t of v2Turns) expect(TURN_KINDS).toContain(t.kind);
    expect(state.sessions.map((session) => session.id)).toEqual(['session-1', 'session-2']);
  });

  it('carries nothing v1-only: no `from`, progressLog, costTokens, undoable or undone counters', () => {
    const text = JSON.stringify(migrated());
    for (const gone of [
      '"from"',
      'progressLog',
      'costTokens',
      'undoable',
      'undoneFrom',
      'undoneSteps',
      'liveLog',
      'liveLine',
    ]) {
      expect(text).not.toContain(gone);
    }
  });

  it('keeps the active conversation and the mode the person chose', () => {
    const state = migrated();
    expect(state).toMatchObject({
      version: 2,
      activeId: 'session-2',
      mode: 'plan',
      modeChosen: true,
    });
  });

  it('titles each conversation with its whole first request, and records no time', () => {
    const state = migrated();
    expect(state.sessions.map((session) => [session.title, session.updatedAt])).toEqual([
      ['صفحة لعيادة أسنان في عمّان، والحجز عبر واتساب', null],
      ['Plan a landing page for a yoga studio in Amman', null],
    ]);
  });

  it('is already revived: loading the migrated state again changes nothing', () => {
    const state = migrated();
    expect(reviveState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });
});

describe('migrateV1State: builds', () => {
  it('maps a completed build’s rows to v2 states and keeps the engine’s final time', () => {
    const built = turn('turn-4', 'build');
    expect(built.progress.phase).toBe('completed');
    expect(built.progress.tasks.map((t) => [t.title, t.status])).toEqual([
      ['الافتتاحية', 'landed'],
      ['الخدمات', 'landed'],
      ['الأطباء', 'failed'],
      ['تواصل معنا', 'landed'],
    ]);
    expect(built.progress.report).toEqual({
      applied: 3,
      skipped: 1,
      elapsedMs: 201_480,
      outcome: 'completed',
    });
    // The engine's reason is evidence for failure-class, never text on screen.
    expect(built.progress.tasks[2]?.reason).toBe('Section "الأطباء" exceeded its 90000ms budget.');
    expect(built.progress.writers).toBeNull();
    expect(built.progress.skeleton).toBeNull();
    expect(built.outcomes).toEqual({});
    expect(built.request).toBe('صفحة لعيادة أسنان في عمّان، والحجز عبر واتساب');
  });

  it('keeps no landing record a v1 build never had, so no row can offer a working Undo', () => {
    const built = turn('turn-4', 'build');
    for (const t of built.progress.tasks) expect(t).not.toHaveProperty('landing');
  });

  it('measures a v1 build to its last evidence, never to now', () => {
    const built = turn('turn-4', 'build');
    // The doctors section settled last, skipped after two attempts: T+21 080, then 180 400.
    expect(built.progress.lastEventAt).toBe(1_790_499_600_000 + 21_080 + 180_400);
    expect(built.progress.tasks[2]?.settledAt).toBe(1_790_499_600_000 + 21_080 + 180_400);
    expect(built.progress.tasks[3]?.settledAt).toBe(1_790_499_600_000 + 69_300 + 39_900);
  });

  it('keeps a stopped build stopped by the person, with its unreached sections not written', () => {
    const stopped = turn('turn-25', 'build');
    expect(stopped.progress.phase).toBe('stopped');
    expect(stopped.progress.stopReason).toBe('signal');
    expect(stopped.progress.tasks.map((t) => t.status)).toEqual([
      'landed',
      'landed',
      'notWritten',
      'notWritten',
    ]);
  });

  it('turns v1’s "undone from section 2" into per-section outcomes keyed by section', () => {
    // v1 had no transaction ids, so the key marks the section (outcomeKeyOf).
    const stopped = turn('turn-25', 'build');
    expect(stopped.outcomes).toEqual({ 'v1-section:c-menu': { kind: 'undone' } });
  });

  it('renders the section v1 undid as undone, and offers no Redo it cannot perform', () => {
    // The record reads outcomes by the key they are stored under: reading landing ids only
    // left this row inked as if it were still on the page.
    const record = recordOf(turn('turn-25', 'build'), {
      ...VIEW_CONTEXT,
      capabilities: { ...VIEW_CONTEXT.capabilities, rowUndo: true },
    });
    expect(record?.rows.map((row) => row.state)).toEqual([
      'landed',
      'undone',
      'notWritten',
      'notWritten',
    ]);
    expect(record?.landed).toBe(1);
    expect(record?.rows[1]?.undo).toEqual({ kind: 'unavailable', why: 'revived' });
  });

  it('keeps a Stop that ended the run before the engine did, timed by v1’s own receipt', () => {
    // v1's catch path: the abort threw, so there is no `build.completed` and no engine time;
    // the receipt v1 cut at the Stop is its record of how long the build ran.
    const stopped = turn('turn-35', 'build');
    expect(stopped.progress).toMatchObject({ phase: 'stopped', stopReason: 'signal' });
    expect(stopped.progress.report).toEqual({
      applied: 1,
      skipped: 0,
      elapsedMs: 52_000,
      outcome: 'signal',
    });
    expect(stopped.progress.tasks.map((t) => t.status)).toEqual([
      'landed',
      'notWritten',
      'notWritten',
    ]);
    expect(recordOf(stopped)).toMatchObject({ phase: 'stopped', stopReason: 'signal' });
    expect(recordOf(stopped)?.elapsedMs).toBe(52_000);
  });

  it('keeps a budget stop as a budget stop', () => {
    const budget = turn('turn-33', 'build');
    expect(budget.progress).toMatchObject({ phase: 'stopped', stopReason: 'budget' });
    expect(budget.progress.report).toMatchObject({ elapsedMs: 900_000, outcome: 'budget' });
    expect(budget.progress.tasks.map((t) => t.status)).toEqual(['landed', 'failed', 'notWritten']);
  });

  it('keeps an interrupted build’s rows as they were, for "Finish the rest"', () => {
    const interrupted = turn('turn-27', 'build');
    expect(interrupted.progress.phase).toBe('building');
    expect(interrupted.progress.tasks.map((t) => [t.status, t.attempts])).toEqual([
      ['landed', 1],
      ['writing', 2],
      ['writing', 1],
      ['waiting', 0],
    ]);
    expect(interrupted.progress.report).toBeNull();
    expect(interrupted.progress.lastEventAt).toBe(1_790_499_600_000 + 3_052_500);
  });

  it('drops an Ask approval with the build: nobody can answer a dead run’s question', () => {
    const waiting = turn('turn-29', 'build');
    expect(waiting).not.toHaveProperty('awaiting');
    expect(waiting.progress.phase).toBe('planned');
    expect(waiting.progress.tasks.every((t) => t.status === 'waiting')).toBe(true);
  });
});

describe('migrateV1State: edits, proposals and endings', () => {
  it('revives an applied plan as a finished edit with its words, and no authority', () => {
    const edit: EditTurn = turn('turn-6', 'edit');
    expect(edit).toMatchObject({
      summary: 'جعلتُ خلفية الافتتاحية داكنة وأضفت زر واتساب بجانب زر الحجز.',
      followUp: 'أضف قسم أسعار بثلاث خطط',
      request: 'اجعل الافتتاحية داكنة وأضف زر واتساب',
      mode: 'auto',
      elapsedMs: 2_114 + 11_870 + 412,
      changes: [],
    });
    expect(edit.skills?.map((pin) => pin.id)).toEqual(['craftkit.hero']);
    expect(edit).not.toHaveProperty('transactionId');
    expect(edit).not.toHaveProperty('proposal');
  });

  it('keeps an unapplied proposal readable and inert: the plan stays, the authority goes', () => {
    const proposal: ProposalTurn = turn('turn-8', 'proposal');
    expect(proposal.plan?.rationale).toBe('أضيف قسم أسعار بثلاث خطط، وأربطه بزر الافتتاحية.');
    expect(proposal).not.toHaveProperty('proposal');
    expect(proposal.salvaged).toEqual({
      kept: 2,
      dropped: [
        {
          step: 3,
          command: 'setProp',
          reason:
            'The grouped plan was rejected by the kernel door: Type "hero" declares no prop "glow".',
        },
      ],
    });
    expect(proposal).toMatchObject({ mode: 'ask', elapsedMs: 1_950 + 14_020 });
  });

  it('keeps the whole refusal for the clipboard, and says the page did not change', () => {
    // The ordinary run's refusal: its apply is one kernel transaction, so nothing landed.
    const error: ErrorTurn = turn('turn-12', 'error');
    expect(error).toMatchObject({
      failure: {
        source: 'provider',
        code: 'http-status',
        message: 'The assistant server answered with status 429.',
        retryable: true,
        status: 429,
      },
      pageState: { kind: 'unchanged' },
      request: 'أعد كتابة قسم الأطباء',
      elapsedMs: 7_301,
    });
  });

  it('lets a classified failure name its own class: a 429 is busy and can be tried again', () => {
    // Pinning "declined" here said "Different wording may work" with no Try again.
    const error: ErrorTurn = turn('turn-12', 'error');
    expect(error).not.toHaveProperty('errorClass');
    const errorClass = classifyRunFailure(error.failure);
    expect(errorClass).toBe('busy');
    expect(isRetryableErrorClass(errorClass)).toBe(true);
  });

  it('keeps how long a stopped edit ran, from its receipt', () => {
    const stopped: EditTurn = turn('turn-14', 'edit');
    expect(stopped).toMatchObject({ elapsedMs: 16_044, request: 'اجعل الألوان أدفأ', changes: [] });
  });

  it('marks the request of a run stopped before any output as not run', () => {
    expect(turn('turn-15', 'user')).toMatchObject({ notRun: true });
    const others = migrated()
      .sessions.flatMap((session) => session.turns)
      .filter((t): t is UserTurn => t.kind === 'user' && t.id !== 'turn-15');
    for (const user of others) expect(user).not.toHaveProperty('notRun');
  });

  it('sends every migrated request with no context: v1 never recorded any', () => {
    expect(turn('turn-3', 'user').context).toEqual([]);
  });
});

describe('migrateV1State: plans', () => {
  it('reads an outline that lists sections as a read-only page plan that may differ', () => {
    const plan: PagePlanTurn = turn('turn-21', 'page-plan');
    expect(plan).toMatchObject({
      status: 'ready',
      subject: 'Plan a landing page for a yoga studio in Amman',
      request: 'Plan a landing page for a yoga studio in Amman',
      direction: {
        mood: 'Calm studio: sand, sage, a light serif. A hero with the first class free, then classes, prices and a map.',
      },
      editable: false,
      note: 'mayDiffer',
    });
    expect(plan.sections.map((section) => section.title)).toEqual([
      'Hero',
      'Classes',
      'Prices',
      'Teachers',
      'Visit us',
    ]);
    expect(new Set(plan.sections.map((section) => section.key)).size).toBe(5);
    expect(plan).not.toHaveProperty('approval');
  });

  it('reads an outline without sections as a step plan, one step per written line', () => {
    const steps: StepPlanTurn = turn('turn-23', 'step-plan');
    expect(steps.steps.map((step) => step.text)).toEqual([
      'GOAL: make the six services scannable in one screen.',
      'OUTLINE: group them into three pairs · give each a one-line price hint · move the booking button under the grid.',
      'RISK: the prices are guesses until you confirm them.',
    ]);
    expect(steps).toMatchObject({
      followUp: 'Group the services into three pairs',
      dropped: 2,
      request: 'How should I reorganise the services section?',
    });
    expect(steps.text).toContain('GOAL: make the six services');
  });
});

/* ── What v1 wrote back after a reload ──────────────────────────────────── */

describe('migrateV1State: what v1 wrote back after every load', () => {
  it('keeps every conversation and turn, in order, as v2 kinds only', () => {
    const state = migrated(fixtures.revivedByV1);
    const v1Ids = fixtures.revivedByV1.sessions.flatMap((session) =>
      session.turns.map((t) => t.id),
    );
    expect(state.sessions.flatMap((session) => session.turns.map((t) => t.id))).toEqual(v1Ids);
    for (const t of state.sessions.flatMap((session) => session.turns)) {
      expect(TURN_KINDS).toContain(t.kind);
    }
    expect(state).toMatchObject({ activeId: 'session-4', mode: 'auto', modeChosen: true });
  });

  it('is already revived: loading it again changes nothing', () => {
    const state = migrated(fixtures.revivedByV1);
    expect(reviveState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('reads a build v1 revived as "built" (stopped, rows still running, no engine time) as interrupted', () => {
    // v1's reviveSessions turned a running build into this shape on reload; the data now
    // says what run-view shows for it, instead of "settled, stopped" with no report.
    const build = revived('turn-41', 'build');
    expect(build).toMatchObject({
      status: 'interrupted',
      revived: true,
      request: 'مخبز صغير في إربد يبيع الكعك والمعمول',
      outcomes: {},
    });
    expect(build.progress.phase).toBe('building');
    expect(build.progress).not.toHaveProperty('stopReason');
    expect(build.progress.report).toBeNull();
    expect(build.progress.tasks.map((t) => [t.status, t.attempts])).toEqual([
      ['landed', 1],
      ['writing', 2],
      ['writing', 1],
      ['waiting', 0],
    ]);
    expect(build.progress.lastEventAt).toBe(1_790_510_064_000);
    expect(recordOf(build)?.phase).toBe('interrupted');
  });

  it('reads a completed build v1 revived as done, with the engine’s time', () => {
    const build = revived('turn-47', 'build');
    expect(build).toMatchObject({ status: 'settled', request: 'Build a specialty café page' });
    expect(build.progress.report).toEqual({
      applied: 3,
      skipped: 0,
      elapsedMs: 96_400,
      outcome: 'completed',
    });
    expect(recordOf(build)).toMatchObject({ phase: 'done', elapsedMs: 96_400 });
  });

  it('reads a build the engine had stopped as stopped, timed by v1’s receipt', () => {
    const build = revived('turn-49', 'build');
    expect(build.status).toBe('settled');
    expect(build.progress).toMatchObject({ phase: 'stopped', stopReason: 'signal' });
    expect(build.progress.report).toEqual({
      applied: 2,
      skipped: 0,
      elapsedMs: 58_000,
      outcome: 'signal',
    });
    expect(build.progress.tasks.map((t) => t.status)).toEqual([
      'landed',
      'landed',
      'notWritten',
      'notWritten',
    ]);
    expect(recordOf(build)).toMatchObject({ phase: 'stopped', stopReason: 'signal' });
  });

  it('never saves a build whose data and record disagree about how it ended', () => {
    const builds = [fixtures.everyKind, fixtures.revivedByV1].flatMap((raw) =>
      migrated(raw)
        .sessions.flatMap((session) => session.turns)
        .filter((t): t is BuildTurn => t.kind === 'build'),
    );
    expect(builds.length).toBeGreaterThanOrEqual(8);
    for (const build of builds) {
      const phase = recordOf(build)?.phase;
      // Settled means the ending is known, which run-view reads from the report alone.
      expect(phase === 'interrupted', build.id).toBe(build.status === 'interrupted');
      if (build.status === 'settled') expect(build.progress.report, build.id).not.toBeNull();
    }
  });

  it('reads a plan stripped of its impact, salvage, run and authority, unapplied, as an inert proposal', () => {
    const proposal: ProposalTurn = revived('turn-43', 'proposal');
    expect(proposal).toMatchObject({
      status: 'ready',
      revived: true,
      mode: 'ask',
      request: 'Make the header sticky',
      followUp: 'Shrink the header while scrolling',
      changes: [],
    });
    expect(proposal.plan?.rationale).toBe(
      'Pin the header to the top so the order button stays in reach.',
    );
    for (const gone of ['proposal', 'salvaged', 'elapsedMs']) {
      expect(proposal).not.toHaveProperty(gone);
    }
  });

  it('reads a stripped applied plan as a finished edit, with no time it never kept', () => {
    const edit: EditTurn = revived('turn-45', 'edit');
    expect(edit).toMatchObject({
      status: 'done',
      origin: 'request',
      mode: 'auto',
      revived: true,
      request: 'Add a WhatsApp button to the hero',
      summary: 'Added a WhatsApp button beside the order button.',
      changes: [],
    });
    expect(edit.skills?.map((pin) => pin.id)).toEqual(['craftkit.hero']);
    expect(edit).not.toHaveProperty('elapsedMs');
  });
});

describe('migrateV1State: refusals say only what v1 knew about the page', () => {
  it('does not claim an unchanged page after a build failed: its skeleton and sections may be on it', () => {
    // v1's build catch path replaced the building turn, progress and all, so what landed
    // before the error is unknown; "The page wasn't changed" may be false.
    const error: ErrorTurn = revived('turn-51', 'error');
    expect(error).toMatchObject({
      pageState: { kind: 'unknown' },
      request: 'Build a gym page with a class timetable',
      failure: { code: 'http-status', status: 500, retryable: true },
    });
    expect(error).not.toHaveProperty('errorClass');
    expect(classifyRunFailure(error.failure)).toBe('unreachable');
  });

  it('keeps "unchanged" for a refused apply: the kernel door refuses a plan whole', () => {
    const error: ErrorTurn = revived('turn-53', 'error');
    expect(error).toMatchObject({
      pageState: { kind: 'unchanged' },
      request: 'Make the prices bigger',
      failure: { source: 'plan', code: 'plan-rejected', retryable: false },
    });
    expect(error).not.toHaveProperty('errorClass');
    expect(error).not.toHaveProperty('elapsedMs');
  });

  it('never pins a class: a refusal that is words alone is read from its words', () => {
    // v1's Plan-mode catch kept only the thrown error's message and offered Try again.
    const error: ErrorTurn = revived('turn-55', 'error');
    expect(error).toMatchObject({
      pageState: { kind: 'unchanged' },
      request: 'Plan a new pricing section',
      failure: { message: 'The plan could not be written.', retryable: true },
    });
    expect(error).not.toHaveProperty('errorClass');
    const view = errorRecordView(errorRecordInputOf(error), VIEW_CONTEXT);
    expect(view).toMatchObject({ failure: 'unknown', retryable: true });
  });

  it.each([
    ['turn-57', 'unreachable'],
    ['turn-59', 'busy'],
  ] as const)(
    'reads %s, a words-only refusal in the engine’s own sentence, as %s with Try again',
    (id, expected) => {
      // Pinning "declined" here said "The model declined" over a lost connection or a 429.
      const view = errorRecordView(errorRecordInputOf(revived(id, 'error')), VIEW_CONTEXT);
      expect(view).toMatchObject({ failure: expected, retryable: true });
      expect(view.pageState).toEqual({ kind: 'unchanged' });
    },
  );

  it('hands the stored page state to the record as it is, "unknown" included', () => {
    const view = errorRecordView(errorRecordInputOf(revived('turn-51', 'error')), VIEW_CONTEXT);
    expect(view).toMatchObject({ failure: 'unreachable', pageState: { kind: 'unknown' } });
  });
});

/* ── Legacy storage ──────────────────────────────────────────────────────── */

describe('migrateV1State: data from before receipts, modes and unique ids', () => {
  function legacy() {
    const state = migrateV1State(structuredClone(fixtures.legacy));
    if (state === null) throw new Error('the legacy fixture must migrate');
    return state;
  }

  it('repairs twin ids, keeping every turn', () => {
    const ids = legacy().sessions[0]?.turns.map((t) => t.id) ?? [];
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(12);
  });

  it('maps the old shapes without inventing what they never recorded', () => {
    const kinds = legacy().sessions[0]?.turns.map((t) =>
      t.kind === 'end' ? `end:${t.key}` : t.kind,
    );
    expect(kinds).toEqual([
      'user',
      'end:proposalDiscarded',
      'user',
      'end:stoppedBeforeChange',
      'user',
      'end:interrupted',
      'user',
      'error',
      'user',
      'proposal',
      'user',
      // A build saved before it had a section list: an interrupted note, never "0/0".
      'end:interrupted',
    ]);
  });

  it('keeps a text-only refusal as the error’s details, with Try again as v1 offered it', () => {
    // «The plan could not be written.» is v1's Plan-mode catch, which settled it retryable.
    const error = legacy().sessions[0]?.turns.find((t): t is ErrorTurn => t.kind === 'error');
    expect(error).toMatchObject({
      failure: { message: 'The plan could not be written.', retryable: true },
      request: 'rewrite the hero',
    });
    expect(error).not.toHaveProperty('errorClass');
    expect(error).not.toHaveProperty('elapsedMs');
  });

  it('reads a plan with no recorded mode as Ask, the v1 default of its time', () => {
    const proposal = legacy().sessions[0]?.turns.find(
      (t): t is ProposalTurn => t.kind === 'proposal',
    );
    expect(proposal).toMatchObject({ mode: 'ask', changes: [] });
    expect(proposal).not.toHaveProperty('elapsedMs');
  });

  it('keeps an empty conversation, untitled, and marks no mode as chosen', () => {
    const state = legacy();
    expect(state.sessions[1]).toEqual({ id: 'session-2', title: '', turns: [], updatedAt: null });
    expect(state).not.toHaveProperty('mode');
    expect(state).not.toHaveProperty('modeChosen');
  });

  it('keeps v1’s rule for data saved before modeChosen: Plan or Auto was chosen, Ask may not be', () => {
    const base = structuredClone(fixtures.legacy);
    expect(migrateV1State({ ...base, mode: 'auto' })?.modeChosen).toBe(true);
    expect(migrateV1State({ ...base, mode: 'plan' })?.modeChosen).toBe(true);
    expect(migrateV1State({ ...base, mode: 'ask' })?.modeChosen).toBeUndefined();
    expect(migrateV1State({ ...base, mode: 'ask', modeChosen: true })?.modeChosen).toBe(true);
    expect(
      migrateV1State({ ...base, mode: 'auto', modeChosen: false })?.modeChosen,
    ).toBeUndefined();
  });

  it.each<[string, unknown]>([
    ['nothing', null],
    ['not an object', 42],
    ['no sessions', { activeId: 'session-1' }],
    ['sessions that are not a list', { sessions: {}, activeId: 'session-1' }],
    ['no active id', { sessions: [] }],
  ])('reads %s as nothing to migrate', (_name, raw) => {
    expect(migrateV1State(raw)).toBeNull();
  });
});

/* ── Storage: read v1, write v2, never write v1 ─────────────────────────── */

describe('loadAgentState', () => {
  const v1Raw = JSON.stringify(fixtures.everyKind);

  it('migrates v1 once, writes it under the v2 key, and never writes the v1 key', () => {
    const { storage, store, writes } = spyStorage({ [V1_SESSIONS_KEY]: v1Raw });
    const loaded = loadAgentState(storage);
    expect(loaded.source).toBe('v1');
    expect(loaded.state).toEqual(migrated());
    expect(writes.map(([key]) => key)).toEqual([SESSIONS_KEY]);
    expect(store.get(V1_SESSIONS_KEY)).toBe(v1Raw);
    expect(JSON.parse(store.get(SESSIONS_KEY) ?? 'null')).toEqual(migrated());
  });

  it('prefers v2 once it exists, and leaves both keys untouched', () => {
    const { storage, writes } = spyStorage({ [V1_SESSIONS_KEY]: v1Raw });
    loadAgentState(storage);
    const second = loadAgentState(storage);
    expect(second.source).toBe('v2');
    expect(second.state).toEqual(migrated());
    expect(writes).toHaveLength(1);
  });

  it('migrates v1 again when the v2 copy is unreadable, rather than losing the history', () => {
    const { storage, writes } = spyStorage({ [V1_SESSIONS_KEY]: v1Raw, [SESSIONS_KEY]: '{broken' });
    const loaded = loadAgentState(storage);
    expect(loaded.source).toBe('v1');
    expect(writes.map(([key]) => key)).toEqual([SESSIONS_KEY]);
  });

  it('never refills an emptied v2 store from v1: deleted conversations stay deleted', () => {
    const emptied = JSON.stringify({ version: 2, sessions: [], activeId: 'session-1' });
    const { storage, writes } = spyStorage({ [V1_SESSIONS_KEY]: v1Raw, [SESSIONS_KEY]: emptied });
    expect(loadAgentState(storage)).toEqual({ state: null, source: 'v2' });
    expect(writes).toEqual([]);
  });

  it('reports nothing saved when neither key holds a conversation', () => {
    expect(loadAgentState(spyStorage().storage)).toEqual({ state: null, source: 'none' });
    expect(loadAgentState(spyStorage({ [V1_SESSIONS_KEY]: 'not json' }).storage)).toEqual({
      state: null,
      source: 'none',
    });
    expect(loadAgentState(undefined)).toEqual({ state: null, source: 'none' });
  });

  it('survives blocked storage: nothing loads, nothing throws', () => {
    expect(loadAgentState(spyStorage({}, true).storage)).toEqual({ state: null, source: 'none' });
  });

  it('still returns the migration when the v2 write is refused (storage full)', () => {
    const { storage } = spyStorage({ [V1_SESSIONS_KEY]: v1Raw });
    const full: AgentStorage = {
      getItem: storage.getItem,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(loadAgentState(full)).toMatchObject({ source: 'v1', state: migrated() });
  });

  it('names the keys exactly', () => {
    expect(V1_SESSIONS_KEY).toBe('pg-assistant-sessions-v1');
    expect(SESSIONS_KEY).toBe('pg-agent-sessions-v2');
  });
});
