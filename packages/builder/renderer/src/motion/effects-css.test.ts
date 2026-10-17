import { describe, expect, it } from 'vitest';

import { CUSTOM_CODE_EFFECTS } from '@craftkit/builder-schema';

import { declarationsOf, insideKeyframes } from './css-test-utils';
import { buildEffectsCss, effectCss } from './effects-css';
import { NO_PREFERENCE } from './presets-css';

const FULL = buildEffectsCss();

describe('buildEffectsCss', () => {
  it('has a ck-fx-* rule for every effect in the vocabulary', () => {
    for (const name of CUSTOM_CODE_EFFECTS) expect(FULL, name).toContain(`.ck-fx-${name}`);
  });

  it('falls glass back to a solid surface without backdrop-filter and under reduced transparency', () => {
    const glass = effectCss('glass');
    expect(glass).toContain(
      '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))',
    );
    expect(glass).toContain('@media (prefers-reduced-transparency: reduce)');
    expect(glass).toContain('background-color: var(--t-surface, #ffffff);');
  });

  it('moves only under prefers-reduced-motion: no-preference', () => {
    const moving = declarationsOf(FULL).filter(
      (declaration) =>
        /^(?:animation|transition)/u.test(declaration.property) &&
        !insideKeyframes(declaration) &&
        !declaration.ancestors.includes(NO_PREFERENCE),
    );
    expect(moving).toEqual([]);
  });

  it('paints with theme tokens (overridable per element), never a physical side', () => {
    expect(FULL).toContain('var(--ck-fx-c1, var(--t-accent, #4f46e5))');
    const physical = declarationsOf(FULL).filter((declaration) =>
      /^(?:left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)$/u.test(
        declaration.property,
      ),
    );
    expect(physical).toEqual([]);
    // The gradient text runs from the inline start in Arabic.
    expect(effectCss('text-gradient')).toContain('--ck-fx-angle: 270deg;');
  });

  it('emits only the effects asked for', () => {
    const one = buildEffectsCss(['glass']);
    expect(one).toContain('.ck-fx-glass');
    expect(one).not.toContain('.ck-fx-mesh');
    expect(buildEffectsCss([])).toBe('');
  });
});
