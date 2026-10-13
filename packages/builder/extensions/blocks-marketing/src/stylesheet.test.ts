import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { marketingSectionStylesheet } from './stylesheet';

describe('marketing publication stylesheet', () => {
  it.each(['mkt-slab', 'mkt-compare__cards', 'mkt-section__content', 'mkt-type--family-serif'])(
    'exposes the exact owner CSS for %s without a second stylesheet source',
    (name) => {
      expect(marketingSectionStylesheet([name])).toBe(
        readFileSync(join(import.meta.dirname, 'components/section-layout.css'), 'utf8'),
      );
    },
  );

  it('omits marketing CSS for a custom-code-only page', () => {
    expect(marketingSectionStylesheet(['p-4', 'text-accent', 'mkt-unrelated-hook'])).toBe('');
  });
});
