import { agentLocaleFromEnv, agentPanelFromEnv, editEffortFromEnv } from './agent-host';

/*
  Which agent panel mounts (VITE_AGENT_PANEL): the v2 panel by default, the v1
  AssistantPanel only as the rollback. Read once: a build ships one panel.
*/
export const AGENT_PANEL = agentPanelFromEnv(import.meta.env);
/* VITE_AGENT_LOCALE=en|ar pins the panel's language; unset, it follows the editor's. */
export const AGENT_LOCALE = agentLocaleFromEnv(import.meta.env);
/* Google font previews in the design-system editor: never in tests (no network there). */
export const LOAD_FONT_PREVIEWS = import.meta.env['MODE'] !== 'test';
/*
  An edit or a new section runs on the fastest model the server allows, at low effort,
  unless VITE_AI_EDIT_MODEL / VITE_AI_EDIT_EFFORT say otherwise; a page build keeps the
  model the person picked. Tiny edits must cost next to nothing (owner, 2026-09-28).
  The model is worked out inside `useAgentModelSettings` (`agentEditModel`), from the live
  offered list.
*/
export const AGENT_EDIT_EFFORT = editEffortFromEnv(import.meta.env);
