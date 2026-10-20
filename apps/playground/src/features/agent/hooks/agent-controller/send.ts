/**
 * Sending a request: its context, a waiting plan card it changes, the clarify check,
 * the queue when a run holds the lease, then dispatch; and draining the queue.
 */
import {
  type BuilderKernel,
  type IntentRoute,
  type NodeId,
  summarizeDocumentForIntent,
} from '@craftkit/builder';

import { blockName } from '../../model/block-name';
import { t } from '../../copy';
import { resolveCreativeFollowup } from '../../model/creative-followup';
import {
  clarifyQuestionsOf,
  type EnhanceInput,
  isUnsureBuild,
  needsClarifying,
} from '../../model/enhance';
import { queueRequest, revalidateQueue, type QueuedRequest } from '../../model/queue';
import { routeRequest } from '../../model/runs';
import { skillRequestText, snapshotPromptSkills } from '../../model/prompt-skills';
import type { PagePlanTurn, SentContext } from '../../model/turns';

import { type Flow, NO_SELECTION, selectionKey, type UiState } from './controller-state';
import { dispatchRequest } from './dispatch';
import { languageWork } from './language-flow';
import { openExchange, type Outgoing, type Placement } from './exchange';
import { track } from './run-lease';
import { say } from './run-outcomes';
import { patchTurn, requestOf } from './turn-plumbing';

/** An ownership question is local and cannot be bypassed by an unavailable enhancer. */
export function answerTargetQuestion(
  flow: Flow,
  outgoing: Outgoing,
  placement: Placement,
  reason: 'missing' | 'ambiguous',
): void {
  const env = flow.env();
  openExchange(flow, placement, outgoing, {
    id: placement.recordTurnId ?? env.sessions.nextId('turn'),
    kind: 'answer',
    request: outgoing.text,
    text: t(env.options.locale, reason === 'missing' ? 'queue.missing' : 'followup.chooseTarget'),
  });
  flow.ui.setState((ui) => ({ ...ui, checking: false, clarify: null }));
  say(flow, 'answer.ready');
}

/* ── The queue ───────────────────────────────────────────────────────────────── */

/** After a run: revalidate the queued request against the page, then run it (FR-026). */
export function drainQueue(flow: Flow): void {
  const ui = flow.ui.getState();
  const queue = ui.queue;
  if (queue === null || queue.paused || flow.runtime.lease !== null || ui.run !== null) return;
  const env = flow.env();
  const document = env.options.kernel.getDocument();
  const predecessor = queue.origin?.predecessorTurnId;
  const owner =
    predecessor === undefined
      ? queue.origin?.kernel
      : (flow.runtime.builds.get(predecessor)?.kernel ??
        flow.runtime.edits.get(predecessor) ??
        queue.origin?.kernel);
  if (
    (queue.origin !== undefined &&
      (owner !== env.options.kernel ||
        !env.sessions.store.getState().sessions.some((s) => s.id === queue.origin?.sessionId))) ||
    revalidateQueue(queue, document) === 'missing'
  ) {
    // It cannot run until the person picks another target (SPEC §4.17 `queue.missing`).
    flow.ui.setState((state) =>
      state.queue === null ? state : { ...state, queue: { ...state.queue, missing: true } },
    );
    return;
  }
  flow.ui.setState((state) => ({ ...state, queue: null, draft: '' }));
  say(flow, 'queue.started');
  const pointed = queue.targets.map((target) => target.id);
  void send(
    flow,
    { text: queue.text, context: queue.context, pointed, skillSnapshot: queue.skillSnapshot },
    {
      skipClarify: true,
      sessionId: queue.origin?.sessionId,
      predecessorTurnId: queue.origin?.predecessorTurnId,
    },
  );
}

/** Capture page/conversation authority, and defer implicit ownership to the live result. */
export function queuedOutgoing(
  flow: Flow,
  outgoing: Outgoing,
  captured?: { readonly kernel: BuilderKernel; readonly sessionId: string },
): QueuedRequest {
  const env = flow.env();
  const sessionId = captured?.sessionId ?? env.sessions.store.getState().activeId;
  const kernel = captured?.kernel ?? env.options.kernel;
  const run = flow.ui.getState().run;
  return queueRequest(
    outgoing.text,
    outgoing.context,
    kernel.getDocument(),
    outgoing.skillSnapshot,
    {
      kernel,
      sessionId,
      ...(outgoing.pointed.length === 0 &&
      run?.sessionId === sessionId &&
      (run.activity === 'edit' || run.activity === 'build' || run.activity === 'proposal')
        ? { predecessorTurnId: run.turnId }
        : {}),
    },
  );
}

/* ── Sending ─────────────────────────────────────────────────────────────────── */

interface SendOptions {
  /** A request that was already accepted (a queued one, an answered one): no clarify check. */
  readonly skipClarify?: boolean | undefined;
  /** The route, when it is already known. */
  readonly route?: IntentRoute | undefined;
  readonly sessionId?: string | undefined;
  readonly predecessorTurnId?: string | undefined;
  readonly kernel?: BuilderKernel | undefined;
}

export function selectionShown(ui: UiState, selection: readonly NodeId[]): readonly NodeId[] {
  return ui.dismissedSelection !== null && ui.dismissedSelection === selectionKey(selection)
    ? NO_SELECTION
    : selection;
}

function ownershipOf(
  flow: Flow,
  outgoing: Outgoing,
  route: IntentRoute,
  options: SendOptions = {},
) {
  const env = flow.env();
  const sessions = env.sessions.store.getState();
  const otherPageTurns = new Set([
    ...[...flow.runtime.builds].flatMap(([id, record]) =>
      record.kernel === env.options.kernel ? [] : [id],
    ),
    ...[...flow.runtime.edits].flatMap(([id, kernel]) =>
      kernel === env.options.kernel ? [] : [id],
    ),
  ]);
  return resolveCreativeFollowup({
    request: skillRequestText(env.options, outgoing.text, outgoing.skillSnapshot),
    route,
    document: env.options.kernel.getDocument(),
    pointed: outgoing.pointed,
    turns:
      sessions.sessions.find((session) => session.id === (options.sessionId ?? sessions.activeId))
        ?.turns ?? [],
    predecessorTurnId: options.predecessorTurnId,
    otherPageBuilds: otherPageTurns,
    otherPageEdits: otherPageTurns,
    transactionIds: new Set(env.options.kernel.transactions().map((transaction) => transaction.id)),
  });
}

function withTarget(flow: Flow, outgoing: Outgoing, id: string): Outgoing {
  return {
    ...outgoing,
    context: [{ kind: 'mention', id, label: blockName(flow.env().options.kernel, id) }],
    pointed: [id],
  };
}

/** The context a draft is sent with (SPEC §4.5), and the blocks it points at. */
export function outgoingOf(flow: Flow, text: string): Outgoing {
  const env = flow.env();
  const ui = flow.ui.getState();
  const kernel = env.options.kernel;
  const document = kernel.getDocument();
  const selection = selectionShown(ui, env.selection).filter(
    (id) => document.nodes[id] !== undefined && id !== document.rootId,
  );
  const blocks: SentContext[] = [
    ...selection.map((id) => ({ kind: 'selection' as const, id, label: blockName(kernel, id) })),
    ...ui.mentions
      .filter(
        (mention) => !selection.includes(mention.id) && document.nodes[mention.id] !== undefined,
      )
      .map((mention) => ({ kind: 'mention' as const, id: mention.id, label: mention.label })),
  ];
  const outgoing: Outgoing = {
    text,
    context: blocks.length === 0 ? [{ kind: 'page' }] : blocks,
    pointed: blocks.flatMap((entry) => (entry.kind === 'page' ? [] : [entry.id])),
    skillSnapshot:
      ui.queue?.text === text && ui.queue.skillSnapshot !== undefined
        ? ui.queue.skillSnapshot
        : snapshotPromptSkills(env.options, text),
    // A suggestion fills the box and never sends; sent unedited, it was picked by name.
    ...(env.shownCatalog.current.has(text) ? { catalog: true } : {}),
  };
  const route = routeRequest(skillRequestText(env.options, text, outgoing.skillSnapshot), {
    kernel,
    mentions: outgoing.pointed,
    selection: outgoing.pointed,
  });
  // A running build may not have created its target yet. Resolve after it settles.
  if (ui.run !== null && !ui.run.awaiting) return outgoing;
  const ownership = ownershipOf(flow, outgoing, route);
  // A queued follow-up captures the same ownership as an immediately dispatched one.
  return ownership.kind === 'target' ? withTarget(flow, outgoing, ownership.id) : outgoing;
}

/**
 * The newest plan card still waiting on the person, in the active conversation. A card
 * planned only because the router was unsure (`PagePlanTurn.unsure`) is not one a newer
 * request changes: that request is routed, and checked, on its own words.
 */
function pendingPlan(
  flow: Flow,
  sessionId?: string,
): { readonly sessionId: string; readonly turn: PagePlanTurn } | null {
  const sessions = flow.env().sessions.store.getState();
  const session = sessions.sessions.find((entry) => entry.id === (sessionId ?? sessions.activeId));
  const turn = session?.turns.at(-1);
  if (session === undefined || turn?.kind !== 'page-plan' || turn.status !== 'ready') return null;
  if (turn.unsure === true) return null;
  return { sessionId: session.id, turn };
}

export function enhanceInputOf(flow: Flow, outgoing: Outgoing, route: IntentRoute): EnhanceInput {
  const env = flow.env();
  return {
    text: skillRequestText(env.options, outgoing.text, outgoing.skillSnapshot),
    locale: env.options.locale,
    intent: route.kind,
    confidence: route.confidence,
    page: summarizeDocumentForIntent(env.options.kernel.getDocument()),
    selection: outgoing.context.flatMap((entry) => (entry.kind === 'page' ? [] : [entry.label])),
  };
}

export async function send(flow: Flow, input: Outgoing, options: SendOptions = {}): Promise<void> {
  const env = flow.env();
  const sessionsState = env.sessions.store.getState();
  const sessionId = options.sessionId ?? sessionsState.activeId;
  const kernel = options.kernel ?? env.options.kernel;
  const originStillCurrent = () => {
    if (
      kernel === flow.env().options.kernel &&
      flow
        .env()
        .sessions.store.getState()
        .sessions.some((session) => session.id === sessionId)
    )
      return true;
    answerTargetQuestion(flow, input, { sessionId }, 'missing');
    return false;
  };
  if (!originStillCurrent()) return;
  const mode = sessionsState.mode;
  let outgoing = {
    ...input,
    skillSnapshot:
      input.skillSnapshot ?? snapshotPromptSkills(env.options, input.request ?? input.text),
  };
  // The clarify check failed on an unsure build: it is planned, whatever the mode.
  let planOnly = false;
  let route =
    options.route ??
    routeRequest(skillRequestText(env.options, input.text, outgoing.skillSnapshot), {
      kernel: env.options.kernel,
      mentions: input.pointed,
      selection: input.pointed,
    });

  /*
    A request sent while a plan card waits is a change to that plan: it is planned again,
    as a page, from the plan's request and this one, and the old card says it was
    replaced. An Ask card's held build is answered Stop first, so nothing is written. A
    question is only answered, when nothing holds the lease.
  */
  const pending = options.route === undefined ? pendingPlan(flow, sessionId) : null;
  const held = pending === null ? undefined : flow.runtime.approvals.get(pending.turn.id);
  if (pending !== null && (route.kind !== 'question' || held !== undefined)) {
    const priorRequest = skillRequestText(
      env.options,
      pending.turn.request ?? pending.turn.subject,
      requestOf(flow, pending.turn.id)?.skillSnapshot,
    );
    flow.runtime.superseded.add(pending.turn.id);
    if (held !== undefined) {
      held('stop');
      await flow.runtime.done;
    } else {
      flow.runtime.superseded.delete(pending.turn.id);
      patchTurn(flow, pending.sessionId, pending.turn.id, () => ({
        id: pending.turn.id,
        kind: 'end',
        key: 'planSuperseded',
      }));
    }
    outgoing = {
      ...input,
      request: `${pending.turn.request ?? pending.turn.subject}\n${input.text}`,
      skillSnapshot: {
        ...outgoing.skillSnapshot,
        request: `${priorRequest}\n${outgoing.skillSnapshot.request}`,
      },
    };
    route = { kind: 'build-page', confidence: 1, reason: 'A change to the plan on screen.' };
  }

  if (!originStillCurrent()) return;
  const ownership = ownershipOf(flow, outgoing, route, options);
  if (ownership.kind === 'clarify') {
    answerTargetQuestion(flow, outgoing, { sessionId }, ownership.reason);
    return;
  }
  if (ownership.kind === 'target') {
    outgoing = {
      ...withTarget(flow, outgoing, ownership.id),
      skillSnapshot: outgoing.skillSnapshot,
    };
  }

  if (
    options.skipClarify !== true &&
    pending === null &&
    needsClarifying(route) &&
    env.enhancer.available
  ) {
    flow.ui.setState((ui) => ({ ...ui, checking: true }));
    try {
      const result = await env.enhancer.ask(enhanceInputOf(flow, outgoing, route), { busy: true });
      if (!originStillCurrent()) return;
      if (result.questions.length > 0) {
        const routed = route;
        flow.ui.setState((ui) => ({
          ...ui,
          checking: false,
          ...(ui.draft.trim() === input.text.trim() ? { draft: '', mentions: [] } : {}),
          clarify: {
            origin: { kernel, sessionId },
            request: outgoing.text,
            skillSnapshot: outgoing.skillSnapshot,
            context: outgoing.context,
            pointed: outgoing.pointed,
            route: routed,
            understood: result.understood,
            questions: clarifyQuestionsOf(result),
            status: 'asking',
          },
        }));
        say(flow, 'clarify.ready');
        return;
      }
    } catch {
      /*
        The check is a courtesy: when it fails, the request runs as it was written, but
        never as a build the router is unsure of (`isUnsureBuild`). That is the costliest
        misreading the check exists to prevent, so it is PLANNED instead: the plan card
        shows what was read, nothing is written and no page is opened until Build.
      */
      if (isUnsureBuild(route)) planOnly = true;
    }
    flow.ui.setState((ui) => ({ ...ui, checking: false }));
  }
  if (!originStillCurrent()) return;

  if (flow.runtime.lease !== null) {
    // A run started while this one was being checked: it waits its turn, never lost.
    flow.ui.setState((ui) => ({
      ...ui,
      draft: ui.queue === null ? outgoing.text : ui.draft,
      queue: ui.queue ?? queuedOutgoing(flow, outgoing, { kernel, sessionId }),
    }));
    say(flow, 'queue.queued');
    return;
  }
  flow.ui.setState((ui) =>
    // The box empties only while it still reads what was sent: words typed meanwhile stay.
    ui.draft.trim() === input.text.trim()
      ? { ...ui, draft: '', mentions: [], clarify: null }
      : { ...ui, clarify: null },
  );
  // A site in several languages, or a whole site translated: a page at a time (2026-10-12).
  const placement = { sessionId };
  const language = planOnly ? undefined : languageWork(flow, outgoing, placement, route, mode);
  if (language !== undefined) {
    await track(flow, language);
    return;
  }
  await track(
    flow,
    dispatchRequest(flow, outgoing, route, placement, planOnly ? 'plan' : mode, planOnly),
  );
}
