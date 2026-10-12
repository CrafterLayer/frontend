/**
 * The page build flow (`runAiBuild`): where a build lands, Plan mode's Build of a
 * planned page, the plan card an Ask build holds at, and the run itself.
 */
import {
  type AiAgentEvent,
  type AiBuildEvent,
  type AiBuildOwnEvent,
  type AiBuildPlanAnswer,
  type AiBuildPlannedTask,
  type BuilderKernel,
  customCodeSchema,
  type IntentRoute,
  type IntentTarget,
  type PagePlan,
  runAiBuild,
  type RunAiBuildOptions,
  summarizeDocumentForIntent,
  validatePagePlan,
} from '@craftkit/builder';

import {
  type BuildProgress,
  initialBuildProgress,
  landedCount,
  reduceBuildProgress,
} from '../../model/build-progress';
import { draftFromEnginePagePlan } from '../../model/page-plan-draft';
import { reduceRunTelemetry } from '../../model/run-telemetry';
import { routeRequest } from '../../model/runs';
import { sectionValues } from '../../model/successor-fill';
import type { BuildTurn, PagePlanTurn, Turn } from '../../model/turns';
import type { AssistantMode, EndNoteKey } from '../../model/view-types';

import { type BuildPlan, failBuild, settleBuild } from './build-settle';
import { type Flow, pageTitleFrom } from './controller-state';
import {
  creativeMark,
  engineRequest,
  historyFor,
  openExchange,
  type Outgoing,
  type Placement,
} from './exchange';
import { followKernel } from './kernel-follow';
import { claim, release, setRun } from './run-lease';
import { commonRunOptions } from './run-options';
import { say } from './run-outcomes';
import { sceneProbeOptions } from './scene-probe-options';
import { locateTurn, patchKind, patchTurn } from './turn-plumbing';

/* ── Builds ──────────────────────────────────────────────────────────────────── */

/**
 * Whether a build here can remove what is on the page before laying its own: only a
 * page-plan build does (`replace`), and only with a provider that can plan a page and a
 * registry holding the region block a plan is laid as (`run-build.ts` `planStep`).
 */
function canStartOver(flow: Flow, kernel: BuilderKernel): boolean {
  return (
    flow.env().provider.proposePagePlan !== undefined &&
    kernel.context.registry.block(customCodeSchema.type) !== undefined
  );
}

/** Where a page build lands, and what the thread says about it afterwards. */
interface Landing {
  readonly kernel: BuilderKernel;
  readonly target: IntentTarget | undefined;
  readonly notes: readonly EndNoteKey[];
  /** A start-over on a page with content: the plan card asks first, even in Auto. */
  readonly confirm: boolean;
}

/**
 * The landing decisions every page build shares (v1 `requestPath`): a new page opens
 * through the host's `addPage` when it offers one, else the page is built below this one
 * and the thread says so; a start-over the build cannot do appends, and says so; a
 * start-over it can do asks first.
 */
async function landingFor(
  flow: Flow,
  wanted: IntentTarget | undefined,
  request: string,
  notes: readonly EndNoteKey[],
): Promise<Landing> {
  const env = flow.env();
  let kernel = env.options.kernel;
  const said = [...notes];
  let target = wanted;
  if (target === 'new-page') {
    const addPage = env.options.addPage;
    if (addPage === undefined) {
      target = 'append';
      said.push('newPageAppended');
    } else {
      try {
        kernel = (await addPage(pageTitleFrom(request))).kernel;
      } catch {
        target = 'append';
        said.push('newPageAppended');
      }
    }
  }
  const page = summarizeDocumentForIntent(kernel.getDocument());
  const holdsContent = page.nodeCount > 0 && !page.placeholderOnly;
  let confirm = false;
  if (target === 'replace' && holdsContent) {
    if (canStartOver(flow, kernel)) {
      // A misread "start over" must not take a person's page without a question, even in Auto.
      confirm = true;
    } else {
      target = 'append';
      said.push('appendedNotReplaced');
    }
  }
  return { kernel, target, notes: said, confirm };
}

export async function runPage(
  flow: Flow,
  outgoing: Outgoing,
  placement: Placement,
  route: IntentRoute,
  mode: AssistantMode,
): Promise<void> {
  const landing = await landingFor(
    flow,
    route.target,
    outgoing.text,
    route.kind === 'build-site' ? ['siteAsOnePage'] : [],
  );
  await runBuild(flow, outgoing, placement, {
    target: landing.target,
    approval: mode === 'ask' || landing.confirm,
    kernel: landing.kernel,
    notes: landing.notes,
  });
}

/**
 * Plan mode's Build: the plan on the card, built verbatim, where its intent says (a new
 * page through the host, else below this one, and said). The card WAS the question, so
 * nothing is asked again. A titles-only card (no engine plan) is built from its request,
 * as a page, and may differ (SPEC §7.6 E6 `plan.note.mayDiffer`).
 */
export async function buildPlanned(
  flow: Flow,
  outgoing: Outgoing,
  placement: Placement,
  pagePlan: PagePlan | undefined,
): Promise<void> {
  if (pagePlan === undefined) {
    const routed = routeRequest(outgoing.text, {
      kernel: flow.env().options.kernel,
      mentions: [],
      selection: [],
    });
    const route: IntentRoute =
      routed.kind === 'build-page' || routed.kind === 'build-site'
        ? routed
        : { kind: 'build-page', confidence: 1, reason: 'Built from a page plan.' };
    await runPage(flow, outgoing, placement, route, 'auto');
    return;
  }
  const landing = await landingFor(flow, pagePlan.intent, outgoing.text, []);
  let plan: PagePlan | undefined = pagePlan;
  if (landing.target !== undefined && landing.target !== pagePlan.intent) {
    // Landing elsewhere than planned: the same plan, held to the new intent, or re-planned.
    const moved = validatePagePlan(pagePlan, { intent: landing.target });
    plan = moved.ok ? moved.plan : undefined;
  }
  await runBuild(flow, outgoing, placement, {
    ...(plan === undefined ? {} : { pagePlan: plan }),
    target: landing.target,
    approval: false,
    kernel: landing.kernel,
    notes: landing.notes,
  });
}

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

/**
 * One page build, from the first event to the record it leaves. `recordTurnId` re-runs
 * into an existing turn (a plan card's Build), so the list inks in place.
 */
async function runBuild(
  flow: Flow,
  outgoing: Outgoing,
  placement: Placement,
  plan: BuildPlan,
): Promise<void> {
  const env = flow.env();
  const kernel = plan.kernel ?? env.options.kernel;
  const turnId = placement.recordTurnId ?? env.sessions.nextId('turn');
  const history = historyFor(flow, placement);
  const slot = claim(flow, placement.sessionId, turnId, 'build');
  if (slot === null) return;
  followKernel(flow, kernel);
  const request = engineRequest(outgoing);
  const building: BuildTurn = {
    id: turnId,
    kind: 'build',
    request,
    progress: initialBuildProgress(slot.runId, flow.clock.now()),
    status: 'running',
    outcomes: {},
    ...creativeMark(env, request),
  };
  const anchor = openExchange(flow, placement, outgoing, building);
  env.mood.beginRun(slot.runId, '');
  say(flow, 'build.started');
  const logBefore = kernel.transactions().length;
  const documentBefore = kernel.getDocument();
  // A checkpoint before anything is written: "Restore the page to before this request".
  env.options.checkpoints?.before(turnId, request, documentBefore);

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
        setRun(flow, slot, { awaiting: false });
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
      const touched = kernel.transactions().length > logBefore;
      patchBuild((turn) =>
        approvalTurn(turnId, request, planned, direction, pagePlan, turn.progress, touched),
      );
      setRun(flow, slot, { awaiting: true, activity: 'plan' });
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
      const step = event.runId.slice(slot.runId.length + 1);
      const match = /^(?:fill|check)-(\d+)(?:-\d+)?$/u.exec(step);
      const task =
        event.runId.startsWith(`${slot.runId}/`) && match !== null
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
      ...commonRunOptions(flow, kernel, slot, request, outgoing.pointed, history),
      ...(plan.target === undefined ? {} : { target: plan.target }),
      ...(plan.pagePlan === undefined ? {} : { pagePlan: plan.pagePlan }),
      ...(plan.approval ? { onPlanned: askToBuild } : {}),
      onEvent,
      fillConcurrency: flow.ui.getState().workers,
      ...sceneProbeOptions(flow.env().options.freeCode),
    };
    const result = await runAiBuild(buildOptions);
    settleBuild(flow, slot, turnId, anchor, kernel, result, plan, { logBefore, documentBefore });
  } catch (cause: unknown) {
    failBuild(flow, slot, turnId, anchor, request, cause);
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
    release(flow, slot);
  }
}
