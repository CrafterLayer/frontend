import { describe, expect, it } from 'vitest';

import {
  customCodeTreeProblems,
  findCssRejection,
  validateParamValues,
  type CustomCodeNode,
} from '@craftkit/builder-schema';

import { namesWords } from '../../i18n-tools/scene-texts';
import { KIT_LANGS, SCENE_PRESETS, type ScenePreset } from '../catalog';
import { KITS_SET_C } from './index';

/*
  The game and story kits as sections (2026-10-13): what presets.test.ts cannot see from the
  library entry alone — the tree the code drives, in both languages, its css, and the contract
  between the two (every word the code says by key is in the tree; every word a visitor reads is
  text page.translate reaches). The real door and the scene check judge each landed kit in
  tools/agent/builtin/scene-preset.test.ts; Chromium plays them in apps/evals.
*/

const KITS = SCENE_PRESETS.filter((preset) => preset.region !== undefined);
const CASES = KITS.map((preset): [string, ScenePreset] => [preset.id, preset]);

interface Element {
  readonly tag: string;
  readonly className?: string;
  readonly text?: string;
  readonly attributes?: Readonly<Record<string, string>>;
  readonly children?: readonly CustomCodeNode[];
}

function elements(nodes: readonly CustomCodeNode[]): Element[] {
  return nodes.flatMap((node) =>
    node.kind === 'element' ? [node as Element, ...elements(node.children ?? [])] : [],
  );
}

function treeOf(preset: ScenePreset, lang: (typeof KIT_LANGS)[number]): Element[] {
  return elements(preset.region?.tree[lang].children ?? []);
}

/** Every literal key the code says by name: say('won'), say('ending-' …) is dynamic and skipped. */
function saidKeys(code: string): string[] {
  return [...new Set([...code.matchAll(/\bsay\(\s*'([\w-]+)'\s*\)/gu)].map((m) => m[1] ?? ''))];
}

const LATIN_WORD = /[A-Za-z]{2,}/u;
const ARABIC = /[؀-ۿ]/u;

describe('the kit catalogue', () => {
  it('holds eight games and three stories, every one a kit with a region', () => {
    expect(KITS_SET_C).toHaveLength(11);
    expect(KITS.map(({ category }) => category)).toEqual([
      ...Array<string>(8).fill('game'),
      ...Array<string>(3).fill('story'),
    ]);
    expect(
      SCENE_PRESETS.filter((preset) => preset.category === 'game' || preset.category === 'story'),
    ).toEqual(KITS);
  });
});

describe.each(CASES)('kit %s', (_id, preset) => {
  const region = preset.region;
  if (region === undefined) throw new Error('a kit without a region');

  it('carries one outer section per language, admitted whole by the tree door', () => {
    for (const lang of KIT_LANGS) {
      const tree = region.tree[lang];
      expect(tree.children).toHaveLength(1);
      expect(tree.children[0]).toMatchObject({ kind: 'element', tag: 'section' });
      expect(customCodeTreeProblems(tree)).toEqual([]);
    }
  });

  it('writes every word in the page language: English in English, Arabic in Arabic', () => {
    const textsOf = (lang: (typeof KIT_LANGS)[number]) =>
      treeOf(preset, lang).flatMap((node) => [
        ...(node.text === undefined ? [] : [node.text]),
        ...(node.attributes?.['aria-label'] === undefined ? [] : [node.attributes['aria-label']]),
      ]);
    const english = textsOf('en'),
      arabic = textsOf('ar');
    expect(english.length).toBeGreaterThan(5);
    expect(english.filter((text) => ARABIC.test(text))).toEqual([]);
    expect(arabic.filter((text) => LATIN_WORD.test(text))).toEqual([]);
    // The same structure in both: only the words differ.
    const shape = (lang: (typeof KIT_LANGS)[number]) =>
      treeOf(preset, lang).map((node) => `${node.tag}.${node.className ?? ''}`);
    expect(shape('ar')).toEqual(shape('en'));
  });

  it('keeps its words out of the code: every line it says by key is in both trees', () => {
    const keys = saidKeys(preset.code);
    for (const lang of KIT_LANGS) {
      const listed = new Set(
        treeOf(preset, lang)
          .filter((node) => node.tag === 'li')
          .map((node) => node.attributes?.['data-scene-value']),
      );
      expect(keys.filter((key) => !listed.has(key))).toEqual([]);
    }
  });

  it('styles only its own ck-kit classes, with theme tokens for every colour', () => {
    const classes = new Set(
      treeOf(preset, 'en').flatMap((node) => (node.className ?? '').split(/\s+/u).filter(Boolean)),
    );
    expect([...classes].filter((name) => !name.startsWith('ck-kit'))).toEqual([]);
    expect(findCssRejection(region.css)).toBeUndefined();
    expect(region.css).not.toMatch(/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/iu);
    expect(region.css).toMatch(/var\(--t-surface\)/u);
    // Sized by its width (aspect-ratio or rows of chapters), never by the viewport height.
    expect(region.css).not.toMatch(/\d\s*(?:d|s|l)?vh\b/u);
  });

  it('gives the page-language words of its params as valid values of word-named text params', () => {
    for (const lang of KIT_LANGS) {
      const words = region.params?.[lang] ?? {};
      expect(validateParamValues(preset.params, words).issues).toEqual([]);
      for (const key of Object.keys(words)) {
        expect(preset.params.find((spec) => spec.key === key)?.type).toBe('text');
        // page.translate reads a text param as words by its key: it must name words.
        expect(namesWords(key)).toBe(true);
      }
    }
  });

  it('follows the playbooks: polite status, editor-inert controls, calm frames, cleanup', () => {
    const status = treeOf(preset, 'en').find(
      (node) =>
        node.attributes?.['data-game-status'] !== undefined ||
        node.attributes?.['data-story-status'] !== undefined,
    );
    expect(status?.attributes).toMatchObject({ role: 'status', 'aria-live': 'polite' });
    expect(preset.code).toContain('s.editor');
    expect(preset.code).toContain('s.reducedMotion');
    expect(preset.code).toContain('s.dispose');
    expect(preset.code).toMatch(/design: \{ width: 1280, height: (?:720|848)/u);
    expect(preset.code).not.toMatch(/\bwindow\.addEventListener\(\s*'key/u);
    if (preset.category === 'game') {
      const actions = treeOf(preset, 'en').map((node) => node.attributes?.['data-game-action']);
      expect(actions).toEqual(expect.arrayContaining(['start', 'pause', 'restart', 'sound']));
      // Sound only through the audio library, created muted.
      expect(preset.code).toContain('s.lib.audio.create(s, { muted: true })');
    } else {
      // Buttons to turn pages, or (the scroll story) chapters the page scroll turns.
      const turns = treeOf(preset, 'en').filter(
        (node) =>
          node.attributes?.['data-story-action'] !== undefined ||
          node.attributes?.['data-scene-part'] === 'chapter',
      );
      expect(turns.length).toBeGreaterThan(0);
    }
  });
});
