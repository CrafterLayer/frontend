/**
 * The page build flow (`runAiBuild`): where a build lands, Plan mode's Build of a
 * planned page, and the run itself (the page's build is page-build.ts's; a site's
 * pages are site-flow.ts's, T230).
 */
import {
  type BuilderKernel,
  customCodeSchema,
  type IntentRoute,
  type IntentTarget,
  type PagePlan,
  sitePlanFromRequest,
  summarizeDocumentForIntent,
  validatePagePlan,
} from '@craftkit/builder';

import { initialBuildProgress } from '../../model/build-progress';
import { routeRequest } from '../../model/runs';
import { skillRequestText } from '../../model/prompt-skills';
import type { BuildTurn } from '../../model/turns';
import type { AssistantMode, EndNoteKey } from '../../model/view-types';

import type { BuildPlan } from './build-settle';
import { type Flow, pageTitleFrom } from './controller-state';
import {
  creativeMark,
  engineRequest,
  historyFor,
  markNotRun,
  openExchange,
  type Outgoing,
  type Placement,
} from './exchange';
import { buildPage } from './page-build';
import { claim, holds, release } from './run-lease';
import { failureTurn, say } from './run-outcomes';
import { runSite } from './site-flow';
import { patchTurn } from './turn-plumbing';

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

/** A host may keep creating a page after Stop; its late result cannot start a build. */
function untilStopped<T>(work: Promise<T>, signal: AbortSignal): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const stopped = () => {
      resolve(null);
    };
    if (signal.aborted) stopped();
    else signal.addEventListener('abort', stopped, { once: true });
    void work.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', stopped);
    });
  });
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
  /*
    T230 (2026-10-12): a site is built as a site, every page under one run, when the host
    can open pages. Without `addPage` it is still built as one page, and the thread says so.
  */
  const site = route.kind === 'build-site';
  const opens = flow.env().options.addPage !== undefined;
  // A declined site fallback must not yield before the page path claims its lease.
  if (
    site &&
    opens &&
    sitePlanFromRequest(engineRequest(outgoing), { assumeSite: true }) !== null
  ) {
    await runSite(flow, outgoing, placement, mode);
    return;
  }
  const notes: readonly EndNoteKey[] = site && !opens ? ['siteAsOnePage'] : [];
  await runBuild(flow, outgoing, placement, async (signal) => {
    const landing = await untilStopped(
      landingFor(flow, route.target, outgoing.text, notes),
      signal,
    );
    return landing === null
      ? null
      : {
          target: landing.target,
          approval: mode === 'ask' || landing.confirm,
          kernel: landing.kernel,
          notes: landing.notes,
        };
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
    const routed = routeRequest(
      skillRequestText(flow.env().options, outgoing.text, outgoing.skillSnapshot),
      {
        kernel: flow.env().options.kernel,
        mentions: [],
        selection: [],
      },
    );
    const route: IntentRoute =
      routed.kind === 'build-page' || routed.kind === 'build-site'
        ? routed
        : { kind: 'build-page', confidence: 1, reason: 'Built from a page plan.' };
    await runPage(flow, outgoing, placement, route, 'auto');
    return;
  }
  await runBuild(flow, outgoing, placement, async (signal) => {
    const landing = await untilStopped(
      landingFor(flow, pagePlan.intent, outgoing.text, []),
      signal,
    );
    if (landing === null) return null;
    let plan: PagePlan | undefined = pagePlan;
    if (landing.target !== undefined && landing.target !== pagePlan.intent) {
      // Landing elsewhere than planned: the same plan, held to the new intent, or re-planned.
      const moved = validatePagePlan(pagePlan, { intent: landing.target });
      plan = moved.ok ? moved.plan : undefined;
    }
    return {
      ...(plan === undefined ? {} : { pagePlan: plan }),
      target: landing.target,
      approval: false,
      kernel: landing.kernel,
      notes: landing.notes,
    };
  });
}

/**
 * One page build, from the first event to the record it leaves. `recordTurnId` re-runs
 * into an existing turn (a plan card's Build), so the list inks in place.
 */
async function runBuild(
  flow: Flow,
  outgoing: Outgoing,
  placement: Placement,
  prepare: BuildPlan | ((signal: AbortSignal) => Promise<BuildPlan | null>),
): Promise<void> {
  const env = flow.env();
  const turnId = placement.recordTurnId ?? env.sessions.nextId('turn');
  const history = historyFor(flow, placement);
  const slot = claim(flow, placement.sessionId, turnId, 'build');
  if (slot === null) return;
  const request = engineRequest(outgoing);
  const startedAt = flow.clock.now();
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
  try {
    const plan = !holds(flow, slot)
      ? null
      : typeof prepare === 'function'
        ? await prepare(slot.controller.signal)
        : prepare;
    if (plan === null || !holds(flow, slot)) {
      patchTurn(flow, slot.sessionId, turnId, () => ({
        id: turnId,
        kind: 'end',
        key: 'stoppedBeforeChange',
      }));
      markNotRun(flow, slot.sessionId, anchor);
      say(flow, 'stopped.none');
      env.mood.settleTurn({ runId: slot.runId, outcome: 'stopped' });
      return;
    }
    const kernel = plan.kernel ?? env.options.kernel;
    // Retain actual page authority even if planning/writing fails before settlement.
    flow.runtime.builds.set(turnId, { kernel });
    const { pointed } = outgoing;
    await buildPage(flow, slot, {
      turnId,
      kernel,
      request,
      pointed,
      history,
      anchor,
      plan,
      skillSnapshot: outgoing.skillSnapshot,
    });
  } catch (cause: unknown) {
    patchTurn(flow, slot.sessionId, turnId, () =>
      failureTurn(turnId, request, cause, { kind: 'unchanged' }, flow.clock.now() - startedAt),
    );
    say(flow, 'failed');
  } finally {
    release(flow, slot);
  }
}
