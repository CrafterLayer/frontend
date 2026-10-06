import { describe, expect, it } from 'vitest';

import { BLOCK_NAMES_AR, blockNameKey } from './block-names';
import { EDITOR_CATALOGUES, editorCatalogue } from './editor-catalogue';
import {
  formatEditorNumber,
  latinDigitsLocale,
  logicalArrowKey,
  resolveChromeDir,
} from './editor-locale';

const ARABIC_LETTER = /[ء-ي]/u;
const ARABIC_INDIC_DIGIT = /[٠-٩۰-۹]/u;
/*
  Latin words an Arabic UI legitimately keeps: key names on the keyboard, file
  formats, CSS and web terms a designer types as they are. Anything else in the
  Arabic catalogue is an untranslated string.
*/
const LATIN_KEPT = new Set([
  'alt', 'backspace', 'cmd', 'css', 'ctrl', 'delete', 'enter', 'esc', 'escape', 'gif', 'google',
  'html', 'http', 'https', 'jpeg', 'jpg', 'lottie', 'max', 'mod', 'option', 'png', 'shift', 'space',
  'svg', 'tab', 'tailwind', 'url', 'webp', 'woff', 'woff2', 'rgb', 'hsl', 'oklch', 'hex', 'fonts',
  'aria', 'lorem', 'ipsum', 'cta', 'faq', 'seo', 'utf', 'aaa', 'home', 'end', 'json',
  // ── block-parts (2026-10-06) ── link schemes a person types as they are (https:// is above)
  'mailto', 'tel',
  // ── /block-parts ──
  // Product names stay as their makers spell them.
  'lucide', 'tabler', 'storybook',
]);

/** Keys only the Arabic side carries: English humanises block types instead of listing them. */
const ARABIC_ONLY = /\.(blocks|blockNames)$/u;
/** Labels that are deliberately Latin: a font's Latin preview sentence. */
const LATIN_BY_DESIGN = '.sampleLatin';

interface Leaf {
  readonly path: string;
  readonly en: unknown;
  readonly ar: unknown;
}

/** Walk both catalogues in step; every path that differs in shape is a parity failure. */
function walk(en: unknown, ar: unknown, path: string, leaves: Leaf[], mismatches: string[]): void {
  if (typeof en === 'object' && en !== null && !Array.isArray(en)) {
    if (typeof ar !== 'object' || ar === null || Array.isArray(ar)) {
      mismatches.push(`${path}: object in EN, ${typeof ar} in AR`);
      return;
    }
    const keys = new Set([...Object.keys(en), ...Object.keys(ar)]);
    for (const key of keys) {
      if (!(key in en)) {
        if (!ARABIC_ONLY.test(`${path}.${key}`)) mismatches.push(`${path}.${key}: only in AR`);
      }
      else if (!(key in ar)) mismatches.push(`${path}.${key}: only in EN`);
      else walk((en as Record<string, unknown>)[key], (ar as Record<string, unknown>)[key], `${path}.${key}`, leaves, mismatches);
    }
    return;
  }
  if (Array.isArray(en)) {
    if (!Array.isArray(ar) || ar.length !== en.length) {
      mismatches.push(`${path}: array length differs`);
      return;
    }
    en.forEach((item, at) => {
      walk(item, ar[at], `${path}[${String(at)}]`, leaves, mismatches);
    });
    return;
  }
  if (typeof en !== typeof ar) {
    mismatches.push(`${path}: ${typeof en} in EN, ${typeof ar} in AR`);
    return;
  }
  leaves.push({ path, en, ar });
}

function collect(): { leaves: Leaf[]; mismatches: string[] } {
  const leaves: Leaf[] = [];
  const mismatches: string[] = [];
  walk(EDITOR_CATALOGUES.en, EDITOR_CATALOGUES.ar, 'catalogue', leaves, mismatches);
  return { leaves, mismatches };
}

/** A function label called the way a surface would: names, then counts. */
function outputs(fn: (...args: unknown[]) => unknown, arabic: boolean): string[] {
  const name = arabic ? 'س' : 'Hero';
  const results: string[] = [];
  for (const args of [
    [name, name, name],
    [1, 2, 3],
    [12, 12, 12],
    [1234, 640, 480],
  ]) {
    try {
      const value = fn(...args);
      if (typeof value === 'string') results.push(value);
    } catch {
      // A label typed for other arguments (an object) is exercised by its own surface's tests.
    }
  }
  return results;
}

function latinWords(text: string): string[] {
  // Placeholders ({name}) and colour values (#0f766e) are not words.
  const prose = text.replace(/\{[^}]*\}/gu, '').replace(/#[0-9a-fA-F]+/gu, '');
  return [...prose.matchAll(/[A-Za-z][A-Za-z0-9]*/gu)]
    .map((match) => match[0])
    .filter((word) => word.length >= 3 && !LATIN_KEPT.has(word.toLowerCase()));
}

describe('the editor catalogue (arabic-editor)', () => {
  it('gives Arabic exactly the shape English has — every surface, key and label kind', () => {
    const { leaves, mismatches } = collect();
    expect(mismatches).toEqual([]);
    expect(leaves.length).toBeGreaterThan(400);
  });

  it('has no empty label in either language', () => {
    const empty = collect()
      .leaves.filter((leaf) => (typeof leaf.en === 'string' && leaf.en.trim() === '') || (typeof leaf.ar === 'string' && leaf.ar.trim() === ''))
      .map((leaf) => leaf.path);
    expect(empty).toEqual([]);
  });

  it('leaves no English word in the Arabic catalogue', () => {
    const untranslated: string[] = [];
    for (const leaf of collect().leaves) {
      const texts =
        typeof leaf.ar === 'string'
          ? [leaf.ar]
          : typeof leaf.ar === 'function'
            ? outputs(leaf.ar as (...args: unknown[]) => unknown, true)
            : [];
      // Values that are not prose: a locale tag, a language code.
      const notProse =
        leaf.path.endsWith('.locale') || leaf.path.endsWith('.language') || leaf.path.endsWith(LATIN_BY_DESIGN);
      if (notProse) continue;
      // A label called with arguments it was not typed for says "undefined"; its own tests cover it.
      for (const text of texts.filter((candidate) => !candidate.includes('undefined'))) {
        const words = latinWords(text);
        if (words.length > 0) untranslated.push(`${leaf.path}: ${text}`);
      }
    }
    expect(untranslated).toEqual([]);
  });

  it('writes every Arabic number in Latin digits', () => {
    const indic: string[] = [];
    for (const leaf of collect().leaves) {
      const texts =
        typeof leaf.ar === 'string'
          ? [leaf.ar]
          : typeof leaf.ar === 'function'
            ? outputs(leaf.ar as (...args: unknown[]) => unknown, true)
            : [];
      for (const text of texts) if (ARABIC_INDIC_DIGIT.test(text)) indic.push(`${leaf.path}: ${text}`);
    }
    expect(indic).toEqual([]);
    expect(formatEditorNumber(1234567, 'ar')).toMatch(/^1.234.567$/u);
    expect(new Intl.RelativeTimeFormat(latinDigitsLocale('ar')).format(-5, 'minute')).not.toMatch(ARABIC_INDIC_DIGIT);
  });

  it('keeps Arabic letters out of the English chrome', () => {
    const arabicInEnglish = collect()
      .leaves.filter((leaf) => typeof leaf.en === 'string' && ARABIC_LETTER.test(leaf.en))
      // Font previews show both scripts on purpose.
      .filter((leaf) => !leaf.path.includes('fontPicker.'))
      .map((leaf) => leaf.path);
    expect(arabicInEnglish).toEqual([]);
  });

  it('builds one catalogue per language with its direction', () => {
    expect(editorCatalogue('ar').dir).toBe('rtl');
    expect(editorCatalogue('en').dir).toBe('ltr');
    expect(editorCatalogue('ar')).toBe(editorCatalogue('ar'));
    expect(editorCatalogue('ar').statusBar.save.saved).toBe('محفوظ');
    expect(editorCatalogue('ar').libraryPanel.palette.blocksTab).toBe('الكتل');
  });

  it('names every block type in Arabic by its normalised key', () => {
    expect(blockNameKey('bento-grid')).toBe('bentogrid');
    expect(blockNameKey('ext:logoCloud')).toBe('logocloud');
    for (const [key, name] of Object.entries(BLOCK_NAMES_AR)) {
      expect(key).toBe(blockNameKey(key));
      expect(name).toMatch(ARABIC_LETTER);
    }
  });
});

describe('chrome direction', () => {
  it('reads the nearest dir above an element, else the fallback', () => {
    const root = document.createElement('div');
    root.innerHTML = '<section dir="rtl"><nav><button>a</button></nav></section><p><b>x</b></p>';
    expect(resolveChromeDir(root.querySelector('button'))).toBe('rtl');
    expect(resolveChromeDir(root.querySelector('b'), 'rtl')).toBe('rtl');
    expect(resolveChromeDir(root.querySelector('b'))).toBe('ltr');
    expect(resolveChromeDir(null, 'rtl')).toBe('rtl');
  });

  it('swaps only the horizontal arrows under RTL', () => {
    expect(logicalArrowKey('ArrowLeft', 'rtl')).toBe('ArrowRight');
    expect(logicalArrowKey('ArrowRight', 'rtl')).toBe('ArrowLeft');
    expect(logicalArrowKey('ArrowDown', 'rtl')).toBe('ArrowDown');
    expect(logicalArrowKey('ArrowLeft', 'ltr')).toBe('ArrowLeft');
  });
});
