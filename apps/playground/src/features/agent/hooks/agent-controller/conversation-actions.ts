/**
 * The conversation actions: start a new one, open one, delete one (aborting its run).
 */
import type { Flow } from './controller-state';

export function conversationActions(flow: Flow) {
  const env = flow.env;

  const newConversation = (): void => {
    // "Available when the current work ends" (SPEC §4.2 `header.new.busy`).
    if (flow.runtime.lease !== null) return;
    env().sessions.newConversation();
    flow.ui.setState((ui) => ({
      ...ui,
      draft: '',
      mentions: [],
      queue: null,
      clarify: null,
      previewing: null,
    }));
    env().enhancer.edited('');
    env().mood.reset();
  };

  const openConversation = (id: string): void => {
    env().sessions.openConversation(id);
    flow.ui.setState((ui) => (ui.clarify === null ? ui : { ...ui, clarify: null }));
  };

  const deleteConversation = (id: string): void => {
    const run = flow.ui.getState().run;
    if (run?.sessionId === id) flow.runtime.lease?.controller.abort();
    env().sessions.deleteConversation(id);
  };

  return { newConversation, openConversation, deleteConversation };
}
