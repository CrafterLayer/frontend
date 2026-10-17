/**
 * What AgentPanel reads off the controller to place its parts: the state it stamps on its
 * root (`data-state`), and whether the story bible shows. Pure, so the panel only places.
 */
import { isAwaitingDecision, type AgentController } from '../../model/view-types';

export type PanelState =
  'hidden' | 'stopping' | 'running' | 'checking' | 'awaiting-decision' | 'idle';

/**
 * The story bible shows once it can matter (creative agent, 2026-10-12): when free code is on
 * — the only mode that writes game and story scenes — or once the bible holds anything.
 */
export function showBible(controller: AgentController): boolean {
  const bible = controller.storyBible;
  if (bible === undefined) return false;
  const { characters, assets, locations, facts } = bible.memory;
  const entries = characters.length + assets.length + locations.length + facts.length;
  return entries > 0 || controller.state.freeCode?.enabled === true;
}

/** Hidden first, then a live run (stopping before running), the request check, a decision. */
export function panelStateOf(
  { state }: Pick<AgentController, 'state'>,
  visible: boolean,
  checking: boolean,
): PanelState {
  const { run, turns } = state;
  if (!visible) return 'hidden';
  if (run?.stopping === true) return 'stopping';
  if (run !== null) return 'running';
  if (checking) return 'checking';
  return turns.some(isAwaitingDecision) ? 'awaiting-decision' : 'idle';
}
