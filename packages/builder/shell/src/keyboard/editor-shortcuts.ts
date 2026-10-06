import { useEffect, useRef } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { ContentDirection } from '@craftkit/builder-schema';

/*
  ── The editor keymap (style-manager DESIGN.md §E, Shortcuts) ────────────────

  A PURE resolver — keyboard event in, editor action out — so the map is one
  table that the dialog lists, the tests pin, and every host attaches the same
  way. Three laws:

  1. `Mod` is Meta on macOS and Control everywhere else; the other modifier
     never stands in for it (Ctrl+Z on a Mac is not undo).
  2. Nothing fires while a person is typing: inputs, textareas, selects and
     anything contenteditable keep every key.
  3. Inline arrows mirror in RTL: the action names logical directions
     (inline-start / inline-end), so ArrowRight on an Arabic page moves toward
     inline-START.

  Letter keys match on `event.code` (the physical key) first, because on macOS
  Alt changes `event.key` (Alt+C types "ç") and an Arabic layout types Arabic
  letters for the same physical keys.

  Actions that need canvas geometry (nudge) are only EMITTED here; the canvas
  (P7) performs them.
*/

export type EditorDevice = 'desktop' | 'tablet' | 'mobile';

export type EditorShortcutAction =
  | { readonly type: 'undo' }
  | { readonly type: 'redo' }
  | { readonly type: 'copy' }
  | { readonly type: 'cut' }
  | { readonly type: 'paste' }
  | { readonly type: 'copyStyle' }
  | { readonly type: 'pasteStyle' }
  | { readonly type: 'duplicate' }
  | { readonly type: 'delete' }
  | { readonly type: 'wrap' }
  | { readonly type: 'unwrap' }
  | { readonly type: 'moveEarlier' }
  | { readonly type: 'moveLater' }
  | { readonly type: 'selectParent' }
  | { readonly type: 'selectFirstChild' }
  | { readonly type: 'toggleHidden' }
  | { readonly type: 'toggleLocked' }
  | { readonly type: 'device'; readonly device: EditorDevice }
  | { readonly type: 'openShortcuts' }
  /**
   * Move an absolutely positioned element. `inline` is +1 toward inline-END
   * (mirrored for RTL already), `block` is +1 toward block-end; `step` is 1,
   * or 10 with Shift.
   */
  | {
      readonly type: 'nudge';
      readonly inline: -1 | 0 | 1;
      readonly block: -1 | 0 | 1;
      readonly step: 1 | 10;
    };

export type EditorShortcutActionType = EditorShortcutAction['type'];

export type ShortcutPlatform = 'mac' | 'other';

/** The fields of a KeyboardEvent the resolver reads — easy to build in tests. */
export interface ShortcutKeyEvent {
  readonly key: string;
  readonly code?: string | undefined;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly target?: EventTarget | null | undefined;
  readonly isComposing?: boolean | undefined;
}

export interface ResolveShortcutOptions {
  readonly platform: ShortcutPlatform;
  /** The PAGE's direction — inline arrows mirror to it. */
  readonly dir: ContentDirection;
}

/** One row of the keymap: what the dialog shows. `keys` are display tokens. */
export interface EditorShortcutDef {
  readonly id: string;
  readonly group: 'history' | 'clipboard' | 'structure' | 'selection' | 'view';
  /** Display tokens: 'Mod', 'Shift', 'Alt', or a key name ('Z', '↑', 'Delete'). */
  readonly keys: readonly (readonly string[])[];
  readonly labels: { readonly en: string; readonly ar: string };
}

/**
 * The §E list, exactly — the dialog renders it and the resolver below
 * implements it; the test checks both against each other.
 */
export const EDITOR_SHORTCUTS: readonly EditorShortcutDef[] = Object.freeze([
  { id: 'undo', group: 'history', keys: [['Mod', 'Z']], labels: { en: 'Undo', ar: 'تراجع' } },
  {
    id: 'redo',
    group: 'history',
    keys: [
      ['Mod', 'Shift', 'Z'],
      ['Mod', 'Y'],
    ],
    labels: { en: 'Redo', ar: 'إعادة' },
  },
  { id: 'copy', group: 'clipboard', keys: [['Mod', 'C']], labels: { en: 'Copy element', ar: 'نسخ العنصر' } },
  { id: 'cut', group: 'clipboard', keys: [['Mod', 'X']], labels: { en: 'Cut element', ar: 'قص العنصر' } },
  { id: 'paste', group: 'clipboard', keys: [['Mod', 'V']], labels: { en: 'Paste element', ar: 'لصق العنصر' } },
  {
    id: 'copyStyle',
    group: 'clipboard',
    keys: [['Mod', 'Alt', 'C']],
    labels: { en: 'Copy style', ar: 'نسخ التنسيق' },
  },
  {
    id: 'pasteStyle',
    group: 'clipboard',
    keys: [['Mod', 'Alt', 'V']],
    labels: { en: 'Paste style', ar: 'لصق التنسيق' },
  },
  { id: 'duplicate', group: 'structure', keys: [['Mod', 'D']], labels: { en: 'Duplicate', ar: 'تكرار' } },
  {
    id: 'delete',
    group: 'structure',
    keys: [['Delete'], ['Backspace']],
    labels: { en: 'Delete', ar: 'حذف' },
  },
  { id: 'wrap', group: 'structure', keys: [['Mod', 'G']], labels: { en: 'Wrap in a container', ar: 'تغليف في حاوية' } },
  {
    id: 'unwrap',
    group: 'structure',
    keys: [['Mod', 'Shift', 'G']],
    labels: { en: 'Unwrap', ar: 'فك التغليف' },
  },
  {
    id: 'moveEarlier',
    group: 'structure',
    keys: [['Alt', '↑']],
    labels: { en: 'Move earlier', ar: 'نقل إلى الأمام' },
  },
  {
    id: 'moveLater',
    group: 'structure',
    keys: [['Alt', '↓']],
    labels: { en: 'Move later', ar: 'نقل إلى الخلف' },
  },
  {
    id: 'nudge',
    group: 'structure',
    keys: [['←'], ['→'], ['↑'], ['↓']],
    labels: {
      en: 'Nudge a positioned element (Shift ×10)',
      ar: 'تحريك عنصر مُموضَع (Shift ×10)',
    },
  },
  {
    id: 'selectParent',
    group: 'selection',
    keys: [['Shift', 'Enter']],
    labels: { en: 'Select parent', ar: 'تحديد الأب' },
  },
  {
    id: 'selectFirstChild',
    group: 'selection',
    keys: [['Enter']],
    labels: { en: 'Select first child', ar: 'تحديد الابن الأول' },
  },
  {
    id: 'toggleHidden',
    group: 'view',
    keys: [['Mod', 'Shift', 'H']],
    labels: { en: 'Hide / show', ar: 'إخفاء / إظهار' },
  },
  {
    id: 'toggleLocked',
    group: 'view',
    keys: [['Mod', 'Shift', 'L']],
    labels: { en: 'Lock / unlock', ar: 'قفل / فتح القفل' },
  },
  {
    id: 'deviceDesktop',
    group: 'view',
    keys: [['Mod', '1']],
    labels: { en: 'Desktop view', ar: 'عرض سطح المكتب' },
  },
  {
    id: 'deviceTablet',
    group: 'view',
    keys: [['Mod', '2']],
    labels: { en: 'Tablet view', ar: 'عرض الجهاز اللوحي' },
  },
  {
    id: 'deviceMobile',
    group: 'view',
    keys: [['Mod', '3']],
    labels: { en: 'Mobile view', ar: 'عرض الجوال' },
  },
  {
    id: 'openShortcuts',
    group: 'view',
    keys: [['?'], ['Mod', '/']],
    labels: { en: 'Keyboard shortcuts', ar: 'اختصارات لوحة المفاتيح' },
  },
] satisfies EditorShortcutDef[]);

/** The platform from the user agent; 'other' when there is no navigator. */
export function detectShortcutPlatform(nav?: { readonly platform?: string; readonly userAgent?: string }): ShortcutPlatform {
  const source = nav ?? (typeof navigator === 'undefined' ? undefined : navigator);
  if (source === undefined) return 'other';
  const text = `${source.platform ?? ''} ${source.userAgent ?? ''}`;
  return /Mac|iPhone|iPad|iPod/u.test(text) ? 'mac' : 'other';
}

const EDITABLE_INPUT_TYPES = new Set([
  'text',
  'search',
  'email',
  'url',
  'tel',
  'password',
  'number',
  'date',
  'datetime-local',
  'month',
  'time',
  'week',
  'color',
  'range',
]);

/**
 * Whether a key event belongs to a field the person is typing in. Read off
 * the node itself (no `instanceof`, so a node from the canvas iframe — a
 * different realm — is judged the same way).
 */
export function isEditableTarget(target: EventTarget | null | undefined): boolean {
  if (target === null || target === undefined) return false;
  const element = target as {
    tagName?: unknown;
    isContentEditable?: unknown;
    type?: unknown;
    closest?: (selector: string) => unknown;
  };
  if (typeof element.tagName !== 'string') return false;
  const tag = element.tagName.toLowerCase();
  if (tag === 'textarea' || tag === 'select') return true;
  if (tag === 'input') {
    const type = typeof element.type === 'string' ? element.type.toLowerCase() : 'text';
    return EDITABLE_INPUT_TYPES.has(type);
  }
  if (element.isContentEditable === true) return true;
  // jsdom and detached nodes do not compute isContentEditable; the attribute decides.
  if (typeof element.closest === 'function') {
    const host = element.closest('[contenteditable]') as { getAttribute?: (name: string) => string | null } | null;
    const value = host?.getAttribute?.('contenteditable');
    if (value !== undefined && value !== null && value !== 'false') return true;
  }
  return false;
}

const INTERACTIVE_TAGS = new Set(['button', 'a', 'summary', 'input', 'option']);
const INTERACTIVE_ROLES = new Set([
  'button',
  'link',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'tab',
  'option',
  'treeitem',
  'tree',
  'slider',
  'listbox',
  'grid',
  'gridcell',
  'radio',
  'checkbox',
  'switch',
  'spinbutton',
  'combobox',
]);

/**
 * Whether an unmodified key (Enter, Delete, an arrow) already means something
 * to the focused control — a button activates on Enter, a tree row walks on
 * arrows. Those keys stay with the control; Mod chords still reach the editor.
 */
export function isInteractiveTarget(target: EventTarget | null | undefined): boolean {
  if (target === null || target === undefined) return false;
  const element = target as { tagName?: unknown; getAttribute?: (name: string) => string | null };
  if (typeof element.tagName !== 'string') return false;
  if (INTERACTIVE_TAGS.has(element.tagName.toLowerCase())) return true;
  const role = element.getAttribute?.('role');
  return role !== null && role !== undefined && INTERACTIVE_ROLES.has(role);
}

/** The letter a physical key stands for: `KeyZ` → `z`, else the lower-cased key. */
function letterOf(event: ShortcutKeyEvent): string {
  const code = event.code ?? '';
  if (/^Key[A-Z]$/u.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/u.test(code)) return code.slice(5);
  if (code === 'Slash') return '/';
  return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}

/**
 * Event → action, or `undefined` when the key is not an editor shortcut (or
 * the person is typing). Never reads the document; the caller decides whether
 * the action applies to the current selection.
 */
export function resolveEditorShortcut(
  event: ShortcutKeyEvent,
  options: ResolveShortcutOptions,
): EditorShortcutAction | undefined {
  if (event.isComposing === true) return undefined;
  if (isEditableTarget(event.target)) return undefined;

  const mod = options.platform === 'mac' ? event.metaKey : event.ctrlKey;
  const foreignMod = options.platform === 'mac' ? event.ctrlKey : event.metaKey;
  if (foreignMod) return undefined;
  const { altKey: alt, shiftKey: shift } = event;
  const key = letterOf(event);

  if (mod) {
    if (alt && !shift) {
      if (key === 'c') return { type: 'copyStyle' };
      if (key === 'v') return { type: 'pasteStyle' };
      return undefined;
    }
    if (alt) return undefined;
    switch (key) {
      case 'z':
        return shift ? { type: 'redo' } : { type: 'undo' };
      case 'y':
        return shift ? undefined : { type: 'redo' };
      case 'g':
        return shift ? { type: 'unwrap' } : { type: 'wrap' };
      case 'h':
        return shift ? { type: 'toggleHidden' } : undefined;
      case 'l':
        return shift ? { type: 'toggleLocked' } : undefined;
      case '/':
        return { type: 'openShortcuts' };
      default:
        break;
    }
    if (shift) return undefined;
    switch (key) {
      case 'c':
        return { type: 'copy' };
      case 'x':
        return { type: 'cut' };
      case 'v':
        return { type: 'paste' };
      case 'd':
        return { type: 'duplicate' };
      case '1':
        return { type: 'device', device: 'desktop' };
      case '2':
        return { type: 'device', device: 'tablet' };
      case '3':
        return { type: 'device', device: 'mobile' };
      default:
        return undefined;
    }
  }

  // Unmodified keys belong to a focused control first (law 2's sibling).
  if (isInteractiveTarget(event.target)) return undefined;

  if (event.key === '?' && !alt) return { type: 'openShortcuts' };

  if (alt) {
    if (shift) return undefined;
    if (event.key === 'ArrowUp') return { type: 'moveEarlier' };
    if (event.key === 'ArrowDown') return { type: 'moveLater' };
    return undefined;
  }

  switch (event.key) {
    case 'Delete':
    case 'Backspace':
      return shift ? undefined : { type: 'delete' };
    case 'Enter':
      return shift ? { type: 'selectParent' } : { type: 'selectFirstChild' };
    case 'ArrowUp':
      return { type: 'nudge', inline: 0, block: -1, step: shift ? 10 : 1 };
    case 'ArrowDown':
      return { type: 'nudge', inline: 0, block: 1, step: shift ? 10 : 1 };
    case 'ArrowLeft':
      return { type: 'nudge', inline: options.dir === 'rtl' ? 1 : -1, block: 0, step: shift ? 10 : 1 };
    case 'ArrowRight':
      return { type: 'nudge', inline: options.dir === 'rtl' ? -1 : 1, block: 0, step: shift ? 10 : 1 };
    default:
      return undefined;
  }
}

/** The keymap row an action belongs to (for announcements and the dialog). */
export function shortcutDefFor(action: EditorShortcutAction): EditorShortcutDef | undefined {
  const id =
    action.type === 'device'
      ? `device${action.device.charAt(0).toUpperCase()}${action.device.slice(1)}`
      : action.type;
  return EDITOR_SHORTCUTS.find((def) => def.id === id);
}

export interface UseEditorShortcutsOptions {
  /** The canvas iframe's document: keys pressed inside the canvas count too. */
  readonly frameDocument?: Document | null | undefined;
  /**
   * Called for every resolved action. Return `false` to leave the event
   * alone (the action did not apply — e.g. Delete with nothing selected),
   * anything else prevents the browser default.
   */
  readonly onAction: (action: EditorShortcutAction, event: KeyboardEvent) => unknown;
  /** Defaults to the user agent. */
  readonly platform?: ShortcutPlatform | undefined;
  /** Off switch, e.g. while a modal owns the keyboard. Defaults to true. */
  readonly enabled?: boolean | undefined;
}

/**
 * Attach the keymap to the window and, when given, the canvas frame's
 * document. The page direction is read live from the kernel at key time, so
 * a direction change needs no re-attach.
 */
export function useEditorShortcuts(kernel: BuilderKernel, options: UseEditorShortcutsOptions): void {
  const { frameDocument, platform, enabled = true } = options;
  // The latest callback without re-attaching listeners on every render.
  const onActionRef = useRef(options.onAction);
  useEffect(() => {
    onActionRef.current = options.onAction;
  });

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;
    const resolvedPlatform = platform ?? detectShortcutPlatform();
    const handler = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return;
      const action = resolveEditorShortcut(event, { platform: resolvedPlatform, dir: kernel.context.dir });
      if (action === undefined) return;
      const handled = onActionRef.current(action, event);
      if (handled !== false) event.preventDefault();
    };
    const targets: (Window | Document)[] = [window];
    if (frameDocument !== null && frameDocument !== undefined) targets.push(frameDocument);
    for (const target of targets) target.addEventListener('keydown', handler as EventListener);
    return () => {
      for (const target of targets) target.removeEventListener('keydown', handler as EventListener);
    };
  }, [kernel, frameDocument, platform, enabled]);
}
