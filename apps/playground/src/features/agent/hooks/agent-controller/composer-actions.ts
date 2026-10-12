/**
 * The composer's actions: send (or queue) the draft, Stop, the draft and its chips,
 * ✨ Improve and Restore, the clarify panel, and the queued request.
 */
import { blockName } from '../../model/block-name';
import { answersOf, requestWithAnswers } from '../../model/enhance';
import { consumeMentionFragment } from '../../model/mentions';
import { queueRequest } from '../../model/queue';
import { routeRequest } from '../../model/runs';

import { type Flow, selectionKey } from './controller-state';
import type { Outgoing } from './exchange';
import { say } from './run-outcomes';
import { drainQueue, enhanceInputOf, outgoingOf, send } from './send';
import { patchTurn } from './turn-plumbing';

export function composerActions(flow: Flow) {
  const env = flow.env;

  const sendDraft = (): void => {
    const ui = flow.ui.getState();
    const text = ui.draft.trim();
    if (text === '' || ui.checking) return;
    const run = ui.run;
    if (run !== null && !run.awaiting) {
      // Running: the draft becomes the ONE queued request, and stays in the composer.
      if (ui.queue !== null && !ui.queue.paused) {
        say(flow, 'queue.already');
        return;
      }
      const outgoing = outgoingOf(flow, text);
      flow.ui.setState((state) => ({
        ...state,
        queue: queueRequest(text, outgoing.context, env().options.kernel.getDocument()),
      }));
      say(flow, 'queue.queued');
      return;
    }
    void send(flow, outgoingOf(flow, text));
  };

  const stop = (): void => {
    const lease = flow.runtime.lease;
    if (lease === null || lease.controller.signal.aborted) return;
    const run = flow.ui.getState().run;
    flow.ui.setState((ui) =>
      ui.run === null
        ? ui
        : {
            ...ui,
            run: { ...ui.run, stopping: true },
            queue: ui.queue === null ? null : { ...ui.queue, paused: true },
          },
    );
    if (run !== null) {
      patchTurn(flow, run.sessionId, run.turnId, (turn) =>
        turn.kind === 'build' || turn.kind === 'edit' ? { ...turn, stopping: true } : turn,
      );
    }
    say(flow, 'stopping');
    lease.controller.abort();
  };

  const setDraft = (text: string): void => {
    const enhancer = env().enhancer;
    // Typing over an Improve in flight: the person's words win.
    if (enhancer.view.status === 'enhancing' && !flow.ui.getState().checking) enhancer.cancel();
    flow.ui.setState((ui) => {
      if (ui.draft === text) return ui;
      const queue = ui.queue;
      // While running, the queued request IS the composer's text (SPEC §3.9).
      const live = queue !== null && !queue.paused && ui.run !== null;
      return {
        ...ui,
        draft: text,
        queue: live ? (text.trim() === '' ? null : { ...queue, text: text.trim() }) : queue,
      };
    });
    enhancer.edited(text);
  };

  const removeChip = (id: string): void => {
    flow.ui.setState((ui) => {
      if (ui.mentions.some((entry) => entry.id === id)) {
        return { ...ui, mentions: ui.mentions.filter((entry) => entry.id !== id) };
      }
      const selection = env().selection;
      return selection.includes(id) ? { ...ui, dismissedSelection: selectionKey(selection) } : ui;
    });
  };

  const addMention = (nodeId: string): void => {
    const kernel = env().options.kernel;
    if (kernel.getDocument().nodes[nodeId] === undefined) return;
    flow.ui.setState((ui) => ({
      ...ui,
      draft: consumeMentionFragment(ui.draft).text,
      mentions: ui.mentions.some((entry) => entry.id === nodeId)
        ? ui.mentions
        : [...ui.mentions, { id: nodeId, label: blockName(kernel, nodeId) }],
    }));
    env().enhancer.edited(flow.ui.getState().draft);
  };

  const enhanceDraft = (): void => {
    const text = flow.ui.getState().draft.trim();
    const enhancer = env().enhancer;
    if (text === '' || !enhancer.available || enhancer.view.status === 'enhancing') return;
    const outgoing = outgoingOf(flow, text);
    const route = routeRequest(text, {
      kernel: env().options.kernel,
      mentions: outgoing.pointed,
      selection: outgoing.pointed,
    });
    void enhancer.improve(enhanceInputOf(flow, outgoing, route)).then((rewritten) => {
      if (rewritten === null) return;
      // Only while the draft is still what was sent to be improved; else the note goes too.
      const now = flow.ui.getState().draft;
      if (now.trim() !== text) {
        env().enhancer.edited(now);
        return;
      }
      flow.ui.setState((ui) => ({ ...ui, draft: rewritten }));
      say(flow, 'enhance.ready');
    });
  };

  const restoreDraft = (): void => {
    const original = env().enhancer.restore();
    if (original === null) return;
    flow.ui.setState((ui) => ({ ...ui, draft: original }));
  };

  const answerClarify = (questionId: string, answer: string): void => {
    const clarify = flow.ui.getState().clarify;
    if (clarify?.status !== 'asking' || answer.trim() === '') return;
    const questions = clarify.questions.map((question) =>
      question.id === questionId ? { ...question, answer: answer.trim() } : question,
    );
    const complete = questions.every((question) => question.answer !== undefined);
    flow.ui.setState((ui) =>
      ui.clarify === null
        ? ui
        : {
            ...ui,
            clarify: { ...ui.clarify, questions, status: complete ? 'rewriting' : 'asking' },
          },
    );
    if (!complete) return;
    const outgoing: Outgoing = {
      text: clarify.request,
      context: clarify.context,
      pointed: clarify.pointed,
    };
    void (async () => {
      let text = requestWithAnswers(clarify.request, questions);
      try {
        const result = await env().enhancer.ask({
          ...enhanceInputOf(flow, outgoing, clarify.route),
          answers: answersOf(questions),
        });
        if (result.enhanced.trim() !== '') text = result.enhanced.trim();
      } catch {
        // The rewrite failed: the person's own words and their own answers run instead.
      }
      // Dismissed (or replaced) while it was rewriting: the request is the person's again.
      const now = flow.ui.getState().clarify;
      if (now?.status !== 'rewriting' || now.request !== clarify.request) return;
      flow.ui.setState((ui) => ({ ...ui, clarify: null }));
      const route = routeRequest(text, {
        kernel: env().options.kernel,
        mentions: clarify.pointed,
        selection: clarify.pointed,
      });
      // The person's turn shows the rewritten request: it is the request that runs.
      await send(flow, { ...outgoing, text }, { skipClarify: true, route });
    })();
  };

  const sendAsWritten = (): void => {
    const clarify = flow.ui.getState().clarify;
    if (clarify === null) return;
    flow.ui.setState((ui) => ({ ...ui, clarify: null }));
    void send(
      flow,
      { text: clarify.request, context: clarify.context, pointed: clarify.pointed },
      { skipClarify: true, route: clarify.route },
    );
  };

  const dismissClarify = (): void => {
    const clarify = flow.ui.getState().clarify;
    if (clarify === null) return;
    // The words, and the blocks they were sent about by name, go back into the box.
    const document = env().options.kernel.getDocument();
    flow.ui.setState((ui) => ({
      ...ui,
      clarify: null,
      draft: clarify.request,
      mentions: clarify.context.flatMap((entry) =>
        entry.kind === 'mention' && document.nodes[entry.id] !== undefined
          ? [{ id: entry.id, label: entry.label }]
          : [],
      ),
    }));
    env().enhancer.edited(clarify.request);
  };

  const removeQueued = (): void => {
    flow.ui.setState((ui) => ({
      ...ui,
      queue: null,
      // The queued request was the composer's own text: [×] clears the box (SPEC §3.9).
      draft: ui.queue !== null && !ui.queue.paused ? '' : ui.draft,
    }));
  };

  const continueQueued = (): void => {
    if (flow.ui.getState().queue === null || flow.runtime.lease !== null) return;
    flow.ui.setState((ui) =>
      ui.queue === null ? ui : { ...ui, queue: { ...ui.queue, paused: false, missing: false } },
    );
    drainQueue(flow);
  };

  return {
    sendDraft,
    stop,
    setDraft,
    removeChip,
    addMention,
    enhanceDraft,
    restoreDraft,
    answerClarify,
    sendAsWritten,
    dismissClarify,
    removeQueued,
    continueQueued,
  };
}
