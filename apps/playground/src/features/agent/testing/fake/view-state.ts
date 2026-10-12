/**
 * `fakeViewState`: the view of one SPEC §3 scenario, dispatched to its frame family
 * (composer, page build, decisions, queue and errors) over one shared scenario context.
 */
import type { AgentViewState, Locale } from '../../model/view-types';

import { scenarioContext } from './scenario-context';
import type { FakeScenario, FakeViewOptions } from './scenarios';
import { buildViewState } from './view-state-build';
import { composerViewState } from './view-state-composer';
import { decisionViewState } from './view-state-decisions';
import { queueViewState } from './view-state-queue';

/**
 * The view of one scenario. Titles, requests and answers are in `locale`, so an Arabic
 * story shows the SPEC §3.15 copy and an English one the §3.4 copy.
 */
export function fakeViewState(
  scenario: FakeScenario,
  locale: Locale = 'ar',
  options: FakeViewOptions = {},
): AgentViewState {
  const context = scenarioContext(locale, options);

  switch (scenario) {
    case 'empty':
    case 'emptyHasContent':
    case 'emptyCreative':
    case 'emptySelection':
    case 'composing':
    case 'mention':
    case 'enhanceUnavailable':
    case 'enhancing':
    case 'enhanced':
    case 'enhanceFailed':
    case 'clarifyAsking':
    case 'clarifyPartly':
    case 'clarifyRewriting':
      return composerViewState(context, scenario);
    case 'skeleton':
    case 'building':
    case 'buildingCreative':
    case 'blocked':
    case 'built':
    case 'builtPartial':
    case 'builtCollapsed':
    case 'stopping':
    case 'stopped':
    case 'stoppedBudget':
    case 'stoppedMaxTasks':
    case 'interrupted':
    case 'buildFailed':
    case 'buildUndone':
    case 'buildRevived':
      return buildViewState(context, scenario);
    case 'editRunning':
    case 'editDone':
    case 'editNoChange':
    case 'editUndone':
    case 'editStopped':
    case 'answer':
    case 'stepPlan':
    case 'planDrafting':
    case 'planReady':
    case 'planEdited':
    case 'planInvalid':
    case 'planApproval':
    case 'planReadOnly':
    case 'proposalDrafting':
    case 'proposal':
    case 'proposalPartial':
    case 'proposalPreviewing':
    case 'proposalApplied':
    case 'proposalDiscarded':
      return decisionViewState(context, scenario);
    case 'queueTyping':
    case 'queued':
    case 'queueStale':
    case 'queueMissing':
    case 'error':
    case 'errorKept':
    case 'errorSkeleton':
    case 'long':
    case 'conversations':
      return queueViewState(context, scenario);
    case 'queuePaused':
      return fakeViewState('stopped', locale, options);
  }
}
