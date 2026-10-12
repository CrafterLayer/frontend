/**
 * Sending a request: its context, a waiting plan card it changes, the clarify check,
 * the queue when a run holds the lease, then dispatch; and draining the queue.
 */
import { type IntentRoute, type NodeId, summarizeDocumentForIntent } from '@craftkit/builder';

import { blockName } from '../../model/block-name';
import {
  clarifyQuestionsOf,
  type EnhanceInput,
  isUnsureBuild,
  needsClarifying,
} from '../../model/enhance';
import { queueRequest, revalidateQueue } from '../../model/queue';
import { routeRequest } from '../../model/runs';
import type { PagePlanTurn, SentContext } from '../../model/turns';

import { type Flow, NO_SELECTION, selectionKey, type UiState } from './controller-state';
import { dispatchRequest } from './dispatch';
import type { Outgoing } from './exchange';
import { track } from './run-lease';
import { say } from './run-outcomes';
import { patchTurn } from './turn-plumbing';

/* ── The queue ───────────────────────────────────────────────────────────────── */

/** After a run: revalidate the queued request against the page, then run it (FR-026). */
export function drainQueue(flow: Flow): void {
  const ui = flow.ui.getState();
  const queue = ui.queue;
  if (queue === null || queue.paused || flow.runtime.lease !== null || ui.run !== null) return;
  const document = flow.env().options.kernel.getDocument();
  if (revalidateQueue(queue, document) === 'missing') {
    // It cannot run until the person picks another target (SPEC §4.17 `queue.missing`).
    flow.ui.setState((state) =>
      state.queue === null ? state : { ...state, queue: { ...state.queue, missing: true } },
    );
    return;
  }
  flow.ui.setState((state) => ({ ...state, queue: null, draft: '' }));
  say(flow, 'queue.started');
  const pointed = queue.targets.map((target) => target.id);
  void send(flow, { text: queue.text, context: queue.context, pointed }, { skipClarify: true });
}

/* ── Sending ─────────────────────────────────────────────────────────────────── */

interface SendOptions {
  /** A request that was already accepted (a queued one, an answered one): no clarify check. */
  readonly skipClarify?: boolean | undefined;
  /** The route, when it is already known. */
  readonly route?: IntentRoute | undefined;
}

export function selectionShown(ui: UiState, selection: readonly NodeId[]): readonly NodeId[] {
  return ui.dismissedSelection !== null && ui.dismissedSelection === selectionKey(selection)
    ? NO_SELECTION
    : selection;
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
  return {
    text,
    context: blocks.length === 0 ? [{ kind: 'page' }] : blocks,
    pointed: blocks.flatMap((entry) => (entry.kind === 'page' ? [] : [entry.id])),
    // A suggestion fills the box and never sends; sent unedited, it was picked by name.
    ...(env.shownCatalog.current.has(text) ? { catalog: true } : {}),
  };
}

/**
 * The newest plan card still waiting on the person, in the active conversation. A card
 * planned only because the router was unsure (`PagePlanTurn.unsure`) is not one a newer
 * request changes: that request is routed, and checked, on its own words.
 */
function pendingPlan(
  flow: Flow,
): { readonly sessionId: string; readonly turn: PagePlanTurn } | null {
  const sessions = flow.env().sessions.store.getState();
  const session = sessions.sessions.find((entry) => entry.id === sessions.activeId);
  const turn = session?.turns.at(-1);
  if (session === undefined || turn?.kind !== 'page-plan' || turn.status !== 'ready') return null;
  if (turn.unsure === true) return null;
  return { sessionId: session.id, turn };
}

export function enhanceInputOf(flow: Flow, outgoing: Outgoing, route: IntentRoute): EnhanceInput {
  const env = flow.env();
  return {
    text: outgoing.text,
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
  const mode = sessionsState.mode;
  let outgoing = input;
  // The clarify check failed on an unsure build: it is planned, whatever the mode.
  let planOnly = false;
  let route =
    options.route ??
    routeRequest(input.text, {
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
  const pending = options.route === undefined ? pendingPlan(flow) : null;
  const held = pending === null ? undefined : flow.runtime.approvals.get(pending.turn.id);
  if (pending !== null && (route.kind !== 'question' || held !== undefined)) {
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
    };
    route = { kind: 'build-page', confidence: 1, reason: 'A change to the plan on screen.' };
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
      if (result.questions.length > 0) {
        const routed = route;
        flow.ui.setState((ui) => ({
          ...ui,
          checking: false,
          ...(ui.draft.trim() === input.text.trim() ? { draft: '', mentions: [] } : {}),
          clarify: {
            request: outgoing.text,
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

  if (flow.runtime.lease !== null) {
    // A run started while this one was being checked: it waits its turn, never lost.
    const document = env.options.kernel.getDocument();
    flow.ui.setState((ui) => ({
      ...ui,
      draft: ui.queue === null ? outgoing.text : ui.draft,
      queue: ui.queue ?? queueRequest(outgoing.text, outgoing.context, document),
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
  await track(
    flow,
    dispatchRequest(
      flow,
      outgoing,
      route,
      { sessionId: sessionsState.activeId },
      planOnly ? 'plan' : mode,
      planOnly,
    ),
  );
}
