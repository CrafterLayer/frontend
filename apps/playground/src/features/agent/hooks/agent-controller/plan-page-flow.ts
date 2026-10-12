/**
 * Plan mode's page plan (`planAiPage`, else the scaffold with `apply: 'never'`): the
 * plan card, and nothing written.
 */
import { type IntentTarget, planAiPage, runAiBuild } from '@craftkit/builder';

import { draftFromEnginePagePlan } from '../../model/page-plan-draft';
import { reduceRunTelemetry } from '../../model/run-telemetry';
import type { PagePlanTurn } from '../../model/turns';

import { plannedSections } from './build-flow';
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
import { commonRunOptions } from './run-options';
import { failureOf, failureTurn, say } from './run-outcomes';
import { patchTurn } from './turn-plumbing';

/* ── Plan mode: the page plan, and nothing written ───────────────────────────── */

export async function runPlanPage(
  flow: Flow,
  outgoing: Outgoing,
  placement: Placement,
  target: IntentTarget | undefined,
  unsure = false,
): Promise<void> {
  const env = flow.env();
  const kernel = env.options.kernel;
  const turnId = placement.recordTurnId ?? env.sessions.nextId('turn');
  const history = historyFor(flow, placement);
  const slot = claim(flow, placement.sessionId, turnId, 'plan');
  if (slot === null) return;
  const request = engineRequest(outgoing);
  const anchor = openExchange(flow, placement, outgoing, {
    id: turnId,
    kind: 'page-plan',
    request,
    status: 'drafting',
    subject: outgoing.text,
    sections: [],
    note: 'exact',
    editable: false,
  });
  env.mood.beginRun(slot.runId, '');
  say(flow, 'plan.drafting');
  const startedAt = flow.clock.now();
  /*
    A new page is planned as a page of its own (`new-page`: a header, a hero, a footer), and
    no page is opened until Build decides where it lands. Left unsaid, the engine's landing
    rule reads the page on screen: one with content means `append`, whose shape rules refuse
    the hero and footer a whole page has, twice, at the cost of two planning calls.
  */
  const landing = target;
  try {
    let ready: PagePlanTurn | null = null;
    if (env.capabilities.editablePlan && env.provider.proposePagePlan !== undefined) {
      const answer = await planAiPage(request, {
        ...commonRunOptions(flow, kernel, slot, request, outgoing.pointed, history),
        ...(landing === undefined ? {} : { target: landing }),
        onEvent: (event) => {
          if (!holds(flow, slot)) return;
          patchTurn(flow, slot.sessionId, turnId, (turn) => {
            const telemetry = reduceRunTelemetry(turn.telemetry, event);
            return telemetry === turn.telemetry ? turn : { ...turn, telemetry };
          });
        },
      });
      if (!holds(flow, slot)) throw stoppedError();
      if ('plan' in answer) {
        const draft = draftFromEnginePagePlan(answer.plan);
        ready = {
          id: turnId,
          kind: 'page-plan',
          request,
          status: 'ready',
          subject: draft.subject,
          ...(draft.direction === undefined ? {} : { direction: draft.direction }),
          sections: draft.sections,
          enginePlan: answer.plan,
          note: 'exact',
          editable: true,
        };
      } else if (answer.error.code !== 'unsupported') {
        throw Object.assign(new Error(answer.error.message), { failure: answer.error });
      }
    }
    if (ready === null) {
      // The scaffold's planning: the section list and the direction, nothing written.
      const result = await runAiBuild({
        ...commonRunOptions(flow, kernel, slot, request, outgoing.pointed, history),
        ...(landing === undefined ? {} : { target: landing }),
        apply: 'never',
        onEvent: (event) => {
          if (!holds(flow, slot)) return;
          patchTurn(flow, slot.sessionId, turnId, (turn) => {
            const telemetry = reduceRunTelemetry(turn.telemetry, event);
            return telemetry === turn.telemetry ? turn : { ...turn, telemetry };
          });
        },
      });
      if (!holds(flow, slot)) throw stoppedError();
      const mood = result.direction.replace(/\s+/gu, ' ').trim();
      ready = {
        id: turnId,
        kind: 'page-plan',
        request,
        status: 'ready',
        subject: outgoing.text,
        ...(mood === '' ? {} : { direction: { mood } }),
        sections: plannedSections(result.plannedTasks ?? []),
        // Titles only: Build re-plans from the request (SPEC §7.6 E6).
        note: 'mayDiffer',
        editable: false,
      };
    }
    const plan: PagePlanTurn = unsure ? { ...ready, unsure: true } : ready;
    patchTurn(flow, slot.sessionId, turnId, () => plan);
    say(flow, 'plan.ready');
    env.mood.settleTurn({ runId: slot.runId, outcome: 'plan', applied: false });
  } catch (cause: unknown) {
    if (slot.controller.signal.aborted) {
      patchTurn(flow, slot.sessionId, turnId, () => ({
        id: turnId,
        kind: 'end',
        key: 'stoppedBeforeChange',
      }));
      markNotRun(flow, slot.sessionId, anchor);
      say(flow, 'stopped.none');
      env.mood.settleTurn({ runId: slot.runId, outcome: 'stopped' });
    } else {
      const failure = failureOf(cause);
      patchTurn(flow, slot.sessionId, turnId, () =>
        failureTurn(turnId, request, cause, { kind: 'unchanged' }, flow.clock.now() - startedAt),
      );
      say(flow, 'failed');
      env.mood.settleTurn({ runId: slot.runId, outcome: 'refused', retryable: failure.retryable });
    }
  } finally {
    release(flow, slot);
  }
}
