import { describe, expect, it } from 'vitest';

import { TEXT_BIDI_CSS } from '../bidi';
import { STATIC_BASE_CSS } from './base-css';

/** The body of the one `@layer base{…}` block, found by brace depth. */
function baseLayerBody(css: string): string {
  const open = css.indexOf('@layer base{');
  expect(open).toBeGreaterThanOrEqual(0);
  const start = open + '@layer base{'.length;
  let depth = 1;
  for (let at = start; at < css.length; at += 1) {
    if (css[at] === '{') depth += 1;
    if (css[at] === '}') depth -= 1;
    if (depth === 0) return css.slice(start, at);
  }
  throw new Error('unbalanced @layer base block');
}

describe('STATIC_BASE_CSS text direction', () => {
  it('carries the text-direction rule inside @layer base, so the export needs no change of its own', () => {
    expect(baseLayerBody(STATIC_BASE_CSS)).toContain(TEXT_BIDI_CSS);
  });

  it('carries it exactly once, after the reset, and keeps the explicit layer order first', () => {
    expect(STATIC_BASE_CSS.split(TEXT_BIDI_CSS)).toHaveLength(2);
    expect(STATIC_BASE_CSS.startsWith('@layer properties,theme,base,components,utilities;')).toBe(
      true,
    );
    const body = baseLayerBody(STATIC_BASE_CSS);
    expect(body.indexOf('*,::after,::before')).toBeLessThan(body.indexOf(TEXT_BIDI_CSS));
    expect(body.endsWith(TEXT_BIDI_CSS)).toBe(true);
  });
});
