/**
 * The view contracts are mostly types, so most of this file is checked by `tsc`, not
 * by vitest: every `expectTypeOf` and `@ts-expect-error` below fails
 * `pnpm --filter @craftkit/playground typecheck` if a contract drifts from SPEC §7.3.
 * The runtime half covers the three guards, the only code the module ships.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  isAwaitingDecision,
  isTurnOfKind,
  TURN_KINDS,
  type AgentController,
  type AgentViewState,
  type AnnouncementKey,
  type AssistantMode,
  type BuildRecordView,
  type ChangeLineView,
  type ContextChipView,
  type EditRecordView,
  type ErrorClass,
  type ErrorPageState,
  type ErrorView,
  type FailureClass,
  type PlanOp,
  type RestoreResult,
  type RowState,
  type RunBarView,
  type SendState,
  type SpineRowView,
  type StatusKey,
  type TurnKind,
  type TurnView,
  type UndoView,
} from './view-types';

/* ── Fixtures: one turn of every kind, built only from the public contract ── */

const row = (position: number, state: RowState): SpineRowView => ({
  key: `s${String(position)}`,
  nodeId: `node-${String(position)}`,
  position,
  total: 3,
  title: `Section ${String(position)}`,
  state,
  canRetry: state === 'failed',
});

const build: BuildRecordView = {
  turnId: 't2',
  phase: 'building',
  landed: 1,
  total: 3,
  remainingMs: null,
  rows: [row(1, 'landed'), row(2, 'drafted'), row(3, 'writing')],
  facts: [],
  collapsed: false,
  revived: false,
  actions: { undoBuild: false, redoBuild: false, finishRest: 0, removeEmpty: 0, retryFailed: 0 },
  menu: [],
};

const page: ContextChipView = { kind: 'page', id: 'scope' };

const EVERY_KIND: readonly TurnView[] = [
  { kind: 'user', view: { turnId: 't1', text: 'A dental clinic', chips: [page], notRun: false } },
  { kind: 'build', view: build },
  {
    kind: 'edit',
    view: {
      turnId: 't3',
      phase: 'done',
      origin: 'request',
      target: 'Hero',
      changes: [
        { kind: 'changed', label: 'Background', before: 'light', after: 'deep navy' },
        { kind: 'added', label: 'Button', value: 'WhatsApp' },
      ],
      elapsedMs: 16_000,
      revealNodeId: 'node-2',
      undo: { kind: 'undo', transactionId: 'tx-9' },
      menu: ['reuse', 'copySummary'],
    },
  },
  { kind: 'answer', view: { turnId: 't4', text: 'Two sections.', menu: ['copyAnswer'] } },
  {
    kind: 'page-plan',
    view: {
      turnId: 't5',
      status: 'ready',
      approval: false,
      edited: false,
      editable: true,
      note: 'exact',
      subject: 'Dental clinic, Amman',
      sections: [
        { key: 'a', title: 'Header' },
        { key: 'b', title: 'Hero' },
      ],
      problems: [],
    },
  },
  {
    kind: 'step-plan',
    view: { turnId: 't6', status: 'ready', steps: [{ key: '1', text: 'Darken the hero' }] },
  },
  {
    kind: 'proposal',
    view: {
      turnId: 't7',
      status: 'ready',
      target: 'FAQ',
      changes: [],
      pageUnchanged: true,
      previewing: false,
      menu: ['viewAsCode'],
    },
  },
  {
    kind: 'error',
    view: {
      turnId: 't8',
      failure: 'unreachable',
      pageState: { kind: 'unchanged' },
      retryable: true,
      details: 'ECONNREFUSED',
      menu: ['copyError'],
    },
  },
  { kind: 'end', view: { turnId: 't9', key: 'proposalDiscarded' } },
];

/* ── Runtime: the guards ─────────────────────────────────────────────────── */

describe('TURN_KINDS', () => {
  it('lists every v2 turn kind exactly once, in the order SPEC §7.4 names them', () => {
    expect(TURN_KINDS).toEqual([
      'user',
      'build',
      'edit',
      'answer',
      'page-plan',
      'step-plan',
      'proposal',
      'error',
      'end',
    ]);
    expect(EVERY_KIND.map((turn) => turn.kind)).toEqual(TURN_KINDS);
  });
});

describe('isTurnOfKind', () => {
  it('narrows to the named kind and rejects every other', () => {
    const matches = EVERY_KIND.filter((turn) => isTurnOfKind(turn, 'build'));
    expect(matches).toHaveLength(1);
    const [only] = matches;
    if (only === undefined || !isTurnOfKind(only, 'build')) throw new Error('no build turn');
    // Narrowed: `view` is a BuildRecordView, so its build-only fields type-check.
    expect(only.view.landed).toBe(1);
  });
});

describe('isAwaitingDecision', () => {
  it('holds only for a ready plan, step plan or proposal (SPEC §4.1 awaiting-decision)', () => {
    const waiting = EVERY_KIND.filter(isAwaitingDecision).map((turn) => turn.kind);
    expect(waiting).toEqual(['page-plan', 'step-plan', 'proposal']);
  });

  it('does not hold while a decision surface is still drafting', () => {
    const drafting: TurnView = {
      kind: 'proposal',
      view: {
        turnId: 'p',
        status: 'drafting',
        changes: [],
        pageUnchanged: true,
        previewing: false,
        menu: [],
      },
    };
    expect(isAwaitingDecision(drafting)).toBe(false);
  });
});

/* ── Compile time: the contract, enforced by `pnpm typecheck` ─────────────── */

describe('contract shape (checked by tsc)', () => {
  it('keeps the SPEC §7.3 unions exact', () => {
    expectTypeOf<AssistantMode>().toEqualTypeOf<'ask' | 'auto' | 'plan'>();
    expectTypeOf<RowState>().toEqualTypeOf<
      | 'planned'
      | 'waiting'
      | 'writing'
      | 'retrying'
      | 'drafted'
      | 'landed'
      | 'failed'
      | 'notWritten'
      | 'undone'
    >();
    expectTypeOf<FailureClass>().toEqualTypeOf<
      | 'timeout'
      | 'invalid'
      | 'outOfScope'
      | 'pageChanged'
      | 'unreachable'
      | 'busy'
      | 'declined'
      | 'unknown'
    >();
    expectTypeOf<TurnKind>().toEqualTypeOf<
      | 'user'
      | 'build'
      | 'edit'
      | 'answer'
      | 'page-plan'
      | 'step-plan'
      | 'proposal'
      | 'error'
      | 'end'
    >();
    expectTypeOf<UndoView['kind']>().toEqualTypeOf<'undo' | 'redo' | 'unavailable'>();
    // The runtime list and the union cannot drift apart: a kind added to one only fails here.
    expectTypeOf<(typeof TURN_KINDS)[number]>().toEqualTypeOf<TurnKind>();
  });

  it('keeps a whole-run failure (§4.14) apart from one section failing (§4.8)', () => {
    expectTypeOf<ErrorView['failure']>().toEqualTypeOf<ErrorClass>();
    // A run can be offline or too large; only a section can write outside its region.
    expectTypeOf<'offline'>().toExtend<ErrorClass>();
    expectTypeOf<'tooLarge'>().toExtend<ErrorClass>();
    expectTypeOf<'offline'>().not.toExtend<FailureClass>();
    expectTypeOf<'outOfScope'>().not.toExtend<ErrorClass>();
    expectTypeOf<'pageChanged'>().not.toExtend<ErrorClass>();
  });

  it('keeps announced-only keys out of the visible line and visible-only keys out of the live region', () => {
    expectTypeOf<'copied'>().toExtend<AnnouncementKey>();
    expectTypeOf<'build.progress'>().toExtend<AnnouncementKey>();
    // §4.3: edit sub-stages update the visible line only; the understanding line is never spoken.
    expectTypeOf<'edit.checking'>().not.toExtend<AnnouncementKey>();
    expectTypeOf<'run.understanding'>().not.toExtend<AnnouncementKey>();
    expectTypeOf<AgentViewState['announcement']>().toEqualTypeOf<{
      readonly key: AnnouncementKey;
      readonly params: Readonly<Record<string, string | number>>;
      readonly seq: number;
    } | null>();
  });

  it('holds every change a line can show, the two with no words included (SPEC §4.9)', () => {
    expectTypeOf<ChangeLineView['kind']>().toEqualTypeOf<
      'changed' | 'added' | 'removed' | 'restyled' | 'moved'
    >();
    // "Make the hero darker" lands with no before → after in words: it is a line anyway.
    expectTypeOf<{ kind: 'restyled'; label: string; value: string }>().toExtend<ChangeLineView>();
    expectTypeOf<EditRecordView['unlisted']>().toEqualTypeOf<true | undefined>();
  });

  it('lets an error say it does not know what reached the page (SPEC §4.14)', () => {
    expectTypeOf<ErrorPageState['kind']>().toEqualTypeOf<
      'unchanged' | 'kept' | 'skeleton' | 'unknown'
    >();
  });

  it('gives the live region a true sentence for a page-wide edit and an empty layout', () => {
    expectTypeOf<
      | 'edit.startedPage'
      | 'edit.donePage'
      | 'edit.noChangePage'
      | 'stopped.budget.none'
      | 'failed.skeleton'
    >().toExtend<AnnouncementKey>();
  });

  it('never offers Stop in the Send slot (SPEC §6.5)', () => {
    expectTypeOf<'stop'>().not.toExtend<SendState>();
    expectTypeOf<'stopping'>().not.toExtend<SendState>();
  });

  it('types the RunBar status by the visible §4.3 keys only', () => {
    expectTypeOf<'build.writing'>().toExtend<StatusKey>();
    expectTypeOf<'stopping'>().toExtend<StatusKey>();
    // Announced-only keys have no visible line, so the RunBar can never show them.
    expectTypeOf<'build.progress'>().not.toExtend<StatusKey>();
    expectTypeOf<'build.done'>().not.toExtend<StatusKey>();
    expectTypeOf<RunBarView['statusKey']>().toEqualTypeOf<StatusKey>();
  });

  it('is readonly all the way down', () => {
    // Never called: only `tsc` reads it. Each line must stay a type error.
    const mutations = (view: SpineRowView, state: AgentViewState): void => {
      // @ts-expect-error: views are snapshots; a component never writes to one.
      view.state = 'failed';
      // @ts-expect-error: the turn list is a readonly array (an assignment, not `push`,
      // so the error stays a type error and never an unresolved call for eslint).
      state.turns[0] = EVERY_KIND[0]!;
      // @ts-expect-error: nested objects are readonly too.
      build.actions.finishRest = 3;
    };
    expect(mutations).toBeTypeOf('function');
  });

  it('keeps optional fields exactOptionalPropertyTypes-safe for mappers', () => {
    // A mapper forwarding a maybe-absent engine field must compile without a spread dance.
    const maybeNode: string | undefined = undefined;
    const planned: SpineRowView = { ...row(1, 'planned'), nodeId: maybeNode };
    expect(planned.nodeId).toBeUndefined();
  });

  it('exposes controller actions as readonly function properties, safe to pass unbound', () => {
    expectTypeOf<AgentController['send']>().toEqualTypeOf<() => void>();
    expectTypeOf<AgentController['editPlan']>().parameters.toEqualTypeOf<
      [turnId: string, op: PlanOp]
    >();
    expectTypeOf<AgentController['retrySections']>().parameters.toEqualTypeOf<
      [turnId: string, keys: readonly string[]]
    >();
  });

  it('adds the actions §4 components need that §7.3 did not list', () => {
    // §4.15 RestoreDialog shows a conflict in place, so it needs the outcome, not a void.
    expectTypeOf<AgentController['restore']>().returns.toEqualTypeOf<Promise<RestoreResult>>();
    expectTypeOf<RestoreResult>().toEqualTypeOf<'restored' | 'conflict'>();
    // §4.8 undone footer, §4.9 edit Undo/Redo, §4.13 Preview, §4.17 chips and mentions.
    expectTypeOf<AgentController['redoBuild']>().toEqualTypeOf<(turnId: string) => void>();
    expectTypeOf<AgentController['undoEdit']>().toEqualTypeOf<(turnId: string) => void>();
    expectTypeOf<AgentController['togglePreview']>().toEqualTypeOf<(turnId: string) => void>();
    expectTypeOf<AgentController['removeChip']>().toEqualTypeOf<(id: string) => void>();
    expectTypeOf<AgentController['addMention']>().toEqualTypeOf<(nodeId: string) => void>();
    expectTypeOf<AgentController['openPageHistory']>().toEqualTypeOf<() => void>();
  });

  it('names what the RunBar is doing even while it says only "Stopping…"', () => {
    // `stopping` has no activity prefix, yet JumpToLatest and the status pill still need one.
    expectTypeOf<RunBarView['activity']>().toEqualTypeOf<
      'routing' | 'build' | 'edit' | 'plan' | 'proposal' | 'answer'
    >();
  });
});
