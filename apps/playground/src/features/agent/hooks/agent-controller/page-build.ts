/**
 * One page's build under a run that already holds the lease: its checkpoint, the one
 * approval, the events that ink its record, and how the record settles.
 *
 * T230 (2026-10-12): split from build-flow.ts's `runBuild` so a site can build several
 * pages under ONE run, one lease, one Stop. A page build claims, opens its exchange and
 * hands its one page here; a site build (site-flow.ts) hands each of its pages, together.
 */
import {
  type AiAgentEvent,
  type AiBuildEvent,
  type AiBuildOwnEvent,
  type AiBuildPlanAnswer,
  type AiBuildPlannedTask,
  type BuilderKernel,
  type NodeId,
  type PagePlan,
  runAiBuild,
  type RunAiAgentOptions,
  type RunAiBuildOptions,
} from '@craftkit/builder';

import { type BuildProgress, landedCount, reduceBuildProgress } from '../../model/build-progress';
import { draftFromEnginePagePlan } from '../../model/page-plan-draft';
import { reduceRunTelemetry } from '../../model/run-telemetry';
import { sectionValues } from '../../model/successor-fill';
import type { BuildTurn, PagePlanTurn, Turn } from '../../model/turns';

import { type BuildPlan, failBuild, settleBuild } from './build-settle';
import type { Flow } from './controller-state';
import { followKernel } from './kernel-follow';
import { setRun, type Slot } from './run-lease';
import { commonRunOptions } from './run-options';
import { say } from './run-outcomes';
import { sceneProbeOptions } from './scene-probe-options';
import { locateTurn, patchKind, patchTurn } from './turn-plumbing';

export function plannedSections(planned: readonly AiBuildPlannedTask[]): PagePlanTurn['sections'] {
  return planned.map((task, index) => ({ key: `section-${String(index + 1)}`, title: task.title }));
}

/** The plan card an Ask build holds at (SPEC §3.7 "Waiting for your approval"). */
function approvalTurn(
  turnId: string,
  request: string,
  planned: readonly AiBuildPlannedTask[],
  direction: string,
  plan: PagePlan | undefined,
  held: BuildProgress,
  touched: boolean,
): PagePlanTurn {
  const common = {
    id: turnId,
    kind: 'page-plan',
    request,
    status: 'ready',
    // Build answers the held question: exactly these sections land (SPEC §7.6 E6).
    note: 'exact',
    approval: true,
    heldBuild: held,
    ...(touched ? { pageTouched: true as const } : {}),
  } as const;
  if (plan !== undefined) {
    const draft = draftFromEnginePagePlan(plan);
    return {
      ...common,
      subject: draft.subject,
      ...(draft.direction === undefined ? {} : { direction: draft.direction }),
      sections: draft.sections,
      enginePlan: plan,
      editable: true,
    };
  }
  const mood = direction.replace(/\s+/gu, ' ').trim();
  return {
    ...common,
    subject: request,
    ...(mood === '' ? {} : { direction: { mood } }),
    sections: plannedSections(planned),
    editable: false,
  };
}

/** What one page of a site shares with the others, and what is its own (site-flow.ts). */
export interface SitePagePart {
  /** Its own run id under the run's (`<run>/page-2`), so its events and record stay its own. */
  readonly runId: string;
  /** The page's name, which its record keeps through a plan card (`BuildTurn.page`). */
  readonly title: string;
  /** The writers' pool and the budget every page of the site builds with. */
  readonly engine: Pick<RunAiBuildOptions, 'writerPool' | 'buildBudgetMs'>;
  /** The site counts its pages held at a plan card: the run waits while any one does. */
  readonly hold: (held: boolean) => void;
}

/** One page to build: its record (already in the thread), its kernel, what it is asked. */
export interface PageBuild {
  readonly turnId: string;
  readonly kernel: BuilderKernel;
  readonly request: string;
  readonly pointed: readonly NodeId[];
  readonly history: RunAiAgentOptions['history'];
  /** The person's turn, marked "Not run" when nothing ran; null on one page of a site. */
  readonly anchor: string | null;
  readonly plan: BuildPlan;
  readonly site?: SitePagePart | undefined;
}

/**
 * Build one page, from the first event to the record it leaves. Never throws: a failure
 * is the record's. The caller holds the lease and gives it back.
 */
export async function buildPage(flow: Flow, slot: Slot, page: PageBuild): Promise<void> {
  const env = flow.env();
  const { kernel, turnId, request, plan } = page;
  const runId = page.site?.runId ?? slot.runId;
  followKernel(flow, kernel);
  const logBefore = kernel.transactions().length;
  const documentBefore = kernel.getDocument();
  // A checkpoint before anything is written: "Restore the page to before this request".
  env.options.checkpoints?.before(turnId, request, documentBefore);
  // On a site, other pages write the same log: only this page's own transactions count.
  const landed = plan.landed;
  const touched = (): boolean =>
    landed === undefined ? kernel.transactions().length > logBefore : landed().length > 0;
  const hold =
    page.site?.hold ??
    ((held: boolean): void => {
      setRun(flow, slot, held ? { awaiting: true, activity: 'plan' } : { awaiting: false });
    });

  const patchBuild = (change: (turn: BuildTurn) => Turn): void => {
    patchKind(flow, slot.sessionId, turnId, 'build', change);
  };

  /*
    The ONE approval, on the list. Asked before anything is written: the build turn
    becomes the plan card under the same id, and the run waits on this promise. Stop in
    the composer answers it too (the abort listener), so a person who wants out never has
    to find a second button.
  */
  const askToBuild = (
    planned: readonly AiBuildPlannedTask[],
    direction: string,
    pagePlan?: PagePlan,
  ): Promise<AiBuildPlanAnswer> =>
    new Promise<AiBuildPlanAnswer>((resolve) => {
      if (slot.controller.signal.aborted) {
        resolve('stop');
        return;
      }
      const settle = (answer: AiBuildPlanAnswer): void => {
        if (flow.runtime.approvals.get(turnId) !== settle) return;
        flow.runtime.approvals.delete(turnId);
        hold(false);
        // The card inked back into a build (plan-card-actions.ts): it names its page again.
        const title = page.site?.title;
        if (title !== undefined) patchBuild((turn) => ({ ...turn, page: title }));
        resolve(answer);
      };
      flow.runtime.approvals.set(turnId, settle);
      slot.controller.signal.addEventListener(
        'abort',
        () => {
          settle('stop');
        },
        { once: true },
      );
      patchBuild((turn) =>
        approvalTurn(turnId, request, planned, direction, pagePlan, turn.progress, touched()),
      );
      hold(true);
      say(flow, 'plan.ready');
    });

  const onEvent = (event: AiBuildEvent): void => {
    env.mood.onEvent(event);
    if (event.type.startsWith('build.') || event.type.startsWith('task.')) {
      env.options.onBuildEvent?.(event as AiBuildOwnEvent);
    } else {
      env.options.onAgentEvent?.(event as AiAgentEvent);
    }
    if (event.type === 'build.planned') {
      // The skeleton just landed: what each region holds now IS its placeholder.
      const document = kernel.getDocument();
      const placeholders = Object.fromEntries(
        event.tasks.map((task) => [task.id, sectionValues(document, task.id)]),
      );
      patchBuild((turn) => ({ ...turn, placeholders }));
      setRun(flow, slot, { activity: 'build', awaiting: false });
      say(flow, 'build.planned', { n: event.tasks.length });
    }
    patchBuild((turn) => {
      const progress = reduceBuildProgress(turn.progress, event);
      const step = event.runId.slice(runId.length + 1);
      const match = /^(?:fill|check)-(\d+)(?:-\d+)?$/u.exec(step);
      const task =
        event.runId.startsWith(`${runId}/`) && match !== null
          ? turn.progress.tasks.find((row) => row.position === Number(match[1]))
          : undefined;
      const scope = task?.title;
      const telemetry = reduceRunTelemetry(turn.telemetry, event, scope);
      return progress === turn.progress && telemetry === turn.telemetry
        ? turn
        : { ...turn, progress, telemetry };
    });
    if (event.type === 'task.completed') {
      const record = locateTurn(flow, turnId)?.turn;
      if (record?.kind === 'build') {
        env.live.landed(landedCount(record.progress), record.progress.tasks.length);
      }
      setRun(flow, slot, { lastLanding: { title: event.task.title, at: flow.clock.now() } });
    }
  };

  try {
    const buildOptions: RunAiBuildOptions = {
      ...commonRunOptions(flow, kernel, slot, request, page.pointed, page.history),
      // One page of a site answers to its own run id, under the run that holds the lease.
      ...(page.site === undefined
        ? {}
        : {
            runId,
            isCurrentRun: (candidate: string) =>
              candidate === runId && flow.runtime.lease?.runId === slot.runId,
            ...page.site.engine,
          }),
      ...(plan.target === undefined ? {} : { target: plan.target }),
      ...(plan.pagePlan === undefined ? {} : { pagePlan: plan.pagePlan }),
      ...(plan.approval ? { onPlanned: askToBuild } : {}),
      onEvent,
      fillConcurrency: flow.ui.getState().workers,
      ...sceneProbeOptions(flow.env().options.freeCode),
    };
    const result = await runAiBuild(buildOptions);
    settleBuild(flow, slot, turnId, page.anchor, kernel, result, plan, {
      logBefore,
      documentBefore,
    });
  } catch (cause: unknown) {
    failBuild(flow, slot, turnId, page.anchor, request, cause, landed);
  } finally {
    flow.runtime.approvals.delete(turnId);
    if (flow.runtime.superseded.delete(turnId)) {
      patchTurn(flow, slot.sessionId, turnId, (turn) =>
        turn.kind === 'page-plan' ||
        turn.kind === 'end' ||
        (turn.kind === 'build' && turn.progress.tasks.length === 0)
          ? { id: turnId, kind: 'end', key: 'planSuperseded' }
          : turn,
      );
    }
  }
}
