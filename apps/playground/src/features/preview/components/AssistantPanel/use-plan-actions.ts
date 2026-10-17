import { useCallback, useEffect, useState } from 'react';

import {
  applyAiPlan,
  classifyAiRunFailure,
  previewAiPlan,
  type AiValidatedProposal,
  type BuilderDocument,
  type BuilderKernel,
} from '@craftkit/builder';

import type { UseAgentMoodResult } from '../AgentFace';
import type { AppliedChangeMemory } from './AssistantPanel.memory';
import type { AssistantMode } from './AssistantPanel.modes';
import { preflightPorts } from './AssistantPanel.runs';
import type { Turn } from './AssistantPanel.turns';

export interface PlanActionsInputs {
  kernel: BuilderKernel;
  memory: AppliedChangeMemory;
  panelMode: AssistantMode;
  noteFaceTurn: UseAgentMoodResult['noteTurn'];
  patchTurns: (change: (previous: readonly Turn[]) => readonly Turn[]) => void;
}

/**
 * What a person does with a proposed plan: Apply it (through the one door,
 * failing closed in Plan), preview the WOULD-BE page in a dialog, or discard it.
 */
export function usePlanActions({
  kernel,
  memory,
  panelMode,
  noteFaceTurn,
  patchTurns,
}: PlanActionsInputs) {
  /**
   * The open preview: the plan's turn id, the plan, and the WOULD-BE document
   * the scratch rehearsal produced. Looking never writes; Apply from here goes
   * through the same accept() as the card's own button.
   */
  const [preview, setPreview] = useState<{
    id: string;
    proposal: AiValidatedProposal;
    document: BuilderDocument;
  } | null>(null);

  const accept = useCallback(
    (id: string, proposal: AiValidatedProposal) => {
      /*
        FAILS CLOSED against the CURRENT mode, not the turn's.

        Every gate here used to read the mode the turn was proposed under, and
        Plan was therefore a label on old cards rather than a state of the
        panel. An Ask proposal made a minute ago still showed Apply after the
        person switched to Plan, and its Preview dialog applied unconditionally
        — so "Only plan — never apply" was one or two clicks from an apply, on
        work the panel was currently promising not to touch.

        The check belongs HERE, at the single function every route reaches: the
        card's button, the preview's button, and anything added later. A gate on
        a button is a gate somebody can forget to copy.
      */
      if (panelMode === 'plan') {
        return;
      }
      try {
        applyAiPlan({ kernel, proposal, validationPorts: preflightPorts() });
        memory.note(proposal);
        patchTurns((previous) =>
          previous.map((turn) =>
            turn.id === id && turn.from === 'assistant' && turn.kind === 'plan'
              ? { ...turn, applied: true }
              : turn,
          ),
        );
        noteFaceTurn('applied');
      } catch (cause: unknown) {
        const failure = classifyAiRunFailure(cause);
        patchTurns((previous) =>
          previous.map((turn) =>
            turn.id === id && turn.from === 'assistant' && turn.kind === 'plan'
              ? {
                  id: turn.id,
                  from: 'assistant',
                  kind: 'refused',
                  text: failure.message,
                  failure,
                }
              : turn,
          ),
        );
      }
    },
    [kernel, memory, panelMode, noteFaceTurn, patchTurns],
  );

  /** Rehearse the plan on a scratch kernel and show the result. Looking ≠ applying. */
  /**
   * In Plan mode, NOTHING in this panel changes the document.
   *
   * Apply was gated first, and that turned out to be half a rule: the applied
   * card's Undo and the build report's per-section Undo both called
   * `kernel.undo()` with no gate at all, so a panel that had hidden every Apply
   * and promised "only plan" still rewrote the page on one click. A person who
   * chose Plan is entitled to read every control in it as safe.
   *
   * Undo is not withheld to protect them from themselves — it is withheld
   * because the mode is a promise about this panel, and a promise with an
   * exception is not one. The way to undo is to leave Plan, which is one click
   * and says what it does.
   */
  const mutatesLiveDocument = panelMode !== 'plan';

  const openPreview = useCallback(
    (id: string, proposal: AiValidatedProposal) => {
      try {
        const document = previewAiPlan({ kernel, proposal, validationPorts: preflightPorts() });
        setPreview({ id, proposal, document });
      } catch (cause: unknown) {
        const failure = classifyAiRunFailure(cause);
        patchTurns((previous) =>
          previous.map((turn) =>
            turn.id === id && turn.from === 'assistant' && turn.kind === 'plan'
              ? {
                  id: turn.id,
                  from: 'assistant',
                  kind: 'refused',
                  text: failure.message,
                  failure,
                }
              : turn,
          ),
        );
      }
    },
    [kernel, patchTurns],
  );

  // The dialog answers Escape like every dialog a person has used.
  useEffect(() => {
    if (preview === null) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreview(null);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [preview]);

  const discard = useCallback(
    (id: string) => {
      patchTurns((previous) =>
        previous.map((turn) =>
          turn.id === id && turn.from === 'assistant' && turn.kind === 'plan'
            ? { id: turn.id, from: 'assistant', kind: 'discarded' }
            : turn,
        ),
      );
      noteFaceTurn('discarded');
    },
    [noteFaceTurn, patchTurns],
  );

  return { accept, preview, setPreview, mutatesLiveDocument, openPreview, discard };
}
