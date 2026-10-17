import { describe, expect, it } from 'vitest';

import { findCssRejection, scopeCustomCodeCss } from './scope-css';

const scope = (css: string) => scopeCustomCodeCss(css, 'n1');

describe('custom-code CSS refusal', () => {
  it.each([
    ['@import', '@import url("https://evil.test/x.css"); .a { color: red }'],
    ['insecure http url()', '.a { background: url(http://evil.test/p.png) }'],
    ['protocol-relative url()', '.a { background: url(//evil.test/p.png) }'],
    ['expression()', '.a { width: expression(alert(1)) }'],
    ['behavior', '.a { behavior: url(#default#time2) }'],
    ['-moz-binding', '.a { -moz-binding: url("x.xml#e") }'],
    ['javascript: url', '.a { background: url(javascript:alert(1)) }'],
    ['early </style>', '.a { color: red } </style><script>alert(1)</script>'],
  ])('refuses %s', (_label, css) => {
    expect(findCssRejection(css)).toBeDefined();
    expect(scope(css)).toBeUndefined();
  });

  it.each([
    [
      'an https background from the internet',
      '.a { background-image: url("https://images.example.com/travel.jpg") }',
    ],
    [
      'an exact colour — hex is a design value, not a threat',
      '.a { color: #1e3a8a; background: rgb(30 58 138 / 0.4) }',
    ],
    ['inline data image', '.a { background: url(data:image/png;base64,iVBORw0KGgo=) }'],
    ['relative asset', '.a { background: url(/assets/hero.png) }'],
    [
      'keyframes and gradients',
      '@keyframes f { to { opacity: 1 } } .a { background: linear-gradient(#000, #fff) }',
    ],
    ['backdrop filter', '.a { backdrop-filter: blur(20px) }'],
  ])('allows %s — the freedom this feature exists for', (_label, css) => {
    expect(findCssRejection(css)).toBeUndefined();
    expect(scope(css)).toBeDefined();
  });
});

describe('custom-code CSS refusal — disguised spellings', () => {
  /*
    The browser decodes escapes and drops comments before it acts. A refusal
    list that only reads the raw text refuses the honest `@import` and admits
    the disguised one — the exact inversion of its purpose.
  */
  it.each([
    ['hex-escaped @import', '@\\69mport url("https://evil.test/x.css");'],
    ['long hex escape with trailing space', '@\\000069 mport url("https://evil.test/x.css");'],
    ['escaped url()', '.a { background: \\75rl(http://evil.test/p.png) }'],
    ['comment inside the keyword', '@/**/import url("https://evil.test/x.css");'],
    ['comment inside url()', '.a { background: u/**/rl(http://evil.test/p.png) }'],
    ['escaped expression()', '.a { width: e\\78pression(alert(1)) }'],
    // `\6a` then a SPACE: a hex escape swallows up to six hex digits, so
    // `\6aavascript` would decode to U+06AA — the space is how CSS ends it.
    ['escaped javascript:', '.a { background: url(\\6a avascript:alert(1)) }'],
    ['six-digit escape without a space', '.a { background: url(\\00006aavascript:alert(1)) }'],
  ])('sees through %s', (_label, css) => {
    expect(findCssRejection(css)).toBeDefined();
    expect(scope(css)).toBeUndefined();
  });

  it('decodes escapes only for inspection; the rendered text is the author own', () => {
    // `\\31` is a legal way to start a class name with a digit; it must survive.
    const css = '.\\31 st { color: red }';

    expect(findCssRejection(css)).toBeUndefined();
    expect(scope(css)).toContain('.\\31 st');
  });
});

describe('custom-code CSS — web fonts', () => {
  it('allows an @import from Google Fonts and keeps it in front of every rule', () => {
    const css =
      '.ck-a { font-family: Inter } @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap");';

    const scoped = scope(css);

    expect(findCssRejection(css)).toBeUndefined();
    expect(scoped?.startsWith('@import url("https://fonts.googleapis.com/')).toBe(true);
    expect(scoped).toContain('[data-ck="n1"] .ck-a{ font-family: Inter }');
  });

  it('allows the bare-string form and bunny.net too', () => {
    expect(
      findCssRejection('@import "https://fonts.bunny.net/css?family=cairo:400";'),
    ).toBeUndefined();
  });

  it('still refuses @import from any other host, including a look-alike', () => {
    expect(
      findCssRejection('@import url("https://fonts.googleapis.com.evil.test/x.css");'),
    ).toBeDefined();
    expect(
      findCssRejection('@import url("https://evil.test/fonts.googleapis.com/x.css");'),
    ).toBeDefined();
    expect(
      findCssRejection('@import url("http://fonts.googleapis.com/css2?family=Inter");'),
    ).toBeDefined();
  });

  it('does not let a font import smuggle a second import behind it', () => {
    expect(
      findCssRejection(
        '@import url("https://fonts.googleapis.com/css2?family=Inter"); @import url("https://evil.test/x.css");',
      ),
    ).toBeDefined();
  });
});

describe('custom-code CSS scoping', () => {
  it('prefixes every selector with the host node attribute', () => {
    expect(scope('.hero { color: red }')).toBe('[data-ck="n1"] .hero{ color: red }');
  });

  it('prefixes each selector in a list separately', () => {
    expect(scope('.a, .b { color: red }')).toBe(
      '[data-ck="n1"] .a,[data-ck="n1"] .b{ color: red }',
    );
  });

  it('does not split a comma inside :is() — that is one selector, not two', () => {
    const scoped = scope(':is(.a, .b) span { color: red }');

    expect(scoped).toBe('[data-ck="n1"] :is(.a, .b) span{ color: red }');
  });

  it('recurses into @media so nested rules are scoped too', () => {
    const scoped = scope('@media (min-width: 40rem) { .a { color: red } }');

    expect(scoped).toBe('@media (min-width: 40rem){[data-ck="n1"] .a{ color: red }}');
  });

  it('leaves @keyframes step selectors alone — they are not selectors', () => {
    const scoped = scope('@keyframes float { 0% { top: 0 } 100% { top: 10px } }');

    expect(scoped).toContain('@keyframes float{');
    expect(scoped).not.toContain('[data-ck="n1"] 0%');
  });

  it('leaves @font-face alone', () => {
    const scoped = scope('@font-face { font-family: X; src: url(/f.woff2) }');

    expect(scoped).toContain('@font-face{');
    expect(scoped).not.toContain('[data-ck="n1"] font-family');
  });

  it('cannot be escaped by a selector that names another region', () => {
    // The prefix is unconditional: a rule aimed at a sibling still resolves
    // only inside this host, because both selectors must match the same tree.
    const scoped = scope('[data-ck="n2"] .x { color: red }');

    expect(scoped).toBe('[data-ck="n1"] [data-ck="n2"] .x{ color: red }');
  });

  it('escapes a host id that contains quotes rather than closing the selector', () => {
    const scoped = scopeCustomCodeCss('.a { color: red }', 'n"]:hover, *');

    expect(scoped).toContain('[data-ck="n\\"]:hover, *"]');
  });

  it('returns undefined for empty, whitespace, and selector-less input', () => {
    expect(scope('')).toBeUndefined();
    expect(scope('   \n  ')).toBeUndefined();
    expect(scope('{ color: red }')).toBeUndefined();
  });

  it('survives unbalanced braces without hanging or throwing', () => {
    expect(() => scope('.a { color: red')).not.toThrow();
    expect(scope('.a { color: red')).toBeUndefined();
  });

  it('bounds at-rule nesting rather than recursing without limit', () => {
    const deep = '@media screen {'.repeat(40) + '.a{color:red}' + '}'.repeat(40);

    expect(() => scope(deep)).not.toThrow();
  });

  it('refuses to pretend the unimplemented strict policy is permissive', () => {
    expect(() => scopeCustomCodeCss('.a { color: red }', 'n1', 'strict')).toThrow(
      /not implemented/iu,
    );
  });

  it('renders nothing at all under the off policy', () => {
    expect(scopeCustomCodeCss('.a { color: red }', 'n1', 'off')).toBeUndefined();
  });
});

describe('custom-code CSS — viewport heights (preview-fix 2026-10-12)', () => {
  /*
    The canvas frame is `100 / zoom` percent tall, so its own `vh` grew with zoom-out: a story
    stage at `min-height: 70vh` was 999px on the canvas at 57% and 604px in Preview, under the
    same pixel-sized cards. A region's viewport heights read the canvas's `--ck-vh` instead; with
    nothing set (Preview, a published page) the fallback is the real unit.
  */
  it('reads a region height in vh through --ck-vh, in rules and inside media blocks', () => {
    const scoped = scope(
      '.ck-story { min-height: 70vh } @media (max-width: 640px) { .ck-story { height: 100dvh } }',
    );
    expect(scoped).toContain(
      '[data-ck="n1"] .ck-story{ min-height: calc(70 * var(--ck-vh, 1vh)) }',
    );
    expect(scoped).toContain(
      '@media (max-width: 640px){[data-ck="n1"] .ck-story{ height: calc(100 * var(--ck-vh, 1dvh)) }}',
    );
    expect(scoped).not.toMatch(/ (?:70vh|100dvh)/u);
  });

  it('leaves a class that merely mentions vh as it was', () => {
    expect(scope('.ck-h-70vh { color: red }')).toBe('[data-ck="n1"] .ck-h-70vh{ color: red }');
  });
});
