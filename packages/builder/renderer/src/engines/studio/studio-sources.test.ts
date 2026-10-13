import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { ANIM_BANNER, ANIM_SHA256, ANIM_SOURCE } from './anim-source';
import { AUDIO_BANNER, AUDIO_SHA256, AUDIO_SOURCE } from './audio-source';
import { BRUSH_BANNER, BRUSH_SHA256, BRUSH_SOURCE } from './brush-source';
import { DIALOGUE_BANNER, DIALOGUE_SHA256, DIALOGUE_SOURCE } from './dialogue-source';
import { EMITTER_BANNER, EMITTER_SHA256, EMITTER_SOURCE } from './emitter-source';
import { FILTERS_BANNER, FILTERS_SHA256, FILTERS_SOURCE } from './filters-source';
import { FX_BANNER, FX_SHA256, FX_SOURCE } from './fx-source';
import { GAMEAI_BANNER, GAMEAI_SHA256, GAMEAI_SOURCE } from './gameai-source';
import { GIF_BANNER, GIF_SHA256, GIF_SOURCE } from './gif-source';
import { HUD_BANNER, HUD_SHA256, HUD_SOURCE } from './hud-source';
import { INK_BANNER, INK_SHA256, INK_SOURCE } from './ink-source';
import { KIT_BANNER, KIT_SHA256, KIT_SOURCE } from './kit-source';
import { PEEPS_BANNER, PEEPS_SHA256, PEEPS_SOURCE } from './peeps-source';
import { PHYSICS_BANNER, PHYSICS_SHA256, PHYSICS_SOURCE } from './physics-source';
import { PROCGEN_BANNER, PROCGEN_SHA256, PROCGEN_SOURCE } from './procgen-source';
import { ROUGH_BANNER, ROUGH_SHA256, ROUGH_SOURCE } from './rough-source';
import { SOUND_BANNER, SOUND_SHA256, SOUND_SOURCE } from './sound-source';
import { TILEMAP_BANNER, TILEMAP_SHA256, TILEMAP_SOURCE } from './tilemap-source';
import { VIEWPORT_BANNER, VIEWPORT_SHA256, VIEWPORT_SOURCE } from './viewport-source';

// Budgets (performance pass, 2026-10-12): measured gzip + 5 %, rounded up to 100 bytes, never raised;
// the same numbers as scripts/studio-engine-targets.mjs.
const ASSETS = [
  ['kit', KIT_SOURCE, KIT_BANNER, KIT_SHA256, 15_800],
  ['filters', FILTERS_SOURCE, FILTERS_BANNER, FILTERS_SHA256, 24_900],
  // particles and physics (2026-10-13): emitter 12,000 → 17,400 for its 13 presets, atlas and
  // lifecycle (measured 16,545, + 5 %); physics keeps 29,500 with world(s) (measured 29,424).
  ['emitter', EMITTER_SOURCE, EMITTER_BANNER, EMITTER_SHA256, 17_400],
  ['physics', PHYSICS_SOURCE, PHYSICS_BANNER, PHYSICS_SHA256, 29_500],
  ['brush', BRUSH_SOURCE, BRUSH_BANNER, BRUSH_SHA256, 3_500],
  ['rough', ROUGH_SOURCE, ROUGH_BANNER, ROUGH_SHA256, 11_000],
  ['viewport', VIEWPORT_SOURCE, VIEWPORT_BANNER, VIEWPORT_SHA256, 13_000],
  ['anim', ANIM_SOURCE, ANIM_BANNER, ANIM_SHA256, 6_500],
  ['fx', FX_SOURCE, FX_BANNER, FX_SHA256, 5_400],
  ['dialogue', DIALOGUE_SOURCE, DIALOGUE_BANNER, DIALOGUE_SHA256, 9_700],
  ['ink', INK_SOURCE, INK_BANNER, INK_SHA256, 66_000],
  ['tilemap', TILEMAP_SOURCE, TILEMAP_BANNER, TILEMAP_SHA256, 11_400],
  // game libraries (2026-10-12): measured 16.0 / 20.7 / 25.1 kB gzip.
  ['audio', AUDIO_SOURCE, AUDIO_BANNER, AUDIO_SHA256, 16_900],
  ['gameai', GAMEAI_SOURCE, GAMEAI_BANNER, GAMEAI_SHA256, 21_800],
  ['hud', HUD_SOURCE, HUD_BANNER, HUD_SHA256, 26_500],
  // character art (2026-10-13): measured 111.3 kB gzip, nearly all Open Peeps path data.
  ['peeps', PEEPS_SOURCE, PEEPS_BANNER, PEEPS_SHA256, 116_900],
  // procedural maps and animated GIFs (2026-10-13): measured 11,745 and 7,480 bytes gzip.
  ['procgen', PROCGEN_SOURCE, PROCGEN_BANNER, PROCGEN_SHA256, 12_400],
  ['gif', GIF_SOURCE, GIF_BANNER, GIF_SHA256, 7_900],
  ['sound', SOUND_SOURCE, SOUND_BANNER, SOUND_SHA256, 10_000],
] as const;

describe('generated Studio engine assets', () => {
  it.each(ASSETS)(
    '%s carries a valid notice, hash and single-file IIFE',
    (_key, source, banner, sha, budget) => {
      expect(banner.startsWith('/*!')).toBe(true);
      // Third-party bundles carry their licences (MIT/ISC permission or BSD redistribution
      // terms); first-party creative libraries say they have none.
      expect(
        banner.includes('Permission is hereby granted') ||
          banner.includes('Redistribution and use in source and binary forms') ||
          banner.includes('first-party source'),
      ).toBe(true);
      expect(source.startsWith(banner)).toBe(true);
      expect(source).not.toMatch(/\bimport\s*\(/u);
      expect(createHash('sha256').update(source.slice(banner.length), 'utf8').digest('hex')).toBe(
        sha,
      );
      expect(() => new Script(source)).not.toThrow();
      expect(gzipSync(source, { level: 9 }).length).toBeLessThanOrEqual(budget);
    },
  );

  it('carries the Open Peeps design licence (CC0 1.0) beside DiceBear’s MIT code licence', () => {
    expect(PEEPS_BANNER).toContain('Source: Open Peeps (https://www.openpeeps.com/)');
    expect(PEEPS_BANNER).toContain(
      'License: CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/)',
    );
    expect(PEEPS_BANNER).toContain('Copyright (c) 2024 Florian Körner');
    expect(PEEPS_SOURCE).not.toMatch(/https?:\/\/api\.dicebear\.com/u);
  });

  it('carries rot.js’s BSD-3-Clause terms and gifuct-js’s MIT notice, and never evaluates code', () => {
    expect(PROCGEN_BANNER).toContain('Copyright (c) 2012-now(), Ondrej Zara');
    expect(PROCGEN_BANNER).toContain('Neither the name of Ondrej Zara');
    expect(GIF_BANNER).toContain('Copyright (c) 2015 Matt Way');
    expect(GIF_BANNER).toContain('Permission is hereby granted');
    for (const source of [PROCGEN_SOURCE, GIF_SOURCE]) {
      expect(source).not.toMatch(/\beval\(|new Function\b|WebAssembly/u);
    }
    // Plain libraries: neither binds to nor bundles a second Pixi.
    expect(PROCGEN_SOURCE).toContain('pixi:false');
    expect(GIF_SOURCE).toContain('pixi:false');
    expect(GIF_SOURCE).not.toMatch(/Ticker\.shared|autoDetectRenderer/u);
  });
});
