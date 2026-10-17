import { useState } from 'react';

import type { AgentViewState } from '../../model/view-types';
import type { SheetDetent } from '../AgentSheet';

/**
 * The phone sheet's detent (SPEC §4.19): the host decides, the sheet only asks. Shown, the
 * sheet is full; hidden, closed. Sending an edit in Auto drops it to mini, once per run, so
 * the change can be watched; nothing else moves it by itself. A sheet the person closes
 * tells the host (`onClose`).
 */
export function useSheetDetent(
  state: Pick<AgentViewState, 'run' | 'mode'>,
  visible: boolean,
  phone: boolean,
  onClose: (() => void) | undefined,
): { readonly detent: SheetDetent; readonly changeDetent: (next: SheetDetent) => void } {
  const [detent, setDetent] = useState<SheetDetent>(visible ? 'full' : 'closed');
  const [shownFor, setShownFor] = useState(visible);
  if (shownFor !== visible) {
    setShownFor(visible);
    setDetent(visible ? 'full' : 'closed');
  }
  const { run } = state;
  const editRun = run?.activity === 'edit' ? run.turnId : null;
  const [droppedFor, setDroppedFor] = useState<string | null>(null);
  if (phone && editRun !== null && editRun !== droppedFor) {
    setDroppedFor(editRun);
    if (state.mode === 'auto' && detent === 'full') setDetent('mini');
  }
  return {
    detent,
    changeDetent: (next) => {
      setDetent(next);
      if (next === 'closed') onClose?.();
    },
  };
}
