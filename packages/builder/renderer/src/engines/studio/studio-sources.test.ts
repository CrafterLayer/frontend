import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { BRUSH_BANNER, BRUSH_SHA256, BRUSH_SOURCE } from './brush-source';
import { EMITTER_BANNER, EMITTER_SHA256, EMITTER_SOURCE } from './emitter-source';
import { FILTERS_BANNER, FILTERS_SHA256, FILTERS_SOURCE } from './filters-source';
import { KIT_BANNER, KIT_SHA256, KIT_SOURCE } from './kit-source';
import { PHYSICS_BANNER, PHYSICS_SHA256, PHYSICS_SOURCE } from './physics-source';
import { ROUGH_BANNER, ROUGH_SHA256, ROUGH_SOURCE } from './rough-source';
import { SOUND_BANNER, SOUND_SHA256, SOUND_SOURCE } from './sound-source';
import { VIEWPORT_BANNER, VIEWPORT_SHA256, VIEWPORT_SOURCE } from './viewport-source';

const ASSETS = [
  ['kit', KIT_SOURCE, KIT_BANNER, KIT_SHA256, 16_000],
  ['filters', FILTERS_SOURCE, FILTERS_BANNER, FILTERS_SHA256, 30_000],
  ['emitter', EMITTER_SOURCE, EMITTER_BANNER, EMITTER_SHA256, 14_000],
  ['physics', PHYSICS_SOURCE, PHYSICS_BANNER, PHYSICS_SHA256, 30_000],
  ['brush', BRUSH_SOURCE, BRUSH_BANNER, BRUSH_SHA256, 4_000],
  ['rough', ROUGH_SOURCE, ROUGH_BANNER, ROUGH_SHA256, 11_000],
  ['viewport', VIEWPORT_SOURCE, VIEWPORT_BANNER, VIEWPORT_SHA256, 13_000],
  ['sound', SOUND_SOURCE, SOUND_BANNER, SOUND_SHA256, 10_000],
] as const;

describe('generated Studio engine assets', () => {
  it.each(ASSETS)(
    '%s carries a valid notice, hash and single-file IIFE',
    (_key, source, banner, sha, budget) => {
      expect(banner.startsWith('/*!')).toBe(true);
      expect(banner).toContain('Permission is hereby granted');
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
