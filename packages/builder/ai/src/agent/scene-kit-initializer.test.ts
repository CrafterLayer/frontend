import { describe, expect, it } from 'vitest';

import {
  customCodeJsMeta,
  customCodeJsParams,
  customCodeTree,
  customCss,
  type JsonValue,
} from '@craftkit/builder-schema';

import { SCENE_PRESETS, scenePreset } from '../scene-presets/catalog';
import type { AiPlan, AiPlanStep } from '../types';
import { checkScene } from './page-plan/check-scene';
import { checkSection, walkLandedTree } from './page-plan/check-section';
import { validatePagePlan } from './page-plan/validate-page-plan';
import type { PagePlan, SectionContract } from './page-plan/types';
import { completeReadyScene } from './scene-initializer';

const REGION = 'own-game';
const DECLARED = ['tree', 'css', 'js', 'jsMeta', 'jsParams'];
const KITS = SCENE_PRESETS.filter(({ region }) => region !== undefined);

function page(lang = 'ar'): { plan: PagePlan; contract: SectionContract } {
  const validated = validatePagePlan({
    intent: 'replace',
    locale: { lang },
    title: 'ليلى بين النجوم',
    description: 'مغامرة قابلة للعب.',
    tokens: {
      bg: 'white',
      surface: 'stone-50',
      ink: 'stone-900',
      muted: 'stone-600',
      accent: 'emerald-800',
      onAccent: 'white',
      border: 'stone-200',
      fontDisplay: { family: 'Tajawal', weights: [400, 700] },
      fontBody: { family: 'Tajawal', weights: [400, 700] },
      radius: 'md',
      signature: 'A playable scene with readable controls.',
    },
    primaryCta: { label: 'تعرف على القصة', href: '#details' },
    sections: [
      {
        key: 'game',
        role: 'hero',
        title: 'ليلى بين النجوم',
        anchorId: 'play',
        purpose: 'مغامرة قابلة للعب.',
        mustSay: ['اكتشف عالماً جديداً'],
      },
      { key: 'details', role: 'band', title: 'التفاصيل', anchorId: 'details', purpose: 'معلومات.' },
    ],
    facts: [{ key: 'credit', section: 'game', sample: 'تصميم فريق النجوم' }],
  });
  if (!validated.ok) throw new Error(JSON.stringify(validated.issues));
  const contract = validated.plan.sections[0];
  if (contract === undefined) throw new Error('Missing hero contract.');
  return { plan: validated.plan, contract };
}

function tool(input: unknown): AiPlanStep {
  return { command: 'tool', args: { name: 'scene.preset', input } };
}

function prop(key: string, value: unknown): AiPlanStep {
  return { command: 'setProp', args: { id: REGION, key, value } };
}

function complete(commands: AiPlanStep[], lang = 'ar', declared = DECLARED): AiPlan {
  const { plan, contract } = page(lang);
  return completeReadyScene(
    plan,
    contract,
    REGION,
    { rationale: 'Use a tested kit.', commands },
    declared,
    '',
    true,
  );
}

function valuesOf(answer: AiPlan): Record<string, JsonValue> {
  return Object.fromEntries(
    answer.commands.map(({ args }) => {
      const value = args as { key: string; value: JsonValue };
      return [value.key, value.value];
    }),
  );
}

describe('build-owned scene kit initialization', () => {
  it('requires an explicit build-owned capability before expanding scene kits', () => {
    const { plan, contract } = page();
    const command = tool({ preset: 'arcade' });
    expect(
      completeReadyScene(
        plan,
        contract,
        REGION,
        { rationale: 'Use a kit.', commands: [command] },
        DECLARED,
      ).commands,
    ).toEqual([command]);
  });

  it.each(['ar', 'en'])(
    'initializes every tested kit with its %s controls and contract',
    (lang) => {
      const { plan, contract } = page(lang);
      expect(KITS).toHaveLength(11);
      for (const preset of KITS) {
        const result = complete([tool({ preset: preset.id })], lang);
        const values = valuesOf(result);
        expect(
          result.commands.every(({ command }) => command === 'setProp'),
          preset.id,
        ).toBe(true);
        for (const step of result.commands) {
          expect(step.args).toMatchObject({ id: REGION });
          expect(DECLARED).toContain((step.args as { key: string }).key);
        }
        expect(values['js'], preset.id).toBe(preset.code);
        expect(customCodeTree().safeParse(values['tree']).success, preset.id).toBe(true);
        expect(customCss(8_000).safeParse(values['css']).success, preset.id).toBe(true);
        expect(customCodeJsMeta().safeParse(values['jsMeta']).success, preset.id).toBe(true);
        expect(customCodeJsParams().safeParse(values['jsParams']).success, preset.id).toBe(true);
        const landed = {
          tree: values['tree'] ?? null,
          css: values['css'] as string,
          js: values['js'] as string,
          jsParams: values['jsParams'] ?? null,
        };
        expect(checkScene(landed), preset.id).toEqual([]);
        expect(checkSection(plan, contract, landed), preset.id).toEqual([]);
        const nodes = walkLandedTree(values['tree']).map(({ node }) => node);
        expect(nodes[0]?.['attributes']).toMatchObject({ id: contract.anchorId });
        expect(nodes.find((node) => node['tag'] === 'h1')?.['text']).toBe(contract.title);
        expect(nodes.map((node) => node['text'])).toEqual(
          expect.arrayContaining([...contract.mustSay, plan.facts[0]?.sample]),
        );
        const controls = JSON.stringify(values['tree']);
        expect(controls, preset.id).toContain(
          preset.category === 'game' ? 'data-game-' : 'data-story-',
        );
      }
    },
  );

  it('accepts its explicit target and preserves valid localized parameter overrides', () => {
    const params = { hero: 'مريم', weather: false };
    const input = tool({ preset: 'picture-book', id: REGION, params });
    const values = valuesOf(complete([input]));
    expect(values['jsParams']).toMatchObject(params);
    expect(JSON.stringify(values['tree'])).toContain('اقرأ بصوت عال');
    expect(input).toEqual(tool({ preset: 'picture-book', id: REGION, params }));
    const quiz = valuesOf(complete([tool({ preset: 'quiz' })]));
    expect(quiz['jsParams']).toEqual(
      expect.objectContaining(scenePreset('quiz')?.region?.params?.ar ?? {}),
    );
  });

  it('leaves an authored tree untouched, before or after the kit', () => {
    const tree = { kind: 'root', children: [] };
    const treeStep = prop('tree', tree);
    const preset = tool({ preset: 'picture-book' });
    for (const commands of [
      [treeStep, preset],
      [preset, treeStep],
    ]) {
      const completed = complete(commands);
      expect(completed.commands).toContain(treeStep);
      expect(
        completed.commands.filter(({ args }) => (args as { key?: string }).key === 'tree'),
      ).toHaveLength(1);
      expect(valuesOf(completed)['tree']).toBe(tree);
    }
  });

  // 2026-11-01: a kit is a starting point, not a fixed look. A writer's own css restyles it —
  // colours, layout, frame — layered OVER the kit's, so the css its controls need still lands.
  it('layers an authored restyle over the kit css, before or after the kit, once', () => {
    const css = '.ck-kit{background:#0b1a2e;border-radius:2rem;aspect-ratio:4/5}';
    const cssStep = prop('css', css);
    const preset = tool({ preset: 'picture-book' });
    const kitCss = scenePreset('picture-book')?.region?.css ?? '';
    expect(kitCss).not.toBe('');
    for (const commands of [
      [cssStep, preset],
      [preset, cssStep],
    ]) {
      const completed = complete(commands);
      const written = completed.commands.filter(
        ({ args }) => (args as { key?: string }).key === 'css',
      );
      expect(written).toHaveLength(1);
      const landed = valuesOf(completed)['css'] as string;
      expect(landed.startsWith(kitCss)).toBe(true);
      expect(landed.endsWith(css)).toBe(true);
      expect(customCss(24_000).safeParse(landed).success).toBe(true);
    }
    // A restyle that already carries the kit css is not doubled.
    const whole = `${kitCss}\n${css}`;
    expect(valuesOf(complete([prop('css', whole), preset]))['css']).toBe(whole);
  });

  it('gives each placed kit its own seed, from the region and section, deterministic', () => {
    const seedOf = (region: string) => {
      const { plan, contract } = page('en');
      const step = completeReadyScene(
        plan,
        contract,
        region,
        { rationale: 'Use a kit.', commands: [tool({ preset: 'arcade' })] },
        DECLARED,
        '',
        true,
      ).commands.find(({ args }) => (args as { key?: string }).key === 'jsParams');
      const args = step?.args as { value?: Record<string, unknown> } | undefined;
      return args?.value?.['seed'];
    };
    const first = seedOf(REGION);
    expect(typeof first).toBe('number');
    expect(first).not.toBe(scenePreset('arcade')?.defaults['seed']);
    expect(seedOf(REGION)).toBe(first);
    expect(new Set(['a', 'b', 'c', 'd'].map(seedOf)).size).toBeGreaterThan(1);
    const chosen = valuesOf(complete([tool({ preset: 'arcade', params: { seed: 42 } })], 'en'));
    expect((chosen['jsParams'] as Record<string, unknown>)['seed']).toBe(42);
  });

  it.each([
    { preset: 'not-a-preset' },
    { preset: 'arcade', params: { notASetting: 1 } },
    { preset: 'picture-book', params: { weather: 'wrong' } },
    { preset: 'arcade', id: 'someone-elses-region' },
    { preset: 'arcade', after: REGION },
    { preset: 'arcade', behind: REGION },
    { preset: 'arcade', into: REGION },
    { preset: 'arcade', id: REGION, after: REGION },
    { preset: 'aurora-curtains', id: REGION },
  ])('preserves unsupported or invalid input for normal door rejection: %j', (input) => {
    const command = tool(input);
    expect(complete([command]).commands).toEqual([command]);
  });

  it('does not generate undeclared settings or conceal missing required block props', () => {
    const command = tool({ preset: 'arcade' });
    for (const missing of ['tree', 'css', 'js']) {
      expect(
        complete(
          [command],
          'en',
          DECLARED.filter((key) => key !== missing),
        ).commands,
      ).toEqual([command]);
    }
    const minimal = complete([command], 'en', ['tree', 'css', 'js']);
    expect(minimal.commands.map(({ args }) => (args as { key: string }).key).sort()).toEqual([
      'css',
      'js',
      'tree',
    ]);
    const localized = tool({ preset: 'quiz' });
    expect(complete([localized], 'ar', ['tree', 'css', 'js']).commands).toEqual([localized]);
  });
});
