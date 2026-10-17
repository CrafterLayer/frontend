/**
 * The queue and error frames of `fakeViewState`: SPEC §3.9 the queue, §3.11 errors,
 * §3.12 a long conversation and §3.13 the conversations list.
 */
import type { AgentViewState, QueueView, RowState, TurnView } from '../../model/view-types';

import type { ScenarioContext } from './scenario-context';
import type { FakeScenario } from './scenarios';
import {
  PAGE_CHIP,
  USER_TURN,
  announce,
  editView,
  errorView,
  runBar,
  sectionId,
  sessions,
  userTurn,
} from './views';

export type QueueScenario = Extract<
  FakeScenario,
  | 'queueTyping'
  | 'queued'
  | 'queueStale'
  | 'queueMissing'
  | 'error'
  | 'errorKept'
  | 'errorSkeleton'
  | 'long'
  | 'conversations'
>;

/** The view of one queue, error or long-conversation scenario. */
export function queueViewState(context: ScenarioContext, scenario: QueueScenario): AgentViewState {
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
    case 'queueTyping':
    case 'queued':
    case 'queueStale':
    case 'queueMissing': {
      const states: RowState[] = [
        'landed',
        'landed',
        'landed',
        'landed',
        'landed',
        'writing',
        'drafted',
        'writing',
      ];
      const state = running(
        buildingRecord(states),
        runBar({ activity: 'build', statusKey: 'build.writing', params: { n: 2 } }, now, 100_000),
      );
      if (scenario === 'queueTyping') {
        return { ...state, draft: words.queued, send: 'running-ready' };
      }
      const status: QueueView['status'] =
        scenario === 'queueStale' ? 'stale' : scenario === 'queueMissing' ? 'missing' : 'editable';
      return {
        ...state,
        draft: words.queued,
        send: 'running-queued',
        queue: { text: words.queued, chips: [PAGE_CHIP], status },
        announcement: announce('queue.queued'),
      };
    }
    case 'error':
    case 'errorKept':
    case 'errorSkeleton':
      return settled(
        {
          kind: 'error',
          view: errorView(
            scenario === 'errorKept'
              ? { pageState: { kind: 'kept', landed: 3 } }
              : scenario === 'errorSkeleton'
                ? { pageState: { kind: 'skeleton' } }
                : {},
          ),
        },
        { face: { mood: 'failed', typing: false }, suggestions: [] },
      );
    case 'long': {
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
          userTurn(
            'turn-5',
            locale === 'ar'
              ? 'أضف الأسعار وخريطة لقسم التواصل'
              : 'Add pricing and a map to the contact section',
          ),
          {
            kind: 'edit',
            view: editView({
              turnId: 'turn-6',
              phase: 'running',
              stage: 'edit.writing',
              target: words.sections[7],
              menu: [],
            }),
          },
        ],
        run: runBar({ turnId: 'turn-6', activity: 'edit', statusKey: 'edit.writing' }, now, 41_000),
        send: 'running-empty',
        face: { mood: 'working', typing: false },
      };
    }
    case 'conversations':
      return { ...settled(built()), sessions: sessions(words) };
  }
}
