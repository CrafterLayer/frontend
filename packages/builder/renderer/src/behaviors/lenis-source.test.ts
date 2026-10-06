/*
  @vitest-environment node

  Reads the vendored files from disk and hashes them; touches no DOM. Under the
  package's default jsdom environment `import.meta.url` is an http URL and
  fileURLToPath rejects it.
*/
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  LENIS_BANNER,
  LENIS_CSS,
  LENIS_CSS_SHA256,
  LENIS_SHA256,
  LENIS_SOURCE,
  LENIS_VERSION,
} from './lenis-source';

const VENDOR_DIR = new URL('../../../../../vendor/lenis/', import.meta.url);

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function readVendored(name: string): string {
  return readFileSync(fileURLToPath(new URL(name, VENDOR_DIR)), 'utf8');
}

describe('vendored Lenis source', () => {
  it('reproduces vendor/lenis/lenis.min.js byte for byte', () => {
    const vendored = readVendored('lenis.min.js');

    expect(sha256(vendored)).toBe(LENIS_SHA256);
    expect(sha256(LENIS_SOURCE)).toBe(LENIS_SHA256);
  });

  it('reproduces vendor/lenis/lenis.css byte for byte', () => {
    const vendored = readVendored('lenis.css');

    expect(sha256(vendored)).toBe(LENIS_CSS_SHA256);
    expect(sha256(LENIS_CSS)).toBe(LENIS_CSS_SHA256);
  });

  it('is the pinned release, and the banner names it and its licence', () => {
    expect(LENIS_VERSION).toBe('1.3.26');
    // The minified build embeds its own version string.
    expect(LENIS_SOURCE).toContain('`1.3.26`');
    expect(LENIS_BANNER).toContain(`Lenis ${LENIS_VERSION}`);
    expect(LENIS_BANNER).toContain('MIT');
    expect(readVendored('LICENSE')).toContain('Copyright (c) 2024 darkroom.engineering');
  });
});
