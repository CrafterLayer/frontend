/**
 * The RunBar's visible line and the one live region's announcement policy (SPEC §4.3,
 * §6.1), with time passed in. Every timing below is an explicit `now`, so the rules are
 * tested as rules: 4s coalescing, "blocked" once per episode after 10s, the always-
 * announced list, and a clock that no input can make speak. The helpers that pick a
 * moment's key are rendered through the real catalog, so a key whose sentence needs a
 * param the helper did not pass fails here, not in a screen reader.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';

import { tAnnounce } from '../copy';
import {
  ANNOUNCE_POLICY,
  BLOCKED_ANNOUNCE_AFTER_MS,
  blockedOn,
  buildEndAnnouncement,
  editEndAnnouncement,
  INITIAL_ANNOUNCER,
  LANDED_LINE_MS,
  MIN_ANNOUNCE_GAP_MS,
  nextWakeAt,
  reduceAnnouncer,
  runStartAnnouncement,
  visibleStatus,
  type AnnouncerInput,
  type AnnouncerState,
  type BuildEnd,
  type EditEnd,
  type ImmediateAnnouncementKey,
  type RunStart,
  type RunStatusInput,
  type StatusRow,
  type VisibleStatus,
} from './agent-status';
import type {
  AnnouncementKey,
  AnnouncementView,
  BuildPhase,
  BuildStopReason,
  RowState,
  RunActivity,
  StatusKey,
} from './view-types';

/* ── Fixtures ────────────────────────────────────────────────────────────── */

const TITLES = [
  'Header',
  'Hero',
  'Services',
  'Why us',
  'Doctors',
  'Testimonials',
  'FAQ',
  'Contact',
];

/** Rows in page order from a compact state list. */
function rows(...states: readonly RowState[]): readonly StatusRow[] {
  return states.map((state, index) => ({ title: TITLES[index] ?? `S${String(index)}`, state }));
}

function building(
  sectionRows: readonly StatusRow[],
  extra: Partial<Extract<RunStatusInput, { activity: 'build' }>> = {},
): RunStatusInput {
  return { activity: 'build', phase: 'building', rows: sectionRows, stopping: false, ...extra };
}

/** Feeds inputs in order at the given times and collects everything spoken. */
function drive(
  steps: readonly (readonly [number, AnnouncerInput])[],
  from: AnnouncerState = INITIAL_ANNOUNCER,
): {
  readonly state: AnnouncerState;
  readonly spoken: readonly (AnnouncementView & { at: number })[];
} {
  let state = from;
  const spoken: (AnnouncementView & { at: number })[] = [];
  for (const [at, input] of steps) {
    const step = reduceAnnouncer(state, input, at);
    state = step.state;
    if (step.speak !== null) spoken.push({ ...step.speak, at });
  }
  return { state, spoken };
}

const landed = (done: number, total = 8): AnnouncerInput => ({ type: 'landed', done, total });
const tick: AnnouncerInput = { type: 'tick' };
const status = (s: VisibleStatus | null): AnnouncerInput => ({ type: 'status', status: s });
const blockedStatus = (title: string): VisibleStatus => ({
  statusKey: 'build.blocked',
  params: { title },
});

/* ── Visible status (the RunBar's line) ──────────────────────────────────── */

describe('visibleStatus: the RunBar line (SPEC §4.3 visible column)', () => {
  it('reads the request before the intent is known', () => {
    expect(visibleStatus({ activity: 'routing', stopping: false }, 0)).toEqual({
      statusKey: 'run.understanding',
      params: {},
    });
  });

  it('says "Laying out the page…" through the skeleton pass', () => {
    const run: RunStatusInput = { activity: 'build', phase: 'skeleton', rows: [], stopping: false };
    expect(visibleStatus(run, 0)).toEqual({ statusKey: 'build.started', params: {} });
  });

  it('counts the sections being written, never the drafted or landed ones (SPEC §3.4)', () => {
    // §3.4: 1 landed; writers on 2, 3, 5, 6; 4 drafted; 7, 8 waiting → "Writing 4 sections".
    const run = building(
      rows('landed', 'writing', 'writing', 'drafted', 'writing', 'writing', 'waiting', 'waiting'),
    );
    expect(visibleStatus(run, 100_000)).toEqual({ statusKey: 'build.writing', params: { n: 4 } });
  });

  it('counts a second attempt as a section being written', () => {
    const run = building(rows('landed', 'retrying', 'writing', 'waiting'));
    expect(visibleStatus(run, 0)).toEqual({ statusKey: 'build.writing', params: { n: 2 } });
  });

  it('matches §3.9: 5 landed, 6 and 8 writing, 7 drafted is not blocked → "Writing 2 sections"', () => {
    const run = building(
      rows('landed', 'landed', 'landed', 'landed', 'landed', 'writing', 'drafted', 'writing'),
    );
    expect(visibleStatus(run, 0)).toEqual({ statusKey: 'build.writing', params: { n: 2 } });
  });

  it('announces the laid-out count before any writer has started', () => {
    const run = building(rows('waiting', 'waiting', 'waiting'));
    expect(visibleStatus(run, 0)).toEqual({ statusKey: 'build.planned', params: { n: 3 } });
  });

  it('shows "{title} is on the page" for 2.4s after a landing, then returns to writing', () => {
    const run = building(rows('landed', 'landed', 'writing', 'waiting'), {
      lastLanding: { title: 'Hero', at: 10_000 },
    });
    expect(visibleStatus(run, 10_000)).toEqual({
      statusKey: 'build.landed',
      params: { title: 'Hero' },
    });
    expect(visibleStatus(run, 10_000 + LANDED_LINE_MS - 1).statusKey).toBe('build.landed');
    expect(visibleStatus(run, 10_000 + LANDED_LINE_MS)).toEqual({
      statusKey: 'build.writing',
      params: { n: 1 },
    });
    expect(LANDED_LINE_MS).toBe(2_400);
  });

  it('says "Waiting on {title}…" while exactly one writer holds back a drafted section (SPEC §3.4)', () => {
    const run = building(rows('landed', 'writing', 'drafted', 'drafted'));
    expect(visibleStatus(run, 0)).toEqual({
      statusKey: 'build.blocked',
      params: { title: 'Hero' },
    });
  });

  it('keeps stopping above everything, for every activity', () => {
    const activities: readonly RunStatusInput[] = [
      { activity: 'routing', stopping: true },
      { activity: 'plan', stopping: true },
      { activity: 'proposal', stopping: true },
      { activity: 'answer', stopping: true },
      { activity: 'edit', stage: 'edit.checking', stopping: true },
      building(rows('landed', 'writing', 'drafted'), {
        stopping: true,
        lastLanding: { title: 'Header', at: 0 },
      }),
      { activity: 'build', phase: 'stopping', rows: rows('writing'), stopping: false },
    ];
    for (const run of activities) {
      expect(visibleStatus(run, 0)).toEqual({ statusKey: 'stopping', params: {} });
    }
  });

  it('maps an edit to its stage phrase, never the provider narration (SPEC §4.9)', () => {
    for (const stage of [
      'run.understanding',
      'edit.started',
      'edit.writing',
      'edit.checking',
      'edit.repairing',
      'edit.applying',
    ] as const) {
      expect(visibleStatus({ activity: 'edit', stage, stopping: false }, 0)).toEqual({
        statusKey: stage,
        params: {},
      });
    }
  });

  it('gives plans, proposals and answers their drafting line', () => {
    expect(visibleStatus({ activity: 'plan', stopping: false }, 0).statusKey).toBe('plan.drafting');
    expect(visibleStatus({ activity: 'proposal', stopping: false }, 0).statusKey).toBe(
      'proposal.drafting',
    );
    expect(visibleStatus({ activity: 'answer', stopping: false }, 0).statusKey).toBe(
      'run.understanding',
    );
  });

  it('keeps the last landing when nothing is left in flight, instead of "Writing 0 sections"', () => {
    const run = building(rows('landed', 'landed', 'failed'), {
      lastLanding: { title: 'Hero', at: 0 },
    });
    expect(visibleStatus(run, 60_000)).toEqual({
      statusKey: 'build.landed',
      params: { title: 'Hero' },
    });
  });

  it('counts only the rows in the writing state, never the waiting or drafted ones', () => {
    // The dark café at 5:32: row 4 writing, row 5 waiting → one section, never «قسمان».
    const one = building(rows('landed', 'landed', 'landed', 'writing', 'waiting'));
    expect(visibleStatus(one, 60_000)).toEqual({ statusKey: 'build.writing', params: { n: 1 } });
    // No writer at all between two pickups: the rows hold no writing count to report.
    const between = building(rows('landed', 'drafted', 'waiting'), {
      lastLanding: { title: 'Hero', at: 0 },
    });
    expect(visibleStatus(between, 60_000)).toEqual({
      statusKey: 'build.landed',
      params: { title: 'Hero' },
    });
    expect(visibleStatus(building(rows('landed', 'waiting', 'waiting')), 60_000)).toEqual({
      statusKey: 'build.writing',
      params: { n: 1 },
    });
  });

  it('never returns a zero count', () => {
    const settled = building(rows('landed', 'failed'));
    const line = visibleStatus(settled, 0);
    expect(line.params['n']).not.toBe(0);
  });
});

describe('blockedOn: the one section the whole build waits on', () => {
  it.each<[string, readonly RowState[], string | null]>([
    ['one writer, a drafted section after it', ['landed', 'writing', 'drafted'], 'Hero'],
    ['one retrying writer, drafted after it', ['retrying', 'waiting', 'drafted'], 'Header'],
    ['two writers', ['writing', 'writing', 'drafted'], null],
    ['one writer, nothing drafted after it', ['drafted', 'writing', 'waiting'], null],
    ['no writer at all', ['landed', 'drafted'], null],
    ['one writer, drafted only before it', ['landed', 'drafted', 'writing'], null],
  ])('%s', (_name, states, expected) => {
    expect(blockedOn(rows(...states))).toBe(expected);
  });
});

/* ── Announcements (the one live region) ─────────────────────────────────── */

describe('ANNOUNCE_POLICY: every announced key has exactly one rule', () => {
  it('announces everything at once except the coalesced progress and the delayed blocked line', () => {
    const deferred = Object.entries(ANNOUNCE_POLICY)
      .filter(([, rule]) => rule !== 'immediate')
      .map(([key, rule]) => `${key}:${rule}`);
    expect(deferred.sort()).toEqual(['build.blocked:afterEpisode', 'build.progress:coalesced']);
  });

  it('covers SPEC §4.3 "Always announced, at once" by key', () => {
    // run start, page laid out, plan ready, proposal ready, answer ready, done, partial,
    // stopping, stopped, failed, undone, queued, queue started.
    const always: readonly AnnouncementKey[] = [
      'build.started',
      'edit.started',
      'plan.drafting',
      'proposal.drafting',
      'build.planned',
      'plan.ready',
      'proposal.ready',
      'answer.ready',
      'build.done',
      'edit.done',
      'edit.noChange',
      'build.partial',
      'stopping',
      'stopped',
      'stopped.none',
      'stopped.budget',
      'stopped.maxTasks',
      'failed',
      'failed.kept',
      'undone',
      'queue.queued',
      'queue.started',
    ];
    for (const key of always) expect(ANNOUNCE_POLICY[key]).toBe('immediate');
  });

  it('keeps visible-only lines out of the announced vocabulary, clock and estimate included', () => {
    expectTypeOf<'edit.writing'>().not.toExtend<AnnouncementKey>();
    expectTypeOf<'edit.checking'>().not.toExtend<AnnouncementKey>();
    expectTypeOf<'run.understanding'>().not.toExtend<AnnouncementKey>();
    expectTypeOf<'build.landed'>().not.toExtend<AnnouncementKey>();
    expectTypeOf<'build.remaining.minutes'>().not.toExtend<AnnouncementKey>();
    expectTypeOf<'build.progress'>().not.toExtend<ImmediateAnnouncementKey>();
    expectTypeOf<'build.blocked'>().not.toExtend<ImmediateAnnouncementKey>();
    const visibleOnly = [
      'run.understanding',
      'build.writing',
      'build.landed',
      'edit.writing',
      'edit.checking',
      'edit.repairing',
      'edit.applying',
    ];
    for (const key of visibleOnly) expect(Object.keys(ANNOUNCE_POLICY)).not.toContain(key);
  });
});

describe('reduceAnnouncer: immediate keys', () => {
  it('speaks an always-announced key at once, with its params, and raises seq', () => {
    const { spoken } = drive([
      [0, { type: 'say', key: 'build.started' }],
      [5, { type: 'say', key: 'build.planned', params: { n: 8 } }],
    ]);
    expect(spoken).toEqual([
      { key: 'build.started', params: {}, seq: 1, at: 0 },
      { key: 'build.planned', params: { n: 8 }, seq: 2, at: 5 },
    ]);
  });

  it('speaks the same sentence twice when it happens twice (a new seq each time)', () => {
    const { spoken } = drive([
      [0, { type: 'say', key: 'queue.already' }],
      [100, { type: 'say', key: 'queue.already' }],
    ]);
    expect(spoken.map((s) => s.seq)).toEqual([1, 2]);
  });

  it('never delays an immediate key behind the coalescing window', () => {
    const { spoken } = drive([
      [0, landed(1)],
      [500, { type: 'say', key: 'stopping' }],
      [900, { type: 'say', key: 'queue.queued' }],
    ]);
    expect(spoken.map((s) => [s.key, s.at])).toEqual([
      ['build.progress', 0],
      ['stopping', 500],
      ['queue.queued', 900],
    ]);
  });
});

describe('reduceAnnouncer: section landings are coalesced (4s, newest count)', () => {
  it('speaks the first landing at once', () => {
    const { spoken } = drive([[1_000, landed(1)]]);
    expect(spoken).toEqual([
      { key: 'build.progress', params: { done: 1, total: 8 }, seq: 1, at: 1_000 },
    ]);
  });

  it('holds landings inside the window and speaks only the newest count when it opens', () => {
    const { spoken, state } = drive([
      [0, landed(1)],
      [300, landed(2)],
      [900, landed(3)],
      [2_000, landed(4)],
    ]);
    expect(spoken.map((s) => s.params)).toEqual([{ done: 1, total: 8 }]);
    expect(nextWakeAt(state)).toBe(MIN_ANNOUNCE_GAP_MS);
    const later = drive(
      [
        [MIN_ANNOUNCE_GAP_MS - 1, tick],
        [MIN_ANNOUNCE_GAP_MS, tick],
      ],
      state,
    );
    expect(later.spoken).toEqual([
      { key: 'build.progress', params: { done: 4, total: 8 }, seq: 2, at: MIN_ANNOUNCE_GAP_MS },
    ]);
    expect(nextWakeAt(later.state)).toBeNull();
    expect(MIN_ANNOUNCE_GAP_MS).toBe(4_000);
  });

  it('never speaks two progress announcements less than 4s apart, over a burst of 8 landings', () => {
    const steps: (readonly [number, AnnouncerInput])[] = [];
    for (let done = 1; done <= 8; done += 1) steps.push([done * 700, landed(done)]);
    for (let at = 0; at <= 20_000; at += 250) steps.push([at, tick]);
    steps.sort((a, b) => a[0] - b[0]);
    const { spoken } = drive(steps);
    const progress = spoken.filter((s) => s.key === 'build.progress');
    for (let i = 1; i < progress.length; i += 1) {
      const gap = (progress[i]?.at ?? 0) - (progress[i - 1]?.at ?? 0);
      expect(gap).toBeGreaterThanOrEqual(MIN_ANNOUNCE_GAP_MS);
    }
    // The newest count is always the one that reaches the listener last.
    expect(progress.at(-1)?.params).toEqual({ done: 8, total: 8 });
  });

  it('waits 4s after ANY announcement, so a count never cuts off "Page laid out"', () => {
    const { spoken, state } = drive([
      [0, { type: 'say', key: 'build.planned', params: { n: 8 } }],
      [1_000, landed(1)],
    ]);
    expect(spoken.map((s) => s.key)).toEqual(['build.planned']);
    expect(nextWakeAt(state)).toBe(4_000);
  });

  it('drops a held count when the build settles: "Page built" is the final count', () => {
    const { spoken, state } = drive([
      [0, landed(7)],
      [1_000, landed(8)],
      [1_200, { type: 'say', key: 'build.done', params: { n: 8 } }],
      [10_000, tick],
    ]);
    expect(spoken.map((s) => s.key)).toEqual(['build.progress', 'build.done']);
    expect(nextWakeAt(state)).toBeNull();
  });

  it('keeps a held count across a non-final announcement and speaks it 4s after that one', () => {
    const { spoken } = drive([
      [0, landed(1)],
      [1_000, landed(2)],
      [2_000, { type: 'say', key: 'queue.queued' }],
      [4_000, tick],
      [6_000, tick],
    ]);
    expect(spoken.map((s) => [s.key, s.at])).toEqual([
      ['build.progress', 0],
      ['queue.queued', 2_000],
      ['build.progress', 6_000],
    ]);
  });
});

describe('reduceAnnouncer: "blocked" once per episode, after 10s', () => {
  it('says nothing for the first 10s of a blocked episode, then says it once', () => {
    const { spoken, state } = drive([
      [0, status(blockedStatus('Hero'))],
      [9_999, tick],
      [10_000, tick],
      [15_000, tick],
      [30_000, status(blockedStatus('Hero'))],
      [45_000, tick],
    ]);
    expect(spoken).toEqual([
      { key: 'build.blocked', params: { title: 'Hero' }, seq: 1, at: 10_000 },
    ]);
    expect(nextWakeAt(state)).toBeNull();
    expect(BLOCKED_ANNOUNCE_AFTER_MS).toBe(10_000);
  });

  it('asks the hook to wake exactly when the episode turns 10s old', () => {
    const { state } = drive([[2_000, status(blockedStatus('Hero'))]]);
    expect(nextWakeAt(state)).toBe(12_000);
  });

  it('says nothing for an episode shorter than 10s', () => {
    const { spoken, state } = drive([
      [0, status(blockedStatus('Hero'))],
      [9_000, status({ statusKey: 'build.writing', params: { n: 3 } })],
      [20_000, tick],
    ]);
    expect(spoken).toEqual([]);
    expect(nextWakeAt(state)).toBeNull();
  });

  it('starts a new episode when the build unblocks and blocks again', () => {
    const { spoken } = drive([
      [0, status(blockedStatus('Hero'))],
      [10_000, tick],
      [12_000, status({ statusKey: 'build.landed', params: { title: 'Hero' } })],
      [14_000, status(blockedStatus('Services'))],
      [24_000, tick],
    ]);
    expect(spoken.map((s) => [s.params['title'], s.at])).toEqual([
      ['Hero', 10_000],
      ['Services', 24_000],
    ]);
  });

  it('treats a different section as a different episode', () => {
    const { spoken } = drive([
      [0, status(blockedStatus('Hero'))],
      [5_000, status(blockedStatus('Services'))],
      [10_000, tick],
      [15_000, tick],
    ]);
    expect(spoken.map((s) => [s.params['title'], s.at])).toEqual([['Services', 15_000]]);
  });

  it('ends the episode when the RunBar leaves or the run settles', () => {
    const left = drive([
      [0, status(blockedStatus('Hero'))],
      [3_000, status(null)],
      [20_000, tick],
    ]);
    expect(left.spoken).toEqual([]);
    const settled = drive([
      [0, status(blockedStatus('Hero'))],
      [3_000, { type: 'say', key: 'stopped', params: { n: 1 } }],
      [20_000, tick],
    ]);
    expect(settled.spoken.map((s) => s.key)).toEqual(['stopped']);
  });

  it('holds a due blocked line 4s behind the previous announcement', () => {
    const { spoken } = drive([
      [0, status(blockedStatus('Hero'))],
      [8_000, { type: 'say', key: 'queue.queued' }],
      [10_000, tick],
      [12_000, tick],
    ]);
    expect(spoken.map((s) => [s.key, s.at])).toEqual([
      ['queue.queued', 8_000],
      ['build.blocked', 12_000],
    ]);
  });
});

describe('reduceAnnouncer: the clock is never announced', () => {
  it('stays silent through a whole run of ticks and visible-only status changes', () => {
    const steps: (readonly [number, AnnouncerInput])[] = [];
    const visibleOnly: readonly StatusKey[] = [
      'run.understanding',
      'build.started',
      'build.planned',
      'build.writing',
      'build.landed',
      'stopping',
      'edit.started',
      'edit.writing',
      'edit.checking',
      'edit.repairing',
      'edit.applying',
      'plan.drafting',
      'proposal.drafting',
    ];
    let at = 0;
    for (let second = 0; second < 600; second += 1) {
      at = second * 1_000;
      const key = visibleOnly[second % visibleOnly.length] ?? 'run.understanding';
      steps.push([at, status({ statusKey: key, params: { n: 2, title: 'Hero' } })]);
      steps.push([at + 500, tick]);
    }
    expect(drive(steps).spoken).toEqual([]);
  });

  it('wakes for nothing when nothing is deferred', () => {
    expect(nextWakeAt(INITIAL_ANNOUNCER)).toBeNull();
    expect(drive([[0, tick]]).spoken).toEqual([]);
  });
});

/* ── Which key a moment speaks ───────────────────────────────────────────── */

describe('runStartAnnouncement', () => {
  it.each<[RunStart, AnnouncementKey | null]>([
    [{ activity: 'routing' }, null],
    [{ activity: 'build' }, 'build.started'],
    [{ activity: 'edit', target: 'Hero' }, 'edit.started'],
    [{ activity: 'plan' }, 'plan.drafting'],
    [{ activity: 'proposal' }, 'proposal.drafting'],
    [{ activity: 'answer' }, null],
  ])('%j → %s', (start, key) => {
    expect(runStartAnnouncement(start)?.key ?? null).toBe(key);
  });

  it('names the edit target', () => {
    expect(runStartAnnouncement({ activity: 'edit', target: 'Hero' })).toEqual({
      key: 'edit.started',
      params: { target: 'Hero' },
    });
  });

  it('never speaks "Started editing {target}" without a target: a page-wide edit has its own key', () => {
    // A page-wide edit has no target (EditTurn.target is optional). "edit.started" with
    // `{}` threw in development and read "Started editing " in production.
    for (const target of [null, '', '   ']) {
      expect(runStartAnnouncement({ activity: 'edit', target })).toEqual({
        key: 'edit.startedPage',
        params: {},
      });
    }
    expect(tAnnounce('en', 'edit.startedPage')).toBe('Started editing the page');
    expect(tAnnounce('ar', 'edit.startedPage')).toBe('بدأ تعديل الصفحة');
  });

  it('makes the caller say whether an edit has a target', () => {
    // @ts-expect-error an edit start must pass `target`, `null` for a page-wide edit
    runStartAnnouncement({ activity: 'edit' });
    expectTypeOf<Extract<RunStart, { activity: 'edit' }>['target']>().toEqualTypeOf<
      string | null
    >();
  });
});

describe('editEndAnnouncement', () => {
  it.each<[string, EditEnd, unknown]>([
    [
      'done names the target',
      { status: 'done', target: 'Hero' },
      { key: 'edit.done', params: { target: 'Hero' } },
    ],
    [
      'no change names the target',
      { status: 'noChange', target: 'Hero' },
      { key: 'edit.noChange', params: { target: 'Hero' } },
    ],
    [
      // An edit lands in one transaction, so a stopped one changed nothing (SPEC §4.9).
      'stopped: the page was not changed',
      { status: 'stopped', target: 'Hero' },
      { key: 'stopped.none', params: {} },
    ],
    [
      'a page-wide stop still speaks: its sentence needs no target',
      { status: 'stopped', target: null },
      { key: 'stopped.none', params: {} },
    ],
    [
      'a page-wide done says the page was updated',
      { status: 'done', target: null },
      { key: 'edit.donePage', params: {} },
    ],
    [
      'a page-wide no change says nothing changed on the page',
      { status: 'noChange', target: '' },
      { key: 'edit.noChangePage', params: {} },
    ],
  ])('%s', (_name, input, expected) => {
    expect(editEndAnnouncement(input)).toEqual(expected);
  });
});

describe('buildEndAnnouncement', () => {
  it.each<[string, BuildEnd, unknown]>([
    [
      'done only when every section landed',
      { phase: 'done', landed: 8, total: 8, skeleton: false },
      { key: 'build.done', params: { n: 8 } },
    ],
    [
      'a "done" with a section missing is partial, never "Page built"',
      { phase: 'done', landed: 7, total: 8, skeleton: true },
      { key: 'build.partial', params: { n: 1 } },
    ],
    [
      'partial counts the failed sections',
      { phase: 'partial', landed: 5, total: 8, skeleton: true },
      { key: 'build.partial', params: { n: 3 } },
    ],
    [
      'stopped by the person with sections on the page',
      { phase: 'stopped', stopReason: 'signal', landed: 5, total: 8, skeleton: true },
      { key: 'stopped', params: { n: 5 } },
    ],
    [
      'stopped before the skeleton reached the page: the page was not changed',
      { phase: 'stopped', stopReason: 'signal', landed: 0, total: 8, skeleton: false },
      { key: 'stopped.none', params: {} },
    ],
    [
      'stopped after the skeleton, before any section: the empty layout is on the page',
      { phase: 'stopped', stopReason: 'signal', landed: 0, total: 8, skeleton: true },
      { key: 'stopped', params: { n: 0 } },
    ],
    [
      'stopped with no reason recorded reads as the person',
      { phase: 'stopped', landed: 2, total: 8, skeleton: true },
      { key: 'stopped', params: { n: 2 } },
    ],
    [
      'the time budget',
      { phase: 'stopped', stopReason: 'budget', landed: 4, total: 8, skeleton: true },
      { key: 'stopped.budget', params: { n: 4 } },
    ],
    [
      'the time budget after the skeleton, before any section: the layout is named',
      { phase: 'stopped', stopReason: 'budget', landed: 0, total: 8, skeleton: true },
      { key: 'stopped.budget', params: { n: 0 } },
    ],
    [
      'the time budget before the skeleton reached the page: the page was not changed',
      { phase: 'stopped', stopReason: 'budget', landed: 0, total: 8, skeleton: false },
      { key: 'stopped.budget.none', params: {} },
    ],
    [
      'the section limit',
      { phase: 'stopped', stopReason: 'maxTasks', landed: 12, total: 14, skeleton: true },
      { key: 'stopped.maxTasks', params: {} },
    ],
    [
      'failed before the skeleton reached the page: the page was not changed',
      { phase: 'failed', landed: 0, total: 8, skeleton: false },
      { key: 'failed', params: {} },
    ],
    [
      'failed after the skeleton, before any section: the page has empty sections',
      { phase: 'failed', landed: 0, total: 8, skeleton: true },
      { key: 'failed.skeleton', params: {} },
    ],
    [
      'failed after some sections landed',
      { phase: 'failed', landed: 3, total: 8, skeleton: true },
      { key: 'failed.kept', params: {} },
    ],
  ])('%s', (_name, input, expected) => {
    expect(buildEndAnnouncement(input)).toEqual(expected);
  });

  it('says nothing for a phase that is not an ending', () => {
    for (const phase of ['skeleton', 'building', 'stopping', 'interrupted', 'undone'] as const) {
      expect(buildEndAnnouncement({ phase, landed: 1, total: 8, skeleton: true })).toBeNull();
    }
  });

  it('never tells the listener the page is unchanged while the skeleton is on it', () => {
    for (const phase of PHASES) {
      for (const stopReason of STOP_REASONS) {
        const said = buildEndAnnouncement({
          phase,
          stopReason,
          landed: 0,
          total: 8,
          skeleton: true,
        });
        if (said === null) continue;
        expect(tAnnounce('en', said.key, said.params)).not.toMatch(/wasn't changed/u);
        expect(tAnnounce('ar', said.key, said.params)).not.toMatch(/لم تتغيّر/u);
        // Nothing landed, so nothing "completed" either: the empty layout is what is there.
        if (phase === 'stopped' && stopReason !== 'maxTasks') {
          expect(tAnnounce('en', said.key, said.params)).toMatch(/empty layout/u);
          expect(tAnnounce('ar', said.key, said.params)).toMatch(/الهيكل الفارغ/u);
        }
        if (phase === 'failed') expect(said.key).toBe('failed.skeleton');
      }
    }
  });
});

/* ── Every key these helpers return renders in both catalogs ─────────────── */

const PHASES = Object.keys({
  skeleton: true,
  building: true,
  done: true,
  partial: true,
  stopping: true,
  stopped: true,
  interrupted: true,
  failed: true,
  undone: true,
} satisfies Record<BuildPhase, true>) as readonly BuildPhase[];

const STOP_REASONS: readonly (BuildStopReason | undefined)[] = [
  undefined,
  'signal',
  'budget',
  'maxTasks',
];

const ACTIVITIES = Object.keys({
  routing: true,
  build: true,
  edit: true,
  plan: true,
  proposal: true,
  answer: true,
} satisfies Record<RunActivity, true>) as readonly RunActivity[];

function everyRunStart(): readonly RunStart[] {
  return ACTIVITIES.flatMap((activity): RunStart[] =>
    activity === 'edit'
      ? [
          { activity, target: 'Hero' },
          { activity, target: null },
          { activity, target: '' },
        ]
      : [{ activity }],
  );
}

function everyBuildEnd(): readonly BuildEnd[] {
  const counts: readonly (readonly [number, number])[] = [
    [0, 0],
    [0, 1],
    [0, 8],
    [1, 1],
    [1, 8],
    [5, 8],
    [8, 8],
  ];
  return PHASES.flatMap((phase) =>
    STOP_REASONS.flatMap((stopReason) =>
      counts.flatMap(([landedCount, total]) =>
        [false, true].map((skeleton) => ({
          phase,
          stopReason,
          landed: landedCount,
          total,
          skeleton,
        })),
      ),
    ),
  );
}

function everyEditEnd(): readonly EditEnd[] {
  return (['done', 'noChange', 'stopped'] as const).flatMap((endStatus) =>
    ['Hero', null, ''].map((target) => ({ status: endStatus, target })),
  );
}

describe('the helpers and the catalog agree', () => {
  const said = [
    ...everyRunStart().map(runStartAnnouncement),
    ...everyBuildEnd().map(buildEndAnnouncement),
    ...everyEditEnd().map(editEndAnnouncement),
  ].filter((announcement) => announcement !== null);

  it('covers every ending and start key the helpers can return', () => {
    expect(new Set(said.map((announcement) => announcement.key))).toEqual(
      new Set<AnnouncementKey>([
        'build.started',
        'edit.started',
        'edit.startedPage',
        'plan.drafting',
        'proposal.drafting',
        'build.done',
        'build.partial',
        'stopped',
        'stopped.none',
        'stopped.budget',
        'stopped.budget.none',
        'stopped.maxTasks',
        'failed',
        'failed.kept',
        'failed.skeleton',
        'edit.done',
        'edit.donePage',
        'edit.noChange',
        'edit.noChangePage',
      ]),
    );
  });

  it.each(['ar', 'en'] as const)(
    'renders every result through tAnnounce in %s: no missing param, no empty slot',
    (locale) => {
      for (const { key, params } of said) {
        // tAnnounce throws in tests on a missing param, naming the key and the slot.
        const text = tAnnounce(locale, key, params);
        expect(text.trim()).not.toBe('');
        expect(text).not.toMatch(/[{}]/u);
        expect(text).not.toMatch(/«\s*»|\s{2}|\s$/u);
      }
    },
  );
});
