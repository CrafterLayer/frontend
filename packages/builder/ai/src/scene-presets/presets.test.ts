import { describe, expect, it } from 'vitest';

import {
  customCodeJsParamsSchema,
  declaredLibs,
  readParamsLiteral,
  scanLibKeys,
  scriptCodeIssues,
  scriptEntrySchema,
  STUDIO_CODE_MAX,
  STUDIO_ID_PATTERN,
  validateParamValues,
} from '@craftkit/builder-schema';

import { CUSTOM_CODE_JS_MAX_LENGTH } from '../plan/validate-plan';
import {
  SCENE_PRESET_CATEGORIES,
  SCENE_PRESETS,
  scenePreset,
  scenePresetsIn,
  type ScenePreset,
} from './catalog';
import { PRESETS_SET_A } from './set-a';
import { PRESETS_SET_B } from './set-b';
import { KITS_SET_C } from './set-c';
import { PRESETS_SET_D } from './set-d';
import { PRESETS_SET_E } from './set-e';
import { PRESETS_SET_F } from './set-f';

/*
  The builtin scene presets as the door sees them: each one is placed as a customCode region's
  `js` exactly as written here, so every check below is one the plan door or the Studio library
  would otherwise make at run time.
*/

const CASES = SCENE_PRESETS.map((preset): [string, ScenePreset] => [preset.id, preset]);

/** Every `s.lib.<key>` (or `scene.lib['key']`) the code reads, de-duplicated and sorted. */
function libsReadInCode(code: string): string[] {
  const keys = new Set<string>();
  for (const match of code.matchAll(/\.\s*lib\s*(?:\.\s*(\w+)|\[\s*(['"`])(\w+)\2\s*\])/gu)) {
    keys.add(match[1] ?? match[3] ?? '');
  }
  return [...keys].sort();
}

describe('scene preset catalogue', () => {
  it('lists every set-A, B, D, E and F preset and every set-C kit once, with unique library ids', () => {
    expect(SCENE_PRESETS).toHaveLength(
      PRESETS_SET_A.length +
        PRESETS_SET_B.length +
        PRESETS_SET_D.length +
        PRESETS_SET_E.length +
        PRESETS_SET_F.length +
        KITS_SET_C.length,
    );
    expect(PRESETS_SET_A.length + PRESETS_SET_B.length).toBe(30);
    expect(PRESETS_SET_D).toHaveLength(6);
    expect(PRESETS_SET_E).toHaveLength(4);
    expect(PRESETS_SET_F).toHaveLength(4);
    const ids = SCENE_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(STUDIO_ID_PATTERN);
      expect(scenePreset(id)?.id).toBe(id);
    }
    expect(scenePreset('no-such-preset')).toBeUndefined();
  });

  it('is frozen all the way down', () => {
    expect(Object.isFrozen(SCENE_PRESETS)).toBe(true);
    for (const preset of SCENE_PRESETS) {
      expect(Object.isFrozen(preset)).toBe(true);
      expect(Object.isFrozen(preset.libs)).toBe(true);
      expect(Object.isFrozen(preset.params)).toBe(true);
      expect(Object.isFrozen(preset.defaults)).toBe(true);
      expect(Object.isFrozen(preset.entry)).toBe(true);
    }
  });

  it('puts every preset in a category, and every category holds a preset', () => {
    for (const category of SCENE_PRESET_CATEGORIES) {
      expect(scenePresetsIn(category).length).toBeGreaterThan(0);
    }
    const counted = SCENE_PRESET_CATEGORIES.reduce(
      (sum, category) => sum + scenePresetsIn(category).length,
      0,
    );
    expect(counted).toBe(SCENE_PRESETS.length);
  });
});

describe.each(CASES)('scene preset %s', (_id, preset) => {
  it('has a title and description in English and Arabic', () => {
    for (const label of [preset.title, preset.description]) {
      expect(label.en.trim()).not.toBe('');
      expect(label.ar.trim()).not.toBe('');
      expect(label.ar).toMatch(/[؀-ۿ]/u);
    }
  });

  it('is a valid builtin library entry (shape, params, libs and sound agree)', () => {
    const parsed = scriptEntrySchema.safeParse(preset.entry);
    expect(parsed.success ? [] : parsed.error.issues.map((issue) => issue.message)).toEqual([]);
    expect(preset.entry).toMatchObject({ author: 'craftkit', trust: 'trusted', licence: 'MIT' });
  });

  it('passes the region-script lint with no issue at all', () => {
    const issues = scriptCodeIssues(preset.code, { switchOn: true });
    expect(issues.map((issue) => `${issue.code}: ${issue.message.en}`)).toEqual([]);
  });

  it('never splits text into letters (Arabic stays joined)', () => {
    // The lint looks for per-letter splitting only when the code holds Arabic; a preset that
    // draws a person's own words must keep them whole whatever language they arrive in.
    const issues = scriptCodeIssues(`${preset.code}\n// نص عربي`, { switchOn: true });
    expect(issues.filter((issue) => issue.code === 'arabic-split')).toEqual([]);
  });

  it('declares exactly the libraries its code loads and reads', () => {
    const loaded = declaredLibs(preset.code);
    expect(loaded.scene).toBe(true);
    expect([...preset.libs].sort()).toEqual([...loaded.libs].sort());
    expect(preset.libs).toContain('kit');
    const extra = preset.libs.filter((key) => key !== 'kit');
    // `ck.scene({ libs: [...] })` names each library literally (the export reads the code) …
    expect(scanLibKeys(preset.code)).toEqual({
      known: loaded.libs.filter((key) => key !== 'kit'),
      unknown: [],
      dynamic: false,
    });
    // … and the code reads each of them as `s.lib.<key>`, and nothing else — except 'viewport',
    // which the kit reads itself when the design zooms (s.world is then the Viewport).
    const zooms = /design:\{[^}]*\bzoom:true\b/u.test(preset.code);
    expect(libsReadInCode(preset.code)).toEqual(
      extra.filter((key) => !(zooms && key === 'viewport')).sort(),
    );
    expect(preset.sound).toBe(loaded.sound);
  });

  /*
    Mural scale (2026-10-14): a mural or pattern laid out from s.width/s.height in CSS pixels
    showed its desktop details zoomed ~3× on a 390 px phone and zoomed out on a 1920 px screen.
    Each one now composes once at a fixed 1280 × 720 design in s.world, a pixi-viewport camera
    the kit fits to the region on every resize — the same picture in the editor at any zoom,
    in Preview on every device and on the published page.
  */
  it.runIf(preset.category === 'mural' || preset.category === 'pattern')(
    'composes at a fixed design in a viewport camera, never in region pixels',
    () => {
      expect(preset.code).toMatch(
        /ck\.scene\(\{[^)]*design:\{width:1280,height:720,fit:'(?:cover|contain)',zoom:true\}/u,
      );
      expect(preset.libs).toContain('viewport');
      expect(preset.code).not.toMatch(/\bs\.(?:width|height|onResize|stage)\b/u);
    },
  );

  it('fits the customCode js limit', () => {
    expect(CUSTOM_CODE_JS_MAX_LENGTH).toBe(STUDIO_CODE_MAX);
    expect(preset.code.length).toBeGreaterThan(200);
    expect(preset.code.length).toBeLessThanOrEqual(CUSTOM_CODE_JS_MAX_LENGTH);
  });

  /*
    Three faults the browser run found that compile and lint clean, then fail on the GPU or on the
    first update without a word at the door — held here statically so they cannot come back.
  */
  it('gives the bundled particle emitter a ParticleContainer parent', () => {
    for (const match of preset.code.matchAll(/new\s+[\w$.]*\bEmitter\(\s*([\w$]+)\s*,/gu)) {
      const parent = match[1] ?? '';
      expect(preset.code).toMatch(
        new RegExp(`\\b${parent}\\s*=\\s*new\\s+[\\w$]+\\.ParticleContainer\\(`, 'u'),
      );
    }
  });

  it('declares the filter uniforms it shares with the vertex stage as highp', () => {
    // The fragment defaults to mediump; a mismatch with the vertex stage fails the program link.
    expect(preset.code).not.toMatch(
      /uniform\s+(?!highp\s)(?:\w+\s+)?vec4\s+u(?:InputSize|OutputFrame|OutputTexture)\b/u,
    );
  });

  it('never redefines what `#include noise` already brings', () => {
    if (!preset.code.includes('#include noise')) return;
    expect(preset.code).not.toMatch(/\b(?:float|vec[234])\s+(?:fbm|snoise|mod289|permute)\s*\(/u);
  });

  it('states the same defaults in its param spec and in its own ck.params({...})', () => {
    expect(Object.fromEntries(readParamsLiteral(preset.code))).toEqual(preset.defaults);
    expect(Object.keys(preset.defaults)).toEqual(preset.params.map((spec) => spec.key));
    expect(customCodeJsParamsSchema.safeParse(preset.defaults).success).toBe(true);
    expect(validateParamValues(preset.params, preset.defaults).issues).toEqual([]);
  });
});
