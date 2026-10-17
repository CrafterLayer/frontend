// @vitest-environment node
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { CAROUSEL_SHA256, CAROUSEL_SOURCE, CAROUSEL_VERSION } from './carousel-source';

it('ships a licensed, digest-verified, bounded standalone Embla asset', () => {
  expect(CAROUSEL_VERSION).toBe('8.6.0');
  expect(CAROUSEL_SOURCE).toContain('Copyright (c) David Jerleke.');
  expect(createHash('sha256').update(CAROUSEL_SOURCE).digest('hex')).toBe(CAROUSEL_SHA256);
  expect(gzipSync(CAROUSEL_SOURCE).byteLength).toBeLessThanOrEqual(20_000);
  expect(CAROUSEL_SOURCE).toContain('ck-carousel-ready');
  expect(CAROUSEL_SOURCE).not.toMatch(/\bimport\(|\beval\(/u);
});
