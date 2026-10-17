/**
 * The plan cards' actions: a page plan's Build (answering a held build, or a new
 * one in Plan mode) and its edits, and a change plan's "Run this plan".
 */
import { type BuildProgress, initialBuildProgress } from '../../model/build-progress';
import {
  applyPlanOp,
  draftFromEnginePagePlan,
  isEdited,
  planDraftOf,
  toEnginePagePlan,
} from '../../model/page-plan-draft';
import { type BuildTurn, historyOf, type PagePlanTurn } from '../../model/turns';
import type { PlanOp } from '../../model/view-types';
import { runViewTransition } from '../use-view-transition';

import { buildPlanned } from './build-flow';
import type { Flow } from './controller-state';
import { runEdit } from './edit-flow';
import { creativeMark, type Outgoing } from './exchange';
import { track } from './run-lease';
import { say } from './run-outcomes';
import { locateTurn, patchTurn, requestOf, sessionOf } from './turn-plumbing';

export function planCardActions(flow: Flow) {
  const env = flow.env;

  const build = (turnId: string): void => {
    const located = locateTurn(flow, turnId);
    const turn = located?.turn;
    if (located === null || turn?.kind !== 'page-plan' || turn.status !== 'ready') return;
    const draft = planDraftOf(turn);
    const checked = turn.enginePlan === undefined ? undefined : toEnginePagePlan(draft);
    // A plan the engine would refuse is not built; the card says why (`problems`).
    if (checked !== undefined && !checked.ok) return;
    const pagePlan = checked?.ok === true ? checked.plan : undefined;
    const request = turn.request ?? turn.subject;
    const held = flow.runtime.approvals.get(turnId);
    const inked = (progress: BuildProgress): BuildTurn => ({
      id: turnId,
      kind: 'build',
      request,
      progress,
      status: 'running',
      outcomes: {},
      ...creativeMark(flow.env(), request),
    });
    if (held !== undefined) {
      const edited =
        turn.enginePlan !== undefined && isEdited(draftFromEnginePagePlan(turn.enginePlan), draft);
      /*
        The card inks into its build in place (SPEC §5 moment 4): the turn becomes the
        build inside the transition, and the held question is answered only then, so no
        build event can arrive while the turn is still the card.
      */
      runViewTransition(() => {
        patchTurn(flow, located.sessionId, turnId, () =>
          inked(
            turn.heldBuild ??
              initialBuildProgress(flow.runtime.lease?.runId ?? turnId, flow.clock.now()),
          ),
        );
        flow.ui.setState((ui) =>
          ui.run === null ? ui : { ...ui, run: { ...ui.run, activity: 'build', awaiting: false } },
        );
        held(pagePlan !== undefined && edited ? { build: pagePlan } : 'build');
      });
      return;
    }
    if (flow.runtime.lease !== null) return;
    // Plan mode: a new run builds exactly the plan on the card (or re-plans: "may differ").
    const history = historyOf(sessionOf(flow, located.sessionId)?.turns ?? []);
    const outgoing: Outgoing = {
      text: request,
      context: [{ kind: 'page' }],
      pointed: [],
      skillSnapshot: requestOf(flow, turnId)?.skillSnapshot,
    };
    runViewTransition(() => {
      patchTurn(flow, located.sessionId, turnId, () =>
        inked(initialBuildProgress(turnId, flow.clock.now())),
      );
      void track(
        flow,
        buildPlanned(
          flow,
          outgoing,
          { sessionId: located.sessionId, recordTurnId: turnId, history },
          pagePlan,
        ),
      );
    });
  };

  const runSteps = (turnId: string): void => {
    const located = locateTurn(flow, turnId);
    const turn = located?.turn;
    if (located === null || turn?.kind !== 'step-plan' || turn.status !== 'ready') return;
    if (flow.runtime.lease !== null) return;
    const origin = requestOf(flow, turnId);
    const text = turn.request ?? origin?.text ?? '';
    if (text === '') return;
    const document = env().options.kernel.getDocument();
    const context = (origin?.context ?? []).filter(
      (entry) => entry.kind === 'page' || document.nodes[entry.id] !== undefined,
    );
    const pointed = context.flatMap((entry) => (entry.kind === 'page' ? [] : [entry.id]));
    // The plan itself rides in the history, so the run follows what the card showed.
    const turns = sessionOf(flow, located.sessionId)?.turns ?? [];
    const history = historyOf(turns.slice(0, located.index + 1));
    // Once, with authority to apply; the chosen mode does not change (SPEC §4.12).
    void track(
      flow,
      runEdit(
        flow,
        {
          text,
          context: context.length === 0 ? [{ kind: 'page' }] : context,
          pointed,
          skillSnapshot: origin?.skillSnapshot,
        },
        { sessionId: located.sessionId, recordTurnId: turnId, history },
        'auto',
      ),
    );
  };

  const editPlan = (turnId: string, op: PlanOp): void => {
    const located = locateTurn(flow, turnId);
    const turn = located?.turn;
    if (located === null || turn?.kind !== 'page-plan' || turn.status !== 'ready') return;
    if (!turn.editable || turn.enginePlan === undefined || !env().capabilities.editablePlan) return;
    const draft = planDraftOf(turn);
    const next = applyPlanOp(draft, op);
    if (next === draft) return;
    const edited = isEdited(draftFromEnginePagePlan(turn.enginePlan), next);
    const { edited: _was, direction: _direction, ...rest } = turn;
    void _was;
    void _direction;
    const updated: PagePlanTurn = {
      ...rest,
      subject: next.subject,
      sections: next.sections,
      ...(next.direction === undefined ? {} : { direction: next.direction }),
      ...(edited ? { edited: true } : {}),
    };
    patchTurn(flow, located.sessionId, turnId, () => updated);
    if (op.kind === 'move') {
      const index = next.sections.findIndex((section) => section.key === op.key);
      say(flow, 'plan.moved', {
        title: next.sections[index]?.title ?? '',
        i: index + 1,
        n: next.sections.length,
      });
    } else if (op.kind === 'remove') {
      say(flow, 'plan.removed', {
        title: draft.sections.find((section) => section.key === op.key)?.title ?? '',
      });
    }
  };

  return { build, runSteps, editPlan };
}
