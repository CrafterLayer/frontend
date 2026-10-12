import { describe, expect, it } from 'vitest';

import { CANVAS_VIEWPORT_HEIGHT_PROPERTY, canvasViewportHeightUnits } from './viewport-units';

const vh = (amount: string, unit = 'vh') => `calc(${amount} * var(--ck-vh, 1${unit}))`;

describe('canvasViewportHeightUnits (preview-fix 2026-10-12)', () => {
  it('names the property the editor canvas sets', () => {
    expect(CANVAS_VIEWPORT_HEIGHT_PROPERTY).toBe('--ck-vh');
  });

  it('reads every viewport-height length through --ck-vh, falling back to its own unit', () => {
    expect(canvasViewportHeightUnits('.a{min-height:70vh}')).toBe(`.a{min-height:${vh('70')}}`);
    expect(canvasViewportHeightUnits('.a { height: 100dvh; top: -12.5svh; bottom: .5LVH }')).toBe(
      `.a { height: ${vh('100', 'dvh')}; top: ${vh('-12.5', 'svh')}; bottom: ${vh('.5', 'lvh')} }`,
    );
    expect(
      canvasViewportHeightUnits('.a{height:calc(100vh - 4rem);inset:clamp(1rem,10vh,4rem)}'),
    ).toBe(`.a{height:calc(${vh('100')} - 4rem);inset:clamp(1rem,${vh('10')},4rem)}`);
  });

  it('leaves selectors, strings, urls, comments and media conditions alone', () => {
    const untouched = [
      '.min-h-\\[70vh\\]{color:red}',
      '.h-70vh{color:red}',
      '.a::after{content:"70vh"}',
      ".a{background:url('/img/70vh.png')}",
      '/* 70vh */.a{color:red}',
      '@media (min-height: 50vh){.a{color:red}}',
      '@supports (height: 100dvh){.a{color:red}}',
      '.a{width:70vw;height:70px}',
    ];
    for (const css of untouched) expect(canvasViewportHeightUnits(css), css).toBe(css);
  });

  it('rewrites the declarations inside a media block but not its condition', () => {
    expect(canvasViewportHeightUnits('@media (min-height: 50vh){.a{height:50vh}}')).toBe(
      `@media (min-height: 50vh){.a{height:${vh('50')}}}`,
    );
  });
});
