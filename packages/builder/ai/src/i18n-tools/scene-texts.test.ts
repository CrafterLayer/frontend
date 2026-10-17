import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeJsMeta,
  customCodeJsParams,
  customCodeTree,
  customCss,
  customJs,
  defineBlockSchema,
  emptyCustomCodeTree,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { parseTreeMarkup, serializeTreeMarkup } from '../plan/tree-markup';
import { validateAiPlan } from '../plan/validate-plan';
import { scenePreset } from '../scene-presets/catalog';
import { agentToolsFixtureBlocks, kitCss, liveContext } from '../tools/agent/agent-tools.fixtures';
import { pageTexts } from './page-texts';
import { pageTranslateTool, type PageTranslateInput } from './page-translate';
import { namesWords, readsAsWords } from './scene-texts';

/*
  Scene text is translatable (T231, 2026-10-12). A Pixi scene's words reach page.translate two
  ways, both pinned here on a page whose customCode block declares js, jsParams and jsMeta as the
  product's does: the dialogue lines it reads from its tree (s.lib.dialogue.fromDom) are tree
  text, translated with no new code; the text params of its Scene settings are translated as one
  jsParams setProp. Its code, its numbers, colours, choices and addresses are never touched.
*/

const [pageBlock] = agentToolsFixtureBlocks.contributes?.blocks ?? [];
if (pageBlock === undefined) throw new Error('fixture: no page block');

const sceneBlocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'scene-texts-fixture',
  version: '0.0.0',
  contributes: {
    blocks: [
      pageBlock,
      {
        schema: defineBlockSchema({
          type: 'customCode',
          description: 'A freely composed region that may carry page code.',
          props: z.object({
            label: z.string().max(80).default('Custom section'),
            tree: customCodeTree().default(emptyCustomCodeTree()),
            css: customCss(24_000),
            js: customJs(),
            jsParams: customCodeJsParams(),
            jsMeta: customCodeJsMeta(),
          }),
          examples: [],
        }),
        render: () => null,
      },
    ],
  },
};

const STORY_TREE = `<section class='ck-scene'><h2>Star run</h2><ol data-ck-dialogue hidden>
<li data-ck-speaker='layla'>The lantern went out.</li>
<li data-ck-node='ask' data-ck-speaker='omar'>Cross the river tonight?<button type='button' data-ck-next='cross'>Cross now</button><button type='button' data-ck-next='wait'>Wait for dawn</button></li>
<li data-ck-node='cross' data-ck-ending='brave'>Brave choice.</li>
<li data-ck-node='wait' data-ck-ending='patient'>Dawn finds the lantern glowing.</li></ol></section>`;

/** Its code names words too ('Start', 'Star run'): code is never read for translation. */
const STORY_JS = `const p=ck.params({title:'Star run',startLabel:'Start',hudText:'',music:'',label:'calm',speed:1});
const s=await ck.scene({libs:['dialogue']});const D=s.lib.dialogue;
const talk=D.create(D.fromDom(ck.root),{rng:s.random});const box=D.view(talk,{root:ck.root,interactive:!s.editor});
s.dispose(()=>{box.dispose();talk.dispose()});`;

const label = (en: string) => ({ en, ar: en });

const STORY_META = {
  params: [
    { key: 'title', type: 'text', label: label('Title'), default: 'Star run' },
    { key: 'startLabel', type: 'text', label: label('Start button'), default: 'Start' },
    { key: 'path', type: 'text', label: label('Swash path'), default: 'M0 0 C10 10 20 0 30 10' },
    {
      key: 'images',
      type: 'text',
      label: label('Images'),
      default: 'https://images.example/a.jpg,https://images.example/b.jpg',
    },
    {
      key: 'label',
      type: 'select',
      label: label('Mood'),
      default: 'calm',
      options: [
        { value: 'calm', label: label('Calm') },
        { value: 'wild', label: label('Wild') },
      ],
    },
    { key: 'tint', type: 'color', label: label('Tint'), default: '#ff0000' },
    { key: 'speed', type: 'range', label: label('Speed'), default: 1, min: 0, max: 2 },
  ],
};

const STORY_PARAMS = {
  title: 'Collect every star',
  hudText: 'Stars left',
  music: 'https://audio.example/night.mp3',
  label: 'wild',
  speed: 1.5,
};

function sceneKernel(scene: Readonly<Record<string, unknown>>): BuilderKernel {
  const document = {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'page',
        props: { title: 'Star run', description: '', slug: '', lang: 'en', pageCss: kitCss('en') },
        slots: { default: ['r-game'] },
      },
      'r-game': {
        id: 'r-game',
        type: 'customCode',
        props: { label: 'Game', css: '', tree: parseTreeMarkup(STORY_TREE), ...scene },
        slots: {},
      },
    },
  } as unknown as BuilderDocument;
  return createBuilder({
    document,
    extensions: [sceneBlocks],
    ports: { clock: fixedClock(1), ids: seededIds('scene-texts') },
  });
}

const STORY = { js: STORY_JS, jsParams: STORY_PARAMS, jsMeta: STORY_META };

const STORY_AR: Readonly<Record<string, string>> = {
  'Star run': 'سباق النجوم',
  'The lantern went out.': 'انطفأ الفانوس.',
  'Cross the river tonight?': 'نعبر النهر الليلة؟',
  'Cross now': 'نعبر الآن',
  'Wait for dawn': 'ننتظر الفجر',
  'Brave choice.': 'اختيار شجاع.',
  'Dawn finds the lantern glowing.': 'يجد الفجر الفانوس مضيئًا.',
  'Collect every star': 'اجمع كل النجوم',
  Start: 'ابدأ',
  'Stars left': 'النجوم المتبقية',
};

/** Run page.translate, then judge its steps with the real door; the accepted writes by `<id>.<key>`. */
function translate(kernel: BuilderKernel, input: PageTranslateInput) {
  const parsed = pageTranslateTool.parse(input);
  if (!parsed.ok) throw new Error(parsed.error);
  const run = pageTranslateTool.run(parsed.value, liveContext(kernel));
  if (!run.ok) return { error: run.error, writes: new Map<string, unknown>() };
  const result = validateAiPlan({ rationale: 'translate', commands: [...run.steps] }, kernel, {
    clock: fixedClock(2),
    ids: seededIds('scene-texts-door'),
  });
  if (!result.ok) throw new Error(result.issues.map(({ message }) => message).join('; '));
  const writes = new Map<string, unknown>();
  for (const step of result.plan.commands) {
    const args = step.args as { id?: string; key?: string; value?: unknown };
    if (step.command === 'setProp') writes.set(`${args.id ?? ''}.${args.key ?? ''}`, args.value);
  }
  return { error: undefined, writes };
}

describe('which scene params are words', () => {
  it.each([
    ['title', true],
    ['startLabel', true],
    ['hudText', true],
    ['text2', true],
    ['winMessage', true],
    ['buttonCta', true],
    ['textColor', false],
    ['titleSize', false],
    ['path', false],
    ['images', false],
    ['music', false],
    ['seed', false],
    ['labels', false],
  ])('%s names words: %s', (key, expected) => {
    expect(namesWords(key)).toBe(expected);
  });

  it.each([
    ['Collect every star', true],
    ['ابدأ', true],
    ['Start', true],
    ['', false],
    ['  ', false],
    ['2026', false],
    ['#ff0000', false],
    ['theme', false],
    ['https://images.example/a.jpg', false],
    ['data:image/png;base64,AAAA', false],
    ['/assets/hero.png', false],
    [12, false],
    [['a', 'b'], false],
  ])('%j reads as words: %s', (value, expected) => {
    expect(readsAsWords(value)).toBe(expected);
  });
});

describe('page.translate on a scene', () => {
  it('lists the dialogue lines and the text params, never code, ids, colours or addresses', () => {
    const texts = pageTexts(liveContext(sceneKernel(STORY)));
    // A tree is read children first (mapTree), so a line's choices come before its question.
    expect(texts).toEqual([
      'Star run',
      'The lantern went out.',
      'Cross now',
      'Wait for dawn',
      'Cross the river tonight?',
      'Brave choice.',
      'Dawn finds the lantern glowing.',
      'Collect every star',
      'Start',
      'Stars left',
    ]);
  });

  it('translates the lines in the tree and the text params; code, meta and settings stay', () => {
    const { error, writes } = translate(sceneKernel(STORY), { lang: 'ar', texts: STORY_AR });
    expect(error).toBeUndefined();
    const tree = serializeTreeMarkup(writes.get('r-game.tree')) ?? '';
    expect(tree).toContain('انطفأ الفانوس.');
    expect(tree).toContain("data-ck-next='cross' type='button'>نعبر الآن</button>");
    expect(tree).toContain("data-ck-ending='patient' data-ck-node='wait'>يجد الفجر");
    expect(tree).toContain('سباق النجوم');
    expect(writes.get('r-game.jsParams')).toEqual({
      title: 'اجمع كل النجوم',
      hudText: 'النجوم المتبقية',
      music: 'https://audio.example/night.mp3',
      label: 'wild',
      speed: 1.5,
      // A declared text param the scene did not store shows its default: its translation is stored.
      startLabel: 'ابدأ',
    });
    expect(writes.has('r-game.js')).toBe(false);
    expect(writes.has('r-game.jsMeta')).toBe(false);
    expect(writes.get('root.lang')).toBe('ar');
  });

  it('refuses a translation that leaves a scene text behind, and names it', () => {
    const texts = Object.fromEntries(
      Object.entries(STORY_AR).filter(([from]) => from !== 'Collect every star'),
    );
    expect(translate(sceneKernel(STORY), { lang: 'ar', texts }).error).toContain(
      '"Collect every star"',
    );
  });

  it('reads a scene with no spec by its keys alone', () => {
    const kernel = sceneKernel({ js: STORY_JS, jsParams: { title: 'Night race', seed: 4 } });
    expect(pageTexts(liveContext(kernel))).toContain('Night race');
    const { writes } = translate(kernel, {
      lang: 'ar',
      texts: { ...STORY_AR, 'Night race': 'سباق الليل' },
    });
    expect(writes.get('r-game.jsParams')).toEqual({ title: 'سباق الليل', seed: 4 });
  });

  it('writes nothing for a scene whose words are names that stay', () => {
    const kernel = sceneKernel({ js: STORY_JS, jsParams: { title: 'Layla' } });
    const { writes } = translate(kernel, {
      lang: 'ar',
      texts: { ...STORY_AR, Layla: 'Layla' },
    });
    expect(writes.has('r-game.jsParams')).toBe(false);
  });

  it('translates a catalogued preset phrase and leaves its swash path alone', () => {
    const preset = scenePreset('calligraphy-ink-reveal');
    if (preset === undefined) throw new Error('catalogue: no calligraphy-ink-reveal');
    const kernel = sceneKernel({
      js: preset.code,
      jsMeta: { params: preset.params },
      jsParams: { text: 'Peace be upon you' },
    });
    const texts = pageTexts(liveContext(kernel));
    expect(texts).toContain('Peace be upon you');
    expect(texts.some((text) => text.startsWith('M20 190'))).toBe(false);
    const { writes } = translate(kernel, {
      lang: 'ar',
      texts: { ...STORY_AR, 'Peace be upon you': 'السلام عليكم' },
    });
    expect(writes.get('r-game.jsParams')).toEqual({ text: 'السلام عليكم' });
  });
});
