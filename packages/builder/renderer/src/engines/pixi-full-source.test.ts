/*
  @vitest-environment node

  The generated FULL pixi.js string (scripts/build-scene-engine.mjs pixi) for region scripts.
  Hashes and parses the string; touches no DOM and no GPU. What it does in a page is covered by the
  handshake tests (packs/scripts.test.ts) and, with a real WebGL context, the static-preview pass.
*/
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { Script } from 'node:vm';

import { describe, expect, it } from 'vitest';

import {
  PIXI_FULL_BANNER,
  PIXI_FULL_SHA256,
  PIXI_FULL_SOURCE,
  PIXI_FULL_VERSION,
} from './pixi-full-source';

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Its own budget, deliberately apart from the 200 kB scene engine (scripts/build-scene-engine.mjs). */
const PIXI_FULL_BUDGET_GZIP_BYTES = 300_000;

describe('generated full pixi.js source', () => {
  it('starts with its licence banner, which closes exactly once at its end', () => {
    expect(PIXI_FULL_SOURCE.startsWith(PIXI_FULL_BANNER)).toBe(true);
    expect(PIXI_FULL_BANNER.startsWith('/*!')).toBe(true);
    expect(PIXI_FULL_BANNER.indexOf('*/')).toBe(PIXI_FULL_BANNER.length - 3);
  });

  it('records the sha256 of the bundle that follows the banner', () => {
    const bundle = PIXI_FULL_SOURCE.slice(PIXI_FULL_BANNER.length).replace(/\n$/u, '');

    expect(sha256(bundle)).toBe(PIXI_FULL_SHA256);
    expect(PIXI_FULL_BANNER).toContain(`sha256(bundle after this banner) = ${PIXI_FULL_SHA256}`);
  });

  it('names pixi.js at its pinned version with the MIT notice, and every bundled package', () => {
    expect(PIXI_FULL_VERSION).toBe('8.22.0');
    expect(PIXI_FULL_BANNER).toContain(`pixi.js@${PIXI_FULL_VERSION} — MIT`);
    expect(PIXI_FULL_BANNER).toContain('Permission is hereby granted, free of charge');
    expect(PIXI_FULL_BANNER).toContain('node scripts/build-scene-engine.mjs pixi');
    // The whole library pulls in more packages than the scene subset: their notices travel too.
    expect(PIXI_FULL_BANNER).toContain('@xmldom/xmldom@');
    expect(PIXI_FULL_BANNER).toContain('earcut@');
  });

  it('is one self-running script: it parses, loads no chunks, and registers the pixi engine', () => {
    expect(() => new Script(PIXI_FULL_SOURCE)).not.toThrow();
    expect(PIXI_FULL_SOURCE).not.toMatch(/\bimport\(\s*["'`]/u);
    // The handshake's registration: `ready('pixi', …)`, minified, and no `window.PIXI` global.
    expect(PIXI_FULL_SOURCE).toMatch(/\.ready\(["']pixi["']/u);
    expect(PIXI_FULL_SOURCE).not.toMatch(/window\.PIXI\s*=/u);
  });

  it('stays inside its own gzip budget', () => {
    expect(gzipSync(PIXI_FULL_SOURCE, { level: 9 }).length).toBeLessThanOrEqual(
      PIXI_FULL_BUDGET_GZIP_BYTES,
    );
  });
});
