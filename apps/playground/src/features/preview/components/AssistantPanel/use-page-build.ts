import { useCallback, type Dispatch, type RefObject, type SetStateAction } from 'react';

import {
  classifyAiRunFailure,
  runAiBuild,
  systemClock,
  type AiAgentEvent,
  type AiAgentPolicy,
  type AiBuildOwnEvent,
  type AiBuildPlannedTask,
  type AiPlanProvider,
  type AiSkillRegistry,
  type BuilderKernel,
  type PagePlan,
} from '@craftkit/builder';

import type { UseAgentMoodResult } from '../AgentFace';
import {
  buildReceipt,
  initialBuildProgress,
  planForApproval,
  reduceBuildProgress,
  withoutStartOver,
} from './AssistantPanel.build';
import type { AppliedChangeMemory } from './AssistantPanel.memory';
import type { AssistantMode } from './AssistantPanel.modes';
import { receiptOf } from './AssistantPanel.progress';
import {
  impactOfProposal,
  isBuildOwnEvent,
  ownsRun,
  preflightPorts,
  withImpact,
  type ActiveRunLease,
} from './AssistantPanel.runs';
import { historyOf, type BuildingTurn, type Session, type Turn } from './AssistantPanel.turns';
import type { BuildPlacement, BuildRecord } from './AssistantPanel.types';
import { catalogPolicyFor, type ProviderKind } from './catalogPolicyFor';

/** What a run borrows from the panel: its conversation, its face, its lease and its provider. */
export interface AssistantRunInputs {
  kernel: BuilderKernel;
  nextId: (prefix: string) => string;
  active: Session | undefined;
  openTurn: (trimmed: string, youId: string, reply: Turn) => void;
  patchTurns: (change: (previous: readonly Turn[]) => readonly Turn[]) => void;
  beginFaceRun: UseAgentMoodResult['beginRun'];
  onFaceEvent: UseAgentMoodResult['onEvent'];
  settleFaceTurn: UseAgentMoodResult['settleTurn'];
  onAgentEvent: ((event: AiAgentEvent) => void) | undefined;
  memory: AppliedChangeMemory;
  memoryProvider: AppliedChangeMemory['provider'];
  resolvedProvider: AiPlanProvider;
  registry: AiSkillRegistry;
  selectedSkillIds: readonly string[] | undefined;
  providerKind: ProviderKind;
  agentPolicy: Partial<AiAgentPolicy> | undefined;
  /** A lease and controller for the one run allowed to own this panel. */
  activeRunRef: RefObject<ActiveRunLease | null>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setDraft: Dispatch<SetStateAction<string>>;
}

export interface PageBuildInputs extends AssistantRunInputs {
  onBuildEvent: ((event: AiBuildOwnEvent) => void) | undefined;
  /** The pending answer to a build's ONE question (a ref: no view reads it). */
  approvalRef: RefObject<((answer: 'build' | 'stop') => void) | null>;
  /** Every finished build this panel ran, by its report turn's id. */
  buildsRef: RefObject<Map<string, BuildRecord>>;
}

/**
 * A PAGE, built as a skeleton plus one run per section.
 *
 * The orchestrator is the same one the engine tests: this function is only
 * the wiring — it opens the turn, forwards the events into the pure reducer,
 * resolves the one approval from the UI, and turns the ending into a report.
 * Everything it does not route here still goes down the single-call path,
 * unchanged.
 */
export function usePageBuild({
  kernel,
  nextId,
  active,
  openTurn,
  patchTurns,
  beginFaceRun,
  onFaceEvent,
  settleFaceTurn,
  onAgentEvent,
  onBuildEvent,
  memory,
  memoryProvider,
  resolvedProvider,
  registry,
  selectedSkillIds,
  providerKind,
  agentPolicy,
  activeRunRef,
  approvalRef,
  buildsRef,
  setBusy,
  setDraft,
}: PageBuildInputs) {
  return useCallback(
    async (trimmed: string, mode: AssistantMode, placement: BuildPlacement) => {
      setBusy(true);
      setDraft('');
      const youId = nextId('turn');
      const buildId = nextId('turn');
      const runId = nextId('run');
      const controller = new AbortController();
      activeRunRef.current = { runId, controller };
      const startedAt = systemClock.now();
      openTurn(trimmed, youId, {
        id: buildId,
        from: 'assistant',
        kind: 'building',
        request: trimmed,
        progress: initialBuildProgress(runId, startedAt),
        ...(placement.notices.length === 0 ? {} : { notices: placement.notices }),
      });
      const history = historyOf(active?.turns ?? []);
      // Entered synchronously, so Send is answered before the build's first event.
      beginFaceRun(runId, 'the page');

      const patchBuilding = (change: (turn: BuildingTurn) => Turn): void => {
        patchTurns((previous) =>
          previous.map((turn) =>
            turn.id === buildId && turn.from === 'assistant' && turn.kind === 'building'
              ? change(turn)
              : turn,
          ),
        );
      };

      /*
        The ONE approval, and it is on the LIST — "you understood me, go" —
        not on each of eight sections in turn.

        Asked BEFORE anything is written (2026-09-28, agent-audit P0-4): the
        engine hands over the sections the skeleton WOULD create, the
        direction, and — on a PagePlan build — the plan itself, and lands the
        skeleton only on 'build'. So the card's rows come from these arguments:
        `build.planned`, which they used to be read from, now fires only after
        the answer, and an approval card drawn from it listed nothing.
      */
      const askToBuild = (
        planned: readonly AiBuildPlannedTask[],
        direction: string,
        plan?: PagePlan,
      ): Promise<'build' | 'stop'> =>
        new Promise<'build' | 'stop'>((resolve) => {
          if (controller.signal.aborted) {
            resolve('stop');
            return;
          }
          const settle = (answer: 'build' | 'stop'): void => {
            patchBuilding((turn) => ({ ...turn, awaiting: false }));
            resolve(answer);
          };
          approvalRef.current = settle;
          // Stop in the composer answers the question too — a person who wants
          // out must never have to find the second button to say so.
          controller.signal.addEventListener(
            'abort',
            () => {
              if (approvalRef.current === settle) {
                approvalRef.current = null;
                settle('stop');
              }
            },
            { once: true },
          );
          patchBuilding((turn) => ({
            ...turn,
            awaiting: true,
            progress: planForApproval(turn.progress, planned, direction, plan),
            /*
              Asked with no page plan in hand, this is a SCAFFOLD build — the
              provider could not plan the page, or its plan was refused — and
              a scaffold appends whatever the target. A start-over promised
              when the request arrived is taken back here, before the person
              decides, not after.
            */
            ...(plan === undefined && turn.notices !== undefined
              ? { notices: withoutStartOver(turn.notices) }
              : {}),
          }));
        });

      const selection = kernel.context.store.getState().selection;
      try {
        const result = await runAiBuild({
          runId,
          clock: systemClock,
          kernel,
          provider: resolvedProvider,
          request: trimmed,
          validationPorts: preflightPorts(),
          selection,
          history,
          ...(memory.hasRecords() ? { additionalContextProviders: [memoryProvider] } : {}),
          skillRegistry: registry,
          ...(selectedSkillIds === undefined ? {} : { selectedSkillIds }),
          ...catalogPolicyFor(providerKind, selection, agentPolicy),
          /*
            Where the page lands, from the router (P1-15). A new page cannot
            be opened from here, so `requestPath` has already turned that into
            'append' and put the reason on the card.
          */
          target: placement.target,
          /*
            PLAN never writes, here as everywhere else. The build stops at the
            skeleton, proposes it instead of applying it, and reports the
            sections it would have filled.
          */
          ...(mode === 'plan' ? { apply: 'never' as const } : {}),
          /*
            Ask waits on the list; Auto does not wait at all. An `onPlanned`
            that always answered 'build' would be the same behaviour with a lie
            in the middle, so Auto omits the hook entirely. Plan is never asked:
            there is nothing to approve when nothing will be written.
          */
          ...(mode === 'ask' || (mode === 'auto' && placement.confirm)
            ? { onPlanned: askToBuild }
            : {}),
          signal: controller.signal,
          isCurrentRun: (candidateRunId) => activeRunRef.current?.runId === candidateRunId,
          onEvent: (event) => {
            if (isBuildOwnEvent(event)) {
              onBuildEvent?.(event);
            } else {
              onFaceEvent(event);
              onAgentEvent?.(event);
            }
            patchBuilding((turn) => {
              const progress = reduceBuildProgress(turn.progress, event);
              return progress === turn.progress ? turn : { ...turn, progress };
            });
          },
        });

        if (result.outcome === 'planned') {
          /*
            PLAN MODE reached the build path and stopped at the skeleton.

            The card is an outline, not a build report: nothing was written, no
            section was filled, and there is nothing to undo. What it adds over
            an ordinary outline is the section LIST the skeleton proposed, and
            one action to build it for real — as a new run, at an authority this
            one never had.
          */
          patchTurns((previous) =>
            previous.map((turn): Turn =>
              turn.id === buildId
                ? {
                    id: turn.id,
                    from: 'assistant',
                    kind: 'outline',
                    text: result.direction,
                    dropped: 0,
                    sections: (result.plannedTasks ?? []).map((task) => task.title),
                    request: trimmed,
                    ...(result.scaffold === undefined
                      ? {}
                      : { skills: result.scaffold.proposal.skillActivations }),
                  }
                : turn,
            ),
          );
          settleFaceTurn({ runId, outcome: 'plan', applied: false });
          return;
        }

        if (result.outcome === 'fallback' && result.fallback !== undefined) {
          /*
            NOT a build. The scaffold produced fewer than two regions and one
            ordinary run replaced it, so the card is the ordinary plan card and
            nothing about it mentions sections — a build must never be worse
            than the single call it replaces, and must not pretend either.
          */
          const fallback = result.fallback;
          if (fallback.status === 'applied') {
            memory.note(fallback.proposal);
          }
          patchTurns((previous) =>
            previous.map((turn): Turn =>
              turn.id === buildId
                ? {
                    id: turn.id,
                    from: 'assistant',
                    kind: 'plan',
                    plan: fallback.proposal.plan,
                    proposal: fallback.proposal,
                    skills: fallback.proposal.skillActivations,
                    applied: fallback.status === 'applied',
                    mode,
                    /*
                      Rehearsed against the document as it is NOW. For an
                      already-applied plan that is the document the plan
                      produced, so the diff is empty and the card says nothing —
                      correct: "what would change" is a question about a
                      decision that has not been made yet.
                    */
                    ...(fallback.status === 'applied'
                      ? {}
                      : withImpact(impactOfProposal(kernel, fallback.proposal))),
                  }
                : turn,
            ),
          );
          settleFaceTurn({ runId, outcome: 'plan', applied: fallback.status === 'applied' });
          return;
        }

        // Read once, outside the updater: an ending has ONE moment, and a
        // state updater React may replay must not sample a clock twice.
        const endedAt = systemClock.now();

        if (result.tasks.length === 0) {
          /*
            NOTHING WAS WRITTEN. Refused at the question, stopped while the
            question was open, or stopped before the skeleton landed: the
            engine returns no section at all, because no region was ever
            created. It used to be drawn as a stopped, UNDOABLE build report —
            "0/3" with rows for sections that were never on the page. It is a
            plain stop, with nothing to undo.
          */
          patchTurns((previous) =>
            previous.map((turn): Turn => {
              if (turn.id !== buildId) return turn;
              const run =
                turn.from === 'assistant' && turn.kind === 'building' ? turn.progress.run : null;
              const receipt = run === null ? null : receiptOf(run, endedAt);
              return {
                id: turn.id,
                from: 'assistant',
                kind: 'stopped',
                ...(receipt === null ? {} : { receipt }),
              };
            }),
          );
          settleFaceTurn({ runId, outcome: 'stopped' });
          return;
        }

        if (result.scaffold?.status === 'applied') {
          memory.note(result.scaffold.proposal);
        }
        buildsRef.current.set(buildId, { kernel, result });
        const unfilled = result.unfilled?.length ?? 0;
        patchTurns((previous) =>
          previous.map((turn): Turn => {
            if (turn.id !== buildId || turn.from !== 'assistant' || turn.kind !== 'building') {
              return turn;
            }
            const receipt = buildReceipt(turn.progress, endedAt);
            /*
              Said as what the build DID: a build with no page plan was a
              scaffold build, which appended — so a start-over it was asked
              for did not happen, and the card must not promise its Undo.
            */
            const notices =
              turn.notices === undefined || result.pagePlan !== undefined
                ? turn.notices
                : withoutStartOver(turn.notices);
            return {
              id: turn.id,
              from: 'assistant',
              kind: 'built',
              progress: turn.progress,
              request: trimmed,
              undoable: true,
              ...(receipt === null ? {} : { receipt }),
              ...(result.outcome === 'completed' ? {} : { stopped: true }),
              ...(notices === undefined ? {} : { notices }),
              ...(unfilled === 0 ? {} : { unfilled }),
            };
          }),
        );
        if (result.outcome === 'completed') {
          settleFaceTurn({ runId, outcome: 'plan', applied: result.applied > 0 });
        } else {
          settleFaceTurn({ runId, outcome: 'stopped' });
        }
      } catch (cause: unknown) {
        const endedAt = systemClock.now();
        const failure = controller.signal.aborted ? null : classifyAiRunFailure(cause);
        patchTurns((previous) =>
          previous.map((turn): Turn => {
            if (turn.id !== buildId) return turn;
            const building = turn.from === 'assistant' && turn.kind === 'building' ? turn : null;
            if (failure !== null) {
              return {
                id: turn.id,
                from: 'assistant',
                kind: 'refused',
                text: failure.message,
                failure,
                request: trimmed,
              };
            }
            /*
              Stopped. A build whose skeleton never landed — still laying it
              out, or still asking about it (the approval rows name no node) —
              is an ordinary stop and reads as one: a report saying "0/3"
              would be a card about sections that were never on the page.
            */
            if (
              building === null ||
              building.progress.phase === 'scaffolding' ||
              building.progress.phase === 'fallback' ||
              building.progress.tasks.length === 0
            ) {
              const run = building?.progress.run ?? null;
              const receipt = run === null ? null : receiptOf(run, endedAt);
              return {
                id: turn.id,
                from: 'assistant',
                kind: 'stopped',
                ...(receipt === null ? {} : { receipt }),
              };
            }
            const receipt = buildReceipt(building.progress, endedAt);
            /*
              Not undoable: the engine threw instead of returning, so there is
              no record of what each section landed as — and putting a section
              back without one would be a guess. The global Undo still works.
            */
            return {
              id: turn.id,
              from: 'assistant',
              kind: 'built',
              progress: building.progress,
              request: trimmed,
              stopped: true,
              ...(receipt === null ? {} : { receipt }),
              ...(building.notices === undefined ? {} : { notices: building.notices }),
            };
          }),
        );
        settleFaceTurn(
          failure === null
            ? { runId, outcome: 'stopped' }
            : { runId, outcome: 'refused', retryable: failure.retryable },
        );
      } finally {
        approvalRef.current = null;
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
      kernel,
      memory,
      memoryProvider,
      nextId,
      onAgentEvent,
      onBuildEvent,
      onFaceEvent,
      openTurn,
      patchTurns,
      resolvedProvider,
      providerKind,
      registry,
      selectedSkillIds,
      settleFaceTurn,
      activeRunRef,
      approvalRef,
      buildsRef,
      setBusy,
      setDraft,
    ],
  );
}
