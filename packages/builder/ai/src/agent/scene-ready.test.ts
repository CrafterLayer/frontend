import { describe, expect, it } from 'vitest';

import { MURAL_KIT_EDIT_LINE, MURAL_KIT_WRITER_LINE } from '../creative/mural-kit';
import { scenePreset } from '../scene-presets/catalog';
import type { AiPlan } from '../types';
import { isSceneInitializationRequest } from '../provider/scene-init-wire';
import { checkScene } from './page-plan/check-scene';
import {
  READY_SCENES_LISTED,
  createReadyScenesContextProvider,
  expandReadyScenes,
  markReadyScenes,
  readyScenes,
  readySceneLines,
  suggestReadyScenes,
  withReadyScenes,
} from './scene-ready';

function jsPlan(value: string): AiPlan {
  return {
    rationale: 'r',
    commands: [
      {
        command: 'setProp',
        args: { id: 'pg-hero', key: 'tree', value: { kind: 'root', children: [] } },
      },
      { command: 'setProp', args: { id: 'pg-hero', key: 'js', value } },
    ],
  };
}

function jsOf(plan: AiPlan): unknown {
  const step = plan.commands.find(
    ({ args }) => (args as { key?: unknown } | undefined)?.key === 'js',
  );
  return (step?.args as { value?: unknown } | undefined)?.value;
}

describe('ready scenes in a build (2026-10-13)', () => {
  it('offers only backdrops that stand as they are: no words, photos or kits of their own', () => {
    const categories = new Set(readyScenes().map(({ category }) => category));
    expect([...categories].sort()).toEqual(['mural', 'particles', 'pattern', 'toy']);
    expect(readyScenes().length).toBeGreaterThanOrEqual(20);
  });

  it('lists the scenes that share the brief’s words first, a few of them', () => {
    const listed = suggestReadyScenes(
      'A calm aurora mural of northern lights over the hills',
      'en',
    );
    expect(listed[0]?.id).toBe('aurora-curtains');
    expect(listed).toHaveLength(READY_SCENES_LISTED);
    expect(new Set(listed.map(({ id }) => id)).size).toBe(listed.length);
  });

  it('gives a brief that names nothing a calm, broad few, Arabic patterns first on an Arabic page', () => {
    expect(suggestReadyScenes('The section of the page', 'en').map(({ id }) => id)).toEqual([
      'aurora-curtains',
      'flow-field-silk',
      'low-poly-terrain',
      'topographic-contours',
    ]);
    expect(suggestReadyScenes('قسم في الصفحة', 'ar')[0]?.id).toBe('girih-starfield');
  });

  it('tells the first writer how to place one, and a retry to place one', () => {
    const listed = suggestReadyScenes('aurora mural', 'en');
    const first = readySceneLines(listed, 1).join('\n');
    expect(first).toContain('READY SCENES');
    expect(first).toContain('"@preset:<id>"');
    expect(first).toContain('under 9,000 characters');
    expect(first).toContain('ONE setProp step');
    expect(first).toContain('responsive tree and css');
    expect(isSceneInitializationRequest(first)).toBe(false);
    const retry = readySceneLines(listed, 2).join('\n');
    expect(retry).toContain('The first attempt at this section failed');
    expect(retry).toContain('no scene code of your own');
    expect(isSceneInitializationRequest(retry)).toBe(true);
    expect(readySceneLines([], 1)).toEqual([]);
  });

  it('marks only an explicit catalog id in the original first-attempt brief as init-only', () => {
    const listed = suggestReadyScenes('aurora mural', 'en');
    const explicit = readySceneLines(listed, 1, 'Place aurora-curtains behind the title').join(
      '\n',
    );
    expect(explicit).toContain('SCENE INITIALIZATION v1: aurora-curtains\n');
    expect(explicit).toContain('no scene code of your own');
    expect(isSceneInitializationRequest(explicit)).toBe(true);
    const retry = readySceneLines(listed, 2, 'Place aurora-curtains behind the title').join('\n');
    expect(retry).toContain('SCENE INITIALIZATION v1: aurora-curtains\n');
    expect(retry).not.toContain('SCENE INITIALIZATION v1: aurora-curtains|');
    for (const original of [
      'A mural of aurora curtains',
      'custom-aurora-curtains-v2',
      'aurora-curtains-other',
    ]) {
      expect(isSceneInitializationRequest(readySceneLines(listed, 1, original).join('\n'))).toBe(
        false,
      );
    }
  });

  it('does not force a later bespoke mural to use a preset named for the lead scene', () => {
    const later = {
      options: { request: 'Build an aurora-curtains hero then a bespoke waterfall mural' },
      plan: { locale: { lang: 'en', dir: 'ltr' as const } },
      skillIds: ['craftkit.pixi-murals'],
      contract: {
        key: 'waterfall',
        role: 'band' as const,
        title: 'Waterfall',
        anchorId: 'waterfall',
        purpose: 'A bespoke waterfall mural with an illustrated bridge',
        mustSay: [],
        mustNotRepeat: [],
      },
    };
    expect(isSceneInitializationRequest(withReadyScenes('brief', later, 1))).toBe(false);
    expect(isSceneInitializationRequest(withReadyScenes('brief', later, 2))).toBe(false);
    const named = {
      ...later,
      options: { request: 'Build an aurora-curtains hero and another aurora-curtains mural' },
      contract: { ...later.contract, purpose: 'A mural using aurora-curtains' },
    };
    expect(withReadyScenes('brief', named, 1)).toContain(
      'SCENE INITIALIZATION v1: aurora-curtains\n',
    );
  });

  it('preserves bespoke scenes and excluded presets on the first attempt and retry', () => {
    const listed = suggestReadyScenes('aurora mural', 'en');
    for (const request of [
      'Do not use aurora-curtains; draw a waterfall mural',
      "Don't use aurora-curtains",
      'A scene without aurora-curtains',
      'A bespoke mural like aurora-curtains drawn from scratch',
      'لا تستخدم aurora-curtains، بدي جدارية مخصصة',
      'ما بدي aurora-curtains',
      'جدارية بدون aurora-curtains',
      'A mural without ready presets',
      'لا تستخدم قوالب جاهزة',
    ]) {
      for (const attempt of [1, 2] as const) {
        expect(readySceneLines(listed, attempt, request), request).toEqual([]);
        expect(
          withReadyScenes(
            'original',
            {
              options: { request },
              plan: { locale: { lang: 'en', dir: 'ltr' } },
              skillIds: ['craftkit.pixi-murals'],
              contract: {
                key: 'hero',
                role: 'hero',
                title: 'Scene',
                anchorId: 'hero',
                purpose: 'A mural',
                mustSay: [],
                mustNotRepeat: [],
              },
            },
            attempt,
          ),
        ).toBe('original');
      }
    }
  });

  it('keeps initialization when ordinary layout constraints do not exclude the scene', () => {
    const listed = suggestReadyScenes('aurora mural', 'en');
    for (const request of [
      'Use aurora-curtains; avoid text clipping and clutter',
      'A mural without horizontal overflow, using aurora-curtains',
      'استخدم aurora-curtains، تجنب قص النص',
      'Avoid text clipping when using aurora-curtains',
      'A mural without horizontal overflow using aurora-curtains',
      'تجنب قص النص في aurora-curtains',
    ]) {
      expect(readySceneLines(listed, 1, request).join('\n'), request).toContain(
        'SCENE INITIALIZATION v1: aurora-curtains\n',
      );
    }
  });

  it('puts a named ready scene’s tested code in, and shows a repair round the name again', () => {
    const named = jsPlan(' @preset:aurora-curtains ');
    const expanded = expandReadyScenes(named);
    expect(jsOf(expanded)).toBe(scenePreset('aurora-curtains')?.code);
    expect(expanded.commands[0]).toBe(named.commands[0]);
    expect(jsOf(markReadyScenes(expanded))).toBe('@preset:aurora-curtains');
  });

  it('leaves everything else as it was written: own code, unknown names, kits', () => {
    for (const value of ['const s=await ck.scene({});', '@preset:no-such-scene', '@preset:snake']) {
      const plan = jsPlan(value);
      expect(expandReadyScenes(plan)).toBe(plan);
      expect(markReadyScenes(plan)).toBe(plan);
    }
  });

  it('places scenes the scene check already passes, so a ready scene never costs a repair round', () => {
    // The writer sizes its region, as its brief says; the code is the preset's.
    const css = '.ck-scene{position:relative;aspect-ratio:16/9;min-height:320px}';
    for (const preset of readyScenes()) {
      expect(checkScene({ tree: null, css, js: preset.code }), preset.id).toEqual([]);
    }
  });

  it('tells a first attempt at a picture no preset matches to compose it with the mural kit', () => {
    const scene = (purpose: string) => ({
      options: { request: purpose },
      plan: { locale: { lang: 'en', dir: 'ltr' as const } },
      skillIds: ['craftkit.pixi-murals'],
      contract: {
        key: 'hero',
        role: 'hero' as const,
        title: 'Reef',
        anchorId: 'hero',
        purpose,
        mustSay: [],
        mustNotRepeat: [],
      },
    });
    const reef = scene('A mural of a coral reef with a diver and fish');
    const first = withReadyScenes('brief', reef, 1);
    expect(first).toContain(MURAL_KIT_WRITER_LINE);
    expect(first).not.toContain('READY SCENES');
    // A retry keeps the tested ready scenes as its safety net; a named preset stays a preset.
    expect(withReadyScenes('brief', reef, 2)).not.toContain(MURAL_KIT_WRITER_LINE);
    const named = scene('A mural using aurora-curtains');
    expect(withReadyScenes('brief', named, 1)).not.toContain(MURAL_KIT_WRITER_LINE);
  });

  it('gives an edit for an unmatched mural the kit line instead of unrelated ready scenes', () => {
    const fragment = createReadyScenesContextProvider(
      'Add a mural of a coral reef with a diver and fish',
      'en',
    ).collect({} as never, []);
    expect(JSON.stringify(fragment)).toContain(MURAL_KIT_EDIT_LINE.slice(0, 40));
  });
});
