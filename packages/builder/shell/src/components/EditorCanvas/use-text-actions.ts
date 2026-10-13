import { useCallback, useState } from 'react';

import type { InlineFormatAction } from '@craftkit/builder-schema';

import type { FloatingMounts } from './EditorCanvas.types';
import type { CanvasRefs } from './use-canvas-refs';

/**
 * The formatting bubble's inputs from an open inline editor (009 §10): the
 * actions it reports and the keyboard round trip between the editor and the
 * bubble's first action (`refs.returnFocusToEditorRef`). Geometry never
 * enters React state.
 */
export function useTextActions(refs: CanvasRefs, floating: FloatingMounts | null) {
  const { returnFocusToEditorRef } = refs;
  const [textActions, setTextActions] = useState<InlineFormatAction[]>([]);

  const reportTextActions = useCallback(
    (actions: InlineFormatAction[]) => {
      if (actions.length === 0) {
        returnFocusToEditorRef.current = null;
      }
      setTextActions(actions);
    },
    [returnFocusToEditorRef],
  );

  const requestFormattingMenuFocus = useCallback(
    (returnFocusToEditor: () => void): boolean => {
      const menu = floating?.text;
      if (menu === undefined) {
        return false;
      }
      const firstAction = menu.querySelector<HTMLButtonElement>(
        '.bldr-text-bubble__action:not(:disabled)',
      );
      if (firstAction === null) {
        return false;
      }
      returnFocusToEditorRef.current = returnFocusToEditor;
      firstAction.focus({ preventScroll: true });
      if (firstAction.ownerDocument.activeElement === firstAction) {
        return true;
      }
      returnFocusToEditorRef.current = null;
      return false;
    },
    [floating, returnFocusToEditorRef],
  );

  const returnFocusToEditor = useCallback((): boolean => {
    const restore = returnFocusToEditorRef.current;
    if (restore === null) {
      return false;
    }
    returnFocusToEditorRef.current = null;
    restore();
    return true;
  }, [returnFocusToEditorRef]);

  return {
    textActions,
    setTextActions,
    reportTextActions,
    requestFormattingMenuFocus,
    returnFocusToEditor,
  };
}
