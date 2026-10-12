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
import { HUD_BANNER, HUD_SHA256, HUD_SOURCE } from './hud-source';
import { INK_BANNER, INK_SHA256, INK_SOURCE } from './ink-source';
import { KIT_BANNER, KIT_SHA256, KIT_SOURCE } from './kit-source';
import { PHYSICS_BANNER, PHYSICS_SHA256, PHYSICS_SOURCE } from './physics-source';
import { ROUGH_BANNER, ROUGH_SHA256, ROUGH_SOURCE } from './rough-source';
import { SOUND_BANNER, SOUND_SHA256, SOUND_SOURCE } from './sound-source';
import { TILEMAP_BANNER, TILEMAP_SHA256, TILEMAP_SOURCE } from './tilemap-source';
import { VIEWPORT_BANNER, VIEWPORT_SHA256, VIEWPORT_SOURCE } from './viewport-source';

const ASSETS = [
  ['kit', KIT_SOURCE, KIT_BANNER, KIT_SHA256, 16_000],
  ['filters', FILTERS_SOURCE, FILTERS_BANNER, FILTERS_SHA256, 30_000],
  ['emitter', EMITTER_SOURCE, EMITTER_BANNER, EMITTER_SHA256, 14_000],
  ['physics', PHYSICS_SOURCE, PHYSICS_BANNER, PHYSICS_SHA256, 30_000],
  ['brush', BRUSH_SOURCE, BRUSH_BANNER, BRUSH_SHA256, 4_000],
  ['rough', ROUGH_SOURCE, ROUGH_BANNER, ROUGH_SHA256, 11_000],
  ['viewport', VIEWPORT_SOURCE, VIEWPORT_BANNER, VIEWPORT_SHA256, 13_000],
  ['anim', ANIM_SOURCE, ANIM_BANNER, ANIM_SHA256, 9_000],
  ['fx', FX_SOURCE, FX_BANNER, FX_SHA256, 9_000],
  ['dialogue', DIALOGUE_SOURCE, DIALOGUE_BANNER, DIALOGUE_SHA256, 12_000],
  ['ink', INK_SOURCE, INK_BANNER, INK_SHA256, 66_000],
  ['tilemap', TILEMAP_SOURCE, TILEMAP_BANNER, TILEMAP_SHA256, 14_000],
  // game libraries (2026-10-12): measured 16.0 / 20.6 / 25.1 kB gzip.
  ['audio', AUDIO_SOURCE, AUDIO_BANNER, AUDIO_SHA256, 18_000],
  ['gameai', GAMEAI_SOURCE, GAMEAI_BANNER, GAMEAI_SHA256, 22_000],
  ['hud', HUD_SOURCE, HUD_BANNER, HUD_SHA256, 27_000],
  ['sound', SOUND_SOURCE, SOUND_BANNER, SOUND_SHA256, 10_000],
] as const;

describe('generated Studio engine assets', () => {
  it.each(ASSETS)(
    '%s carries a valid notice, hash and single-file IIFE',
    (_key, source, banner, sha, budget) => {
      expect(banner.startsWith('/*!')).toBe(true);
      // Third-party bundles carry their licences; first-party creative libraries say they have none.
      expect(
        banner.includes('Permission is hereby granted') || banner.includes('first-party source'),
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
});
