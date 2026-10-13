/**
 * The v2 conversation model (SPEC §7.4 `AssistantPanel.turns.ts` row): the kept helpers
 * (`highestIdSuffix`, `withUniqueTurnIds`; `historyOf` is in conversation-memory.test), the
 * revive rules, and the storage read. Revival is where the old panel lied most: a spinner nothing would ever
 * resolve, an Undo whose kernel history died with the tab, an Apply with no authority
 * behind it. Every rule below is one of those, closed.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';

import type { AiPlan, AiRunFailure, AiValidatedProposal } from '@craftkit/builder';

import { clinicPlan } from '../testing/page-plans';
import type { BuildProgress, BuildTask } from './build-progress';
import type { BuildRecordInput, ErrorRecordInput, SectionOutcome } from './run-view';
import {
  answerFromPlan,
  highestIdSuffix,
  outcomeKeyOf,
  reviveState,
  reviveTurn,
  SESSIONS_KEY,
  sessionSummaries,
  titleOf,
  withUniqueTurnIds,
  type BuildTurn,
  type EditTurn,
  type ErrorTurn,
  type LandingOutcome,
  type PagePlanTurn,
  type ProposalTurn,
  type Session,
  type Turn,
} from './turns';
import { TURN_KINDS, type ErrorPageState, type TurnKind } from './view-types';
import { telemetryTotals } from './run-telemetry';

/* ── Fixtures ────────────────────────────────────────────────────────────── */

function task(
  position: number,
  status: BuildTask['status'],
  extra: Partial<BuildTask> = {},
): BuildTask {
  return {
    id: `n${String(position)}`,
    title: `Section ${String(position)}`,
    position,
    status,
    attempts: status === 'waiting' ? 0 : 1,
    ...extra,
  };
}

function progress(tasks: readonly BuildTask[], extra: Partial<BuildProgress> = {}): BuildProgress {
  return {
    runId: 'run-1',
    phase: 'building',
    direction: 'Calm, clinical, teal.',
    tasks,
    startedAt: 1_000,
    writers: 3,
    skeleton: null,
    report: null,
    lastEventAt: 9_000,
    ...extra,
  };
}

function build(extra: Partial<BuildTurn> = {}): BuildTurn {
  return {
    id: 'turn-2',
    kind: 'build',
    request: 'A dental clinic page',
    progress: progress([task(1, 'landed'), task(2, 'writing'), task(3, 'waiting')]),
    status: 'running',
    outcomes: {},
    ...extra,
  };
}

const plan: AiPlan = { rationale: 'Make the header sticky.', commands: [] };

/** A structural stand-in for the runtime authority; its absence is what revival proves. */
const authority: AiValidatedProposal = {
  schemaVersion: 1,
  plan,
  policy: { allowedCommands: [], maxCommands: 0, maxOperations: 0 },
  skillActivations: [],
  contextFingerprint: 'sha256-context',
  proposalFingerprint: 'sha256-proposal',
};

const failure: AiRunFailure = {
  source: 'provider',
  code: 'http-status',
  message: 'The assistant server answered with status 429.',
  retryable: true,
  status: 429,
};

function session(turns: readonly Turn[], id = 'session-1'): Session {
  return { id, title: 'A dental clinic page', turns, updatedAt: 1_790_000_000_000 };
}

/* ── The union ───────────────────────────────────────────────────────────── */

describe('Turn: the v2 union (SPEC §7.4)', () => {
  it('has exactly the nine v2 kinds, the same ones the views render', () => {
    expectTypeOf<Turn['kind']>().toEqualTypeOf<TurnKind>();
    expect(TURN_KINDS).toHaveLength(9);
  });

  it('deletes progressLog and costTokens, and replaces undoneFrom/undoneSteps', () => {
    type Keys = { [K in Turn['kind']]: keyof Extract<Turn, { kind: K }> }[Turn['kind']];
    expectTypeOf<'progressLog'>().not.toExtend<Keys>();
    expectTypeOf<'costTokens'>().not.toExtend<Keys>();
    expectTypeOf<'undoneFrom'>().not.toExtend<Keys>();
    expectTypeOf<'undoneSteps'>().not.toExtend<Keys>();
    expectTypeOf<'outcomes'>().toExtend<Keys>();
  });

  it('lets an error say it does not know the page, in the view’s own vocabulary', () => {
    // `unknown` is v1's build-path refusal: what landed before it was never kept. It is a
    // member of the view's `ErrorPageState`, so the stored state renders as it is.
    expectTypeOf<ErrorTurn['pageState']>().toEqualTypeOf<ErrorPageState>();
    expectTypeOf<{ readonly kind: 'unknown' }>().toExtend<ErrorPageState>();
    const stored: ErrorTurn = {
      id: 'e',
      kind: 'error',
      failure: { source: 'provider', code: 'network', message: 'x', retryable: true },
      pageState: { kind: 'unknown' },
    };
    const input: ErrorRecordInput = {
      turnId: stored.id,
      failure: stored.failure,
      pageState: stored.pageState,
    };
    expect(input.pageState).toEqual({ kind: 'unknown' });
  });

  it('keeps no error class beside the failure: the record reads it from the failure', () => {
    type Keys = keyof ErrorTurn;
    expectTypeOf<'errorClass'>().not.toExtend<Keys>();
  });

  it('writes to its own key, never the v1 one', () => {
    expect(SESSIONS_KEY).toBe('pg-agent-sessions-v2');
  });
});

/* ── Kept helpers ────────────────────────────────────────────────────────── */

describe('highestIdSuffix', () => {
  it('reads the highest numeric suffix across sessions and turns', () => {
    const sessions = [
      session([{ id: 'turn-3', kind: 'user', text: 'a', context: [] }], 'session-7'),
      session([{ id: 'turn-12', kind: 'end', key: 'interrupted' }], 'session-2'),
    ];
    expect(highestIdSuffix(sessions)).toBe(12);
  });

  it('is 1 with nothing numbered, so the next id is 2', () => {
    expect(highestIdSuffix([])).toBe(1);
    expect(highestIdSuffix([session([], 'first')])).toBe(1);
  });
});

describe('withUniqueTurnIds', () => {
  it('re-keys the later twin above every id in use, and keeps the first', () => {
    const repaired = withUniqueTurnIds([
      session([
        { id: 'turn-2', kind: 'user', text: 'make it blue', context: [] },
        { id: 'turn-2', kind: 'end', key: 'proposalDiscarded' },
        { id: 'turn-5', kind: 'user', text: 'again', context: [] },
      ]),
    ]);
    expect(repaired[0]?.turns.map((turn) => turn.id)).toEqual(['turn-2', 'turn-6', 'turn-5']);
  });

  it('returns turns unchanged when every id is already unique', () => {
    const turns: readonly Turn[] = [
      { id: 'turn-2', kind: 'user', text: 'a', context: [] },
      { id: 'turn-3', kind: 'end', key: 'interrupted' },
    ];
    expect(withUniqueTurnIds([session(turns)])[0]?.turns).toEqual(turns);
  });
});

describe('answerFromPlan: a plan with words and no command is an answer', () => {
  /*
    «can you link the page in here on it»: the model understood nothing, proposed no
    command and asked back in a follow-up. It was recorded as "No change to the page. It
    already matched what you asked for.", a false claim. `edit.noChange` is for commands
    that landed and moved nothing; words alone are an answer.
  */
  it('records the rationale as the answer, and keeps the follow-up to send next', () => {
    const plan: AiPlan = {
      rationale: 'Which page should the link open?',
      commands: [],
      followUp: 'Link the Book button to the Contact page',
    };
    expect(answerFromPlan({ id: 'turn-4', request: 'link the page in here', plan })).toEqual({
      id: 'turn-4',
      kind: 'answer',
      text: 'Which page should the link open?',
      request: 'link the page in here',
      followUp: 'Link the Book button to the Contact page',
    });
  });

  it('answers with the follow-up when the rationale is empty', () => {
    const plan: AiPlan = { rationale: '  ', commands: [], followUp: 'Which page?' };
    expect(answerFromPlan({ id: 'turn-4', plan })).toMatchObject({
      kind: 'answer',
      text: 'Which page?',
    });
  });

  it('is not an answer when the plan proposed a command, or said nothing at all', () => {
    const acting: AiPlan = {
      rationale: 'Recolour the heading.',
      commands: [{ command: 'setProp', args: { id: 'h', key: 'color', value: 'blue' } }],
    };
    expect(answerFromPlan({ id: 'turn-4', plan: acting })).toBeNull();
    expect(answerFromPlan({ id: 'turn-4', plan: { rationale: '', commands: [] } })).toBeNull();
  });
});

describe('titleOf and sessionSummaries: the conversations list (SPEC §4.18)', () => {
  it('titles a conversation with its first request, whole', () => {
    const turns: readonly Turn[] = [
      { id: 't1', kind: 'end', key: 'interrupted' },
      {
        id: 't2',
        kind: 'user',
        text: '  A dental clinic in Amman with WhatsApp booking ',
        context: [],
      },
      { id: 't3', kind: 'user', text: 'Make the hero dark', context: [] },
    ];
    expect(titleOf(turns)).toBe('A dental clinic in Amman with WhatsApp booking');
    expect(titleOf([])).toBe('');
  });

  it('lists every conversation with its time, and marks only the open one current', () => {
    const sessions: readonly Session[] = [
      session([], 'session-1'),
      { id: 'session-2', title: 'Old chat', turns: [], updatedAt: null },
    ];
    expect(sessionSummaries(sessions, 'session-2')).toEqual([
      {
        id: 'session-1',
        title: 'A dental clinic page',
        updatedAt: 1_790_000_000_000,
        current: false,
      },
      { id: 'session-2', title: 'Old chat', updatedAt: null, current: true },
    ]);
  });
});

describe('outcomeKeyOf: per-section outcomes are keyed by transaction id', () => {
  it('uses the landing transaction when the section has one', () => {
    const landed = task(1, 'landed', {
      landing: { transactionId: 'tx-9', label: 'Assistant: 1/3 — Hero', before: {}, after: {} },
    });
    expect(outcomeKeyOf(landed)).toBe('tx-9');
  });

  it('IS run-view’s outcome type, so the controller hands outcomes over as they are', () => {
    // One type, not two copies: a copy once kept `undone.transactionId` optional here and
    // required there, and this assignment stopped compiling.
    expectTypeOf<LandingOutcome>().toEqualTypeOf<SectionOutcome>();
    const turn = build({
      status: 'settled',
      outcomes: {
        'tx-1': { kind: 'undone', transactionId: 'tx-40' },
        'v1-section:n2': { kind: 'undone' },
        'tx-3': { kind: 'refused', why: 'changedSince' },
      },
    });
    const handedOver: BuildRecordInput['outcomes'] = turn.outcomes;
    expect(handedOver).toBe(turn.outcomes);
  });

  it('marks a v1 section, which never recorded one, by its section id', () => {
    expect(outcomeKeyOf({ id: 'n1' })).toBe('v1-section:n1');
  });
});

/* ── Revive rules ────────────────────────────────────────────────────────── */

describe('reviveTurn: a reload ends every run and every runtime authority', () => {
  it('turns a running build into an interrupted one, revived, never still "working"', () => {
    const revived = reviveTurn(build({ stopping: true }));
    expect(revived).toMatchObject({ kind: 'build', status: 'interrupted', revived: true });
    expect(revived).not.toHaveProperty('stopping');
    // The list it had is kept: what landed is on the page, and the rest may be finished.
    expect((revived as BuildTurn).progress.tasks).toHaveLength(3);
  });

  it('ends a build that never got its section list as an interrupted note, not "0/0"', () => {
    const revived = reviveTurn(build({ progress: progress([], { phase: 'scaffolding' }) }));
    expect(revived).toEqual({ id: 'turn-2', kind: 'end', key: 'interrupted' });
  });

  it('keeps a settled build readable and marks it revived, so its Undo is unavailable', () => {
    const outcomes = { 'tx-1': { kind: 'undone', transactionId: 'tx-40' } } as const;
    const revived = reviveTurn(build({ status: 'settled', outcomes }));
    expect(revived).toMatchObject({ kind: 'build', status: 'settled', revived: true, outcomes });
  });

  it('keeps a failed build failed, and revived', () => {
    const revived = reviveTurn(build({ status: 'failed', failure }));
    expect(revived).toMatchObject({ kind: 'build', status: 'failed', failure, revived: true });
  });

  it('ends a running edit as interrupted: a reload killed that request', () => {
    const edit: EditTurn = {
      id: 'turn-4',
      kind: 'edit',
      origin: 'request',
      status: 'running',
      changes: [],
    };
    expect(reviveTurn(edit)).toEqual({ id: 'turn-4', kind: 'end', key: 'interrupted' });
  });

  it('keeps a settled edit and marks it revived', () => {
    const edit: EditTurn = {
      id: 'turn-4',
      kind: 'edit',
      origin: 'proposal',
      status: 'done',
      changes: [{ kind: 'added', label: 'Button', value: 'WhatsApp' }],
      transactionId: 'tx-7',
      stopping: true,
    };
    const revived = reviveTurn(edit);
    expect(revived).toMatchObject({
      kind: 'edit',
      status: 'done',
      transactionId: 'tx-7',
      revived: true,
    });
    expect(revived).not.toHaveProperty('stopping');
  });

  it('never revives a proposal’s authority: the card stays readable and cannot apply', () => {
    const proposal: ProposalTurn = {
      id: 'turn-6',
      kind: 'proposal',
      status: 'ready',
      plan,
      proposal: authority,
      changes: [],
    };
    const revived = reviveTurn(proposal);
    expect(revived).toMatchObject({ kind: 'proposal', status: 'ready', plan, revived: true });
    expect(revived).not.toHaveProperty('proposal');
  });

  it('ends a proposal, plan or step plan still being drafted as interrupted', () => {
    const drafting: readonly Turn[] = [
      { id: 'a', kind: 'proposal', status: 'drafting', changes: [] },
      {
        id: 'b',
        kind: 'page-plan',
        status: 'drafting',
        subject: '',
        sections: [],
        note: 'exact',
        editable: true,
      },
      { id: 'c', kind: 'step-plan', status: 'drafting', steps: [], text: '', dropped: 0 },
    ];
    for (const turn of drafting) {
      expect(reviveTurn(turn)).toEqual({ id: turn.id, kind: 'end', key: 'interrupted' });
    }
  });

  it('drops an Ask approval with its held build: Build now re-plans, so the note says so', () => {
    const waiting: PagePlanTurn = {
      id: 'turn-8',
      kind: 'page-plan',
      status: 'ready',
      subject: 'A dental clinic',
      sections: [
        { key: 's1', title: 'Hero' },
        { key: 's2', title: 'Services' },
      ],
      approval: true,
      heldBuild: progress([task(1, 'waiting'), task(2, 'waiting')], { phase: 'planned' }),
      note: 'exact',
      editable: true,
    };
    const revived = reviveTurn(waiting);
    expect(revived).toMatchObject({ kind: 'page-plan', status: 'ready', note: 'mayDiffer' });
    expect(revived).not.toHaveProperty('approval');
    expect(revived).not.toHaveProperty('heldBuild');
  });

  it('keeps "exact" for a revived Ask plan that carries the engine’s plan: a new run builds it verbatim', () => {
    const plan = clinicPlan();
    const waiting: PagePlanTurn = {
      id: 'turn-8',
      kind: 'page-plan',
      status: 'ready',
      subject: plan.title,
      sections: plan.sections.map(({ key, title }) => ({ key, title })),
      enginePlan: plan,
      approval: true,
      note: 'exact',
      editable: true,
    };
    const revived = reviveTurn(JSON.parse(JSON.stringify(waiting)) as PagePlanTurn);
    expect(revived).toMatchObject({ kind: 'page-plan', note: 'exact', enginePlan: plan });
    expect(revived).not.toHaveProperty('approval');
  });

  it('leaves a ready plan without an approval exactly as it was', () => {
    const ready: PagePlanTurn = {
      id: 'turn-8',
      kind: 'page-plan',
      status: 'ready',
      subject: 'A café',
      sections: [{ key: 's1', title: 'Hero' }],
      note: 'exact',
      editable: true,
      edited: true,
    };
    expect(reviveTurn(ready)).toEqual(ready);
  });

  it('leaves the person’s words, answers, errors and endings alone', () => {
    const plain: readonly Turn[] = [
      {
        id: 'a',
        kind: 'user',
        text: 'hi',
        context: [{ kind: 'mention', id: 'n1', label: 'Hero' }],
      },
      { id: 'b', kind: 'answer', text: 'The hero is first.' },
      { id: 'c', kind: 'error', failure, pageState: { kind: 'kept', landed: 3 } },
      { id: 'f', kind: 'error', failure, pageState: { kind: 'unknown' } },
      { id: 'd', kind: 'end', key: 'planSuperseded' },
      { id: 'e', kind: 'step-plan', status: 'ready', steps: [], text: 'x', dropped: 1 },
    ];
    for (const turn of plain) expect(reviveTurn(turn)).toBe(turn);
  });

  it('is idempotent: reviving a revived turn changes nothing', () => {
    const once = reviveTurn(build({ stopping: true }));
    expect(reviveTurn(once)).toEqual(once);
  });
});

describe('reviveState: reading pg-agent-sessions-v2 defensively', () => {
  it('preserves an overflowed receipt as unknown across reload and rejects malformed flags', () => {
    const receipt = {
      activity: [],
      attempts: {
        'run/attempt-1': {
          inputTokens: 20,
          outputTokens: 8,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          costUsd: 0.01,
        },
      },
      overflowed: true,
    };
    const state = reviveState(
      JSON.parse(
        JSON.stringify({
          activeId: 's',
          sessions: [
            {
              id: 's',
              turns: [{ id: 'a', kind: 'answer', text: 'Saved reply', telemetry: receipt }],
            },
          ],
        }),
      ),
    );
    const telemetry = state?.sessions[0]?.turns[0]?.telemetry;
    expect(telemetry?.overflowed).toBe(true);
    if (telemetry === undefined) throw new Error('Missing bounded overflow receipt');
    expect(telemetryTotals(telemetry)).toMatchObject({
      inputTokens: null,
      outputTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      costUsd: null,
    });
    const malformed = reviveState({
      activeId: 's',
      sessions: [
        {
          id: 's',
          turns: [
            {
              id: 'a',
              kind: 'answer',
              text: 'Saved reply',
              telemetry: { ...receipt, overflowed: 'true' },
            },
          ],
        },
      ],
    });
    expect(malformed?.sessions[0]?.turns[0]).toEqual({
      id: 'a',
      kind: 'answer',
      text: 'Saved reply',
    });
  });
  it('drops malformed optional telemetry without losing a readable answer', () => {
    for (const telemetry of [
      {},
      { activity: [], attempts: [] },
      { activity: 'private', attempts: {} },
    ]) {
      const state = reviveState({
        activeId: 's',
        sessions: [
          { id: 's', turns: [{ id: 'a', kind: 'answer', text: 'Saved reply', telemetry }] },
        ],
      });
      expect(state?.sessions[0]?.turns[0]).toEqual({
        id: 'a',
        kind: 'answer',
        text: 'Saved reply',
      });
    }
  });
  it('retains bounded measured receipts and preserves bad or absent counts as unknown', () => {
    const state = reviveState({
      activeId: 's',
      sessions: [
        {
          id: 's',
          turns: [
            {
              id: 'a',
              kind: 'answer',
              text: 'Saved reply',
              telemetry: {
                activity: [
                  { stage: 'checking', scope: 'x'.repeat(500) },
                  { stage: 'private reasoning' },
                ],
                attempts: {
                  'run/attempt-1': {
                    inputTokens: 20,
                    outputTokens: -1,
                    cacheReadTokens: Infinity,
                    cacheWriteTokens: Number.MAX_SAFE_INTEGER,
                    costUsd: -1,
                  },
                },
              },
            },
          ],
        },
      ],
    });
    const telemetry = state?.sessions[0]?.turns[0]?.telemetry;
    expect(telemetry?.activity).toEqual([{ stage: 'checking', scope: 'x'.repeat(120) }]);
    if (telemetry === undefined) throw new Error('Missing measured receipt');
    expect(telemetryTotals(telemetry)).toMatchObject({
      inputTokens: 20,
      outputTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      costUsd: null,
    });
  });
  it('rejects prototype-bearing, dangerous-key and oversized persisted ledgers', () => {
    const ledgers: readonly unknown[] = [
      Object.create({ 'inherited/attempt-1': null }),
      JSON.parse('{"__proto__":null}'),
      Object.fromEntries(
        Array.from({ length: 65 }, (_, i) => [`run-${String(i)}/attempt-1`, null]),
      ),
    ];
    for (const attempts of ledgers) {
      const state = reviveState({
        activeId: 's',
        sessions: [
          {
            id: 's',
            turns: [
              {
                id: 'a',
                kind: 'answer',
                text: 'Saved reply',
                telemetry: { activity: [], attempts },
              },
            ],
          },
        ],
      });
      expect(state?.sessions[0]?.turns[0]?.telemetry).toBeUndefined();
    }
  });
  const saved = {
    version: 2,
    sessions: [session([{ id: 'turn-2', kind: 'user', text: 'hi', context: [] }, build()])],
    activeId: 'session-1',
    mode: 'plan',
    modeChosen: true,
  };

  it('revives every turn and keeps the chosen mode', () => {
    const state = reviveState(JSON.parse(JSON.stringify(saved)));
    expect(state?.activeId).toBe('session-1');
    expect(state?.mode).toBe('plan');
    expect(state?.modeChosen).toBe(true);
    expect(state?.sessions[0]?.turns[1]).toMatchObject({ status: 'interrupted', revived: true });
  });

  it.each<[string, unknown]>([
    ['nothing stored', null],
    ['a string', 'sessions'],
    ['no sessions array', { activeId: 'session-1' }],
    ['no active id', { sessions: [] }],
    ['an empty session list', { version: 2, sessions: [], activeId: 'x' }],
  ])('reads %s as no saved state', (_name, raw) => {
    expect(reviveState(raw)).toBeNull();
  });

  it('drops a turn it cannot read instead of breaking the thread', () => {
    const state = reviveState({
      version: 2,
      activeId: 'session-1',
      sessions: [
        {
          id: 'session-1',
          title: 't',
          updatedAt: null,
          turns: [
            { id: 'turn-2', kind: 'user', text: 'hi', context: [] },
            { id: 'turn-3', kind: 'hologram' },
            { kind: 'user', text: 'no id' },
            null,
          ],
        },
      ],
    });
    expect(state?.sessions[0]?.turns.map((turn) => turn.id)).toEqual(['turn-2']);
  });

  it('drops a known kind that lacks what its record needs, instead of crashing the load', () => {
    const state = reviveState({
      version: 2,
      activeId: 'session-1',
      sessions: [
        {
          id: 'session-1',
          title: 't',
          updatedAt: null,
          turns: [
            { id: 'turn-2', kind: 'build', status: 'running', request: 'x', outcomes: {} },
            { id: 'turn-3', kind: 'user', context: [] },
            { id: 'turn-4', kind: 'edit', origin: 'request', status: 'done' },
            { id: 'turn-5', kind: 'error', pageState: { kind: 'unchanged' } },
            { id: 'turn-6', kind: 'end', key: 'interrupted' },
          ],
        },
      ],
    });
    expect(state?.sessions[0]?.turns.map((turn) => turn.id)).toEqual(['turn-6']);
  });

  it('opens the first conversation when the saved active one is gone', () => {
    const state = reviveState({ ...saved, activeId: 'session-404' });
    expect(state?.activeId).toBe('session-1');
  });

  it('only counts a literal true as a chosen mode, and ignores a mode it does not know', () => {
    expect(reviveState({ ...saved, modeChosen: 'yes' })?.modeChosen).toBeUndefined();
    expect(reviveState({ ...saved, mode: 'yolo' })?.mode).toBeUndefined();
  });

  it('repairs twin turn ids on the way in', () => {
    const state = reviveState({
      ...saved,
      sessions: [
        session([
          { id: 'turn-2', kind: 'user', text: 'a', context: [] },
          { id: 'turn-2', kind: 'end', key: 'interrupted' },
        ]),
      ],
    });
    expect(state?.sessions[0]?.turns.map((turn) => turn.id)).toEqual(['turn-2', 'turn-3']);
  });

  it('is a fixed point: saving what it revived and reviving again changes nothing', () => {
    const once = reviveState(JSON.parse(JSON.stringify(saved)));
    const twice = reviveState(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });
});
