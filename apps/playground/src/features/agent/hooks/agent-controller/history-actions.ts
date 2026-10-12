/**
 * The undo and redo actions on records (a build's rows, the whole build, an edit),
 * removing empty regions, and the successor actions (Retry, Finish the rest).
 */
import {
  AiBuildRevertError,
  type AiBuildTaskReport,
  applyAiPlan,
  removeUnfilledSections,
  revertBuildSection,
} from '@craftkit/builder';

import { isNewest, isNextRedo } from '../../model/kernel-history';
import { preflightPorts } from '../../model/runs';
import { failedKeys, holdsValues, relandCommands, unwrittenKeys } from '../../model/successor-fill';
import { type BuildTurn, type LandingOutcome, outcomeKeyOf } from '../../model/turns';

import type { Flow } from './controller-state';
import { kernelOfBuild, shadowOf } from './kernel-follow';
import { track } from './run-lease';
import { say } from './run-outcomes';
import { runSuccessor } from './successor-flow';
import { locateTurn, patchKind } from './turn-plumbing';

export function historyActions(flow: Flow) {
  const env = flow.env;

  const buildTurnOf = (
    turnId: string,
  ): { readonly sessionId: string; readonly turn: BuildTurn } | null => {
    const located = locateTurn(flow, turnId);
    return located?.turn.kind === 'build'
      ? { sessionId: located.sessionId, turn: located.turn }
      : null;
  };

  const setOutcome = (
    sessionId: string,
    turnId: string,
    key: string,
    outcome: LandingOutcome,
  ): void => {
    patchKind(flow, sessionId, turnId, 'build', (turn) => ({
      ...turn,
      outcomes: { ...turn.outcomes, [key]: outcome },
    }));
  };

  const undoSection = (turnId: string, key: string): void => {
    const found = buildTurnOf(turnId);
    if (found === null || found.turn.revived === true || flow.runtime.lease !== null) return;
    const task = found.turn.progress.tasks.find((candidate) => candidate.id === key);
    if (task?.landing === undefined || task.status !== 'landed') return;
    const outcomeKey = outcomeKeyOf(task);
    if (found.turn.outcomes[outcomeKey]?.kind === 'undone') return;
    const kernel = kernelOfBuild(flow, turnId);
    const report: AiBuildTaskReport = {
      id: task.id,
      title: task.title,
      status: 'applied',
      attempts: task.attempts,
      landing: task.landing,
    };
    try {
      const applied = revertBuildSection(kernel, report, preflightPorts());
      const transactionId = applied.transactions.at(-1)?.id;
      setOutcome(found.sessionId, turnId, outcomeKey, {
        kind: 'undone',
        ...(transactionId === undefined ? {} : { transactionId }),
      });
      say(flow, 'undone', { title: task.title });
      env().mood.noteTurn('discarded');
    } catch (cause: unknown) {
      // A refusal writes nothing and is said on the row, in the section's own terms.
      if (cause instanceof AiBuildRevertError) {
        if (cause.code === 'not-landed') return;
        setOutcome(found.sessionId, turnId, outcomeKey, {
          kind: 'refused',
          why: cause.code === 'changed-since' ? 'changedSince' : 'regionMissing',
        });
        return;
      }
      setOutcome(found.sessionId, turnId, outcomeKey, { kind: 'refused', why: 'changedSince' });
    }
  };

  const redoSection = (turnId: string, key: string): void => {
    const found = buildTurnOf(turnId);
    if (found === null || found.turn.revived === true || flow.runtime.lease !== null) return;
    const task = found.turn.progress.tasks.find((candidate) => candidate.id === key);
    const landing = task?.landing;
    if (task === undefined || landing === undefined) return;
    const outcomeKey = outcomeKeyOf(task);
    if (found.turn.outcomes[outcomeKey]?.kind !== 'undone') return;
    const kernel = kernelOfBuild(flow, turnId);
    const document = kernel.getDocument();
    // Forward, like the Undo: only while the region still holds what the Undo put back.
    if (!holdsValues(document, task.id, landing.before)) {
      setOutcome(found.sessionId, turnId, outcomeKey, {
        kind: 'refused',
        why: document.nodes[task.id] === undefined ? 'regionMissing' : 'changedSince',
      });
      return;
    }
    const commands = relandCommands(task.id, landing);
    if (commands.length === 0) return;
    try {
      const applied = applyAiPlan({
        kernel,
        validationPorts: preflightPorts(),
        plan: { rationale: `Put the section "${task.title}" back as it was built.`, commands },
        policy: { allowedCommands: ['setProp'], maxCommands: commands.length },
        label: `Assistant: redo ${landing.label.replace(/^Assistant: /u, '')}`.slice(0, 160),
      });
      const transactionId = applied.transactions.at(-1)?.id;
      if (transactionId !== undefined) {
        setOutcome(found.sessionId, turnId, outcomeKey, { kind: 'redone', transactionId });
      }
      say(flow, 'redone', { title: task.title });
    } catch {
      setOutcome(found.sessionId, turnId, outcomeKey, { kind: 'refused', why: 'changedSince' });
    }
  };

  const removeEmpty = (turnId: string): void => {
    const found = buildTurnOf(turnId);
    if (found === null || flow.runtime.lease !== null) return;
    const kernel = kernelOfBuild(flow, turnId);
    const placeholders = found.turn.placeholders;
    const unfilled =
      placeholders === undefined
        ? (flow.runtime.builds.get(turnId)?.result?.unfilled ?? [])
        : found.turn.progress.tasks.flatMap((task) => {
            const placeholder = placeholders[task.id];
            return task.status === 'landed' || placeholder === undefined
              ? []
              : [{ id: task.id, title: task.title, placeholder }];
          });
    if (unfilled.length === 0) return;
    try {
      const removal = removeUnfilledSections(kernel, { unfilled }, preflightPorts());
      if (removal.removed.length > 0) {
        patchKind(flow, found.sessionId, turnId, 'build', (turn) => ({
          ...turn,
          placeholdersRemoved: true,
        }));
        env().mood.noteTurn('discarded');
      }
    } catch {
      // Refused whole, so nothing was removed: the offer stays, and is still honest.
    }
  };

  const undoBuild = (turnId: string): void => {
    const found = buildTurnOf(turnId);
    if (found === null || found.turn.revived === true || found.turn.undone === true) return;
    if (found.turn.status !== 'settled' || flow.runtime.lease !== null) return;
    const kernel = kernelOfBuild(flow, turnId);
    const ids = found.turn.transactionIds ?? [];
    if (isNewest(shadowOf(flow, kernel), ids)) {
      // Exactly the build's own transactions, newest first: the skeleton goes too.
      ids.forEach(() => {
        kernel.undo();
      });
      patchKind(flow, found.sessionId, turnId, 'build', (turn) => ({ ...turn, undone: true }));
      say(flow, 'undone', { title: found.turn.request });
      env().mood.noteTurn('discarded');
      return;
    }
    if (!env().capabilities.rowUndo || !env().capabilities.undoBuild) return;
    // Engine E3 present: every landed section back, newest first, then the empty regions.
    const landed = [...found.turn.progress.tasks]
      .reverse()
      .filter((task) => task.status === 'landed');
    for (const task of landed) undoSection(turnId, task.id);
    removeEmpty(turnId);
    const after = buildTurnOf(turnId)?.turn;
    const reverted = landed.filter(
      (task) => after?.outcomes[outcomeKeyOf(task)]?.kind === 'undone',
    ).length;
    if (reverted === 0) return;
    // "Undone" only when every section went back; a refused row says why on its own line.
    if (reverted === landed.length) {
      patchKind(flow, found.sessionId, turnId, 'build', (turn) => ({ ...turn, undone: true }));
    }
    say(flow, 'undone', { title: found.turn.request });
    env().mood.noteTurn('discarded');
  };

  const redoBuild = (turnId: string): void => {
    const found = buildTurnOf(turnId);
    if (found?.turn.undone !== true || flow.runtime.lease !== null) return;
    const kernel = kernelOfBuild(flow, turnId);
    const ids = found.turn.transactionIds ?? [];
    if (!isNextRedo(shadowOf(flow, kernel), ids)) return;
    ids.forEach(() => {
      kernel.redo();
    });
    patchKind(flow, found.sessionId, turnId, 'build', (turn) => {
      const { undone: _undone, ...rest } = turn;
      void _undone;
      return rest;
    });
    say(flow, 'redone', { title: found.turn.request });
  };

  const undoEdit = (turnId: string): void => {
    const located = locateTurn(flow, turnId);
    const turn = located?.turn;
    if (located === null || turn?.kind !== 'edit' || turn.revived === true) return;
    if (turn.outcome?.kind === 'undone' || flow.runtime.lease !== null) return;
    const transactionId =
      turn.outcome?.kind === 'redone' ? turn.outcome.transactionId : turn.transactionId;
    const kernel = env().options.kernel;
    if (transactionId === undefined || !isNewest(shadowOf(flow, kernel), [transactionId])) return;
    kernel.undo();
    patchKind(flow, located.sessionId, turnId, 'edit', (current) => ({
      ...current,
      outcome: { kind: 'undone', transactionId },
    }));
    say(flow, 'undone', { title: turn.target ?? turn.request ?? '' });
    env().mood.noteTurn('discarded');
  };

  const redoEdit = (turnId: string): void => {
    const located = locateTurn(flow, turnId);
    const turn = located?.turn;
    if (located === null || turn?.kind !== 'edit' || turn.outcome?.kind !== 'undone') return;
    if (flow.runtime.lease !== null) return;
    const transactionId = turn.outcome.transactionId;
    const kernel = env().options.kernel;
    if (transactionId === undefined || !isNextRedo(shadowOf(flow, kernel), [transactionId])) return;
    kernel.redo();
    patchKind(flow, located.sessionId, turnId, 'edit', (current) => ({
      ...current,
      outcome: { kind: 'redone', transactionId },
    }));
    say(flow, 'redone', { title: turn.target ?? turn.request ?? '' });
  };

  const retrySections = (turnId: string, keys: readonly string[]): void => {
    const found = buildTurnOf(turnId);
    if (found === null || flow.runtime.lease !== null) return;
    const wanted = keys.length === 0 ? failedKeys(found.turn.progress) : keys;
    void track(flow, runSuccessor(flow, turnId, wanted));
  };

  const finishRest = (turnId: string): void => {
    const found = buildTurnOf(turnId);
    if (found === null || flow.runtime.lease !== null) return;
    void track(flow, runSuccessor(flow, turnId, unwrittenKeys(found.turn.progress)));
  };

  return {
    undoSection,
    redoSection,
    removeEmpty,
    undoBuild,
    redoBuild,
    undoEdit,
    redoEdit,
    retrySections,
    finishRest,
  };
}
