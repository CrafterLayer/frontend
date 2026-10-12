/**
 * The decision frames of `fakeViewState`: SPEC §3.6 edits, §4.10 and §4.12 words-only
 * answers and change plans, §3.7 the page plan and §3.8 Ask proposals.
 */
import type { AgentViewState, PlanView, StepPlanView } from '../../model/view-types';

import type { ScenarioContext } from './scenario-context';
import type { FakeScenario } from './scenarios';
import {
  RECORD_TURN,
  announce,
  conversation,
  editView,
  planView,
  proposalView,
  runBar,
  sectionId,
} from './views';
import { SWATCHES } from './words';

export type DecisionScenario = Extract<
  FakeScenario,
  | 'editRunning'
  | 'editDone'
  | 'editNoChange'
  | 'editUndone'
  | 'editStopped'
  | 'answer'
  | 'stepPlan'
  | 'planDrafting'
  | 'planReady'
  | 'planEdited'
  | 'planInvalid'
  | 'planApproval'
  | 'planReadOnly'
  | 'proposalDrafting'
  | 'proposal'
  | 'proposalPartial'
  | 'proposalPreviewing'
  | 'proposalApplied'
  | 'proposalDiscarded'
>;

/** The view of one edit, answer, plan or proposal scenario. */
export function decisionViewState(
  context: ScenarioContext,
  scenario: DecisionScenario,
): AgentViewState {
  const { locale, now, words, start, hasContent, heroChip, running, settled } = context;
  switch (scenario) {
    case 'editRunning':
      return {
        ...running(
          {
            kind: 'edit',
            view: editView({
              phase: 'running',
              target: words.sections[1],
              stage: 'edit.checking',
              menu: [],
            }),
          },
          runBar({ activity: 'edit', statusKey: 'edit.checking' }, now, 7_000),
          words.editRequest,
        ),
        chips: [heroChip],
        face: { mood: 'planning', variant: 'checking', typing: false },
      };
    case 'editDone':
      return settled(
        {
          kind: 'edit',
          view: editView({
            target: words.sections[1],
            changes: words.editChanges,
            elapsedMs: 16_000,
            revealNodeId: sectionId(2),
            undo: { kind: 'undo', transactionId: 'tx-edit' },
          }),
        },
        { chips: [heroChip], face: { mood: 'done', outcome: 'applied', typing: false } },
      );
    case 'editNoChange':
      return settled({
        kind: 'edit',
        view: editView({ phase: 'noChange', target: words.sections[1], elapsedMs: 9_000 }),
      });
    case 'editUndone':
      return settled({
        kind: 'edit',
        view: editView({
          phase: 'undone',
          target: words.sections[1],
          changes: words.editChanges,
          elapsedMs: 16_000,
          undo: { kind: 'redo', transactionId: 'tx-edit' },
        }),
      });
    case 'editStopped':
      return settled({
        kind: 'edit',
        view: editView({
          phase: 'stopped',
          target: words.sections[1],
          elapsedMs: 5_000,
          menu: ['reuse'],
        }),
      });
    case 'answer':
      return {
        ...settled({
          kind: 'answer',
          view: { turnId: RECORD_TURN, text: words.answer, menu: ['reuse', 'copyAnswer'] },
        }),
        turns: conversation(
          words,
          {
            kind: 'answer',
            view: { turnId: RECORD_TURN, text: words.answer, menu: ['reuse', 'copyAnswer'] },
          },
          words.question,
        ),
      };
    case 'stepPlan': {
      const view: StepPlanView = {
        turnId: RECORD_TURN,
        status: 'ready',
        steps: words.steps.map((text, index) => ({
          key: `step-${String(index + 1)}`,
          text,
          target: words.sections[1],
        })),
      };
      return {
        ...start,
        ...hasContent,
        mode: 'plan',
        turns: conversation(words, { kind: 'step-plan', view }, words.editRequest),
      };
    }
    case 'planDrafting':
      return {
        ...running(
          {
            kind: 'page-plan',
            view: planView(words, { status: 'drafting', sections: [], direction: undefined }),
          },
          runBar({ activity: 'plan', statusKey: 'plan.drafting' }, now, 6_000),
        ),
        mode: 'plan',
        empty: { kind: 'greeting' },
        face: { mood: 'planning', typing: false },
      };
    case 'planReady':
    case 'planEdited':
    case 'planInvalid':
    case 'planApproval':
    case 'planReadOnly': {
      const patch: Partial<PlanView> =
        scenario === 'planEdited'
          ? {
              edited: true,
              sections: planView(words, {}).sections.map((section, index) =>
                index === 5
                  ? { ...section, title: locale === 'ar' ? 'قصص المرضى' : 'Patient stories' }
                  : section,
              ),
            }
          : scenario === 'planInvalid'
            ? {
                edited: true,
                problems: ['contrast'],
                direction: {
                  ...words.direction,
                  swatches: SWATCHES?.map((swatch) =>
                    swatch.role === 'text' ? { ...swatch, hex: '#d4d4d8' } : swatch,
                  ),
                },
              }
            : scenario === 'planApproval'
              ? { approval: true }
              : scenario === 'planReadOnly'
                ? { editable: false, note: 'mayDiffer', direction: { mood: words.direction.mood } }
                : {};
      return {
        ...start,
        mode: scenario === 'planApproval' ? 'ask' : 'plan',
        turns: conversation(words, { kind: 'page-plan', view: planView(words, patch) }),
        suggestions: [],
        announcement: announce('plan.ready'),
      };
    }
    case 'proposalDrafting':
      return {
        ...running(
          {
            kind: 'proposal',
            view: proposalView(words, { status: 'drafting', changes: [], menu: [] }),
          },
          runBar({ activity: 'proposal', statusKey: 'proposal.drafting' }, now, 5_000),
          words.proposalRequest,
        ),
        mode: 'ask',
      };
    case 'proposal':
    case 'proposalPartial':
    case 'proposalPreviewing':
      return {
        ...start,
        ...hasContent,
        mode: 'ask',
        turns: conversation(
          words,
          {
            kind: 'proposal',
            view: proposalView(
              words,
              scenario === 'proposalPartial'
                ? { partial: { kept: 2, total: 3 } }
                : scenario === 'proposalPreviewing'
                  ? { previewing: true }
                  : {},
            ),
          },
          words.proposalRequest,
        ),
        announcement: announce('proposal.ready'),
      };
    case 'proposalApplied':
      return {
        ...settled({
          kind: 'edit',
          view: editView({
            origin: 'proposal',
            target: words.sections[6],
            changes: words.proposalChanges,
            elapsedMs: 18_000,
            undo: { kind: 'undo', transactionId: 'tx-apply' },
          }),
        }),
        mode: 'ask',
      };
    case 'proposalDiscarded':
      return {
        ...settled({ kind: 'end', view: { turnId: RECORD_TURN, key: 'proposalDiscarded' } }),
        mode: 'ask',
      };
  }
}
