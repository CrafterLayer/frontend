import { describe, expect, it } from 'vitest';

import { estimateCanonicalJsonTokens } from '../../internal/canonical-json';
import { scenePresetMenu } from '../../tools/agent/builtin/scene-preset';
import { PLAYBOOK_PRESET_IDS, SCENE_PRESET_CATEGORIES, scenePreset } from '../catalog';
import { PRESETS_SET_E } from './index';

/*
  Set E (mural libraries 2, 2026-10-13): the static promises each library mural makes beyond the
  catalogue checks in presets.test.ts — it leans on s.lib.lsys / s.lib.color / s.lib.geom 1.2,
  draws in design units, takes every colour from s.palette (moved only by s.lib.color), mirrors
  with s.dir, holds a still frame under reduced motion — and the reason it exists: applying it is
  one short call, writing it would be a page of code.
*/

const CASES = PRESETS_SET_E.map(([entry, category]): [string, typeof entry, string] => [
  entry.id,
  entry,
  category,
]);

describe('set E', () => {
  it('lists four library murals: an L-system garden and scroll, OKLCH waves and arc rings', () => {
    expect(PRESETS_SET_E.map(([entry, category]) => `${category}:${entry.id}`)).toEqual([
      'mural:botanical-garden',
      'mural:gradient-waves',
      'mural:arc-rings',
      'pattern:arabesque-scroll',
    ]);
    const libs = new Set(PRESETS_SET_E.flatMap(([entry]) => entry.libs));
    for (const key of ['lsys', 'color', 'geom'] as const) expect(libs.has(key)).toBe(true);
  });
});

describe.each(CASES)('library mural %s', (id, entry, category) => {
  it('is catalogued in its category and taught by the mural playbook, not the cached menu', () => {
    expect(scenePreset(id)?.category).toBe(category);
    expect(PLAYBOOK_PRESET_IDS.has(id)).toBe(true);
    expect(scenePresetMenu()).not.toContain(id);
    expect(scenePresetMenu(SCENE_PRESET_CATEGORIES)).toContain(id);
  });

  it('leans on the new libraries and draws in 1280 × 720 design units on s.world', () => {
    expect(entry.libs).toContain('color');
    expect(entry.libs.some((key) => key === 'lsys' || key === 'geom')).toBe(true);
    expect(entry.code).toMatch(/design:\{width:1280,height:720,fit:'(?:cover|contain)'\}/u);
    expect(entry.code).toContain('s.world.addChild(');
    expect(entry.code).not.toMatch(/s\.onResize|window\.|document\.|Math\.random/u);
  });

  it('takes every colour from the page palette, mirrors with s.dir and stills under reduced motion', () => {
    // No literal colours: hex numbers, #rrggbb strings, CSS colour words or colour functions.
    expect(entry.code).not.toMatch(
      /0x[0-9a-f]{3,8}\b|['"]#[0-9a-f]{3,8}['"]|\b(?:white|black)\b|['"](?:rgb|hsl|oklch)\(/iu,
    );
    expect(entry.code).toContain('C=s.palette');
    expect(entry.code).toContain('Co=s.lib.color');
    expect(entry.code).toContain('s.dir');
    expect(entry.code).toMatch(/s\.reducedMotion\?0:/u);
    expect(entry.reducedMotion).toBe('still');
  });

  it('applies in one short call instead of a page of code (4 characters per token)', () => {
    const apply = estimateCanonicalJsonTokens({ preset: id });
    const write = estimateCanonicalJsonTokens({ js: entry.code });
    expect(apply).toBeLessThanOrEqual(12);
    expect(write).toBeGreaterThan(apply * 40);
  });
});

describe('the L-system murals', () => {
  it('grow from the scene seed and mirror with s.dir, drawing an upTo view each frame', () => {
    for (const id of ['botanical-garden', 'arabesque-scroll']) {
      const code = scenePreset(id)?.code ?? '';
      expect(code).toMatch(
        /L\.grow\(s,\{preset:'(?:tree|fern|bush|arabesque)'|L\.grow\(s,\{preset:kind/u,
      );
      expect(code).toContain('L.fit(');
      expect(code).toContain('L.upTo(');
      expect(code).toContain('L.draw(');
      // Fully grown at once under reduced motion and in the editor.
      expect(code).toContain('s.reducedMotion||s.editor?1:');
    }
    expect(scenePreset('botanical-garden')?.code).toContain('dir:s.dir');
  });

  it('ramp and shade in OKLCH from the palette, and lay arcs out from pie spans', () => {
    for (const [entry] of PRESETS_SET_E) expect(entry.code).toMatch(/Co\.(?:ramp|shades)\(/u);
    const rings = scenePreset('arc-rings')?.code ?? '';
    expect(rings).toContain('G.pie(');
    expect(rings).toContain('dir:s.dir');
    expect(rings).toContain('G.arc({cx:0,cy:0,inner,outer,start:span.start,end:span.end');
    expect(scenePreset('gradient-waves')?.code).toContain('G.spline(pts,{curve:p.curve');
  });
});
