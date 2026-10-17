/*
  @vitest-environment node

  The generated scene engine string (scripts/build-scene-engine.mjs). Hashes
  and parses the string; touches no DOM and no GPU. The live behaviour of the
  scenes is checked in the static-preview pass, and their policy in
  @craftkit/builder-media-engines.
*/
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';

import { describe, expect, it } from 'vitest';

import { PIXI_VERSION, SCENE_BANNER, SCENE_SHA256, SCENE_SOURCE } from './scene-source';

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

describe('generated scene engine source', () => {
  it('starts with its licence banner, which closes exactly once at its end', () => {
    expect(SCENE_SOURCE.startsWith(SCENE_BANNER)).toBe(true);
    expect(SCENE_BANNER.startsWith('/*!')).toBe(true);
    expect(SCENE_BANNER.indexOf('*/')).toBe(SCENE_BANNER.length - 3);
  });

  it('records the sha256 of the bundle that follows the banner, in the banner and the export', () => {
    const bundle = SCENE_SOURCE.slice(SCENE_BANNER.length).replace(/\n$/u, '');

    expect(sha256(bundle)).toBe(SCENE_SHA256);
    expect(SCENE_BANNER).toContain(`sha256(bundle after this banner) = ${SCENE_SHA256}`);
  });

  it('names pixi.js at its pinned version with the MIT notice', () => {
    expect(PIXI_VERSION).toBe('8.22.0');
    expect(SCENE_BANNER).toContain(`pixi.js@${PIXI_VERSION} — MIT`);
    expect(SCENE_BANNER).toContain('Permission is hereby granted, free of charge');
    expect(SCENE_BANNER).toContain('node scripts/build-scene-engine.mjs');
  });

  it('is one self-running script: it parses, loads no chunks, and ends by installing the engine', () => {
    expect(() => new Script(SCENE_SOURCE)).not.toThrow();
    expect(SCENE_SOURCE).not.toMatch(/\bimport\(\s*["'`]/u);
    expect(SCENE_SOURCE.trimEnd()).toMatch(/\(window\);?\}\)\(\);?$/u);
  });
});
