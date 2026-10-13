/**
 * The actions on a record: Apply, Discard and Preview a proposal, Try again, reuse a
 * request, and Copy.
 */
import { skillRequestText } from '../../model/prompt-skills';
import { applyAiPlan, previewAiPlan } from '@craftkit/builder';

import { editEndAnnouncement } from '../../model/agent-status';
import { preflightPorts, routeRequest } from '../../model/runs';
import { type EditTurn, historyOf } from '../../model/turns';
import type { CopyTarget } from '../../model/view-types';

import type { Flow } from './controller-state';
import { copyText } from './copy-text';
import { dispatchRequest } from './dispatch';
import { followKernel } from './kernel-follow';
import { track } from './run-lease';
import { failureTurn, say } from './run-outcomes';
import { locateTurn, patchTurn, requestOf, sessionOf } from './turn-plumbing';

export function recordActions(flow: Flow) {
  const env = flow.env;

  const endPreview = (turnId: string): void => {
    if (flow.ui.getState().previewing !== turnId) return;
    flow.ui.setState((ui) => ({ ...ui, previewing: null }));
    env().options.onPreview?.(null);
  };

  const apply = (turnId: string): void => {
    const located = locateTurn(flow, turnId);
    const turn = located?.turn;
    if (located === null || turn?.kind !== 'proposal' || turn.proposal === undefined) return;
    if (flow.runtime.lease !== null) return;
    const kernel = env().options.kernel;
    const proposal = turn.proposal;
    endPreview(turnId);
    followKernel(flow, kernel);
    try {
      const applied = applyAiPlan({ kernel, proposal, validationPorts: preflightPorts() });
      env().memory.note(proposal);
      const transactionId = applied.transactions.at(-1)?.id;
      const edit: EditTurn = {
        id: turnId,
        kind: 'edit',
        ...(turn.request === undefined ? {} : { request: turn.request }),
        origin: 'proposal',
        status: 'done',
        mode: 'ask',
        ...(turn.target === undefined ? {} : { target: turn.target }),
        ...(turn.targetNodeId === undefined ? {} : { targetNodeId: turn.targetNodeId }),
        ...(turn.run === undefined ? {} : { run: turn.run }),
        ...(turn.elapsedMs === undefined ? {} : { elapsedMs: turn.elapsedMs }),
        changes: turn.changes,
        ...(turn.plan === undefined ? {} : { summary: turn.plan.rationale }),
        ...(turn.followUp === undefined ? {} : { followUp: turn.followUp }),
        ...(turn.salvaged === undefined ? {} : { salvaged: turn.salvaged }),
        ...(transactionId === undefined ? {} : { transactionId }),
      };
      patchTurn(flow, located.sessionId, turnId, () => edit);
      const end = editEndAnnouncement({ status: 'done', target: turn.target ?? null });
      say(flow, end.key, end.params);
      env().mood.noteTurn('applied');
    } catch (cause: unknown) {
      patchTurn(flow, located.sessionId, turnId, () =>
        failureTurn(turnId, turn.request ?? '', cause, { kind: 'unchanged' }, turn.elapsedMs ?? 0),
      );
      say(flow, 'failed');
    }
  };

  const discard = (turnId: string): void => {
    const located = locateTurn(flow, turnId);
    const turn = located?.turn;
    if (located === null || turn === undefined) return;
    if (turn.kind === 'proposal') {
      endPreview(turnId);
      patchTurn(flow, located.sessionId, turnId, () => ({
        id: turnId,
        kind: 'end',
        key: 'proposalDiscarded',
      }));
      env().mood.noteTurn('discarded');
      return;
    }
    if (turn.kind === 'page-plan' || turn.kind === 'step-plan') {
      patchTurn(flow, located.sessionId, turnId, () => ({
        id: turnId,
        kind: 'end',
        key: 'planDiscarded',
      }));
      // An Ask card's held build is answered Stop: nothing is written.
      flow.runtime.approvals.get(turnId)?.('stop');
      env().mood.noteTurn('discarded');
    }
  };

  const tryAgain = (turnId: string): void => {
    if (flow.runtime.lease !== null) return;
    const located = locateTurn(flow, turnId);
    const origin = requestOf(flow, turnId);
    if (located === null || origin === null || origin.text.trim() === '') return;
    const kernel = env().options.kernel;
    const document = kernel.getDocument();
    // The blocks it pointed at, while they are still there.
    const context = origin.context.filter(
      (entry) => entry.kind === 'page' || document.nodes[entry.id] !== undefined,
    );
    const pointed = context.flatMap((entry) => (entry.kind === 'page' ? [] : [entry.id]));
    const turns = sessionOf(flow, located.sessionId)?.turns ?? [];
    // The history as it was when the request was first sent.
    const history = historyOf(turns.slice(0, Math.max(0, located.index - 1)));
    const route = routeRequest(
      skillRequestText(flow.env().options, origin.text, origin.skillSnapshot),
      {
        kernel,
        mentions: pointed,
        selection: pointed,
      },
    );
    const mode = env().sessions.store.getState().mode;
    void track(
      flow,
      dispatchRequest(
        flow,
        {
          text: origin.text,
          skillSnapshot: origin.skillSnapshot,
          context: context.length === 0 ? [{ kind: 'page' }] : context,
          pointed,
        },
        route,
        { sessionId: located.sessionId, recordTurnId: turnId, history },
        mode,
      ),
    );
  };

  const reuse = (turnId: string): void => {
    const origin = requestOf(flow, turnId);
    if (origin === null) return;
    const document = env().options.kernel.getDocument();
    flow.ui.setState((ui) => ({
      ...ui,
      draft: origin.text,
      mentions: origin.context.flatMap((entry) =>
        entry.kind === 'page' || document.nodes[entry.id] === undefined
          ? []
          : [{ id: entry.id, label: entry.label }],
      ),
    }));
    env().enhancer.edited(origin.text);
  };

  const togglePreview = (turnId: string): void => {
    if (flow.ui.getState().previewing === turnId) {
      endPreview(turnId);
      return;
    }
    const turn = locateTurn(flow, turnId)?.turn;
    if (turn?.kind !== 'proposal' || turn.proposal === undefined) return;
    try {
      const document = previewAiPlan({
        kernel: env().options.kernel,
        proposal: turn.proposal,
        validationPorts: preflightPorts(),
      });
      flow.ui.setState((ui) => ({ ...ui, previewing: turnId }));
      env().options.onPreview?.({ turnId, document });
    } catch {
      // A proposal that cannot be rehearsed has nothing to show; the card stays as it is.
    }
  };

  const copy = (turnId: string, what: CopyTarget): void => {
    const text = copyText(flow, turnId, what);
    if (text === null) return;
    // jsdom and insecure origins have no clipboard, whatever the DOM types say.
    const clipboard: Clipboard | undefined =
      typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    const write =
      env().options.clipboard ??
      ((value: string): Promise<void> =>
        clipboard === undefined
          ? Promise.reject(new Error('No clipboard.'))
          : clipboard.writeText(value));
    void write(text).then(
      () => {
        say(flow, 'copied');
      },
      () => undefined,
    );
  };

  return { apply, discard, tryAgain, reuse, togglePreview, copy };
}
