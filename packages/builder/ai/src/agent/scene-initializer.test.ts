import { describe, expect, it } from 'vitest';

import {
  customCodeJsMeta,
  customCodeJsParams,
  customCodeTree,
  customCss,
  type CustomCodeRoot,
  type JsonValue,
} from '@craftkit/builder-schema';

import { scenePreset } from '../scene-presets/catalog';
import type { AiPlan, AiPlanStep } from '../types';
import { checkScene } from './page-plan/check-scene';
import { checkSection, walkLandedTree } from './page-plan/check-section';
import type { PagePlan, SectionContract, SectionRole } from './page-plan/types';
import { completeReadyScene, READY_SCENE_INIT_CSS } from './scene-initializer';
import { readyScenes } from './scene-ready';

const REGION = 'mural-region';
const DECLARED = ['tree', 'css', 'js', 'jsMeta', 'jsParams'];

function contract(role: SectionRole = 'hero'): SectionContract {
  return {
    key: 'mural',
    role,
    anchorId: 'mural',
    title: 'أضواء في السماء',
    purpose: 'جدارية هادئة بألوان الشفق، لا تخترع حقائق عن اللوحة.',
    mustSay: ['مشهد يتغير بهدوء', 'الضوء فوق التلال'],
    mustNotRepeat: [],
  };
}

function page(section: SectionContract): PagePlan {
  return {
    intent: 'replace',
    locale: { lang: 'ar', dir: 'rtl' },
    title: 'أضواء في السماء',
    description: 'جدارية الشفق.',
    tokens: {
      bg: '#ffffff',
      surface: '#f5f5f5',
      ink: '#171717',
      muted: '#525252',
      accent: '#065f46',
      onAccent: '#ffffff',
      accentInk: '#065f46',
      border: '#d4d4d4',
      fontDisplay: { family: 'Tajawal', weights: [400, 700], url: '' },
      fontBody: { family: 'Tajawal', weights: [400, 700], url: '' },
      radius: 'md',
      signature: 'أضواء خلف نص واضح',
    },
    primaryCta: { label: 'شاهد التفاصيل', href: '#details' },
    nav: [],
    sections: [
      section,
      {
        key: 'details',
        role: 'band',
        title: 'تفاصيل',
        anchorId: 'details',
        purpose: 'شرح قصير.',
        mustSay: [],
        mustNotRepeat: [],
      },
    ],
    facts: [
      { key: 'mural-credit', sample: 'اسم الفنان كما زوّده المالك', section: section.key },
      { key: 'other-fact', sample: 'حقيقة لقسم آخر', section: 'details' },
    ],
  };
}

function prop(key: string, value: unknown, id = REGION): AiPlanStep {
  return { command: 'setProp', args: { id, key, value } };
}

function answer(...commands: AiPlanStep[]): AiPlan {
  return { rationale: 'اختيار مشهد جاهز', commands };
}

function valuesOf(plan: AiPlan): Record<string, unknown> {
  return Object.fromEntries(
    plan.commands
      .filter((step) => step.command === 'setProp' && (step.args as { id?: unknown }).id === REGION)
      .map((step) => {
        const args = step.args as { key: string; value: unknown };
        return [args.key, args.value];
      }),
  );
}

function complete(section: SectionContract, given: AiPlan, declared = DECLARED): AiPlan {
  return completeReadyScene(page(section), section, REGION, given, declared);
}

describe('completeReadyScene — compact full section initialization', () => {
  it('enforces an initialization-only contract before custom or unlisted code can reach the door', () => {
    const section = contract();
    const request = 'SCENE INITIALIZATION v1: aurora-curtains';
    for (const invalid of [
      answer(),
      answer(prop('js', 'custom scene code')),
      answer(prop('js', '@preset:flow-field-silk')),
    ]) {
      expect(() =>
        completeReadyScene(page(section), section, REGION, invalid, DECLARED, request),
      ).toThrow(/offered ready presets/u);
    }
    const values = valuesOf(
      completeReadyScene(
        page(section),
        section,
        REGION,
        answer(prop('js', '@preset:aurora-curtains')),
        DECLARED,
        request,
      ),
    );
    expect(values['js']).toBe(scenePreset('aurora-curtains')?.code);
  });
  it.each(['hero', 'cta', 'band'] as const)(
    'initializes a responsive %s with exact copy, anchor and the appropriate action',
    (role) => {
      const section = contract(role);
      const before = answer(prop('js', '@preset:aurora-curtains'));
      const values = valuesOf(complete(section, before));
      const nodes = walkLandedTree(values['tree']).map(({ node }) => node);
      const texts = nodes.flatMap((node) =>
        typeof node['text'] === 'string' ? [node['text']] : [],
      );
      const heading = nodes.find((node) => node['tag'] === (role === 'hero' ? 'h1' : 'h2'));
      expect(heading?.['text']).toBe(section.title);
      expect(texts).toEqual(expect.arrayContaining([...section.mustSay]));
      expect(texts).toContain(page(section).facts[0]?.sample);
      expect(texts).not.toContain('حقيقة لقسم آخر');
      expect(texts).not.toContain(section.purpose);
      expect(nodes[0]?.['attributes']).toMatchObject({ id: section.anchorId });
      expect(nodes.some((node) => node['tag'] === 'img')).toBe(false);
      const links = nodes.filter((node) => node['tag'] === 'a');
      expect(links).toHaveLength(role === 'band' ? 0 : 1);
      if (role !== 'band') {
        expect(links[0]?.['text']).toBe(page(section).primaryCta.label);
        expect(links[0]?.['attributes']).toMatchObject({ href: '#details' });
      }
      expect(values['css']).toBe(READY_SCENE_INIT_CSS);
      expect(values['css']).toContain('aspect-ratio:16/9');
      expect(values['css']).toContain('aspect-ratio:3/4');
      expect(values['css']).toContain('z-index:1');
      expect(values['css']).toContain('background:var(--ck-surface)');
      expect(values['css']).not.toMatch(/\bvh\b/u);
      expect(values['js']).toBe(scenePreset('aurora-curtains')?.code);
      expect(customCodeTree().safeParse(values['tree']).success).toBe(true);
      expect(customCss(8_000).safeParse(values['css']).success).toBe(true);
      expect(
        checkSection(page(section), section, {
          tree: values['tree'] as JsonValue,
          css: values['css'] as string,
        }),
      ).toEqual([]);
      expect(before.commands).toEqual([prop('js', '@preset:aurora-curtains')]);
    },
  );

  it('preserves each required claim whole when their combined copy exceeds kit slot limits', () => {
    const section = {
      ...contract(),
      mustSay: Array.from(
        { length: 6 },
        (_, index) => `${String(index)} ${'كلمات مهمة '.repeat(16)}`,
      ),
    };
    const values = valuesOf(complete(section, answer(prop('js', '@preset:aurora-curtains'))));
    const texts = walkLandedTree(values['tree']).map(({ node }) => node['text']);
    for (const text of section.mustSay) expect(texts).toContain(text);
  });

  it('keeps an authored tree and css exactly, without adding another write for either', () => {
    const tree: CustomCodeRoot = { kind: 'root', children: [] };
    const css = '.authored{position:relative;min-height:500px}';
    const treeStep = prop('tree', tree);
    const cssStep = prop('css', css);
    const result = complete(
      contract(),
      answer(treeStep, cssStep, prop('js', '@preset:aurora-curtains')),
    );
    expect(result.commands[0]).toBe(treeStep);
    expect(result.commands[1]).toBe(cssStep);
    expect(
      result.commands.filter((step) => (step.args as { key?: unknown }).key === 'tree'),
    ).toHaveLength(1);
    expect(valuesOf(result)['tree']).toBe(tree);
    expect(valuesOf(result)['css']).toBe(css);
  });

  it('initializes every available backdrop with valid settings and passing static scene checks', () => {
    for (const preset of readyScenes()) {
      const values = valuesOf(complete(contract(), answer(prop('js', `@preset:${preset.id}`))));
      expect(
        checkScene({
          tree: values['tree'] as JsonValue,
          css: values['css'] as string,
          js: values['js'] as string,
        }),
        preset.id,
      ).toEqual([]);
      expect(customCodeJsMeta().safeParse(values['jsMeta']).success, preset.id).toBe(true);
      expect(customCodeJsParams().safeParse(values['jsParams']).success, preset.id).toBe(true);
      expect(values['jsParams'], preset.id).toEqual({});
    }
  });

  it('validates settings against the chosen preset and stores only non-default values', () => {
    const preset = scenePreset('aurora-curtains');
    const values = valuesOf(
      complete(
        contract(),
        answer(
          prop('js', '@preset:aurora-curtains'),
          prop('jsParams', { speed: 1.5, seed: preset?.defaults['seed'] }),
        ),
      ),
    );
    expect(values['jsParams']).toEqual({ speed: 1.5 });
    expect(values['jsMeta']).toMatchObject({
      ref: { tier: 'builtin', id: 'aurora-curtains', version: 1 },
      libs: preset?.libs,
    });
  });

  it.each([null, [], { wrong: 1 }, { speed: 'not a speed' }, { speed: 1000 }])(
    'refuses invalid authored params instead of dropping or clamping them: %j',
    (params) => {
      expect(() =>
        complete(
          contract(),
          answer(prop('js', '@preset:aurora-curtains'), prop('jsParams', params)),
        ),
      ).toThrow(/Ready scene aurora-curtains/u);
    },
  );

  it('only adds settings declared by the owning block', () => {
    const values = valuesOf(
      complete(contract(), answer(prop('js', '@preset:aurora-curtains')), ['tree', 'css', 'js']),
    );
    expect(values).not.toHaveProperty('jsMeta');
    expect(values).not.toHaveProperty('jsParams');
  });

  it('leaves custom JS, unknown ids and game/story kits unchanged', () => {
    for (const js of [
      'const s=await ck.scene({});',
      '@preset:unknown',
      '@preset:snake',
      '@preset:picture-book',
    ]) {
      const given = answer(prop('js', js));
      expect(complete(contract(), given)).toBe(given);
    }
  });

  it('does not expand or initialize another region and preserves unrelated commands', () => {
    const foreign = prop('js', '@preset:aurora-curtains', 'someone-elses-region');
    const given = answer(foreign);
    expect(complete(contract(), given)).toBe(given);
    const result = complete(contract(), answer(foreign, prop('js', '@preset:aurora-curtains')));
    expect(result.commands[0]).toBe(foreign);
    expect(
      result.commands.every(
        (step, index) => index === 0 || (step.args as { id?: unknown }).id === REGION,
      ),
    ).toBe(true);
  });

  it('keeps the final custom JS write as the authority when an earlier step named a preset', () => {
    const given = answer(prop('js', '@preset:aurora-curtains'), prop('js', 'const bespoke=1;'));
    expect(complete(contract(), given)).toBe(given);
  });
});
