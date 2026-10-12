/**
 * The words-only flow: a question answered, or a change plan written (Plan mode),
 * with `outlineAiPlan`. Nothing is written to the page.
 */
import { type NodeId, outlineAiPlan } from '@craftkit/builder';

import { catalogPolicyFor } from '../../../preview/components/AssistantPanel/catalogPolicyFor';
import { skillsForMode } from '../../model/runs';
import { stepsOf } from '../../model/steps';
import type { StepPlanTurn } from '../../model/turns';

import { type Flow, stoppedError } from './controller-state';
import {
  engineRequest,
  historyFor,
  markNotRun,
  openExchange,
  type Outgoing,
  type Placement,
} from './exchange';
import { claim, holds, release } from './run-lease';
import { contextProvidersOf } from './story-bible-context';
import { failureOf, failureTurn, say } from './run-outcomes';
import { placeRecord } from './turn-plumbing';

/* ── Words only: answers and change plans ────────────────────────────────────── */

export function targetOf(outgoing: Outgoing): { readonly label?: string; readonly id?: NodeId } {
  // An inferred type predicate: `target` is a block chip here, never the page scope.
  const target = outgoing.context.find((entry) => entry.kind !== 'page');
  return target === undefined ? {} : { label: target.label, id: target.id };
}

export async function runWords(
  flow: Flow,
  outgoing: Outgoing,
  placement: Placement,
  kind: 'answer' | 'steps',
): Promise<void> {
  const env = flow.env();
  const kernel = env.options.kernel;
  const turnId = placement.recordTurnId ?? env.sessions.nextId('turn');
  const history = historyFor(flow, placement);
  const target = targetOf(outgoing);
  const slot = claim(flow, placement.sessionId, turnId, kind === 'answer' ? 'answer' : 'plan');
  if (slot === null) return;
  const request = engineRequest(outgoing);
  // An answer has no drafting record: the RunBar says it is reading, the answer arrives whole.
  const anchor = openExchange(
    flow,
    placement,
    outgoing,
    kind === 'steps'
      ? {
          id: turnId,
          kind: 'step-plan',
          request,
          status: 'drafting',
          steps: [],
          text: '',
          dropped: 0,
        }
      : null,
  );
  env.mood.beginRun(slot.runId, target.label ?? '');
  if (kind === 'steps') say(flow, 'plan.drafting');
  const startedAt = flow.clock.now();
  try {
    const selectedSkillIds =
      kind === 'steps'
        ? skillsForMode('plan', env.options.selectedSkillIds)
        : env.options.selectedSkillIds;
    const outline = await outlineAiPlan({
      kernel,
      provider: env.provider,
      request,
      selection: outgoing.pointed,
      ...(history === undefined ? {} : { history }),
      // Answers and plans read the same memory a build does (the ledger, the bible, the project).
      ...contextProvidersOf(env),
      skillRegistry: env.registry,
      ...(selectedSkillIds === undefined ? {} : { selectedSkillIds }),
      ...catalogPolicyFor(
        env.options.providerKind ?? 'offline',
        outgoing.pointed,
        env.options.agentPolicy,
      ),
      signal: slot.controller.signal,
    });
    if (!holds(flow, slot)) throw stoppedError();
    const skills = outline.skillActivations;
    const followUp = outline.followUp === undefined ? {} : { followUp: outline.followUp };
    if (kind === 'answer') {
      placeRecord(flow, slot.sessionId, anchor, {
        id: turnId,
        kind: 'answer',
        text: outline.rationale,
        request,
        ...followUp,
        ...(skills === undefined ? {} : { skills }),
      });
      say(flow, 'answer.ready');
    } else {
      const steps: StepPlanTurn = {
        id: turnId,
        kind: 'step-plan',
        request,
        status: 'ready',
        steps: stepsOf(outline.rationale, target.label),
        text: outline.rationale,
        dropped: outline.droppedCommands,
        ...followUp,
        ...(skills === undefined ? {} : { skills }),
      };
      placeRecord(flow, slot.sessionId, anchor, steps);
      say(flow, 'plan.ready');
    }
    env.mood.settleTurn({ runId: slot.runId, outcome: 'plan', applied: false });
  } catch (cause: unknown) {
    if (slot.controller.signal.aborted) {
      placeRecord(flow, slot.sessionId, anchor, {
        id: turnId,
        kind: 'end',
        key: 'stoppedBeforeChange',
      });
      markNotRun(flow, slot.sessionId, anchor);
      say(flow, 'stopped.none');
      env.mood.settleTurn({ runId: slot.runId, outcome: 'stopped' });
    } else {
      const failure = failureOf(cause);
      placeRecord(
        flow,
        slot.sessionId,
        anchor,
        failureTurn(turnId, request, cause, { kind: 'unchanged' }, flow.clock.now() - startedAt),
      );
      say(flow, 'failed');
      env.mood.settleTurn({ runId: slot.runId, outcome: 'refused', retryable: failure.retryable });
    }
  } finally {
    release(flow, slot);
  }
}
