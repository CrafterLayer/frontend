import { describe, expect, it } from 'vitest';

import { canvasFrameStyles, normalizeZoom } from './canvas-frame-style';

describe('normalizeZoom', () => {
  it('keeps a finite positive zoom and falls back to 1 otherwise', () => {
    expect(normalizeZoom(0.5)).toBe(0.5);
    expect(normalizeZoom(0)).toBe(1);
    expect(normalizeZoom(-2)).toBe(1);
    expect(normalizeZoom(Number.NaN)).toBe(1);
    expect(normalizeZoom(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe('canvasFrameStyles (device width + visual zoom, 007 §6)', () => {
  it('full width at zoom 1 needs no style at all', () => {
    expect(canvasFrameStyles(undefined, 1)).toEqual({ viewport: undefined, frameShell: undefined });
  });

  it('a device width keeps the authored width exact and scales only the footprint', () => {
    expect(canvasFrameStyles(834, 1)).toEqual({
      viewport: { inlineSize: '834px' },
      frameShell: { inlineSize: '834px' },
    });
    expect(canvasFrameStyles(1280, 0.5)).toEqual({
      viewport: { inlineSize: '640px' },
      frameShell: { inlineSize: '1280px', blockSize: '200%', transform: 'scale(0.5)' },
    });
  });

  it('full width under zoom counter-sizes the shell so the scaled frame fills the column', () => {
    expect(canvasFrameStyles(undefined, 0.5)).toEqual({
      viewport: { inlineSize: '50%' },
      frameShell: { inlineSize: '200%', blockSize: '200%', transform: 'scale(0.5)' },
    });
  });

  it('ignores an unusable frame width', () => {
    expect(canvasFrameStyles(0, 1).frameShell).toBeUndefined();
    expect(canvasFrameStyles(Number.NaN, 1).viewport).toBeUndefined();
  });
});
