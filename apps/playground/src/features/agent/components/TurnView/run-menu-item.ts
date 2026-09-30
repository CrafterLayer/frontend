import type { AgentController, RecordMenuItem } from '../../model/view-types';

/** One `[⋯]` item, run for its record (SPEC §4.15). Restore only opens its dialog. */
export function runMenuItem(
  item: RecordMenuItem,
  turnId: string,
  actions: Pick<AgentController, 'reuse' | 'copy' | 'viewAsCode' | 'showTechnicalDetails'>,
  openRestore: () => void,
): void {
  switch (item) {
    case 'restore':
      openRestore();
      return;
    case 'reuse':
      actions.reuse(turnId);
      return;
    case 'copySummary':
      actions.copy(turnId, 'summary');
      return;
    case 'copyAnswer':
      actions.copy(turnId, 'answer');
      return;
    case 'copyError':
      actions.copy(turnId, 'error');
      return;
    case 'viewAsCode':
      actions.viewAsCode(turnId);
      return;
    case 'technical':
      actions.showTechnicalDetails(turnId);
      return;
  }
}
