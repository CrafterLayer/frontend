import type { Dispatch, RefObject, SetStateAction } from 'react';

import {
  outlineAiPlan,
  systemClock,
  type AiAgentPolicy,
  type AiPlanProvider,
  type AiSkillRegistry,
  type BuilderKernel,
  type NodeId,
} from '@craftkit/builder';

import type { UseAgentMoodResult } from '../AgentFace';
import { receiptOf } from './AssistantPanel.progress';
import { ownsRun, type ActiveRunLease } from './AssistantPanel.runs';
import type { historyOf, Turn } from './AssistantPanel.turns';
import { catalogPolicyFor, type ProviderKind } from './catalogPolicyFor';

export interface OutlineTurnInputs {
  kernel: BuilderKernel;
  resolvedProvider: AiPlanProvider;
  registry: AiSkillRegistry;
  selectedSkillIds: readonly string[] | undefined;
  providerKind: ProviderKind;
  agentPolicy: Partial<AiAgentPolicy> | undefined;
  /** The request as asked, trimmed. */
  trimmed: string;
  /** Blocks the request @-mentions; they replace the selection as its focus. */
  mentioned: readonly NodeId[];
  /** The selection captured when the request was queued, if it was. */
  capturedSelection: readonly NodeId[] | undefined;
  history: ReturnType<typeof historyOf>;
  runId: string;
  thinkingId: string;
  controller: AbortController;
  activeRunRef: RefObject<ActiveRunLease | null>;
  patchTurns: (change: (previous: readonly Turn[]) => readonly Turn[]) => void;
  settleFaceTurn: UseAgentMoodResult['settleTurn'];
  setBusy: Dispatch<SetStateAction<boolean>>;
}

/**
 * A request answered in WORDS: Plan mode, or a question (`path: 'answer'`).
 *
 * `runAiAgent` promises a plan of COMMANDS, so this route is a different
 * function rather than a flag: `outlineAiPlan` asks the same provider, with
 * the same skills and the same context, and never goes near the door —
 * there is nothing to validate, because there is nothing to apply. The
 * thinking turn becomes an outline, a stop, or a retryable refusal.
 */
export async function runOutlineTurn({
  kernel,
  resolvedProvider,
  registry,
  selectedSkillIds,
  providerKind,
  agentPolicy,
  trimmed,
  mentioned,
  capturedSelection,
  history,
  runId,
  thinkingId,
  controller,
  activeRunRef,
  patchTurns,
  settleFaceTurn,
  setBusy,
}: OutlineTurnInputs): Promise<void> {
  const pointed =
    mentioned.length > 0
      ? mentioned
      : (capturedSelection ?? kernel.context.store.getState().selection);
  try {
    const outline = await outlineAiPlan({
      kernel,
      provider: resolvedProvider,
      request: trimmed,
      selection: pointed,
      history,
      skillRegistry: registry,
      ...(selectedSkillIds === undefined ? {} : { selectedSkillIds }),
      /*
              The same catalog policy every other run carries. Without it an
              outline defaulted to the FULL catalog: measured ~49k tokens for
              one Plan request against ~5k with `catalogMode: 'none'`
              (agent-audit P1-7d, 34 headless blocks; the playground registers
              55) — and a question is the request least in need of it.
            */
      ...catalogPolicyFor(providerKind, pointed, agentPolicy),
      signal: controller.signal,
    });
    if (!ownsRun(activeRunRef.current, runId)) return;
    settleFaceTurn({ runId, outcome: 'plan', applied: false });
    patchTurns((previous) =>
      previous.map((turn) =>
        turn.id === thinkingId
          ? {
              id: thinkingId,
              from: 'assistant',
              kind: 'outline',
              text: outline.rationale,
              ...(outline.followUp === undefined ? {} : { followUp: outline.followUp }),
              ...(outline.skillActivations === undefined
                ? {}
                : { skills: outline.skillActivations }),
              dropped: outline.droppedCommands,
            }
          : turn,
      ),
    );
  } catch (error) {
    /*
            `ownsRun`, not a direct `.runId` read. New chat and unmount set the
            lease to null, so reading through it threw — a person who started a
            plan and then opened a new chat crashed the panel.
          */
    if (!ownsRun(activeRunRef.current, runId)) return;
    const endedAt = systemClock.now();
    if (controller.signal.aborted) {
      /*
              The person pressed Stop. That is an OUTCOME, not an error — the
              same rule the ordinary run follows. Rendering the abort exception
              as a retryable refusal put the platform's own AbortError on screen
              and left the face showing failure for something nobody got wrong.
            */
      settleFaceTurn({ runId, outcome: 'stopped' });
      patchTurns((previous) =>
        previous.map((turn): Turn => {
          if (turn.id !== thinkingId) return turn;
          const receipt =
            turn.from === 'assistant' && turn.kind === 'thinking'
              ? receiptOf(turn.run, endedAt, turn.progress)
              : null;
          return {
            id: turn.id,
            from: 'assistant',
            kind: 'stopped',
            ...(receipt === null ? {} : { receipt }),
          };
        }),
      );
    } else {
      settleFaceTurn({ runId, outcome: 'refused', retryable: true });
      patchTurns((previous) =>
        previous.map((turn) =>
          turn.id === thinkingId
            ? {
                id: thinkingId,
                from: 'assistant',
                kind: 'refused',
                text: error instanceof Error ? error.message : 'The plan could not be written.',
                request: trimmed,
              }
            : turn,
        ),
      );
    }
  } finally {
    if (ownsRun(activeRunRef.current, runId)) {
      activeRunRef.current = null;
      setBusy(false);
    }
  }
}
