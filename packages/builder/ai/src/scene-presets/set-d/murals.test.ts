import { describe, expect, it } from 'vitest';

import { estimateCanonicalJsonTokens } from '../../internal/canonical-json';
import { scenePresetMenu } from '../../tools/agent/builtin/scene-preset';
import { PLAYBOOK_PRESET_IDS, SCENE_PRESET_CATEGORIES, scenePreset } from '../catalog';
import { PRESETS_SET_D } from './index';

/*
  Set D (mural libraries, 2026-10-13): the static promises each library mural makes beyond the
  catalogue checks in presets.test.ts — it leans on the new libraries, draws in design units, takes
  every colour from s.palette, mirrors with s.dir, holds a still frame under reduced motion — and
  the reason it exists: applying it is one short call, writing it would be a page of code.
*/

const CASES = PRESETS_SET_D.map(([entry, category]): [string, typeof entry, string] => [
  entry.id,
  entry,
  category,
]);

describe.each(CASES)('library mural %s', (id, entry, category) => {
  it('is catalogued in its category and taught by the mural playbook, not the cached menu', () => {
    expect(scenePreset(id)?.category).toBe(category);
    expect(PLAYBOOK_PRESET_IDS.has(id)).toBe(true);
    expect(scenePresetMenu()).not.toContain(id);
    expect(scenePresetMenu(SCENE_PRESET_CATEGORIES)).toContain(id);
  });

  it('leans on the mural libraries and draws in 1280 × 720 design units on s.world', () => {
    expect(entry.libs.some((key) => key === 'noise' || key === 'geom' || key === 'hex')).toBe(true);
    expect(entry.code).toMatch(
      /design:\{width:1280,height:720,fit:'(?:cover|contain)',zoom:true\}/u,
    );
    expect(entry.code).toContain('s.world.addChild(');
    expect(entry.code).not.toMatch(/s\.onResize|window\.|document\./u);
  });

  it('takes every colour from the page palette, mirrors with s.dir and stills under reduced motion', () => {
    // No literal colours: hex numbers, #rrggbb strings or CSS colour words.
    expect(entry.code).not.toMatch(
      /0x[0-9a-f]{3,8}\b|['"]#[0-9a-f]{3,8}['"]|\b(?:white|black)\b/iu,
    );
    expect(entry.code).toContain('C=s.palette');
    expect(entry.code).toContain('s.dir');
    expect(entry.code).toMatch(/s\.reducedMotion\?0(?:\.15)?:/u);
    expect(entry.reducedMotion).toBe('still');
  });

  it('applies in one short call instead of a page of code (4 characters per token)', () => {
    const apply = estimateCanonicalJsonTokens({ preset: id });
    const write = estimateCanonicalJsonTokens({ js: entry.code });
    expect(apply).toBeLessThanOrEqual(12);
    expect(write).toBeGreaterThan(apply * 30);
  });
});
