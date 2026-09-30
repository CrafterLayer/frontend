import { describe, expect, it } from 'vitest';

import { customCodeTreeSchema } from '@craftkit/builder-schema';

import { normalizeAiPlanTrees, readAiPlanTreeMarkup } from './normalize-plan';

function planWith(children: unknown[]) {
  return {
    rationale: 'fill a region',
    commands: [
      {
        command: 'setProp',
        args: { id: 'pg-0006', key: 'tree', value: { kind: 'root', children } },
        title: 'Drinks',
      },
    ],
  };
}

function treeOf(plan: unknown): unknown {
  return (plan as ReturnType<typeof planWith>).commands[0]?.args.value;
}

/*
  Measured 2026-09-27: a whole section plan was refused — and re-requested for
  another 25-40 seconds — because one tree used `border-emerald-900/20`, an
  ordinary Tailwind class the site vocabulary happens not to generate. A class
  with no CSS renders as nothing; removing it before the door costs the section
  that one class instead of the whole section.
*/
describe('normalizeAiPlanTrees', () => {
  it('removes the classes that have no generated CSS and keeps the rest', () => {
    const result = normalizeAiPlanTrees(
      planWith([
        {
          kind: 'element',
          tag: 'section',
          className: 'py-24 border-emerald-900/20 totally-made-up bg-stone-50',
        },
      ]),
    );

    expect(treeOf(result.plan)).toEqual({
      kind: 'root',
      children: [{ kind: 'element', tag: 'section', className: 'py-24 bg-stone-50' }],
    });
    expect(result.removedClasses).toEqual(['border-emerald-900/20', 'totally-made-up']);
  });

  it('keeps the region-local ck- classes a tree styles in its own css', () => {
    const result = normalizeAiPlanTrees(
      planWith([{ kind: 'element', tag: 'div', className: 'ck-hero-glow p-4' }]),
    );

    expect(result.removedClasses).toEqual([]);
    expect(treeOf(result.plan)).toEqual({
      kind: 'root',
      children: [{ kind: 'element', tag: 'div', className: 'ck-hero-glow p-4' }],
    });
  });

  it('drops a className that had nothing usable left in it', () => {
    const result = normalizeAiPlanTrees(
      planWith([{ kind: 'element', tag: 'p', className: 'made-up-one made-up-two', text: 'Hi' }]),
    );

    expect(treeOf(result.plan)).toEqual({
      kind: 'root',
      children: [{ kind: 'element', tag: 'p', text: 'Hi' }],
    });
  });

  it('cleans nested children and icon classes too', () => {
    const result = normalizeAiPlanTrees(
      planWith([
        {
          kind: 'element',
          tag: 'ul',
          children: [
            {
              kind: 'element',
              tag: 'li',
              className: 'text-emerald-900/70 flex',
              children: [{ kind: 'icon', name: 'coffee', className: 'nope-class size-5' }],
            },
          ],
        },
      ]),
    );

    expect(result.removedClasses).toEqual(['text-emerald-900/70', 'nope-class']);
    expect(JSON.stringify(result.plan)).not.toContain('nope-class');
    expect(JSON.stringify(result.plan)).toContain('"name":"coffee"');
  });

  it('swaps an icon the Lucide set does not have for a neutral one, so the row keeps its rhythm', () => {
    const result = normalizeAiPlanTrees(
      planWith([
        {
          kind: 'element',
          tag: 'div',
          children: [
            { kind: 'icon', name: 'definitely-not-an-icon', size: 20 },
            { kind: 'element', tag: 'span', text: 'Open daily' },
          ],
        },
      ]),
    );

    expect(result.removedIcons).toEqual(['definitely-not-an-icon']);
    expect(treeOf(result.plan)).toEqual({
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'div',
          children: [
            { kind: 'icon', name: 'sparkles', size: 20 },
            { kind: 'element', tag: 'span', text: 'Open daily' },
          ],
        },
      ],
    });
  });

  it('keeps the last service card iconned: an unknown name becomes the nearest one the set has', () => {
    // Final test 2026-09-30: `tooth` is not in Lucide; dropping it left one card of four bare.
    const result = normalizeAiPlanTrees(
      planWith([
        { kind: 'icon', name: 'tooth-sparkle' },
        { kind: 'icon', name: 'tooth' },
      ]),
    );
    expect(treeOf(result.plan)).toEqual({
      kind: 'root',
      children: [
        { kind: 'icon', name: 'sparkle' },
        { kind: 'icon', name: 'sparkles' },
      ],
    });
    expect(result.adjustments).toEqual(['icon tooth-sparkle → sparkle', 'icon tooth → sparkles']);
  });

  it('returns the very same plan when there is nothing to clean', () => {
    const plan = planWith([{ kind: 'element', tag: 'h2', className: 'text-3xl', text: 'Menu' }]);
    const result = normalizeAiPlanTrees(plan);

    expect(result.plan).toBe(plan);
    expect(result.removedClasses).toEqual([]);
    expect(result.removedIcons).toEqual([]);
  });

  it('leaves anything that is not a plan untouched', () => {
    for (const value of [null, 'text', 42, { rationale: 'x' }, []]) {
      expect(normalizeAiPlanTrees(value).plan).toBe(value);
    }
  });

  it('finds trees wherever the args carry them', () => {
    const plan = {
      rationale: 'insert',
      commands: [
        {
          command: 'insertNode',
          args: {
            type: 'customCode',
            parentId: 'root',
            props: {
              tree: {
                kind: 'root',
                children: [{ kind: 'element', tag: 'div', className: 'x-y-z p-2' }],
              },
            },
          },
        },
      ],
    };

    expect(JSON.stringify(normalizeAiPlanTrees(plan).plan)).toContain('"className":"p-2"');
  });
});

describe('normalizeAiPlanTrees — the tree vocabulary', () => {
  /*
    2026-09-27: a contact section built as a form (form, label, input,
    textarea) was refused whole as "Invalid input". The vocabulary has no
    controls on purpose; the section's words and layout still belong on the page.
  */
  it('keeps a form section as layout and drops the controls nothing could wire up', () => {
    const result = normalizeAiPlanTrees(
      planWith([
        {
          kind: 'element',
          tag: 'form',
          className: 'grid gap-4',
          children: [
            { kind: 'element', tag: 'label', text: 'Your name' },
            { kind: 'element', tag: 'input', className: 'border-2' },
            { kind: 'element', tag: 'textarea' },
            { kind: 'element', tag: 'button', text: 'Send' },
          ],
        },
      ]),
    );

    expect(treeOf(result.plan)).toEqual({
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'div',
          className: 'grid gap-4',
          children: [
            { kind: 'element', tag: 'span', text: 'Your name' },
            { kind: 'element', tag: 'button', text: 'Send' },
          ],
        },
      ],
    });
    expect(result.adjustments).toEqual(
      expect.arrayContaining(['form → div', 'label → span', 'dropped input', 'dropped textarea']),
    );
  });

  // b and i joined the vocabulary on 2026-09-28; before, they became strong and em.
  it('keeps b and i as written, folding only their case', () => {
    const result = normalizeAiPlanTrees(
      planWith([
        { kind: 'element', tag: 'b', text: 'Bold' },
        { kind: 'element', tag: 'I', text: 'Lean' },
      ]),
    );

    expect(treeOf(result.plan)).toEqual({
      kind: 'root',
      children: [
        { kind: 'element', tag: 'b', text: 'Bold' },
        { kind: 'element', tag: 'i', text: 'Lean' },
      ],
    });
  });

  it('moves an attribute written beside the tag into attributes, and drops what is not one', () => {
    const result = normalizeAiPlanTrees(
      planWith([
        {
          kind: 'element',
          tag: 'a',
          href: '#menu',
          text: 'Menu',
          attributes: { rel: 'nofollow', 'aria-label': 'Open the menu', width: 40 },
        },
      ]),
    );

    expect(treeOf(result.plan)).toEqual({
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'a',
          text: 'Menu',
          attributes: { 'aria-label': 'Open the menu', href: '#menu' },
        },
      ],
    });
  });

  it('bounds icon numbers to what the schema admits and drops unknown icon keys', () => {
    const result = normalizeAiPlanTrees(
      planWith([{ kind: 'icon', name: 'coffee', size: 400.5, strokeWidth: 9, color: 'red' }]),
    );

    expect(treeOf(result.plan)).toEqual({
      kind: 'root',
      children: [{ kind: 'icon', name: 'coffee', size: 256, strokeWidth: 4 }],
    });
  });

  it('turns a text node and a kind-less element into vocabulary elements', () => {
    const result = normalizeAiPlanTrees(
      planWith([
        { kind: 'text', text: 'Hello' },
        { tag: 'p', text: 'World' },
      ]),
    );

    expect(treeOf(result.plan)).toEqual({
      kind: 'root',
      children: [
        { kind: 'element', tag: 'span', text: 'Hello' },
        { kind: 'element', tag: 'p', text: 'World' },
      ],
    });
  });

  it('leaves a vocabulary-clean tree with attributes as the very same object', () => {
    const plan = planWith([
      {
        kind: 'element',
        tag: 'img',
        className: 'rounded-2xl',
        attributes: { src: 'https://example.com/a.jpg', alt: 'A cup' },
      },
    ]);

    expect(normalizeAiPlanTrees(plan).plan).toBe(plan);
  });
});

describe('normalizeAiPlanTrees — one setProp per prop', () => {
  it('splits a css key written inside the tree setProp into its own setProp', () => {
    const tree = {
      kind: 'root',
      children: [{ kind: 'element', tag: 'div', className: 'ck-glow' }],
    };
    const result = normalizeAiPlanTrees({
      rationale: 'fill',
      commands: [
        {
          command: 'setProp',
          args: { id: 'pg-5', key: 'tree', value: tree, css: '.ck-glow{filter:blur(40px)}' },
          title: 'Hero',
        },
      ],
    });

    expect(result.plan).toEqual({
      rationale: 'fill',
      commands: [
        { command: 'setProp', args: { id: 'pg-5', key: 'tree', value: tree }, title: 'Hero' },
        {
          command: 'setProp',
          args: { id: 'pg-5', key: 'css', value: '.ck-glow{filter:blur(40px)}' },
        },
      ],
    });
    expect(result.adjustments).toContain('split css into its own setProp');
  });

  it('leaves a setProp that is already one prop untouched', () => {
    const plan = {
      rationale: 'r',
      commands: [{ command: 'setProp', args: { id: 'a', key: 'k', value: 1 } }],
    };
    expect(normalizeAiPlanTrees(plan).plan).toBe(plan);
  });
});

describe('normalizeAiPlanTrees — trees written as markup', () => {
  it('reads a setProp tree written as markup into the tree, then cleans it', () => {
    const result = normalizeAiPlanTrees({
      rationale: 'fill',
      commands: [
        {
          command: 'setProp',
          args: {
            id: 'pg-6',
            key: 'tree',
            value:
              "<section class='py-16 totally-made-up'><form><h2>تواصل</h2><input></form></section>",
          },
        },
      ],
    });

    expect(treeOf(result.plan)).toEqual({
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'section',
          className: 'py-16',
          children: [
            {
              kind: 'element',
              tag: 'div',
              children: [{ kind: 'element', tag: 'h2', text: 'تواصل' }],
            },
          ],
        },
      ],
    });
    expect(result.adjustments).toContain('read tree markup');
  });

  it('reads an insertNode tree prop written as markup', () => {
    const result = normalizeAiPlanTrees({
      rationale: 'insert',
      commands: [
        {
          command: 'insertNode',
          args: {
            type: 'customCode',
            parentId: 'root',
            props: { label: 'Menu', tree: "<section><h2 class='text-3xl'>Menu</h2></section>" },
          },
        },
      ],
    });

    expect(JSON.stringify(result.plan)).toContain(
      '"tree":{"kind":"root","children":[{"kind":"element","tag":"section","children":[{"kind":"element","tag":"h2","className":"text-3xl","text":"Menu"}]}]}',
    );
  });

  it('reads ck-component into a component reference, never a div', () => {
    const result = normalizeAiPlanTrees({
      rationale: 'fill',
      commands: [
        {
          command: 'setProp',
          args: {
            id: 'pg-6',
            key: 'tree',
            value:
              "<section class='py-16'><h2>Contact</h2><ck-component type='contact' props='{\"email\":\"a@b.co\"}'></ck-component></section>",
          },
        },
      ],
    });

    expect(treeOf(result.plan)).toEqual({
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'section',
          className: 'py-16',
          children: [
            { kind: 'element', tag: 'h2', text: 'Contact' },
            { kind: 'component', component: 'contact', props: { email: 'a@b.co' } },
          ],
        },
      ],
    });
    expect(result.adjustments).not.toContain('ck-component → div');
  });

  it('leaves a tag that names a registered block for the door to refuse, instead of an empty div', () => {
    const result = normalizeAiPlanTrees(
      {
        rationale: 'fill',
        commands: [
          {
            command: 'setProp',
            args: {
              id: 'pg-6',
              key: 'tree',
              value: '<section><contact></contact><formSection/><aside>kept</aside></section>',
            },
          },
        ],
      },
      'free',
      ['contact', 'formSection'],
    );

    expect(JSON.stringify(treeOf(result.plan))).toBe(
      '{"kind":"root","children":[{"kind":"element","tag":"section","children":[{"kind":"element","tag":"contact"},{"kind":"element","tag":"formsection"},{"kind":"element","tag":"aside","text":"kept"}]}]}',
    );
    expect(result.adjustments.join(' ')).not.toMatch(/contact → div|formsection → div/u);
  });

  it('leaves a label or any other string prop alone even when it starts with <', () => {
    const plan = {
      rationale: 'r',
      commands: [{ command: 'setProp', args: { id: 'a', key: 'label', value: '<3 coffee' } }],
    };
    expect(normalizeAiPlanTrees(plan).plan).toBe(plan);
  });
});

/*
  Markup is a spelling, not a vocabulary rule: the context always tells the
  model to write trees as markup, so a host that turns the vocabulary check
  off must still have them read — or every tree reaches the door as a string.
*/
describe('readAiPlanTreeMarkup', () => {
  it('reads every tree written as markup and cleans nothing else', () => {
    const plan = {
      rationale: 'fill',
      commands: [
        {
          command: 'setProp',
          args: {
            id: 'a',
            key: 'tree',
            value: "<section class='made-up-class'><form>x</form></section>",
          },
        },
        {
          command: 'insertNode',
          args: { type: 'customCode', parentId: 'root', props: { tree: '<p>Hi</p>' } },
        },
        { command: 'setProp', args: { id: 'a', key: 'label', value: '<3 coffee' } },
      ],
    };

    expect(readAiPlanTreeMarkup(plan)).toEqual({
      rationale: 'fill',
      commands: [
        {
          command: 'setProp',
          args: {
            id: 'a',
            key: 'tree',
            value: {
              kind: 'root',
              children: [
                {
                  kind: 'element',
                  tag: 'section',
                  className: 'made-up-class',
                  children: [{ kind: 'element', tag: 'form', text: 'x' }],
                },
              ],
            },
          },
        },
        {
          command: 'insertNode',
          args: {
            type: 'customCode',
            parentId: 'root',
            props: {
              tree: { kind: 'root', children: [{ kind: 'element', tag: 'p', text: 'Hi' }] },
            },
          },
        },
        { command: 'setProp', args: { id: 'a', key: 'label', value: '<3 coffee' } },
      ],
    });
  });

  it('returns the very same plan when no tree is written as markup', () => {
    const plan = {
      rationale: 'r',
      commands: [{ command: 'setProp', args: { id: 'a', key: 'k', value: 1 } }],
    };
    expect(readAiPlanTreeMarkup(plan)).toBe(plan);
  });
});

/*
  Design markup (2026-09-28): the vocabulary now holds disclosure, tables,
  media and an svg shape family, each with a per-tag policy. The normalizer
  keeps them as written and drops only what the door would refuse where it
  stands — a refusal is a 25-40 s repair round (measured 2026-09-27), and an
  attribute that could never do what it says loses the page nothing.
*/
describe('normalizeAiPlanTrees — design markup', () => {
  const el = (tag: string, extra: Record<string, unknown> = {}) => ({
    kind: 'element',
    tag,
    ...extra,
  });

  it('keeps a FAQ, a table, a picture and a muted video exactly as written', () => {
    const children = [
      el('details', {
        attributes: { name: 'faq', open: '' },
        children: [
          el('summary', { text: 'Parking?' }),
          el('p', { text: 'Free, behind the shop.' }),
        ],
      }),
      el('table', {
        children: [
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
      }),
      el('picture', {
        children: [
          el('source', {
            attributes: { media: '(min-width:768px)', srcset: 'https://x.test/w.jpg 1600w' },
          }),
          el('img', {
            attributes: {
              src: 'https://x.test/a.jpg',
              alt: 'A cup',
              loading: 'lazy',
              width: '800',
              height: '600',
            },
          }),
        ],
      }),
      el('video', {
        attributes: {
          autoplay: '',
          muted: '',
          loop: '',
          playsinline: '',
          poster: 'https://x.test/p.jpg',
        },
        children: [
          el('source', { attributes: { src: 'https://x.test/v.mp4', type: 'video/mp4' } }),
        ],
      }),
    ];
    const plan = planWith(children);
    const result = normalizeAiPlanTrees(plan);

    expect(result.plan).toBe(plan);
    expect(result.adjustments).toEqual([]);
    expect(customCodeTreeSchema.safeParse(treeOf(plan)).success).toBe(true);
  });

  it('respells svg names and React spellings the way the vocabulary spells them', () => {
    const result = normalizeAiPlanTrees(
      planWith([
        el('SVG', {
          attributes: { viewbox: '0 0 10 10', 'aria-hidden': 'true' },
          children: [
            el('lineargradient', {
              attributes: { id: 'ck-fade', gradientunits: 'objectBoundingBox' },
              children: [el('stop', { attributes: { offset: 0, stopColor: 'currentColor' } })],
            }),
            el('path', { attributes: { d: 'M0 0H10', strokeWidth: 2, fill: 'url(#ck-fade)' } }),
          ],
        }),
        el('img', {
          attributes: { src: '/a.jpg', alt: '', srcSet: '/a.jpg 1x, /a2.jpg 2x', width: '640px' },
        }),
      ]),
    );

    const tree = treeOf(result.plan);
    expect(tree).toEqual({
      kind: 'root',
      children: [
        el('svg', {
          attributes: { viewBox: '0 0 10 10', 'aria-hidden': 'true' },
          children: [
            el('linearGradient', {
              attributes: { id: 'ck-fade', gradientUnits: 'objectBoundingBox' },
              children: [el('stop', { attributes: { offset: '0', 'stop-color': 'currentColor' } })],
            }),
            el('path', {
              attributes: { d: 'M0 0H10', 'stroke-width': '2', fill: 'url(#ck-fade)' },
            }),
          ],
        }),
        el('img', {
          attributes: { src: '/a.jpg', alt: '', srcset: '/a.jpg 1x, /a2.jpg 2x', width: '640' },
        }),
      ],
    });
    expect(result.adjustments).toEqual(
      expect.arrayContaining([
        'SVG → svg',
        'lineargradient → linearGradient',
        'viewbox → viewBox',
        'strokeWidth → stroke-width',
      ]),
    );
    expect(customCodeTreeSchema.safeParse(tree).success).toBe(true);
  });

  it('keeps a drawing closed: only shapes inside an svg, and no shape outside one', () => {
    const result = normalizeAiPlanTrees(
      planWith([
        el('svg', {
          attributes: { viewBox: '0 0 10 10' },
          text: 'stray words',
          children: [
            el('use', { attributes: { href: '#logo' } }),
            el('foreignObject', { children: [el('div', { text: 'html in a drawing' })] }),
            el('text', { text: 'Hello' }),
            el('div'),
            { kind: 'icon', name: 'coffee' },
            { kind: 'text', text: 'loose' },
            el('path', { attributes: { d: 'M0 0', href: '#x' }, children: [el('circle')] }),
          ],
        }),
        el('path', { attributes: { d: 'M0 0' } }),
      ]),
    );

    const tree = treeOf(result.plan);
    expect(tree).toEqual({
      kind: 'root',
      children: [
        el('svg', {
          attributes: { viewBox: '0 0 10 10' },
          children: [el('path', { attributes: { d: 'M0 0' } })],
        }),
      ],
    });
    expect(result.adjustments).toEqual(
      expect.arrayContaining([
        'dropped text in svg',
        'dropped use',
        'dropped foreignObject',
        'dropped div',
        'dropped icon inside svg',
        'dropped text inside svg',
        'dropped what was drawn inside path',
        'dropped path',
      ]),
    );
    expect(customCodeTreeSchema.safeParse(tree).success).toBe(true);
  });

  it('drops an attribute the door would refuse where it stands, and says why', () => {
    const result = normalizeAiPlanTrees(
      planWith([
        el('a', { attributes: { href: '#menu', popovertarget: 'ck-menu' }, text: 'Menu' }),
        el('div', { attributes: { width: '40', viewBox: '0 0 1 1' } }),
        el('img', { attributes: { src: '/a.jpg', alt: '', srcset: 'http://x.test/a.jpg 2x' } }),
        el('details', { attributes: { open: false, name: 'faq' } }),
        el('source', { attributes: { src: '/v.mp4' } }),
      ]),
    );

    const tree = treeOf(result.plan);
    expect(tree).toEqual({
      kind: 'root',
      children: [
        el('a', { attributes: { href: '#menu' }, text: 'Menu' }),
        el('div'),
        el('img', { attributes: { src: '/a.jpg', alt: '' } }),
        el('details', { attributes: { name: 'faq' } }),
      ],
    });
    expect(result.adjustments).toEqual(
      expect.arrayContaining([
        'dropped attribute popovertarget: popovertarget belongs on <button>, not <a>',
        'dropped source outside picture or video',
      ]),
    );
    expect(customCodeTreeSchema.safeParse(tree).success).toBe(true);
  });

  it('mutes a video that plays by itself, and writes boolean attributes bare', () => {
    const result = normalizeAiPlanTrees(
      planWith([
        el('video', {
          attributes: { autoplay: true, loop: 'true', controls: 'false', src: '/v.mp4' },
        }),
      ]),
    );

    expect(treeOf(result.plan)).toEqual({
      kind: 'root',
      children: [
        el('video', { attributes: { autoplay: '', loop: 'true', src: '/v.mp4', muted: '' } }),
      ],
    });
    expect(result.adjustments).toContain('muted the autoplaying video');
    expect(customCodeTreeSchema.safeParse(treeOf(result.plan)).success).toBe(true);
  });

  it('reads a popover menu written as markup and keeps it whole', () => {
    const markup =
      "<header id='top'><button aria-label='Menu' popovertarget='ck-nav'><svg viewBox='0 0 24 24' aria-hidden='true' fill='none' stroke='currentColor' stroke-width='2'><path d='M4 6h16M4 12h16M4 18h16'/></svg></button>" +
      "<nav id='ck-nav' popover=''><button popovertarget='ck-nav' popovertargetaction='hide' aria-label='Close'>×</button><a href='#menu'>Menu</a></nav></header>";
    const result = normalizeAiPlanTrees({
      rationale: 'r',
      commands: [{ command: 'setProp', args: { id: 'a', key: 'tree', value: markup } }],
    });

    const tree = (result.plan as { commands: { args: { value: unknown } }[] }).commands[0]?.args
      .value;
    expect(result.adjustments).toEqual(['read tree markup']);
    expect(customCodeTreeSchema.safeParse(tree).success).toBe(true);
    expect(JSON.stringify(tree)).toContain('"popovertargetaction":"hide"');
    expect(JSON.stringify(tree)).toContain('"viewBox":"0 0 24 24"');
  });
});

/*
  Final test, 2026-09-29: a writer's delivery card on an Arabic page showed the
  phone as "0000 9000 7 962+" — an unisolated left-to-right run inside a
  right-to-left line. The skeleton isolates the numbers it writes; a writer's
  card did not.
*/
describe('normalizeAiPlanTrees — phone numbers keep their order', () => {
  const LRI = '⁦';
  const PDI = '⁩';
  const el = (tag: string, extra: Record<string, unknown> = {}) => ({
    kind: 'element',
    tag,
    ...extra,
  });

  it('wraps every phone-shaped run in a text in LTR isolates, and nothing else', () => {
    const result = normalizeAiPlanTrees(
      planWith([
        el('p', { text: 'اتصل بنا: +962 7 9000 0000 أو 06 555 1234' }),
        el('a', { attributes: { href: 'tel:+96279000000' }, text: '(06) 555-1234' }),
        el('span', { text: '+٩٦٢ ٧ ٩٠٠٠ ٠٠٠٠' }),
        { kind: 'text', text: '0790000000' },
      ]),
    );

    expect(treeOf(result.plan)).toEqual({
      kind: 'root',
      children: [
        el('p', { text: `اتصل بنا: ${LRI}+962 7 9000 0000${PDI} أو ${LRI}06 555 1234${PDI}` }),
        el('a', { attributes: { href: 'tel:+96279000000' }, text: `${LRI}(06) 555-1234${PDI}` }),
        el('span', { text: `${LRI}+٩٦٢ ٧ ٩٠٠٠ ٠٠٠٠${PDI}` }),
        el('span', { text: `${LRI}0790000000${PDI}` }),
      ],
    });
    expect(result.adjustments).toContain('isolated a phone number');
    expect(customCodeTreeSchema.safeParse(treeOf(result.plan)).success).toBe(true);
  });

  it('leaves prices, years, hours and already-isolated numbers exactly as written', () => {
    const plan = planWith([
      el('p', { text: '1,250,000 د.ا' }),
      el('p', { text: 'منذ 1998 - 2024' }),
      el('p', { text: '08.00 - 22.00' }),
      el('p', { text: `${LRI}+962 7 9000 0000${PDI}` }),
      el('span', { attributes: { dir: 'ltr' }, text: '+962 7 9000 0000' }),
      el('p', { text: 'Order 12345' }),
    ]);

    expect(normalizeAiPlanTrees(plan).plan).toBe(plan);
  });

  it('isolates only once, however often a plan is normalized', () => {
    const once = normalizeAiPlanTrees(planWith([el('p', { text: '+962 7 9000 0000' })])).plan;

    expect(normalizeAiPlanTrees(once).plan).toBe(once);
  });

  it("keeps a bdi's isolation when it becomes a span", () => {
    const result = normalizeAiPlanTrees(
      planWith([
        el('bdi', { text: 'Hail Roastery' }),
        el('bdi', { attributes: { dir: 'rtl' }, text: 'حيّ' }),
      ]),
    );

    expect(treeOf(result.plan)).toEqual({
      kind: 'root',
      children: [
        el('span', { attributes: { dir: 'auto' }, text: 'Hail Roastery' }),
        el('span', { attributes: { dir: 'rtl' }, text: 'حيّ' }),
      ],
    });
  });
});
