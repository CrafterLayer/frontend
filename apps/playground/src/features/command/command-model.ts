/*
  The command palette's model (Studio Indigo, 2026-10-12): every place and action the editor
  offers, as one flat, searchable list. UI UX Pro Max's no-code-builder profile asks for
  keyboard reach to everything; a palette is that reach in one shortcut (Ctrl/⌘ K), and it
  teaches the editor too: every row names where it goes and, when it has one, its shortcut.

  Pure data: the host builds the list from its own state each render, the palette only
  filters, groups and runs. A command that cannot run now stays listed, disabled, so the
  person learns it exists.
*/

/** The palette's sections, in the order they are shown. */
export const COMMAND_GROUPS = ['actions', 'navigate', 'view', 'pages', 'language', 'help'] as const;
export type CommandGroup = (typeof COMMAND_GROUPS)[number];

export interface CommandItem {
  /** Unique across the list; also cmdk's value, so it must not change between renders. */
  readonly id: string;
  readonly group: CommandGroup;
  /** What the row says, in the editor's language. */
  readonly label: string;
  /** Extra words that should find it (both languages are welcome: «نشر» finds Publish). */
  readonly keywords?: readonly string[] | undefined;
  /** A short hint at the row's end: a shortcut (`Ctrl Z`) or a state (`On`). */
  readonly hint?: string | undefined;
  /** Listed but not runnable now (nothing to undo, publishing in flight). */
  readonly disabled?: boolean | undefined;
  /** The row is the current place or state (the open rail section, the device in use). */
  readonly current?: boolean | undefined;
  readonly run: () => void;
}

/** The commands of one group, in their given order; empty groups are dropped. */
export function groupCommands(
  commands: readonly CommandItem[],
): readonly { readonly group: CommandGroup; readonly items: readonly CommandItem[] }[] {
  return COMMAND_GROUPS.map((group) => ({
    group,
    items: commands.filter((command) => command.group === group),
  })).filter((entry) => entry.items.length > 0);
}

/** `Ctrl` on Windows and Linux, `⌘` on Apple platforms (a platform or user-agent string). */
export function platformModifier(platform: string): string {
  return /mac|iphone|ipad|ipod/iu.test(platform) ? '⌘' : 'Ctrl';
}

/** `Ctrl K` on Windows and Linux, `⌘ K` on Apple platforms. */
export function paletteShortcutLabel(platform: string): string {
  return `${platformModifier(platform)} K`;
}

/** Whether a keydown opens the palette: Ctrl/⌘ + K, without Shift or Alt. */
export function isPaletteShortcut(event: {
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}): boolean {
  return (
    (event.metaKey || event.ctrlKey) &&
    !event.shiftKey &&
    !event.altKey &&
    event.key.toLowerCase() === 'k'
  );
}
