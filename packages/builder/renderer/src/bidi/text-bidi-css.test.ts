import { describe, expect, it } from 'vitest';

import { TEXT_BIDI_CANVAS_CSS, TEXT_BIDI_CSS, TEXT_BIDI_STYLE_ID } from './text-bidi-css';

describe('TEXT_BIDI_CSS', () => {
  it('is one zero-specificity rule that isolates each text element by its own first strong character', () => {
    expect(TEXT_BIDI_CSS.startsWith(':where(')).toBe(true);
    expect(TEXT_BIDI_CSS).toContain('{unicode-bidi:plaintext}');
    // ── block-parts (2026-10-06) ── plus one rule that keeps the section's alignment
    expect(TEXT_BIDI_CSS.match(/\{/g)).toHaveLength(2);
    expect(TEXT_BIDI_CSS.endsWith('{text-align:match-parent}')).toBe(true);
    expect(TEXT_BIDI_CSS.match(/:where\(/g)).toHaveLength(2);
  });

  it('aligns every text element and every dir=auto element to its PARENT\'s direction (DESIGN §6.2)', () => {
    const rules = [...TEXT_BIDI_CSS.matchAll(/:where\(([^)]*)\)\{([^}]*)\}/g)];
    const align = rules.find((rule) => rule[2] === 'text-align:match-parent');
    const selectors = align?.[1]?.split(',') ?? [];
    for (const selector of ['p', 'h2', 'li', 'a', '[data-ck-part]', '[dir=auto]']) {
      expect(selectors).toContain(selector);
    }
  });

  it('covers every text-bearing element and every declared block part', () => {
    const selectors = /:where\(([^)]*)\)/.exec(TEXT_BIDI_CSS)?.[1]?.split(',') ?? [];
    for (const tag of [
      'p',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'li',
      'blockquote',
      'button',
      'a',
      'label',
    ]) {
      expect(selectors).toContain(tag);
    }
    expect(selectors).toContain('[data-ck-part]');
  });

  it('the canvas copy sits in the base layer, so a text-center utility still wins', () => {
    expect(TEXT_BIDI_CANVAS_CSS).toBe(`@layer base{${TEXT_BIDI_CSS}}`);
  });

  it('names a stable style id for the canvas', () => {
    expect(TEXT_BIDI_STYLE_ID).toBe('ck-text-bidi');
  });
});
