/*
  @vitest-environment node

  Reads the vendored files from disk and hashes them; touches no DOM (see lenis-source.test.ts:
  under jsdom `import.meta.url` is an http URL and fileURLToPath rejects it).
*/
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { LOTTIE_BANNER, LOTTIE_SHA256, LOTTIE_SOURCE, LOTTIE_VERSION } from './lottie-source';
import {
  ANIME_VERSION,
  TIMELINE_BANNER,
  TIMELINE_ENGINE,
  TIMELINE_EXPORTS,
  TIMELINE_GLOBAL,
  TIMELINE_LICENSE,
  TIMELINE_SHA256,
  TIMELINE_SOURCE,
} from './timeline-source';

const VENDOR = new URL('../../../../../vendor/', import.meta.url);

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function readVendored(path: string): string {
  return readFileSync(fileURLToPath(new URL(path, VENDOR)), 'utf8');
}

describe('vendored anime.js subset (timeline-source), MIT — GSAP is gone (gsap-pixi 2026-10-08)', () => {
  it('reproduces vendor/animejs/anime.ck.min.js byte for byte', () => {
    expect(TIMELINE_ENGINE).toBe('anime.js');
    expect(ANIME_VERSION).toBe('4.5.0');
    const vendored = readVendored('animejs/anime.ck.min.js');
    expect(sha256(vendored)).toBe(TIMELINE_SHA256);
    expect(sha256(TIMELINE_SOURCE)).toBe(TIMELINE_SHA256);
  });

  it('defines window.ckAnime with exactly the recipe surface, and carries no GSAP', () => {
    expect(TIMELINE_GLOBAL).toBe('ckAnime');
    expect(TIMELINE_EXPORTS).toEqual(['createTimeline', 'animate', 'stagger', 'onScroll', 'splitText']);
    const global = /window\.ckAnime=\{([^}]*)\}/u.exec(TIMELINE_SOURCE);
    expect(global).not.toBeNull();
    const keys = (global?.[1] ?? '').split(',').map((pair) => pair.split(':')[0]);
    expect(keys).toEqual([...TIMELINE_EXPORTS, 'version']);
    for (const text of [TIMELINE_SOURCE, TIMELINE_BANNER]) {
      expect(text).not.toMatch(/gsap|greensock|ScrollTrigger|webflow/iu);
    }
    expect(TIMELINE_SOURCE).not.toMatch(/\bimport\(/u);
  });

  it('is MIT: the banner carries the full notice, the version, the integrity and the hash', () => {
    expect(TIMELINE_LICENSE).toBe('MIT');
    const licence = readVendored('animejs/LICENSE.md');
    expect(licence).toContain('The MIT License');
    expect(licence).toContain('Copyright (c) 2025 Julian Garnier');
    expect(TIMELINE_BANNER.startsWith('/*!')).toBe(true);
    expect(TIMELINE_BANNER).toContain('anime.js 4.5.0');
    expect(TIMELINE_BANNER).toContain('Copyright (c) 2025 Julian Garnier');
    expect(TIMELINE_BANNER).toContain('Permission is hereby granted, free of charge');
    expect(TIMELINE_BANNER).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
    expect(TIMELINE_BANNER).toContain(TIMELINE_SHA256);
    // One comment only: nothing after the closing */ but the newline.
    expect(TIMELINE_BANNER.indexOf('*/')).toBe(TIMELINE_BANNER.length - 3);
  });

  it('records its provenance beside the bundle', () => {
    const provenance = readVendored('animejs/PROVENANCE.md');
    expect(provenance).toContain('https://registry.npmjs.org/animejs/-/animejs-4.5.0.tgz');
    expect(provenance).toContain('sha512-');
    expect(provenance).toContain(TIMELINE_SHA256);
    expect(TIMELINE_BANNER).toMatch(/sha512-[A-Za-z0-9+/=]+/u);
  });

  it('leaves no GSAP file in the repository', () => {
    expect(existsSync(fileURLToPath(new URL('gsap', VENDOR)))).toBe(false);
  });
});

describe('vendored lottie-web light (lottie-source)', () => {
  it('reproduces vendor/lottie/lottie_light.min.js byte for byte', () => {
    expect(LOTTIE_VERSION).toBe('5.13.0');
    const vendored = readVendored('lottie/lottie_light.min.js');
    expect(sha256(vendored)).toBe(LOTTIE_SHA256);
    expect(sha256(LOTTIE_SOURCE)).toBe(LOTTIE_SHA256);
  });

  it('is MIT, and the banner carries the notice and the hash', () => {
    const licence = readVendored('lottie/LICENSE');
    expect(licence).toContain('The MIT License');
    expect(licence).toContain('Copyright (c) 2015 Bodymovin');
    expect(LOTTIE_BANNER).toContain('MIT License');
    expect(LOTTIE_BANNER).toContain('Copyright (c) 2015 Bodymovin');
    expect(LOTTIE_BANNER).toContain(LOTTIE_SHA256);
    expect(LOTTIE_BANNER.indexOf('*/')).toBe(LOTTIE_BANNER.length - 3);
  });

  it('is the light (SVG-only) player, which needs no eval', () => {
    expect(LOTTIE_SOURCE).not.toMatch(/\beval\(/);
    expect(LOTTIE_SOURCE).toContain('.lottie=');
  });
});
