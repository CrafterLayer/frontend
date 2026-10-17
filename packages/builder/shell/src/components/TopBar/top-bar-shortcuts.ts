import {
  EDITOR_SHORTCUTS,
  detectShortcutPlatform,
  type ShortcutPlatform,
} from '../../keyboard/editor-shortcuts';

/** How each keymap token is printed on a platform, and how ARIA names it. */
const PRINTED: Readonly<Record<ShortcutPlatform, Readonly<Record<string, string>>>> = {
  mac: { Mod: '⌘', Shift: '⇧', Alt: '⌥' },
  other: { Mod: 'Ctrl', Shift: 'Shift', Alt: 'Alt' },
};
const ARIA: Readonly<Record<ShortcutPlatform, Readonly<Record<string, string>>>> = {
  mac: { Mod: 'Meta', Shift: 'Shift', Alt: 'Alt' },
  other: { Mod: 'Control', Shift: 'Shift', Alt: 'Alt' },
};

/** A top-bar control's shortcut, from the ONE keymap the editor runs (never a second list). */
export interface TopBarShortcut {
  /** As the platform prints it: "Ctrl Z", "⌘ Z". */
  readonly printed: string;
  /** As `aria-keyshortcuts` wants it: "Control+Z". */
  readonly aria: string;
}

/** The first chord of a keymap entry, or undefined when the keymap has none by that id. */
export function topBarShortcut(
  id: string,
  platform: ShortcutPlatform = detectShortcutPlatform(),
): TopBarShortcut | undefined {
  const chord = EDITOR_SHORTCUTS.find((definition) => definition.id === id)?.keys[0];
  if (chord === undefined) return undefined;
  return {
    printed: chord.map((token) => PRINTED[platform][token] ?? token).join(' '),
    aria: chord.map((token) => ARIA[platform][token] ?? token.toUpperCase()).join('+'),
  };
}

/** "Undo · Ctrl Z", or the bare name when the control has no shortcut. */
export function tooltipFor(name: string, shortcut: TopBarShortcut | undefined): string {
  return shortcut === undefined ? name : `${name} · ${shortcut.printed}`;
}
