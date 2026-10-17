import { useCallback, type Dispatch, type SetStateAction } from 'react';

import {
  classifyAiRunFailure,
  customCodeSchema,
  runAiAgent,
  summarizeDocumentForIntent,
  systemClock,
  type AiPlanProvider,
  type NodeId,
} from '@craftkit/builder';

import { estimateRequestTokens } from './AssistantPanel.impact';
import { mentionedIds } from './AssistantPanel.mentions';
import type { AssistantMode } from './AssistantPanel.modes';
import {
  appendLiveProgress,
  initialRunProgress,
  receiptOf,
  reduceRunProgress,
} from './AssistantPanel.progress';
import {
  impactOfProposal,
  ownsRun,
  preflightPorts,
  requestPath,
  routeRequest,
  skillsForMode,
  withImpact,
  type RequestPath,
} from './AssistantPanel.runs';
import { historyOf, type PlanTurn, type Turn } from './AssistantPanel.turns';
import type { AskOrigin, BuildPlacement, QueuedAssistantRequest } from './AssistantPanel.types';
import { catalogPolicyFor } from './catalogPolicyFor';
import { runOutlineTurn } from './run-outline';
import type { AssistantRunInputs } from './use-page-build';

/** A build asked for by name (Plan's "Build this"), where no route says where it lands. */
const BUILD_IN_PLACE: BuildPlacement = {
  path: 'build',
  target: 'append',
  notices: [],
  confirm: false,
};

export interface AskInputs extends AssistantRunInputs {
  panelMode: AssistantMode;
  busy: boolean;
  /** What the assistant can see, stated: the selected block's type, or the page. */
  sees: string;
  selectedType: string | undefined;
  /** The provider with the catalog in front of it (pressed suggestions only). */
  catalogFirstProvider: AiPlanProvider;
  queuedRequest: QueuedAssistantRequest | null;
  setQueuedRequest: Dispatch<SetStateAction<QueuedAssistantRequest | null>>;
  setQueuePaused: Dispatch<SetStateAction<boolean>>;
  /** A page-sized request goes to the split build instead. */
  runBuild: (trimmed: string, mode: AssistantMode, placement: BuildPlacement) => Promise<void>;
}

/**
 * Ask the assistant. A busy panel QUEUES the request (one at a time); otherwise
 * the request is routed against the page it will run on: a page-sized request
 * becomes a split build, a question or a Plan-mode request is answered in
 * words (`runOutlineTurn`), and everything else is ONE agent run whose plan is
 * proposed (Ask) or applied (Auto) — always through the same door.
 */
export function useAsk({
  kernel,
  nextId,
  active,
  openTurn,
  patchTurns,
  beginFaceRun,
  onFaceEvent,
  settleFaceTurn,
  onAgentEvent,
  memory,
  memoryProvider,
  resolvedProvider,
  registry,
  selectedSkillIds,
  providerKind,
  agentPolicy,
  activeRunRef,
  setBusy,
  setDraft,
  panelMode,
  busy,
  sees,
  selectedType,
  catalogFirstProvider,
  queuedRequest,
  setQueuedRequest,
  setQueuePaused,
  runBuild,
}: AskInputs) {
  return useCallback(
    async (request: string, origin: AskOrigin = 'typed', capturedSelection?: readonly NodeId[]) => {
      const trimmed = request.trim();
      /*
        The mode this RUN carries, which is not always the one in state.
        `setMode` is asynchronous and this closure already holds the old value,
        so a build started from a planned page would otherwise plan again — the
        control would move and nothing would happen. Deciding it here keeps the
        run's authority and the visible control saying the same thing, which is
        the property the mode lock exists to protect.
      */
      const mode: AssistantMode = origin === 'build' ? 'ask' : panelMode;
      if (trimmed.length === 0) {
        return;
      }
      if (busy) {
        if (queuedRequest !== null) return;
        const selection = kernel.context.store.getState().selection;
        setQueuedRequest({
          request: trimmed,
          context: sees,
          selection,
          targetTypes: selection.map((id) => kernel.getDocument().nodes[id]?.type),
          state: 'editable',
        });
        setQueuePaused(false);
        setDraft('');
        return;
      }
      setQueuePaused(false);
      /*
        What the request is FOR, read against the page it will run on
        (2026-09-28). It used to ask whether a page-archetype skill
        auto-activated — keyword substrings — which sent 8 of 12 measured edits
        into a full page build and missed 14 of 17 page asks (agent-audit
        P0-1 / P1-5). The router reads the words AND the page: an empty page
        takes a bare subject as its brief, a pointed-at block keeps a
        page-like phrase an edit, and a page with content gets a new-page
        target rather than sections appended under it.

        "Build this" on a planned page is a build by definition — the plan it
        came from was one — whatever the words route to now.
      */
      const page = summarizeDocumentForIntent(kernel.getDocument());
      const routed = requestPath(
        routeRequest(trimmed, {
          kernel,
          ...(capturedSelection === undefined ? {} : { selection: capturedSelection }),
        }),
        {
          holdsContent: page.nodeCount > 0 && !page.placeholderOnly,
          /*
            Only a PagePlan build removes what is there, and the engine takes
            that path only with a provider that can plan a page and a registry
            holding the region block a plan is laid as (run-build's
            `planStep`). The playground's own provider cannot plan a page, so
            its builds append — and must not ask "start over?" first.
          */
          canStartOver:
            resolvedProvider.proposePagePlan !== undefined &&
            kernel.context.registry.block(customCodeSchema.type) !== undefined,
        },
      );
      const path: RequestPath =
        origin === 'build' && routed.path !== 'build' ? BUILD_IN_PLACE : routed;
      if (path.path === 'build') {
        await runBuild(trimmed, mode, path);
        return;
      }
      /*
        A QUESTION is answered in words by the one route that cannot write:
        no command vocabulary, no proposal, no Apply. `runAiAgent` cannot
        answer one — its validator refuses a plan with zero commands, so "how
        do I change the font?" came back as a refusal, or as edits nobody
        asked for.
      */
      const answersOnly = mode === 'plan' || path.path === 'answer';
      setBusy(true);
      setDraft('');
      const thinkingId = nextId('turn');
      // No spinner without a subject: the wait says what is being read.
      const subject = selectedType === undefined ? 'the page' : `the ${selectedType} block`;
      const youId = nextId('turn');
      openTurn(trimmed, youId, {
        id: thinkingId,
        from: 'assistant',
        kind: 'thinking',
        subject,
        run: initialRunProgress(
          mode === 'auto' && !answersOnly ? 'auto' : 'never',
          systemClock.now(),
        ),
      });

      const history = historyOf(active?.turns ?? []);

      const runId = nextId('run');
      const controller = new AbortController();
      activeRunRef.current = { runId, controller };
      /** What the recovery ladder left behind, if it ran at all. */
      let salvaged: PlanTurn['salvaged'];
      // Entered synchronously, so Send is answered before the run's first event.
      beginFaceRun(runId, subject);
      /*
        @mentions ARE the selection: naming a block in the request is the most
        direct way a person points at it, so named blocks (that really exist)
        replace the canvas selection as the request's focus.
      */
      const mentioned = mentionedIds(trimmed, kernel.getDocument());
      /*
        PLAN takes its own route, and it is a different function, not a flag.

        `runAiAgent` promises a plan of COMMANDS: it refuses an empty command
        policy before the provider is called, its validator rejects a plan with
        zero commands, and its output contract demands at least one. Threading
        "but not this time" through all three would have been three exceptions
        pretending to be one rule. `outlineAiPlan` asks the same provider, with
        the same skills and the same context, and simply never goes near the
        door — there is nothing to validate, because there is nothing to apply.
      */
      if (answersOnly) {
        await runOutlineTurn({
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
        });
        return;
      }

      const planSkills = skillsForMode(mode, selectedSkillIds);
      try {
        const result = await runAiAgent({
          runId,
          clock: systemClock,
          kernel,
          provider: origin === 'suggestion' ? catalogFirstProvider : resolvedProvider,
          request: trimmed,
          validationPorts: preflightPorts(),
          selection:
            mentioned.length > 0
              ? mentioned
              : (capturedSelection ?? kernel.context.store.getState().selection),
          history,
          ...(memory.hasRecords() ? { additionalContextProviders: [memoryProvider] } : {}),
          skillRegistry: registry,
          /*
            PLAN carries its own skill (see `skillsForMode`), which is what makes
            its request different from Ask's — and, through an empty
            `restrictToCommands` that intersects everything else down to nothing,
            what makes it structurally unable to write.
          */
          ...(planSkills === undefined ? {} : { selectedSkillIds: planSkills }),
          /*
            The host's policy wins over the catalog helper's, always: the helper
            supplies a budget the offline path needs, not a decision a host may
            not override.
          */
          ...catalogPolicyFor(
            providerKind,
            mentioned.length > 0 ? mentioned : kernel.context.store.getState().selection,
            agentPolicy,
          ),
          apply: mode === 'auto' ? 'auto' : 'never',
          signal: controller.signal,
          isCurrentRun: (candidateRunId) => activeRunRef.current?.runId === candidateRunId,
          onEvent: (event) => {
            onFaceEvent(event);
            /*
              A LOCAL, not state: the salvage is read once, at the end, to build
              the card. Putting it in state would re-render the panel mid-run to
              store something no view reads until the run is over — and a run
              salvages at most once, so there is nothing to accumulate.
            */
            if (event.type === 'plan.salvaged') {
              salvaged = { kept: event.kept, dropped: event.dropped };
            }
            patchTurns((previous) =>
              previous.map((turn) => {
                if (
                  turn.id !== thinkingId ||
                  turn.from !== 'assistant' ||
                  turn.kind !== 'thinking'
                ) {
                  return turn;
                }
                const run = reduceRunProgress(turn.run, event);
                if (run === turn.run && event.type !== 'plan.progress') return turn;
                const progressLog =
                  event.type === 'plan.progress'
                    ? appendLiveProgress(turn.progressLog, event.text)
                    : turn.progressLog;
                if (
                  event.type === 'plan.progress' &&
                  run === turn.run &&
                  turn.progress === event.text &&
                  progressLog === turn.progressLog
                ) {
                  return turn;
                }
                return {
                  ...turn,
                  run,
                  ...(event.type === 'plan.progress'
                    ? {
                        progress: event.text,
                        progressLog,
                      }
                    : {}),
                };
              }),
            );
            onAgentEvent?.(event);
          },
        });
        if (result.status === 'applied') {
          memory.note(result.proposal);
        }
        patchTurns((previous) =>
          previous.map((turn) =>
            turn.id === thinkingId
              ? {
                  id: turn.id,
                  from: 'assistant',
                  kind: 'plan',
                  plan: result.proposal.plan,
                  proposal: result.proposal,
                  skills: result.proposal.skillActivations,
                  applied: result.status === 'applied',
                  mode,
                  ...(salvaged === undefined ? {} : { salvaged }),
                  ...(result.status === 'applied'
                    ? {}
                    : withImpact(impactOfProposal(kernel, result.proposal))),
                  costTokens: estimateRequestTokens(trimmed, result.context, history),
                  ...(turn.from === 'assistant' && turn.kind === 'thinking'
                    ? { run: turn.run }
                    : {}),
                }
              : turn,
          ),
        );
        settleFaceTurn({ runId, outcome: 'plan', applied: result.status === 'applied' });
      } catch (cause: unknown) {
        /*
          Read once, outside the updater: the ending has ONE moment, and a
          state updater React may replay must not sample a clock twice.
          `run.cancelled` / `run.failed` are emitted before the runner
          rethrows, so the settled rows are already in state by the time this
          reduction runs — the receipt reads the finished run, not a guess.
        */
        const endedAt = systemClock.now();
        if (controller.signal.aborted) {
          // The person pressed Stop. That is an outcome, not an error.
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
          settleFaceTurn({ runId, outcome: 'stopped' });
        } else {
          const failure = classifyAiRunFailure(cause);
          patchTurns((previous) =>
            previous.map((turn): Turn => {
              if (turn.id !== thinkingId) return turn;
              const thinking = turn.from === 'assistant' && turn.kind === 'thinking' ? turn : null;
              const receipt =
                thinking === null ? null : receiptOf(thinking.run, endedAt, thinking.progress);
              return {
                id: turn.id,
                from: 'assistant',
                kind: 'refused',
                text: failure.message,
                failure,
                request: trimmed,
                ...(thinking !== null && thinking.run.failedAt !== null
                  ? { failedAt: thinking.run.failedAt }
                  : {}),
                ...(receipt === null ? {} : { receipt }),
              };
            }),
          );
          settleFaceTurn({ runId, outcome: 'refused', retryable: failure.retryable });
        }
      } finally {
        if (ownsRun(activeRunRef.current, runId)) {
          activeRunRef.current = null;
          setBusy(false);
        }
      }
    },
    [
      active,
      agentPolicy,
      beginFaceRun,
      busy,
      catalogFirstProvider,
      kernel,
      memory,
      memoryProvider,
      panelMode,
      queuedRequest,
      nextId,
      onAgentEvent,
      onFaceEvent,
      openTurn,
      patchTurns,
      resolvedProvider,
      providerKind,
      registry,
      runBuild,
      selectedSkillIds,
      selectedType,
      sees,
      settleFaceTurn,
      activeRunRef,
      setBusy,
      setDraft,
      setQueuedRequest,
      setQueuePaused,
    ],
  );
}
