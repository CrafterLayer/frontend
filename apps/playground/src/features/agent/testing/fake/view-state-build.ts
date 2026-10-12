/**
 * The page-build frames of `fakeViewState`: SPEC §3.3 to §3.5 (skeleton, building,
 * blocked, built) and §3.10 stopping and stopped, with the other build endings (§4.8).
 */
import { t } from '../../copy';
import { creativeBriefView } from '../../model/creative-brief';
import type { AgentViewState, RowState, TurnView } from '../../model/view-types';

import type { ScenarioContext } from './scenario-context';
import type { FakeScenario } from './scenarios';
import {
  ALL_LANDED,
  NO_ACTIONS,
  PAGE_CHIP,
  USER_TURN,
  WRITING_STATES,
  announce,
  buildView,
  editView,
  rows,
  runBar,
  sectionId,
  suggestions,
  userTurn,
} from './views';

export type BuildScenario = Extract<
  FakeScenario,
  | 'skeleton'
  | 'building'
  | 'buildingCreative'
  | 'blocked'
  | 'built'
  | 'builtPartial'
  | 'builtCollapsed'
  | 'stopping'
  | 'stopped'
  | 'stoppedBudget'
  | 'stoppedMaxTasks'
  | 'interrupted'
  | 'buildFailed'
  | 'buildUndone'
  | 'buildRevived'
>;

/** The view of one page-build scenario. */
export function buildViewState(context: ScenarioContext, scenario: BuildScenario): AgentViewState {
  const {
    locale,
    now,
    words,
    start,
    hasContent,
    heroChip,
    running,
    settled,
    built,
    buildingRecord,
  } = context;
  switch (scenario) {
    case 'skeleton':
      return {
        ...running(
          {
            kind: 'build',
            view: buildView(words, { phase: 'skeleton', rows: [], direction: undefined }),
          },
          runBar({ activity: 'build', statusKey: 'build.started' }, now, 4_000),
        ),
        empty: { kind: 'greeting' },
        face: { mood: 'planning', typing: false },
        announcement: announce('build.started'),
      };
    case 'buildingCreative': {
      const record = buildingRecord();
      const request = t(locale, 'creative.game.prompt');
      return {
        ...running(
          record.kind === 'build'
            ? { kind: 'build', view: { ...record.view, brief: creativeBriefView(request) } }
            : record,
          runBar({ activity: 'build', statusKey: 'build.writing', params: { n: 4 } }, now, 42_000),
          request,
        ),
        freeCode: { enabled: true },
      };
    }
    case 'building':
      return running(
        buildingRecord(),
        runBar({ activity: 'build', statusKey: 'build.writing', params: { n: 4 } }, now, 72_000),
      );
    case 'blocked':
      return running(
        buildingRecord([
          'landed',
          'writing',
          'drafted',
          'drafted',
          'drafted',
          'waiting',
          'waiting',
          'waiting',
        ]),
        runBar(
          {
            activity: 'build',
            statusKey: 'build.blocked',
            params: { title: words.sections[1] ?? '' },
          },
          now,
          95_000,
        ),
      );
    case 'built':
      return settled(built(), {
        face: { mood: 'done', outcome: 'applied', typing: false },
        announcement: announce('build.done', { n: 8 }),
      });
    case 'builtPartial': {
      const states: RowState[] = [...ALL_LANDED];
      states[4] = 'failed';
      return settled({
        kind: 'build',
        view: buildView(words, {
          phase: 'partial',
          rows: rows(words, states, true),
          elapsedMs: 160_000,
          actions: { ...NO_ACTIONS, undoBuild: true, retryFailed: 1 },
          menu: ['reuse', 'copySummary'],
        }),
      });
    }
    case 'builtCollapsed': {
      const record = built();
      const collapsed: TurnView =
        record.kind === 'build'
          ? { kind: 'build', view: { ...record.view, collapsed: true } }
          : record;
      return {
        ...start,
        ...hasContent,
        turns: [
          userTurn(USER_TURN, words.request),
          collapsed,
          userTurn('turn-3', words.editRequest, [heroChip]),
          {
            kind: 'edit',
            view: editView({
              turnId: 'turn-4',
              target: words.sections[1],
              changes: words.editChanges,
              elapsedMs: 16_000,
              revealNodeId: sectionId(2),
              undo: { kind: 'undo', transactionId: 'tx-edit' },
            }),
          },
        ],
        suggestions: suggestions(words, 'followUp').slice(0, 3),
      };
    }
    case 'stopping':
      return {
        ...running(
          {
            kind: 'build',
            view: buildView(words, { phase: 'stopping', rows: rows(words, WRITING_STATES) }),
          },
          runBar({ activity: 'build', statusKey: 'stopping', stopping: true }, now, 110_000),
        ),
        announcement: announce('stopping'),
      };
    case 'stopped':
    case 'stoppedBudget':
    case 'stoppedMaxTasks': {
      const states: RowState[] = [
        'landed',
        'landed',
        'landed',
        'landed',
        'landed',
        'notWritten',
        'notWritten',
        'notWritten',
      ];
      const stopReason =
        scenario === 'stopped' ? 'signal' : scenario === 'stoppedBudget' ? 'budget' : 'maxTasks';
      return settled(
        {
          kind: 'build',
          view: buildView(words, {
            phase: 'stopped',
            stopReason,
            rows: rows(words, states, true),
            elapsedMs: 112_000,
            actions: { ...NO_ACTIONS, finishRest: 3, removeEmpty: 3 },
            menu: ['reuse', 'copySummary'],
          }),
        },
        {
          face: { mood: 'stopped', typing: false },
          suggestions: [],
          queue: { text: words.queued, chips: [PAGE_CHIP], status: 'paused' },
        },
      );
    }
    case 'interrupted': {
      const states: RowState[] = [
        'landed',
        'landed',
        'landed',
        'notWritten',
        'notWritten',
        'notWritten',
        'notWritten',
        'notWritten',
      ];
      return settled({
        kind: 'build',
        view: buildView(words, {
          phase: 'interrupted',
          rows: rows(words, states).map((row) =>
            row.state === 'landed'
              ? { ...row, undo: { kind: 'unavailable', why: 'revived' } }
              : row,
          ),
          revived: true,
          actions: { ...NO_ACTIONS, finishRest: 5, removeEmpty: 5 },
          menu: ['reuse', 'copySummary'],
        }),
      });
    }
    case 'buildFailed':
      return settled(
        {
          kind: 'build',
          view: buildView(words, {
            phase: 'failed',
            rows: rows(
              words,
              WRITING_STATES.map(() => 'failed'),
            ),
            elapsedMs: 31_000,
            menu: ['reuse', 'copyError'],
            error: {
              failure: 'unreachable',
              pageState: { kind: 'skeleton' },
              retryable: true,
              details: 'provider/network: The assistant server could not be reached.',
            },
          }),
        },
        { face: { mood: 'failed', typing: false } },
      );
    case 'buildUndone':
      return settled({
        kind: 'build',
        view: buildView(words, {
          phase: 'undone',
          rows: rows(
            words,
            ALL_LANDED.map(() => 'undone'),
          ).map((row) => {
            const { nodeId, ...rest } = row;
            void nodeId;
            return rest;
          }),
          elapsedMs: 141_000,
          actions: { ...NO_ACTIONS, redoBuild: true },
          menu: ['reuse', 'copySummary'],
        }),
      });
    case 'buildRevived':
      return settled({
        kind: 'build',
        view: buildView(words, {
          phase: 'done',
          rows: rows(words, ALL_LANDED).map((row) => ({
            ...row,
            undo: { kind: 'unavailable', why: 'revived' },
          })),
          elapsedMs: 141_000,
          revived: true,
          menu: ['reuse', 'copySummary'],
        }),
      });
  }
}
