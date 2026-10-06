import { describe, expect, it } from 'vitest';

import { localBlockName, BLOCK_NAMES_AR } from '@craftkit/builder';

import { createPlaygroundKernel } from '../features/preview/create-playground-kernel';
import {
  CHROME_LABELS,
  EDITOR_LOCALE_KEY,
  editorLabels,
  editorLocaleFromEnv,
  initialEditorLocale,
  rememberEditorLocale,
} from './editor-labels';
import { RAIL_SECTIONS, RAIL_UTILITIES, railItemsIn } from './rail-sections';
import { recentChangesOf } from './use-recent-changes';

const ARABIC_LETTER = /[ء-ي]/u;
const ARABIC_INDIC_DIGIT = /[٠-٩۰-۹]/u;

/*
  arabic-editor: the playground hands every surface its strings from ONE
  catalogue, and its own chrome (rail, zoom, device line, notices,
  announcements) has an Arabic set of the same shape.
*/
describe('editor labels', () => {
  it('reads the editor language from the environment, English unless Arabic is asked for', () => {
    expect(editorLocaleFromEnv({ VITE_EDITOR_LOCALE: 'ar' })).toBe('ar');
    expect(editorLocaleFromEnv({ VITE_EDITOR_LOCALE: ' AR ' })).toBe('ar');
    expect(editorLocaleFromEnv({})).toBe('en');
  });

  it('opens in the language this viewer chose last, and survives storage that throws', () => {
    const memory = new Map<string, string>();
    const store = () => ({
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => void memory.set(key, value),
    });
    expect(initialEditorLocale({}, store)).toBe('en');
    rememberEditorLocale('ar', store);
    expect(memory.get(EDITOR_LOCALE_KEY)).toBe('ar');
    expect(initialEditorLocale({}, store)).toBe('ar');
    rememberEditorLocale('en', store);
    expect(initialEditorLocale({ VITE_EDITOR_LOCALE: 'ar' }, store)).toBe('en');
    memory.set(EDITOR_LOCALE_KEY, 'fr');
    expect(initialEditorLocale({ VITE_EDITOR_LOCALE: 'ar' }, store)).toBe('ar');
    const blocked = () => {
      throw new Error('SecurityError');
    };
    expect(initialEditorLocale({ VITE_EDITOR_LOCALE: 'ar' }, blocked)).toBe('ar');
    expect(() => {
      rememberEditorLocale('ar', blocked);
    }).not.toThrow();
  });

  it('gives the Arabic chrome exactly the English shape, every value Arabic, digits Latin', () => {
    const en = CHROME_LABELS.en as unknown as Record<string, unknown>;
    const ar = CHROME_LABELS.ar as unknown as Record<string, unknown>;
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en)) {
      const value = ar[key];
      if (typeof value === 'string') expect(value, key).toMatch(ARABIC_LETTER);
      if (typeof value === 'function') {
        const text = String((value as (...args: unknown[]) => unknown)('س', 1280));
        expect(text, key).toMatch(ARABIC_LETTER);
        expect(text, key).not.toMatch(ARABIC_INDIC_DIGIT);
      }
      if (typeof value === 'object' && value !== null) {
        expect(Object.keys(value).sort(), key).toEqual(Object.keys(en[key] as object).sort());
        for (const inner of Object.values(value)) expect(inner, key).toMatch(ARABIC_LETTER);
      }
    }
    expect(CHROME_LABELS.ar.deviceLine('سطح المكتب', 1280)).toBe('سطح المكتب · \u20661280 px\u2069');
  });

  it('builds one set per locale with its direction, from the shell catalogue', () => {
    const ar = editorLabels('ar');
    expect(ar.dir).toBe('rtl');
    expect(ar.statusBar.save.saved).toBe('محفوظ');
    expect(ar.libraryPanel.palette.blocksTab).toBe('الكتل');
    expect(ar.chrome.rail.layers).toBe('الطبقات');
    expect(editorLabels('en').dir).toBe('ltr');
  });

  it('names every block the playground registers in Arabic', () => {
    const kernel = createPlaygroundKernel();
    const types = kernel.context.registry.blocks('site').map((entry) => entry.schema.type);
    expect(types.length).toBeGreaterThan(20);
    const unnamed = types.filter((type) => localBlockName(type, BLOCK_NAMES_AR) === undefined);
    expect(unnamed).toEqual([]);
  });

  it('names every rail destination in Arabic, keeping ids and icons', () => {
    const items = railItemsIn([...RAIL_SECTIONS, ...RAIL_UTILITIES], CHROME_LABELS.ar.rail);
    for (const item of items) expect(item.label, item.id).toMatch(ARABIC_LETTER);
    expect(items.map((item) => item.id)).toEqual([...RAIL_SECTIONS, ...RAIL_UTILITIES].map((item) => item.id));
  });

  it('phrases recent changes in Arabic when given the Arabic phrases', () => {
    const log = [{ id: 't1', author: 'user', command: 'insertTreeNode' }];
    expect(recentChangesOf(log, { phrases: CHROME_LABELS.ar.changes }).changes[0]?.label).toBe('إضافة عنصر');
    expect(recentChangesOf(log).changes[0]?.label).toBe('add element');
  });
});
