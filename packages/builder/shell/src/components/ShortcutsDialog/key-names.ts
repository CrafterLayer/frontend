import type { ShortcutPlatform } from '../../keyboard/editor-shortcuts';

import type { ShortcutsDialogLabels } from './ShortcutsDialog.labels';

/** A keymap display token as the person's platform prints it. */
export function keyName(token: string, platform: ShortcutPlatform, labels: ShortcutsDialogLabels): string {
  switch (token) {
    case 'Mod':
      return platform === 'mac' ? labels.keys.modMac : labels.keys.modOther;
    case 'Alt':
      return platform === 'mac' ? labels.keys.altMac : labels.keys.altOther;
    case 'Shift':
      return labels.keys.shift;
    case 'Delete':
      return labels.keys.delete;
    case 'Backspace':
      return labels.keys.backspace;
    case 'Enter':
      return labels.keys.enter;
    default:
      return token;
  }
}
