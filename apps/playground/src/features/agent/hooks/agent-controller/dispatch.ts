/**
 * The routed request to its flow: a question to words, a page to a build (or its plan),
 * an edit or a new section to an edit (or its change plan).
 */
import type { IntentRoute } from '@craftkit/builder';

import type { AssistantMode } from '../../model/view-types';

import { runPage } from './build-flow';
import type { Flow } from './controller-state';
import { runEdit } from './edit-flow';
import type { Outgoing, Placement } from './exchange';
import { runPlanPage } from './plan-page-flow';
import { runWords } from './words-flow';

export async function dispatchRequest(
  flow: Flow,
  outgoing: Outgoing,
  route: IntentRoute,
  placement: Placement,
  mode: AssistantMode,
  /** Planned only because the router was unsure (`PagePlanTurn.unsure`). */
  unsure = false,
): Promise<void> {
  switch (route.kind) {
    case 'question':
      await runWords(flow, outgoing, placement, 'answer');
      return;
    case 'build-page':
    case 'build-site':
      if (mode === 'plan') {
        await runPlanPage(flow, outgoing, placement, route.target, unsure);
        return;
      }
      await runPage(flow, outgoing, placement, route, mode);
      return;
    case 'add-section':
    case 'edit':
      if (mode === 'plan') {
        await runWords(flow, outgoing, placement, 'steps');
        return;
      }
      await runEdit(flow, outgoing, placement, mode === 'ask' ? 'never' : 'auto', route);
      return;
  }
}
