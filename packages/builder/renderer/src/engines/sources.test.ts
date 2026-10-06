/*
  @vitest-environment node

  Reads the vendored files from disk and hashes them; touches no DOM (see lenis-source.test.ts:
  under jsdom `import.meta.url` is an http URL and fileURLToPath rejects it).
*/
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { LOTTIE_BANNER, LOTTIE_SHA256, LOTTIE_SOURCE, LOTTIE_VERSION } from './lottie-source';
import {
  GSAP_VERSION,
  TIMELINE_BANNER,
  TIMELINE_LICENSE,
  TIMELINE_PARTS,
  TIMELINE_SOURCE,
} from './timeline-source';

const VENDOR = new URL('../../../../../vendor/', import.meta.url);

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function readVendored(path: string): string {
  return readFileSync(fileURLToPath(new URL(path, VENDOR)), 'utf8');
}

describe('vendored GSAP (timeline-source)', () => {
  it('carries the three pinned files, each slice byte for byte the vendored file', () => {
    expect(GSAP_VERSION).toBe('3.15.0');
    expect(TIMELINE_PARTS.map((part) => part.file)).toEqual([
      'gsap.min.js',
      'ScrollTrigger.min.js',
      'SplitText.min.js',
    ]);
    for (const part of TIMELINE_PARTS) {
      const vendored = readVendored(`gsap/${part.file}`);
      expect(sha256(vendored)).toBe(part.sha256);
      expect(sha256(TIMELINE_SOURCE.slice(part.start, part.end))).toBe(part.sha256);
    }
  });

  it('is exactly the files joined by "\\n;" with nothing added or removed', () => {
    const joined = TIMELINE_PARTS.map((part) => readVendored(`gsap/${part.file}`)).join('\n;');
    expect(sha256(TIMELINE_SOURCE)).toBe(sha256(joined));
  });

  it('keeps every GSAP notice intact (the licence forbids removing or altering them)', () => {
    const names = ['GSAP', 'ScrollTrigger', 'SplitText'];
    TIMELINE_PARTS.forEach((part, index) => {
      const slice = TIMELINE_SOURCE.slice(part.start, part.end);
      expect(slice.startsWith(`/*!\n * ${String(names[index])} ${GSAP_VERSION}\n`)).toBe(true);
      expect(slice).toContain('@license Copyright 2026, GreenSock. All rights reserved.');
      expect(slice).toContain('https://gsap.com/standard-license');
    });
  });

  it('banner names the licence, the conditions, and every file hash', () => {
    expect(TIMELINE_LICENSE).toBe('GSAP Standard No-Charge License');
    expect(TIMELINE_BANNER.startsWith('/*!')).toBe(true);
    expect(TIMELINE_BANNER.trimEnd().endsWith('*/')).toBe(true);
    expect(TIMELINE_BANNER).toContain(TIMELINE_LICENSE);
    expect(TIMELINE_BANNER).toContain('NOT OSI');
    expect(TIMELINE_BANNER).toContain('unmodified');
    expect(TIMELINE_BANNER).toContain('no visual GSAP timeline or keyframe editor');
    for (const part of TIMELINE_PARTS) expect(TIMELINE_BANNER).toContain(part.sha256);
    // One comment only: nothing after the closing */ but the newline.
    expect(TIMELINE_BANNER.indexOf('*/')).toBe(TIMELINE_BANNER.length - 3);
  });

  it('ships the licence text and provenance beside the files', () => {
    const licence = readVendored('gsap/LICENSE.md');
    expect(licence).toContain('Standard "No Charge" GSAP License');
    expect(licence).toContain('II. GRANT OF LICENSE');
    expect(licence).toContain('Prohibited Uses');
    expect(licence).toContain('fetched 2026-10-06');
    const provenance = readVendored('gsap/PROVENANCE.md');
    for (const part of TIMELINE_PARTS) expect(provenance).toContain(part.sha256);
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
