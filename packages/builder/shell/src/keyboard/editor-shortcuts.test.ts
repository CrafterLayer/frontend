import { renderHook } from '@testing-library/react';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { defineBlockSchema, type TrustedExtensionManifest } from '@craftkit/builder-schema';

import {
  EDITOR_SHORTCUTS,
  detectShortcutPlatform,
  isEditableTarget,
  resolveEditorShortcut,
  shortcutDefFor,
  useEditorShortcuts,
  type EditorShortcutAction,
  type ShortcutKeyEvent,
} from './editor-shortcuts';

const key = (
  init: Partial<ShortcutKeyEvent> & { key: string },
): ShortcutKeyEvent => ({
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...init,
});

const MAC = { platform: 'mac', dir: 'ltr' } as const;
const WIN = { platform: 'other', dir: 'ltr' } as const;
const MAC_RTL = { platform: 'mac', dir: 'rtl' } as const;

describe('resolveEditorShortcut — the §E keymap', () => {
  const macTable: [string, ShortcutKeyEvent, EditorShortcutAction | undefined][] = [
    ['Mod+Z', key({ key: 'z', code: 'KeyZ', metaKey: true }), { type: 'undo' }],
    ['Mod+Shift+Z', key({ key: 'Z', code: 'KeyZ', metaKey: true, shiftKey: true }), { type: 'redo' }],
    ['Mod+Y', key({ key: 'y', code: 'KeyY', metaKey: true }), { type: 'redo' }],
    ['Mod+C', key({ key: 'c', code: 'KeyC', metaKey: true }), { type: 'copy' }],
    ['Mod+X', key({ key: 'x', code: 'KeyX', metaKey: true }), { type: 'cut' }],
    ['Mod+V', key({ key: 'v', code: 'KeyV', metaKey: true }), { type: 'paste' }],
    // macOS Alt rewrites event.key ("ç"); the physical code still decides.
    ['Mod+Alt+C', key({ key: 'ç', code: 'KeyC', metaKey: true, altKey: true }), { type: 'copyStyle' }],
    ['Mod+Alt+V', key({ key: '√', code: 'KeyV', metaKey: true, altKey: true }), { type: 'pasteStyle' }],
    ['Mod+D', key({ key: 'd', code: 'KeyD', metaKey: true }), { type: 'duplicate' }],
    ['Delete', key({ key: 'Delete' }), { type: 'delete' }],
    ['Backspace', key({ key: 'Backspace' }), { type: 'delete' }],
    ['Mod+G', key({ key: 'g', code: 'KeyG', metaKey: true }), { type: 'wrap' }],
    ['Mod+Shift+G', key({ key: 'G', code: 'KeyG', metaKey: true, shiftKey: true }), { type: 'unwrap' }],
    ['Alt+↑', key({ key: 'ArrowUp', altKey: true }), { type: 'moveEarlier' }],
    ['Alt+↓', key({ key: 'ArrowDown', altKey: true }), { type: 'moveLater' }],
    ['↑', key({ key: 'ArrowUp' }), { type: 'nudge', inline: 0, block: -1, step: 1 }],
    ['Shift+↓', key({ key: 'ArrowDown', shiftKey: true }), { type: 'nudge', inline: 0, block: 1, step: 10 }],
    ['→', key({ key: 'ArrowRight' }), { type: 'nudge', inline: 1, block: 0, step: 1 }],
    ['←', key({ key: 'ArrowLeft' }), { type: 'nudge', inline: -1, block: 0, step: 1 }],
    ['Shift+Enter', key({ key: 'Enter', shiftKey: true }), { type: 'selectParent' }],
    ['Enter', key({ key: 'Enter' }), { type: 'selectFirstChild' }],
    ['Mod+Shift+H', key({ key: 'H', code: 'KeyH', metaKey: true, shiftKey: true }), { type: 'toggleHidden' }],
    ['Mod+Shift+L', key({ key: 'L', code: 'KeyL', metaKey: true, shiftKey: true }), { type: 'toggleLocked' }],
    ['Mod+1', key({ key: '1', code: 'Digit1', metaKey: true }), { type: 'device', device: 'desktop' }],
    ['Mod+2', key({ key: '2', code: 'Digit2', metaKey: true }), { type: 'device', device: 'tablet' }],
    ['Mod+3', key({ key: '3', code: 'Digit3', metaKey: true }), { type: 'device', device: 'mobile' }],
    ['?', key({ key: '?', code: 'Slash', shiftKey: true }), { type: 'openShortcuts' }],
    ['Mod+/', key({ key: '/', code: 'Slash', metaKey: true }), { type: 'openShortcuts' }],
    // Not shortcuts:
    ['plain letter', key({ key: 'a', code: 'KeyA' }), undefined],
    ['Mod+H (system hide)', key({ key: 'h', code: 'KeyH', metaKey: true }), undefined],
    ['Mod+Shift+D', key({ key: 'D', code: 'KeyD', metaKey: true, shiftKey: true }), undefined],
    ['Alt+→', key({ key: 'ArrowRight', altKey: true }), undefined],
  ];

  it.each(macTable)('mac: %s', (_name, event, expected) => {
    expect(resolveEditorShortcut(event, MAC)).toEqual(expected);
  });

  it('Mod is Control off macOS, and the other modifier never stands in', () => {
    expect(resolveEditorShortcut(key({ key: 'z', code: 'KeyZ', ctrlKey: true }), WIN)).toEqual({ type: 'undo' });
    expect(resolveEditorShortcut(key({ key: 'z', code: 'KeyZ', metaKey: true }), WIN)).toBeUndefined();
    expect(resolveEditorShortcut(key({ key: 'z', code: 'KeyZ', ctrlKey: true }), MAC)).toBeUndefined();
  });

  it('an Arabic keyboard layout still resolves by physical key', () => {
    // The KeyZ position types "ئ" on the Arabic layout.
    expect(resolveEditorShortcut(key({ key: 'ئ', code: 'KeyZ', ctrlKey: true }), WIN)).toEqual({ type: 'undo' });
  });

  it('RTL: the inline arrows mirror; the block arrows do not', () => {
    expect(resolveEditorShortcut(key({ key: 'ArrowRight' }), MAC_RTL)).toEqual({
      type: 'nudge',
      inline: -1,
      block: 0,
      step: 1,
    });
    expect(resolveEditorShortcut(key({ key: 'ArrowLeft', shiftKey: true }), MAC_RTL)).toEqual({
      type: 'nudge',
      inline: 1,
      block: 0,
      step: 10,
    });
    expect(resolveEditorShortcut(key({ key: 'ArrowUp' }), MAC_RTL)).toEqual({
      type: 'nudge',
      inline: 0,
      block: -1,
      step: 1,
    });
  });

  it('never fires inside an input, a textarea, a select or contenteditable', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const select = document.createElement('select');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const inner = document.createElement('span');
    editable.append(inner);
    document.body.append(editable);
    for (const target of [input, textarea, select, editable, inner]) {
      expect(isEditableTarget(target)).toBe(true);
      expect(resolveEditorShortcut(key({ key: 'z', code: 'KeyZ', metaKey: true, target }), MAC)).toBeUndefined();
      expect(resolveEditorShortcut(key({ key: 'Backspace', target }), MAC)).toBeUndefined();
    }
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    expect(isEditableTarget(checkbox)).toBe(false);
    expect(isEditableTarget(document.body)).toBe(false);
    editable.remove();
  });

  it('unmodified keys stay with a focused control; Mod chords still reach the editor', () => {
    const button = document.createElement('button');
    expect(resolveEditorShortcut(key({ key: 'Enter', target: button }), MAC)).toBeUndefined();
    expect(resolveEditorShortcut(key({ key: 'ArrowDown', target: button }), MAC)).toBeUndefined();
    expect(resolveEditorShortcut(key({ key: 'z', code: 'KeyZ', metaKey: true, target: button }), MAC)).toEqual({
      type: 'undo',
    });
  });

  it('ignores keys pressed while an IME composes', () => {
    expect(resolveEditorShortcut(key({ key: 'Enter', isComposing: true }), MAC)).toBeUndefined();
  });

  it('every resolved action has a row in the dialog table, and every row has labels in both languages', () => {
    const actions = macTable.map(([, , action]) => action).filter((action) => action !== undefined);
    for (const action of actions) expect(shortcutDefFor(action)).toBeDefined();
    const ids = new Set(EDITOR_SHORTCUTS.map((def) => def.id));
    expect(ids.size).toBe(EDITOR_SHORTCUTS.length);
    for (const def of EDITOR_SHORTCUTS) {
      expect(def.labels.en).not.toBe('');
      expect(def.labels.ar).not.toBe('');
      expect(def.keys.length).toBeGreaterThan(0);
    }
  });

  it('detects the platform from the user agent', () => {
    expect(detectShortcutPlatform({ platform: 'MacIntel' })).toBe('mac');
    expect(detectShortcutPlatform({ platform: 'Win32', userAgent: 'Windows NT' })).toBe('other');
  });
});

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'shortcut-test',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({ type: 'page', description: 'Page', props: z.object({}), examples: [] }),
        render: () => null,
      },
    ],
  },
};

describe('useEditorShortcuts', () => {
  it('attaches to the window and the frame document, reads the page dir live, and prevents handled keys', () => {
    const kernel = createBuilder({ extensions: [VOCAB], dir: 'rtl' });
    const frame = document.implementation.createHTMLDocument('frame');
    const onAction = vi.fn<(action: EditorShortcutAction) => boolean | undefined>(() => undefined);
    const { unmount } = renderHook(() => {
      useEditorShortcuts(kernel, { frameDocument: frame, onAction, platform: 'other' });
    });

    const fromWindow = new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', ctrlKey: true, cancelable: true });
    window.dispatchEvent(fromWindow);
    expect(onAction).toHaveBeenLastCalledWith({ type: 'undo' }, fromWindow);
    expect(fromWindow.defaultPrevented).toBe(true);

    const fromFrame = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
    frame.dispatchEvent(fromFrame);
    expect(onAction).toHaveBeenLastCalledWith({ type: 'nudge', inline: -1, block: 0, step: 1 }, fromFrame);

    onAction.mockReturnValueOnce(false);
    const declined = new KeyboardEvent('keydown', { key: 'Delete', cancelable: true });
    window.dispatchEvent(declined);
    expect(declined.defaultPrevented).toBe(false);

    unmount();
    onAction.mockClear();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', ctrlKey: true }));
    expect(onAction).not.toHaveBeenCalled();
  });
});
