import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { customCodeTree, customCss } from './custom-code-tree';
import {
  CUSTOM_CSS_FONT_HOSTS,
  CUSTOM_CSS_FONT_IMPORT,
  customCssPropertyNames,
  findCssRejection,
  normalizeCssForInspection,
} from './custom-css';

/*
  The refusal list moved here from the custom-code extension so the AI plan
  door could reach it. These tests pin the behaviour AT ITS NEW HOME: the
  extension's own scope-css.test.ts still exercises the same functions through
  the re-export, which is what proves the move kept every caller working.
*/

describe('custom-css refusal', () => {
  it.each([
    ['@import', '@import url("https://evil.test/x.css"); .a { color: red }'],
    ['insecure (http or //) url()', '.a { background: url(http://evil.test/p.png) }'],
    ['insecure (http or //) url()', '.a { background: url(//evil.test/p.png) }'],
    ['expression()', '.a { width: expression(alert(1)) }'],
    ['behavior', '.a { behavior: url(#default#time2) }'],
    ['-moz-binding', '.a { -moz-binding: url("x.xml#e") }'],
    ['javascript:', '.a { background: url(javascript:alert(1)) }'],
    ['</style>', '.a { color: red } </style><script>alert(1)</script>'],
  ])('refuses %s and names it', (reason, css) => {
    expect(findCssRejection(css)).toEqual({ reason });
  });

  it.each([
    [
      'an https background from the internet',
      '.a { background-image: url("https://img.test/a.jpg") }',
    ],
    ['a hex colour', '.a { color: #1e3a8a }'],
    ['an inline data image', '.a { background: url(data:image/png;base64,iVBORw0KGgo=) }'],
    ['a site-relative asset', '.a { background: url(/assets/hero.png) }'],
    [
      'keyframes and gradients',
      '@keyframes f { to { opacity: 1 } } .a { background: linear-gradient(#000, #fff) }',
    ],
    ['an empty sheet', ''],
  ])('allows %s', (_label, css) => {
    expect(findCssRejection(css)).toBeUndefined();
  });

  it.each(CUSTOM_CSS_FONT_HOSTS)('allows a font @import from %s', (host) => {
    expect(
      findCssRejection(`@import url("${host}css2?family=Inter"); .a { color: red }`),
    ).toBeUndefined();
  });

  it('still refuses a lookalike font host and an insecure one', () => {
    expect(
      findCssRejection('@import url("https://fonts.googleapis.com.evil.test/x.css");'),
    ).toEqual({
      reason: '@import',
    });
    expect(
      findCssRejection('@import url("http://fonts.googleapis.com/css2?family=Inter");'),
    ).toEqual({
      reason: '@import',
    });
  });

  it('sees through escapes and comments, because the browser does', () => {
    expect(findCssRejection('@\\69mport url("https://evil.test/x.css");')).toEqual({
      reason: '@import',
    });
    expect(findCssRejection('@/**/import url("https://evil.test/x.css");')).toEqual({
      reason: '@import',
    });
    expect(normalizeCssForInspection('@/**/import')).toBe('@import');
  });
});

describe('custom-css property names', () => {
  it('finds the stylesheet props a block declares, by marker and not by name', () => {
    const props = z.object({
      // Named `css` but a plain string: NOT a stylesheet.
      css: z.string().default(''),
      // Named `styles` but declared with the marker: a stylesheet.
      styles: customCss(8_000),
      pageCss: customCss(20_000),
      tree: customCodeTree(),
      title: z.string().default(''),
    });

    expect([...customCssPropertyNames(props)].sort()).toEqual(['pageCss', 'styles']);
  });

  it('unwraps optional and nullable stylesheet declarations', () => {
    const props = z.object({ css: customCss(8_000).optional() });

    expect([...customCssPropertyNames(props)]).toEqual(['css']);
  });

  it('returns nothing for a schema that is not an object', () => {
    expect(customCssPropertyNames(z.string()).size).toBe(0);
  });
});

describe('web-font imports', () => {
  it('keeps a ";" inside the address: css2 weights are written wght@500;700', () => {
    // The 2026-10-05 Arabic scaffold page: the import was cut at "@500;".
    const css =
      "@import url('https://fonts.googleapis.com/css2?family=El+Messiri:wght@500;700&display=swap');.a{color:red}";
    expect(css.match(CUSTOM_CSS_FONT_IMPORT)).toEqual([
      "@import url('https://fonts.googleapis.com/css2?family=El+Messiri:wght@500;700&display=swap');",
    ]);
    expect(css.replace(CUSTOM_CSS_FONT_IMPORT, '')).toBe('.a{color:red}');
    expect(findCssRejection(css)).toBeUndefined();
  });

  it('still reads the bare and %3B forms, and never a host off the list', () => {
    const bare = '@import "https://fonts.bunny.net/css?family=a;b";.b{}';
    expect(bare.replace(CUSTOM_CSS_FONT_IMPORT, '')).toBe('.b{}');
    const encoded = '@import url(https://fonts.googleapis.com/css2?family=A:wght@400%3B700);.c{}';
    expect(encoded.replace(CUSTOM_CSS_FONT_IMPORT, '')).toBe('.c{}');
    expect("@import url('https://evil.example/x;y');".match(CUSTOM_CSS_FONT_IMPORT)).toBeNull();
    expect(findCssRejection("@import url('https://evil.example/x');")).toBeDefined();
  });
});
