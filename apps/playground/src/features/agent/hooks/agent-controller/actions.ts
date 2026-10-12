/**
 * The controller's actions (`AgentController` less its state): composed from the
 * composer, record, plan card, history and conversation actions, plus the host's
 * own setters.
 */
import type { AgentController, RestoreResult } from '../../model/view-types';

import { composerActions } from './composer-actions';
import type { Flow } from './controller-state';
import { conversationActions } from './conversation-actions';
import { historyActions } from './history-actions';
import { planCardActions } from './plan-card-actions';
import { recordActions } from './record-actions';

/* ── The actions ─────────────────────────────────────────────────────────────── */

type Actions = Omit<AgentController, 'state' | 'capabilities'>;

export function createActions(flow: Flow): Actions {
  const env = flow.env;
  const {
    sendDraft,
    stop,
    setDraft,
    removeChip,
    addMention,
    enhanceDraft,
    restoreDraft,
    answerClarify,
    sendAsWritten,
    dismissClarify,
    removeQueued,
    continueQueued,
  } = composerActions(flow);
  const { apply, discard, tryAgain, reuse, togglePreview, copy } = recordActions(flow);
  const { build, runSteps, editPlan } = planCardActions(flow);
  const {
    undoSection,
    redoSection,
    removeEmpty,
    undoBuild,
    redoBuild,
    undoEdit,
    redoEdit,
    retrySections,
    finishRest,
  } = historyActions(flow);
  const { newConversation, openConversation, deleteConversation } = conversationActions(flow);

  return {
    send: sendDraft,
    stop,
    removeQueued,
    continueQueued,
    apply,
    discard,
    build,
    runSteps,
    editPlan,
    undoSection,
    redoSection,
    undoBuild,
    retrySections,
    finishRest,
    removeEmpty,
    tryAgain,
    // The canvas link is the hook's (`use-canvas-link`); these are replaced below.
    reveal: () => undefined,
    peek: () => undefined,
    reuse,
    setDraft,
    setMode: (mode) => {
      env().sessions.chooseMode(mode);
    },
    setModel: (id) => {
      env().options.onSelectModel?.(id);
    },
    setWorkers: (workers) => {
      if (flow.runtime.lease !== null || flow.ui.getState().checking) return;
      if (![1, 3, 6].includes(workers)) return;
      flow.ui.setState((ui) => (ui.workers === workers ? ui : { ...ui, workers }));
    },
    setEffort: (level) => {
      env().options.onSelectEffort?.(level);
    },
    setFreeCode: (enabled) => {
      env().options.onToggleFreeCode?.(enabled);
    },
    newConversation,
    openConversation,
    deleteConversation,
    redoBuild,
    undoEdit,
    redoEdit,
    togglePreview,
    viewAsCode: (turnId) => {
      env().options.onViewAsCode?.(turnId);
    },
    copy,
    // Engine E3 (`restoreBefore`) is absent: the menu hides Restore; a direct call refuses.
    restore: (): Promise<RestoreResult> => Promise.resolve('conflict'),
    showTechnicalDetails: (turnId) => {
      env().options.onTechnicalDetails?.(turnId);
    },
    openPageHistory: () => {
      env().options.onOpenPageHistory?.();
    },
    removeChip,
    addMention,
    enhanceDraft,
    restoreDraft,
    answerClarify,
    sendAsWritten,
    dismissClarify,
    setComposerFocused: (focused) => {
      flow.ui.setState((ui) =>
        ui.composerFocused === focused ? ui : { ...ui, composerFocused: focused },
      );
    },
  };
}
