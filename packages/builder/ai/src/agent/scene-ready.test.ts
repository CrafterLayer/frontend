import { describe, expect, it } from 'vitest';

import { MURAL_KIT_EDIT_LINE, MURAL_KIT_WRITER_LINE } from '../creative/mural-kit';
import { scenePreset } from '../scene-presets/catalog';
import { createCraftkitAiSkillRegistry } from '../skills/index';
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

  // 2026-11-01: no fixed four for every brief that names nothing — the same few every time made
  // every such mural one of the same pictures. The backdrops rotate by the brief, deterministically.
  it('gives a brief that names nothing a few broad backdrops chosen by that brief, Arabic patterns first on an Arabic page', () => {
    const ids = (brief: string, lang = 'en') => suggestReadyScenes(brief, lang).map(({ id }) => id);
    const first = ids('The section of the page');
    expect(first).toHaveLength(READY_SCENES_LISTED);
    expect(ids('The section of the page')).toEqual(first);
    const briefs = ['The section of the page', 'A quiet band', 'Lorem ipsum', 'Something else'];
    expect(new Set(briefs.map((brief) => ids(brief).join(' '))).size).toBeGreaterThan(1);
    for (const brief of briefs) {
      for (const id of ids(brief)) {
        expect(['mural', 'pattern'], `${brief}: ${id}`).toContain(scenePreset(id)?.category);
      }
    }
    // Wider than the old four: across briefs, more of the catalogue is offered.
    const offered = new Set(
      Array.from({ length: 24 }, (_, index) => ids(`Section number ${String(index)}`)).flat(),
    );
    expect(offered.size).toBeGreaterThan(8);
    expect(scenePreset(ids('قسم في الصفحة', 'ar')[0] ?? '')?.tags).toContain('arabic');
  });

  it('tells the first writer how to place one, and offers a retry one without forcing it', () => {
    const listed = suggestReadyScenes('aurora mural', 'en');
    const first = readySceneLines(listed, 1).join('\n');
    expect(first).toContain('READY SCENES');
    expect(first).toContain('"@preset:<id>"');
    expect(first).toContain('under 9,000 characters');
    expect(first).toContain('ONE setProp step');
    expect(first).toContain('responsive tree and css');
    expect(isSceneInitializationRequest(first)).toBe(false);
    // 2026-11-01: a retry is offered the ready scenes, never forced into one.
    const retry = readySceneLines(listed, 2).join('\n');
    expect(retry).toContain('The first attempt at this section failed');
    expect(retry).toContain('READY SCENES');
    expect(retry).not.toContain('no scene code of your own');
    expect(isSceneInitializationRequest(retry)).toBe(false);
    expect(readySceneLines([], 1)).toEqual([]);
  });

  it('presents ready scenes as one option, never as faster than the writer’s own scene', () => {
    const listed = suggestReadyScenes('aurora mural', 'en');
    for (const attempt of [1, 2] as const) {
      const lines = readySceneLines(listed, attempt).join('\n');
      expect(lines).not.toMatch(/in seconds|takes minutes/u);
    }
    const edit = JSON.stringify(
      createReadyScenesContextProvider('An abstract aurora mural', 'en').collect({} as never, []),
    );
    expect(edit).not.toMatch(/in seconds|takes minutes/u);
  });

  it('sizes the region by its width in the shape the piece wants, never vh and never one fixed band', () => {
    const lines = readySceneLines(suggestReadyScenes('aurora mural', 'en'), 1).join('\n');
    expect(lines).toContain('never vh');
    for (const shape of ['21/9', '4/5', '1/1']) expect(lines).toContain(shape);
  });

  it('does not force a later scene to use a preset the request named for the lead scene, now that it reads the request', () => {
    const skillRegistry = createCraftkitAiSkillRegistry();
    const later = {
      options: {
        request: 'A calm aurora-curtains hero, then a mural band of a waterfall with a bridge',
        skillRegistry,
      },
      plan: { locale: { lang: 'en', dir: 'ltr' as const } },
      skillIds: ['craftkit.pixi-murals'],
      contract: {
        key: 'waterfall',
        role: 'band' as const,
        title: 'Waterfall',
        anchorId: 'waterfall',
        purpose: 'A mural of a waterfall with an illustrated bridge',
        mustSay: [],
        mustNotRepeat: [],
      },
    };
    for (const attempt of [1, 2] as const) {
      expect(isSceneInitializationRequest(withReadyScenes('brief', later, attempt))).toBe(false);
    }
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

  it('preserves an unmatched picture subject through its first attempt and retry', () => {
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
    for (const request of [
      'A mural of a coral reef with a diver and fish',
      'جدارية عن شعاب مرجانية فيها أسماك وأخطبوط',
    ]) {
      for (const attempt of [1, 2] as const) {
        const prepared = withReadyScenes('brief', scene(request), attempt);
        expect(prepared, request).toContain(MURAL_KIT_WRITER_LINE);
        expect(prepared, request).not.toContain('READY SCENES');
        expect(isSceneInitializationRequest(prepared), request).toBe(false);
      }
    }
    // A deliberately named preset keeps its identity, including on retry.
    const named = scene('A mural using aurora-curtains with a coral reef below');
    for (const attempt of [1, 2] as const) {
      const prepared = withReadyScenes('brief', named, attempt);
      expect(prepared).not.toContain(MURAL_KIT_WRITER_LINE);
      expect(prepared).toContain('SCENE INITIALIZATION v1: aurora-curtains\n');
    }
  });

  it('gives an edit for an unmatched mural the kit line instead of unrelated ready scenes', () => {
    const fragment = createReadyScenesContextProvider(
      'Add a mural of a coral reef with a diver and fish',
      'en',
    ).collect({} as never, []);
    expect(JSON.stringify(fragment)).toContain(MURAL_KIT_EDIT_LINE.slice(0, 40));
  });
});
