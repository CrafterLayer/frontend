/**
 * The agent panel's public face (SPEC §7.1): what the app mounts. Everything else in
 * `features/agent/` is the panel's own: components, model, hooks and copy are imported
 * by path inside the feature, and by stories and tests.
 *
 * - `LiveAgentPanel`: the panel over `useAgentController`, the one the app mounts.
 * - `AgentPanel`: the same composition over any `AgentController` (stories, the fake one).
 * - `AgentStatusPill`: the status-bar line while the panel is hidden; AgentPanel draws it
 *   into the host's `pillContainer` itself, so a host only exports it for its own stories.
 * - `usePhoneLayout`: whether the panel is the phone sheet, so the host can keep its own
 *   column out of the sheet's way.
 *
 * `EmptyCanvasHint` arrives with the canvas stage (SPEC §8 WP-21).
 */
export {
  AgentPanel,
  LiveAgentPanel,
  PANEL_WIDTH_DEFAULT,
  PANEL_WIDTH_MAX,
  PANEL_WIDTH_MIN,
  usePhoneLayout,
  type AgentPanelPresentation,
  type AgentPanelProps,
  type LiveAgentPanelProps,
} from './components/AgentPanel';
export {
  AgentStatusPill,
  pillView,
  type AgentStatusPillProps,
  type PillView,
} from './components/AgentStatusPill';
export type { EditEffort, ProposalPreview } from './hooks/use-agent-controller';
export type { AgentController, Locale } from './model/view-types';
