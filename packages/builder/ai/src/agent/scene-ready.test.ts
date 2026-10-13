import { describe, expect, it } from 'vitest';

import { scenePreset } from '../scene-presets/catalog';
import type { AiPlan } from '../types';
import { checkScene } from './page-plan/check-scene';
import {
  READY_SCENES_LISTED,
  expandReadyScenes,
  markReadyScenes,
  readyScenes,
  readySceneLines,
  suggestReadyScenes,
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
    const retry = readySceneLines(listed, 2).join('\n');
    expect(retry).toContain('The first attempt at this section failed');
    expect(retry).toContain('no scene code of your own');
    expect(readySceneLines([], 1)).toEqual([]);
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
});
