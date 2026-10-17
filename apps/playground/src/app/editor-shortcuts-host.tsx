import { useEditorShortcuts, type BuilderKernel, type EditorShortcutAction } from '@craftkit/builder';

export interface EditorShortcutsHostProps {
  readonly kernel: BuilderKernel;
  readonly onAction: (action: EditorShortcutAction) => boolean;
  /** Off while a modal (the shortcuts dialog itself) owns the keyboard. */
  readonly enabled?: boolean | undefined;
}

/**
 * The editor keymap on the host window (style-manager DESIGN §E).
 *
 * A component rather than a call in `App` because the hook needs a kernel and
 * the app has a state with none. Keys pressed INSIDE the canvas frame reach
 * the same runner through `EditorCanvas`'s `onShortcut`, which forwards only
 * what the canvas did not claim — so the frame is not listened to twice.
 */
export function EditorShortcutsHost({ kernel, onAction, enabled = true }: EditorShortcutsHostProps) {
  useEditorShortcuts(kernel, { onAction: (action) => onAction(action), enabled });
  return null;
}
