import { describe, expect, it } from 'vitest';

import { CUSTOM_CODE_REGION_CSS_MAX } from '@craftkit/builder-schema';

import { customCodeSchema } from './schema';

/*
  style-manager DESIGN §D.1 (2026-10-05): the region stylesheet is the escape
  hatch for what utilities cannot say, and an animated, effect-rich section
  outgrew 8 000 characters. The block declares the shared 24 000 ceiling.
*/
describe('the region css cap', () => {
  const props = customCodeSchema.props;

  it('stores a stylesheet of 24 000 characters and refuses one more', () => {
    expect(CUSTOM_CODE_REGION_CSS_MAX).toBe(24_000);
    const at = (length: number) => props.safeParse({ css: `/*${'x'.repeat(length - 4)}*/` });
    expect(at(24_000).success).toBe(true);
    expect(at(24_001).success).toBe(false);
  });
});
