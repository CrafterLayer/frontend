import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  CUSTOM_CODE_ATTRIBUTES,
  CUSTOM_CODE_MAX_DEPTH,
  CUSTOM_CODE_MAX_NODES,
  CUSTOM_CODE_SVG_ATTRIBUTES,
  CUSTOM_CODE_SVG_TAGS,
  CUSTOM_CODE_TAGS,
  customCodeAttributeProblem,
  customCodeAttributeSpelling,
  customCodeClassNames,
  customCodeComponentTypes,
  customCodeIconGaps,
  customCodeIconNames,
  customCodeSrcsetUrls,
  customCodeTagSpelling,
  customCodeTree,
  customCodeTreeProblems,
  customCodeTreeSchema,
  emptyCustomCodeTree,
  isCustomCodeSvgTag,
  isCustomCodeTag,
  isCustomCodeTreeSchema,
  safeCustomCodeUrl,
  type CustomCodeNode,
} from './custom-code-tree';

function nest(depth: number): CustomCodeNode {
  let node: CustomCodeNode = { kind: 'element', tag: 'span', text: 'leaf' };
  for (let at = 0; at < depth; at += 1) {
    node = { kind: 'element', tag: 'div', children: [node] };
  }
  return node;
}

describe('custom-code tree', () => {
  it('accepts a tree that mixes authored markup with a component reference', () => {
    const result = customCodeTreeSchema.safeParse({
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'section',
          className: 'min-h-screen bg-surface',
          children: [
            { kind: 'element', tag: 'h1', text: 'Reem Haddad' },
            { kind: 'component', component: 'card', props: { tone: 'muted' }, children: [] },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('has no vocabulary for a script tag, so injection is unrepresentable', () => {
    const result = customCodeTreeSchema.safeParse({
      kind: 'root',
      children: [{ kind: 'element', tag: 'script', text: 'alert(1)' }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects an event-handler attribute rather than dropping it silently', () => {
    const result = customCodeTreeSchema.safeParse({
      kind: 'root',
      children: [{ kind: 'element', tag: 'div', attributes: { onclick: 'steal()' } as never }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects an unknown property on a node — the door is strict on write', () => {
    const result = customCodeTreeSchema.safeParse({
      kind: 'root',
      children: [{ kind: 'element', tag: 'div', dangerouslySetInnerHTML: '<script/>' }],
    });

    expect(result.success).toBe(false);
  });

  it('accepts a tree at the depth ceiling and refuses one past it', () => {
    const atLimit = { kind: 'root', children: [nest(CUSTOM_CODE_MAX_DEPTH - 2)] };
    const beyond = { kind: 'root', children: [nest(CUSTOM_CODE_MAX_DEPTH + 5)] };

    expect(customCodeTreeSchema.safeParse(atLimit).success).toBe(true);
    expect(customCodeTreeSchema.safeParse(beyond).success).toBe(false);
  });

  it('refuses a flat tree past the node ceiling — depth alone does not bound size', () => {
    const flat = {
      kind: 'root',
      children: Array.from({ length: CUSTOM_CODE_MAX_NODES + 10 }, () => ({
        kind: 'element' as const,
        tag: 'span' as const,
        text: 'x',
      })),
    };

    const result = customCodeTreeSchema.safeParse(flat);

    expect(result.success).toBe(false);
  });

  it('survives the depth guard without recursing on a hostile tree', () => {
    // The guard must be iterative: a recursive one would overflow before zod ran.
    expect(() =>
      customCodeTreeSchema.safeParse({ kind: 'root', children: [nest(50_000)] }),
    ).not.toThrow();
  });

  it('is JSON-Schema representable, which is what lets a block declare it', () => {
    expect(() => z.toJSONSchema(z.object({ tree: customCodeTreeSchema }))).not.toThrow();
  });

  it('is recognised through optional and default wrappers by meta, not identity', () => {
    expect(isCustomCodeTreeSchema(customCodeTree())).toBe(true);
    expect(isCustomCodeTreeSchema(customCodeTree().optional())).toBe(true);
    expect(isCustomCodeTreeSchema(z.string())).toBe(false);
  });

  it('reports the canonical empty tree as valid', () => {
    expect(customCodeTreeSchema.safeParse(emptyCustomCodeTree()).success).toBe(true);
  });

  it('collects class names and component types for the doors that police them', () => {
    const tree = {
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'div',
          className: 'p-8',
          children: [
            { kind: 'component', component: 'card' },
            { kind: 'element', tag: 'p', className: 'text-sm' },
            { kind: 'component', component: 'button' },
            { kind: 'component', component: 'card' },
          ],
        },
      ],
    };

    expect([...customCodeClassNames(tree)].sort()).toEqual(['p-8', 'text-sm']);
    expect(customCodeComponentTypes(tree)).toEqual(['button', 'card']);
  });

  it('walks tolerantly over malformed input, because the AI door inspects unvalidated proposals', () => {
    expect(customCodeClassNames(null)).toEqual([]);
    expect(customCodeComponentTypes({ children: 'not-an-array' })).toEqual([]);
  });

  describe('icon nodes', () => {
    const withIcon = (icon: Record<string, unknown>) =>
      customCodeTreeSchema.safeParse({ kind: 'root', children: [{ kind: 'icon', ...icon }] });

    it('accepts a Lucide name with optional size, stroke, class, and label', () => {
      expect(
        withIcon({
          name: 'arrow-right',
          size: 20,
          strokeWidth: 1.5,
          className: 'text-accent',
          label: 'Next',
        }).success,
      ).toBe(true);
      expect(withIcon({ name: 'mail' }).success).toBe(true);
      expect(withIcon({ name: 'arrow-down-0-1' }).success).toBe(true);
    });

    it('refuses anything that is not a kebab-case name — an SVG surface is never opened', () => {
      for (const name of ['Mail', 'arrow--right', 'mail ', '<svg>', 'a/b', '']) {
        expect(withIcon({ name }).success, name).toBe(false);
      }
    });

    it('is a leaf: children and text are unknown keys and refused', () => {
      expect(withIcon({ name: 'mail', children: [] }).success).toBe(false);
      expect(withIcon({ name: 'mail', text: 'x' }).success).toBe(false);
    });

    it('bounds size and stroke to what a 24-unit grid can draw', () => {
      expect(withIcon({ name: 'mail', size: 4 }).success).toBe(false);
      expect(withIcon({ name: 'mail', size: 512 }).success).toBe(false);
      expect(withIcon({ name: 'mail', strokeWidth: 9 }).success).toBe(false);
    });

    it('collects icon names for the door that checks they exist', () => {
      const tree = {
        kind: 'root',
        children: [
          { kind: 'element', tag: 'div', children: [{ kind: 'icon', name: 'mail' }] },
          { kind: 'icon', name: 'globe' },
          { kind: 'icon', name: 'mail' },
        ],
      };

      expect(customCodeIconNames(tree)).toEqual(['globe', 'mail']);
      expect(customCodeIconNames(null)).toEqual([]);
    });

    it('finds an icon list with a bare item, grouped by tag and classes, never table cells', () => {
      const li = (icon: boolean) => ({
        kind: 'element',
        tag: 'li',
        className: 'flex gap-2',
        children: icon ? [{ kind: 'icon', name: 'check' }] : [],
        text: 'x',
      });
      const td = (icon: boolean) => ({ ...li(icon), tag: 'td' });
      const tree = (children: unknown[]) => ({
        kind: 'root',
        children: [{ kind: 'element', tag: 'ul', children }],
      });

      expect(customCodeIconGaps(tree([li(true), li(true), li(true), li(false)]))).toEqual([
        { tag: 'li', className: 'flex gap-2', items: 4, bare: 1 },
      ]);
      expect(customCodeIconGaps(tree([li(true), li(true), li(true)]))).toEqual([]);
      // Two items is not a row; a mostly bare row is text with an accent, not an icon list.
      expect(customCodeIconGaps(tree([li(true), li(false)]))).toEqual([]);
      expect(customCodeIconGaps(tree([li(true), li(false), li(false)]))).toEqual([]);
      // A header div beside a grid div differs in classes and is not one row.
      expect(
        customCodeIconGaps(
          tree([li(true), li(true), { ...li(false), className: 'mt-4 text-sm' }]),
        ),
      ).toEqual([]);
      expect(customCodeIconGaps(tree([td(true), td(true), td(true), td(false)]))).toEqual([]);
      expect(customCodeIconGaps(null)).toEqual([]);
    });
  });

  it('answers tag membership for the renderer read guard', () => {
    expect(isCustomCodeTag('section')).toBe(true);
    expect(isCustomCodeTag('iframe')).toBe(false);
  });
});

/*
  Design code (2026-09-28): the markup a professional section reaches for —
  a FAQ that opens, a price table, a wave divider, a muted video hero, a
  menu that opens on a phone — admitted with a per-tag policy, and still
  nothing that runs.
*/
describe('custom-code tree — design markup', () => {
  const el = (
    tag: string,
    extra: { attributes?: Record<string, string>; children?: unknown[]; text?: string } = {},
  ) => ({ kind: 'element', tag, ...extra });
  const parse = (...children: unknown[]) =>
    customCodeTreeSchema.safeParse({ kind: 'root', children });
  const messages = (...children: unknown[]) => {
    const result = parse(...children);
    return result.success ? [] : result.error.issues.map((issue) => issue.message);
  };

  it('admits a FAQ that opens without script, one answer at a time', () => {
    expect(
      parse(
        el('details', {
          attributes: { name: 'faq', open: '' },
          children: [el('summary', { text: 'Do you deliver?' }), el('p', { text: 'Daily.' })],
        }),
      ).success,
    ).toBe(true);
    expect(messages(el('details', { attributes: { open: 'false' } }))[0]).toMatch(/written bare/u);
  });

  it('admits a comparison table with header scopes and spans', () => {
    const table = el('table', {
      children: [
        el('caption', { text: 'Plans' }),
        el('thead', {
          children: [
            el('tr', { children: [el('th', { attributes: { scope: 'col' }, text: 'Pro' })] }),
          ],
        }),
        el('tbody', {
          children: [
            el('tr', {
              children: [
                el('th', { attributes: { scope: 'row' }, text: 'Seats' }),
                el('td', { attributes: { colspan: '2' }, text: '5' }),
              ],
            }),
          ],
        }),
      ],
    });
    expect(parse(table).success).toBe(true);
    expect(messages(el('td', { attributes: { scope: 'row' } }))[0]).toBe(
      'scope belongs on <th>, not <td>',
    );
  });

  it('admits an svg divider with a same-drawing gradient, case-sensitive names kept', () => {
    const wave = el('svg', {
      attributes: {
        viewBox: '0 0 1440 80',
        preserveAspectRatio: 'none',
        xmlns: 'http://www.w3.org/2000/svg',
        'aria-hidden': 'true',
      },
      children: [
        el('defs', {
          children: [
            el('linearGradient', {
              attributes: {
                id: 'ck-fade',
                x1: '0',
                x2: '0',
                y1: '0',
                y2: '1',
                gradientUnits: 'objectBoundingBox',
              },
              children: [
                el('stop', {
                  attributes: { offset: '0%', 'stop-color': 'currentColor', 'stop-opacity': '0.4' },
                }),
                el('stop', { attributes: { offset: '1', 'stop-color': 'currentColor' } }),
              ],
            }),
          ],
        }),
        el('path', {
          attributes: {
            d: 'M0 40C360 80 1080 0 1440 40V80H0Z',
            fill: 'url(#ck-fade)',
            'fill-rule': 'evenodd',
          },
        }),
        el('circle', {
          attributes: { cx: '20', cy: '20', r: '4', stroke: 'currentColor', 'stroke-width': '1.5' },
        }),
        el('polygon', { attributes: { points: '0,0 10,0 5,8', transform: 'rotate(45 5 5)' } }),
      ],
    });
    expect(parse(wave).success).toBe(true);
  });

  it('keeps an svg a closed drawing: nothing that links, loads, runs or holds markup', () => {
    for (const tag of ['use', 'image', 'foreignObject', 'script', 'animate']) {
      expect(parse(el('svg', { children: [el(tag)] })).success, tag).toBe(false);
    }
    expect(messages(el('svg', { children: [el('path', { attributes: { href: '#x' } })] }))[0]).toBe(
      'href belongs on an html element, not <path>',
    );
    expect(parse(el('svg', { children: [el('a', { attributes: { href: '/x' } })] })).success).toBe(
      false,
    );
    expect(parse(el('svg', { attributes: { style: 'x' } })).success).toBe(false);
    expect(parse(el('svg', { attributes: { onload: 'x()' } })).success).toBe(false);
    expect(
      messages(
        el('svg', {
          children: [el('path', { attributes: { fill: 'url(https://evil.test/p.svg#a)' } })],
        }),
      )[0],
    ).toMatch(/only a gradient in the same svg/u);
    expect(
      messages(el('svg', { children: [el('path', { attributes: { d: 'M0 0"/><script>' } })] }))[0],
    ).toMatch(/path data/u);
    expect(messages(el('svg', { children: [el('div')] }))[0]).toMatch(/svg holds only shapes/u);
    expect(messages(el('svg', { children: [{ kind: 'icon', name: 'mail' }] }))[0]).toMatch(
      /svg holds only shapes, not an icon/u,
    );
    expect(messages(el('path', { attributes: { d: 'M0 0' } }))[0]).toBe(
      '<path> is drawn only inside an <svg>',
    );
    expect(messages(el('svg', { children: [el('path', { text: 'hello' })] }))[0]).toMatch(
      /holds no text/u,
    );
    expect(messages(el('div', { attributes: { viewBox: '0 0 1 1' } }))[0]).toBe(
      'viewBox belongs on <svg>, not <div>',
    );
  });

  it('admits a muted, looping video hero and refuses one that would play sound', () => {
    const hero = el('video', {
      attributes: {
        autoplay: '',
        muted: '',
        loop: '',
        playsinline: '',
        preload: 'metadata',
        poster: 'https://images.example.com/poster.jpg',
        width: '1280',
        height: '720',
      },
      children: [
        el('source', {
          attributes: { src: 'https://cdn.example.com/hero.mp4', type: 'video/mp4' },
        }),
      ],
    });
    expect(parse(hero).success).toBe(true);
    expect(messages(el('video', { attributes: { autoplay: '' } }))[0]).toMatch(/is muted/u);
    expect(messages(el('video', { attributes: { poster: 'http://x.test/p.jpg' } }))[0]).toMatch(
      /https or relative/u,
    );
    expect(
      messages(
        el('video', { children: [el('source', { attributes: { src: 'javascript:alert(1)' } })] }),
      )[0],
    ).toMatch(/https or relative/u);
    expect(messages(el('source', { attributes: { src: '/a.mp4' } }))[0]).toMatch(
      /inside a <picture> or a <video>/u,
    );
  });

  it('admits responsive images and refuses an address outside the policy in any srcset candidate', () => {
    const picture = el('picture', {
      children: [
        el('source', {
          attributes: { media: '(min-width:768px)', srcset: 'https://x.test/a-1600.jpg 1600w' },
        }),
        el('img', {
          attributes: {
            src: 'https://x.test/a-800.jpg',
            srcset: 'https://x.test/a-800.jpg 800w, /a-1600.jpg 1600w',
            sizes: '(min-width:768px) 50vw, 100vw',
            loading: 'lazy',
            decoding: 'async',
            width: '800',
            height: '600',
            alt: 'A cup',
          },
        }),
      ],
    });
    expect(parse(picture).success).toBe(true);
    expect(messages(el('img', { attributes: { srcset: 'http://x.test/a.jpg 1x' } }))[0]).toMatch(
      /https or relative/u,
    );
    expect(messages(el('div', { attributes: { width: '40' } }))[0]).toMatch(/belongs on <img>/u);
    expect(messages(el('img', { attributes: { width: '100%' } }))[0]).toMatch(
      /whole number of pixels/u,
    );
    expect(messages(el('video', { attributes: { loading: 'lazy' } }))[0]).toBe(
      'loading belongs on <img>, not <video>',
    );
  });

  it('admits a declarative menu: a button opens a popover, and only a button can', () => {
    const menu = [
      el('button', { attributes: { popovertarget: 'ck-menu', 'aria-label': 'Menu' } }),
      el('nav', {
        attributes: { id: 'ck-menu', popover: '', 'aria-label': 'Sections' },
        children: [
          el('a', { attributes: { href: '#menu', 'aria-current': 'page' }, text: 'Menu' }),
        ],
      }),
      el('button', { attributes: { popovertarget: 'ck-menu', popovertargetaction: 'hide' } }),
    ];
    expect(parse(...menu).success).toBe(true);
    expect(messages(el('a', { attributes: { popovertarget: 'ck-menu' } }))[0]).toBe(
      'popovertarget belongs on <button>, not <a>',
    );
    expect(messages(el('button', { attributes: { popovertargetaction: 'close' } }))[0]).toBe(
      '<button> popovertargetaction is one of toggle, show, hide',
    );
    expect(messages(el('div', { attributes: { popover: 'always' } }))[0]).toMatch(
      /popover is one of/u,
    );
  });

  it('admits mixed-language text and the phrasing tags the recipes name', () => {
    expect(
      parse(
        el('p', {
          attributes: { lang: 'ar', dir: 'rtl' },
          children: [
            el('span', { attributes: { lang: 'en', dir: 'ltr' }, text: 'Hail Roastery' }),
            el('abbr', { attributes: { title: 'Specialty Coffee Association' }, text: 'SCA' }),
            ...['b', 'i', 's', 'mark', 'cite', 'q'].map((tag) => el(tag, { text: tag })),
          ],
        }),
        el('dl', { children: [el('dt', { text: 'Roast' }), el('dd', { text: 'Medium' })] }),
        el('address', { text: 'Rainbow St, Amman' }),
      ).success,
    ).toBe(true);
    expect(messages(el('span', { attributes: { dir: 'right' } }))[0]).toBe(
      '<span> dir is one of ltr, rtl, auto',
    );
  });

  it('reports only the first few problems, each with its path, so the refusal stays one instruction', () => {
    const result = parse(
      el('div', {
        children: Array.from({ length: 20 }, () => el('a', { attributes: { popovertarget: 'x' } })),
      }),
    );
    expect(result.success).toBe(false);
    const issues = result.success ? [] : result.error.issues;
    expect(issues.length).toBeLessThanOrEqual(8);
    expect(issues[0]?.path).toEqual(['children', 0, 'children', 0, 'attributes', 'popovertarget']);
  });

  it('states every tag and attribute in the JSON Schema the prompt derives its vocabulary from', () => {
    const json = JSON.stringify(z.toJSONSchema(z.object({ tree: customCodeTreeSchema })));
    for (const name of [
      'details',
      'linearGradient',
      'video',
      'viewBox',
      'popovertarget',
      'stroke-width',
    ]) {
      expect(json).toContain(`"${name}"`);
    }
    expect(
      CUSTOM_CODE_SVG_TAGS.every((tag) => (CUSTOM_CODE_TAGS as readonly string[]).includes(tag)),
    ).toBe(true);
    expect(
      CUSTOM_CODE_SVG_ATTRIBUTES.every((name) =>
        (CUSTOM_CODE_ATTRIBUTES as readonly string[]).includes(name),
      ),
    ).toBe(true);
    expect(new Set(CUSTOM_CODE_ATTRIBUTES).size).toBe(CUSTOM_CODE_ATTRIBUTES.length);
    expect(new Set(CUSTOM_CODE_TAGS).size).toBe(CUSTOM_CODE_TAGS.length);
  });

  it('folds case and React spellings back to the vocabulary', () => {
    expect(customCodeTagSpelling('lineargradient')).toBe('linearGradient');
    expect(customCodeTagSpelling('DIV')).toBe('div');
    expect(customCodeTagSpelling('iframe')).toBeUndefined();
    expect(customCodeAttributeSpelling('viewbox')).toBe('viewBox');
    expect(customCodeAttributeSpelling('strokeWidth')).toBe('stroke-width');
    expect(customCodeAttributeSpelling('srcSet')).toBe('srcset');
    expect(customCodeAttributeSpelling('popoverTarget')).toBe('popovertarget');
    expect(customCodeAttributeSpelling('className')).toBeUndefined();
    expect(isCustomCodeSvgTag('path')).toBe(true);
    expect(isCustomCodeSvgTag('div')).toBe(false);
  });

  it('reads srcset candidates the way a browser does, data URL commas included', () => {
    expect(customCodeSrcsetUrls('/a.jpg 1x, /b.jpg 2x')).toEqual(['/a.jpg', '/b.jpg']);
    // A comma ends a candidate only where it trails an address (HTML's srcset algorithm)…
    expect(customCodeSrcsetUrls('/a.jpg, /b.jpg 640w')).toEqual(['/a.jpg', '/b.jpg']);
    // …inside one it is part of the address, as a browser reads it: one relative path.
    expect(customCodeSrcsetUrls('/a.jpg,/b.jpg 640w')).toEqual(['/a.jpg,/b.jpg']);
    expect(customCodeSrcsetUrls('data:image/png;base64,AAAA 1x')).toEqual([
      'data:image/png;base64,AAAA',
    ]);
    expect(customCodeSrcsetUrls('/a.jpg huge')).toBeUndefined();
    expect(customCodeSrcsetUrls('   ')).toBeUndefined();
    expect(safeCustomCodeUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeCustomCodeUrl(' https://x.test/a.jpg ')).toBe('https://x.test/a.jpg');
  });

  it('lets an existing tree stand: the first vocabulary is unchanged', () => {
    expect(
      parse(
        el('div', { attributes: { alt: 'x', title: 't', role: 'img', id: 'a' } }),
        el('img', {
          attributes: { src: 'http://legacy.test/a.jpg', alt: 'kept for the read-time policy' },
        }),
        el('time', { attributes: { datetime: '2026-09-28' }, text: 'Today' }),
      ).success,
    ).toBe(true);
    expect(customCodeTreeProblems({ kind: 'root', children: 'nope' })).toEqual([]);
    expect(customCodeAttributeProblem('p', 'onclick', 'x')).toMatch(/not an attribute/u);
  });
});
