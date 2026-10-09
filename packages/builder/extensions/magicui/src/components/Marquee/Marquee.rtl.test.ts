import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/*
  blocks-polish (2026-10-08): the marquee rail stays full in RTL.

  jsdom runs no animation, so the law is read from the stylesheet: right to
  left the track travels by +50% (its second copy comes in from the left),
  never by the LTR -50% that emptied the rail, and only where motion is
  welcome.
*/
const css = readFileSync(join(import.meta.dirname, 'Marquee.css'), 'utf8');

function rule(selector: string, from: number): string {
  const at = css.indexOf(selector, from);
  if (at < 0) return '';
  return css.slice(at, css.indexOf('}', at) + 1);
}

describe('Marquee in RTL', () => {
  const block = css.slice(css.indexOf('/* blocks-polish additions'));

  it('travels the RTL track by +50%, the LTR one by -50%', () => {
    expect(rule('@keyframes mgc-marquee-travel-rtl', 0)).toBeTruthy();
    expect(block).toMatch(/to\s*\{\s*transform:\s*translateX\(50%\)/u);
    expect(rule('@keyframes mgc-marquee-travel {', 0)).toBeTruthy();
    expect(css).toMatch(/@keyframes mgc-marquee-travel \{[^@]*translateX\(-50%\)/u);
  });

  it('switches to the RTL keyframes under [dir=rtl], inside a no-preference motion query', () => {
    const motion = block.slice(block.indexOf('@media (prefers-reduced-motion: no-preference)'));
    expect(motion).toContain("[dir='rtl'] .mgc-marquee__track {\n    animation-name: mgc-marquee-travel-rtl;");
    /* Forward reads in the page's own direction once the keyframes are mirrored. */
    expect(rule("[dir='rtl'] .mgc-marquee__viewport[data-marquee-direction='forward'] .mgc-marquee__track", css.indexOf('/* blocks-polish additions'))).toContain(
      'animation-direction: normal',
    );
  });

  it('comes after the reduced-motion rule only inside its own no-preference query', () => {
    const reduced = css.indexOf('@media (prefers-reduced-motion: reduce)');
    const mine = css.indexOf('@media (prefers-reduced-motion: no-preference)');
    expect(reduced).toBeGreaterThan(-1);
    expect(mine).toBeGreaterThan(reduced);
  });
});
