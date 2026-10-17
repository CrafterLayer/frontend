import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { CUSTOM_CODE_TAGS, customCodeTreeSchema } from '@craftkit/builder-schema';

import { isTreeMarkup, parseTreeMarkup, serializeTreeMarkup } from './tree-markup';

describe('parseTreeMarkup', () => {
  it('reads elements, classes and attributes into the tree shape', () => {
    const tree = parseTreeMarkup(
      "<section class='py-16 md:py-24'><div class='mx-auto max-w-6xl'><h2 class='text-4xl font-bold'>قائمة المشروبات</h2><a href='#menu' class='rounded-full bg-amber-600 px-6 py-3'>اطلب الآن</a></div></section>",
    );

    expect(tree).toEqual({
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'section',
          className: 'py-16 md:py-24',
          children: [
            {
              kind: 'element',
              tag: 'div',
              className: 'mx-auto max-w-6xl',
              children: [
                {
                  kind: 'element',
                  tag: 'h2',
                  className: 'text-4xl font-bold',
                  text: 'قائمة المشروبات',
                },
                {
                  kind: 'element',
                  tag: 'a',
                  className: 'rounded-full bg-amber-600 px-6 py-3',
                  attributes: { href: '#menu' },
                  text: 'اطلب الآن',
                },
              ],
            },
          ],
        },
      ],
    });
    expect(customCodeTreeSchema.safeParse(tree).success).toBe(true);
  });

  it('reads an icon as a leaf, with its size and label', () => {
    const tree = parseTreeMarkup(
      "<li class='flex gap-2'><icon name='coffee' class='size-5 text-amber-600' size='20' label='Coffee'/>إسبريسو</li>",
    );

    expect(tree.children[0]).toEqual({
      kind: 'element',
      tag: 'li',
      className: 'flex gap-2',
      children: [
        {
          kind: 'icon',
          name: 'coffee',
          className: 'size-5 text-amber-600',
          size: 20,
          label: 'Coffee',
        },
        { kind: 'element', tag: 'span', text: 'إسبريسو' },
      ],
    });
  });

  it('lifts content a model wrote inside an unclosed icon out after it', () => {
    const tree = parseTreeMarkup("<p><icon name='star'><strong>4.9</strong> rating</p>");

    expect(tree.children[0]).toEqual({
      kind: 'element',
      tag: 'p',
      children: [
        { kind: 'icon', name: 'star' },
        { kind: 'element', tag: 'strong', text: '4.9' },
        { kind: 'element', tag: 'span', text: ' rating' },
      ],
    });
  });

  it('keeps mixed text in reading order, because the renderer draws text first', () => {
    const tree = parseTreeMarkup(
      '<p>Open <strong>daily</strong> from 7am <em>until late</em>.</p>',
    );

    expect(tree.children[0]).toEqual({
      kind: 'element',
      tag: 'p',
      text: 'Open ',
      children: [
        { kind: 'element', tag: 'strong', text: 'daily' },
        { kind: 'element', tag: 'span', text: ' from 7am ' },
        { kind: 'element', tag: 'em', text: 'until late' },
        { kind: 'element', tag: 'span', text: '.' },
      ],
    });
  });

  it('drops layout whitespace between blocks and keeps word spaces between inline nodes', () => {
    const tree = parseTreeMarkup(`
      <div>
        <h3>Title</h3>
        <p><strong>A</strong> <em>B</em></p>
      </div>
    `);

    expect(tree.children).toEqual([
      {
        kind: 'element',
        tag: 'div',
        children: [
          { kind: 'element', tag: 'h3', text: 'Title' },
          {
            kind: 'element',
            tag: 'p',
            children: [
              { kind: 'element', tag: 'strong', text: 'A' },
              { kind: 'element', tag: 'span', text: ' ' },
              { kind: 'element', tag: 'em', text: 'B' },
            ],
          },
        ],
      },
    ]);
  });

  it('closes what a model left open, the way a browser would', () => {
    const tree = parseTreeMarkup("<section><div class='grid'><p>One<p>Two</div>");

    expect(customCodeTreeSchema.safeParse(tree).success).toBe(true);
    expect(JSON.stringify(tree)).toContain('"text":"One"');
    expect(JSON.stringify(tree)).toContain('"text":"Two"');
  });

  it('decodes entities and reads void elements as leaves', () => {
    const tree = parseTreeMarkup(
      "<figure><img src='https://example.com/cup.jpg' alt='A cup &amp; saucer'><figcaption>Fresh &mdash; daily</figcaption></figure>",
    );

    expect(tree.children[0]).toEqual({
      kind: 'element',
      tag: 'figure',
      children: [
        {
          kind: 'element',
          tag: 'img',
          attributes: { src: 'https://example.com/cup.jpg', alt: 'A cup & saucer' },
        },
        { kind: 'element', tag: 'figcaption', text: 'Fresh — daily' },
      ],
    });
  });

  it('never produces a script: an unknown tag is a candidate the door still refuses', () => {
    const tree = parseTreeMarkup('<div><script>alert(1)</script></div>');

    expect(customCodeTreeSchema.safeParse(tree).success).toBe(false);
  });
});

describe('isTreeMarkup', () => {
  it('recognises markup and nothing else', () => {
    expect(isTreeMarkup("  <section class='x'></section>")).toBe(true);
    expect(isTreeMarkup('plain words')).toBe(false);
    expect(isTreeMarkup({ kind: 'root', children: [] })).toBe(false);
  });
});

describe('serializeTreeMarkup', () => {
  const samples = [
    "<section class='py-16 md:py-24'><div class='mx-auto max-w-6xl'><h2 class='text-4xl'>قائمة المشروبات</h2><ul class='grid gap-4'><li class='flex gap-2'><icon name='coffee' class='size-5' size='20'/><span>إسبريسو</span><strong>1.75</strong></li></ul></div></section>",
    '<p>Open <strong>daily</strong><span> from 7am </span><em>until late</em><span>.</span></p>',
    "<figure><img alt='A cup &amp; saucer' src='https://example.com/cup.jpg'/><figcaption>Fresh — daily</figcaption></figure>",
    "<a class='rounded-full px-6' href='#menu' target='_blank'>Rock &amp; roll &lt;3</a>",
  ];

  it('writes back exactly the tree it reads, so a quoted region round-trips', () => {
    for (const markup of samples) {
      const tree = parseTreeMarkup(markup);
      const written = serializeTreeMarkup(tree);
      expect(written).toBeDefined();
      expect(parseTreeMarkup(written ?? '')).toEqual(tree);
    }
  });

  it('is deterministic — attributes sorted, single quotes — so the prompt prefix holds', () => {
    const tree = {
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'a',
          attributes: { target: '_blank', href: '#x', 'aria-label': "Menu's page" },
          text: 'Go',
        },
      ],
    };

    expect(serializeTreeMarkup(tree)).toBe(
      "<a aria-label='Menu&#39;s page' href='#x' target='_blank'>Go</a>",
    );
  });

  it('spells a component reference as ck-component, so a region holding one is editable', () => {
    const tree = {
      kind: 'root',
      children: [
        {
          kind: 'component',
          component: 'hero',
          props: { heading: "Rock & roll's <3" },
          children: [{ kind: 'element', tag: 'p', text: 'Inside the slot' }],
        },
        { kind: 'component', component: 'divider' },
      ],
    };

    const written = serializeTreeMarkup(tree);
    expect(written).toBe(
      "<ck-component type='hero' props='{\"heading\":\"Rock &amp; roll&#39;s &lt;3\"}'><p>Inside the slot</p></ck-component><ck-component type='divider'/>",
    );
    expect(parseTreeMarkup(written ?? '')).toEqual(tree);
  });
});

/** Serialize, then read back: exactly what editTree does to every region it touches. */
function roundTrip(tree: unknown): unknown {
  const written = serializeTreeMarkup(tree);
  expect(written).toBeDefined();
  return parseTreeMarkup(written ?? '');
}

describe('whitespace is content where it renders', () => {
  it('keeps the word spaces of a sentence split by inline elements through a round trip', () => {
    const tree = parseTreeMarkup(
      "<p>Pay <strong>once</strong> and keep it. Read the <a href='/terms'>terms</a> <em>first</em>.</p>",
    );

    expect(tree.children[0]).toEqual({
      kind: 'element',
      tag: 'p',
      text: 'Pay ',
      children: [
        { kind: 'element', tag: 'strong', text: 'once' },
        { kind: 'element', tag: 'span', text: ' and keep it. Read the ' },
        { kind: 'element', tag: 'a', attributes: { href: '/terms' }, text: 'terms' },
        { kind: 'element', tag: 'span', text: ' ' },
        { kind: 'element', tag: 'em', text: 'first' },
        { kind: 'element', tag: 'span', text: '.' },
      ],
    });
    expect(roundTrip(tree)).toEqual(tree);
  });

  it('keeps spacing written inside an inline element on the first read', () => {
    expect(parseTreeMarkup('<p>A<span> · </span>B</p>').children[0]).toEqual({
      kind: 'element',
      tag: 'p',
      text: 'A',
      children: [
        { kind: 'element', tag: 'span', text: ' · ' },
        { kind: 'element', tag: 'span', text: 'B' },
      ],
    });
  });

  it('writes edge spaces of a block as character references, so they survive being read back', () => {
    const tree = {
      kind: 'root',
      children: [
        { kind: 'element', tag: 'p', text: ' leading and trailing ' },
        { kind: 'element', tag: 'h2', text: ' ' },
        { kind: 'element', tag: 'p', text: 'two  spaces\tand a tab' },
      ],
    };

    expect(serializeTreeMarkup(tree)).toBe(
      '<p>&#32;leading and trailing&#32;</p><h2>&#32;</h2><p>two&#32;&#32;spaces&#9;and a tab</p>',
    );
    expect(roundTrip(tree)).toEqual(tree);
  });

  it('keeps newlines in pre and code, and in whitespace-pre text', () => {
    const tree = parseTreeMarkup(
      "<pre><code>npm i craftkit\nnpx craftkit dev</code></pre><p class='whitespace-pre-line'>line one\nline two</p>",
    );

    expect(tree.children).toEqual([
      {
        kind: 'element',
        tag: 'pre',
        children: [{ kind: 'element', tag: 'code', text: 'npm i craftkit\nnpx craftkit dev' }],
      },
      {
        kind: 'element',
        tag: 'p',
        className: 'whitespace-pre-line',
        text: 'line one\nline two',
      },
    ]);
    expect(roundTrip(tree)).toEqual(tree);
    // A stored multi-line pre survives an edit anywhere in its region.
    expect(
      roundTrip({ kind: 'root', children: [{ kind: 'element', tag: 'pre', text: 'a\nb' }] }),
    ).toEqual({ kind: 'root', children: [{ kind: 'element', tag: 'pre', text: 'a\nb' }] });
  });

  it('drops the newline written right after <pre>, as a browser does, and keeps a stored one', () => {
    expect(parseTreeMarkup('<pre>\nfirst\n  second</pre>').children[0]).toEqual({
      kind: 'element',
      tag: 'pre',
      text: 'first\n  second',
    });
    const stored = { kind: 'root', children: [{ kind: 'element', tag: 'pre', text: '\nx' }] };
    expect(roundTrip(stored)).toEqual(stored);
  });

  it('keeps a non-breaking space non-breaking, raw or written as an entity', () => {
    const tree = parseTreeMarkup('<p>10&nbsp;%</p><p>Only 10 %</p>');

    expect(tree.children.map((node) => node['text'])).toEqual(['10 %', 'Only 10 %']);
    expect(serializeTreeMarkup(tree)).toBe('<p>10&nbsp;%</p><p>Only 10&nbsp;%</p>');
    expect(roundTrip(tree)).toEqual(tree);
  });
});

describe('structure is read as written', () => {
  it('keeps block children of a paragraph inside it when the markup closes every tag', () => {
    const tree = {
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'section',
          className: 'py-16',
          children: [
            { kind: 'element', tag: 'h2', text: 'Title' },
            {
              kind: 'element',
              tag: 'p',
              className: 'text-lg text-muted',
              children: [
                { kind: 'element', tag: 'div', text: 'Card' },
                {
                  kind: 'element',
                  tag: 'ul',
                  children: [{ kind: 'element', tag: 'li', text: 'T' }],
                },
              ],
            },
            {
              kind: 'element',
              tag: 'a',
              attributes: { href: '#x' },
              children: [{ kind: 'element', tag: 'a', attributes: { href: '#y' }, text: 'inner' }],
            },
          ],
        },
      ],
    };

    expect(roundTrip(tree)).toEqual(tree);
  });

  it('still repairs markup a model left unbalanced, the way a browser would', () => {
    const tree = parseTreeMarkup("<ul class='grid'><li>One<li>Two</ul><p>Three<div>Four</div>");

    expect(tree.children).toEqual([
      {
        kind: 'element',
        tag: 'ul',
        className: 'grid',
        children: [
          { kind: 'element', tag: 'li', text: 'One' },
          { kind: 'element', tag: 'li', text: 'Two' },
        ],
      },
      { kind: 'element', tag: 'p', text: 'Three' },
      { kind: 'element', tag: 'div', text: 'Four' },
    ]);
  });
});

/*
  Design markup (2026-09-28): SVG names are case-sensitive, and the tokenizer
  folds case the way an HTML parser does — so a wave divider written by a
  model came back as `lineargradient`/`viewbox`, which the vocabulary does
  not have. Every name is respelled as the vocabulary spells it, and the
  writer writes it that way, so editTree round-trips a drawing exactly.
*/
describe('design markup in trees written as markup', () => {
  const wave =
    "<svg class='block h-12 w-full' aria-hidden='true' preserveAspectRatio='none' viewBox='0 0 1440 80'>" +
    "<defs><linearGradient gradientUnits='objectBoundingBox' id='ck-fade' x1='0' x2='0' y1='0' y2='1'>" +
    "<stop offset='0' stop-color='currentColor' stop-opacity='0.4'/><stop offset='1' stop-color='currentColor'/>" +
    "</linearGradient></defs><path d='M0 40C360 80 1080 0 1440 40V80H0Z' fill='url(#ck-fade)'/></svg>";

  it('keeps svg names in their own case, and reads self-closed shapes as leaves', () => {
    const tree = parseTreeMarkup(wave.replace('viewBox', 'VIEWBOX').replace(/linearGradient/gu, 'LINEARGRADIENT'));
    const svg = tree.children[0] as Record<string, unknown>;
    expect(svg['tag']).toBe('svg');
    expect(Object.keys(svg['attributes'] as object)).toEqual(
      expect.arrayContaining(['viewBox', 'preserveAspectRatio', 'aria-hidden']),
    );
    const defs = (svg['children'] as Record<string, unknown>[])[0];
    const gradient = (defs?.['children'] as Record<string, unknown>[])[0];
    expect(gradient?.['tag']).toBe('linearGradient');
    expect(gradient?.['attributes']).toEqual(
      expect.objectContaining({ gradientUnits: 'objectBoundingBox', id: 'ck-fade' }),
    );
    expect(gradient?.['children']).toHaveLength(2);
    expect((svg['children'] as unknown[])[1]).toEqual({
      kind: 'element',
      tag: 'path',
      attributes: { d: 'M0 40C360 80 1080 0 1440 40V80H0Z', fill: 'url(#ck-fade)' },
    });
    expect(customCodeTreeSchema.safeParse(tree).success).toBe(true);
  });

  it('writes a drawing back byte for byte, shapes self-closed', () => {
    expect(serializeTreeMarkup(parseTreeMarkup(wave))).toBe(wave);
  });

  it('round-trips a FAQ, a comparison table, a picture, a muted video and a popover menu', () => {
    const samples = [
      "<details name='faq' open=''><summary class='cursor-pointer list-none font-semibold'>Do you deliver?</summary><p>Daily, inside Amman.</p></details>",
      "<div class='overflow-x-auto'><table class='w-full text-sm'><caption class='sr-only'>Plans</caption><thead><tr><th scope='col'>Feature</th><th scope='col'>Pro</th></tr></thead><tbody><tr><th scope='row'>Seats</th><td colspan='2'>5</td></tr></tbody></table></div>",
      "<picture><source media='(min-width:768px)' srcset='https://x.test/w.jpg 1600w'/><img alt='A cup' decoding='async' height='600' loading='lazy' src='https://x.test/a.jpg' width='800'/></picture>",
      "<video class='absolute inset-0 h-full w-full object-cover' autoplay='' loop='' muted='' playsinline='' poster='https://x.test/p.jpg'><source src='https://x.test/v.mp4' type='video/mp4'/></video>",
      "<button aria-label='Menu' popovertarget='ck-menu'><icon name='menu'/></button><nav id='ck-menu' popover=''><a href='#menu'>Menu</a></nav>",
      "<p lang='ar'>قهوة <span dir='ltr' lang='en'>Hail</span><b>طازجة</b><mark>اليوم</mark></p>",
    ];
    for (const markup of samples) {
      const tree = parseTreeMarkup(markup);
      expect(serializeTreeMarkup(tree), markup).toBe(markup);
      expect(customCodeTreeSchema.safeParse(tree).success, markup).toBe(true);
    }
  });

  it('reads bare boolean attributes as the empty value the door takes', () => {
    const tree = parseTreeMarkup(
      "<video autoplay muted loop playsinline><source src='/v.mp4' type='video/mp4'></video>",
    );
    expect(tree.children[0]).toEqual({
      kind: 'element',
      tag: 'video',
      attributes: { autoplay: '', muted: '', loop: '', playsinline: '' },
      children: [{ kind: 'element', tag: 'source', attributes: { src: '/v.mp4', type: 'video/mp4' } }],
    });
  });
});

describe('component references in markup', () => {
  it('reads ck-component into a component reference with its props and children', () => {
    const tree = parseTreeMarkup(
      "<section class='py-16'><ck-component type='hero' props='{\"heading\":\"Fresh coffee\",\"count\":3}'><p>Slot copy</p></ck-component><ck-component type='contact'/></section>",
    );

    expect(tree.children[0]).toEqual({
      kind: 'element',
      tag: 'section',
      className: 'py-16',
      children: [
        {
          kind: 'component',
          component: 'hero',
          props: { heading: 'Fresh coffee', count: 3 },
          children: [{ kind: 'element', tag: 'p', text: 'Slot copy' }],
        },
        { kind: 'component', component: 'contact' },
      ],
    });
    expect(customCodeTreeSchema.safeParse(tree).success).toBe(true);
  });

  it('leaves props that are not JSON as written, for the door to refuse by name', () => {
    const tree = parseTreeMarkup(
      "<ck-component type='hero' props='{heading: Fresh}'></ck-component>",
    );

    expect(tree.children[0]).toEqual({
      kind: 'component',
      component: 'hero',
      props: '{heading: Fresh}',
    });
    expect(customCodeTreeSchema.safeParse(tree).success).toBe(false);
  });

  it('puts text written inside a component into its slot as spans', () => {
    expect(
      parseTreeMarkup("<ck-component type='button'>Order now</ck-component>").children[0],
    ).toEqual({
      kind: 'component',
      component: 'button',
      children: [{ kind: 'element', tag: 'span', text: 'Order now' }],
    });
  });
});

/*
  The property editTree rests on: any stored tree, written as markup and read
  back, is the same tree. Only spellings that render identically are allowed
  to differ — an empty `text`, `className`, `attributes` or `children` is the
  same as none — so the comparison is against that canonical form.
*/
const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'source', 'track']);

function canonical(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(canonical);
  if (typeof node !== 'object' || node === null) return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'text' && value === '') continue;
    if (key === 'className' && (node as { kind?: unknown }).kind === 'element' && value === '')
      continue;
    if (key === 'attributes' && Object.keys(value as object).length === 0) continue;
    if (
      key === 'children' &&
      (value as unknown[]).length === 0 &&
      (node as { kind?: unknown }).kind !== 'root'
    ) {
      continue;
    }
    out[key] = key === 'props' ? value : canonical(value);
  }
  return out;
}

const textArbitrary = fc
  .array(
    fc.constantFrom(
      'a',
      'Z',
      'قهوة',
      '7',
      ' ',
      '  ',
      '\n',
      '\t',
      '\r',
      '\f',
      ' ',
      '&',
      '&amp;',
      '<',
      '>',
      "'",
      '"',
      '·',
      '/',
      '=',
    ),
    { maxLength: 8 },
  )
  .map((parts) => parts.join(''));

const classArbitrary = fc.constantFrom(
  '',
  'py-16',
  'flex gap-2',
  'text-lg font-bold',
  'whitespace-pre',
  'md:whitespace-pre-line',
  'inline-flex',
);

const attributesArbitrary = fc.dictionary(
  fc.constantFrom('href', 'title', 'aria-label', 'id'),
  textArbitrary,
  { maxKeys: 2 },
);

const treeArbitrary = fc.letrec((tie) => ({
  node: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    tie('element'),
    tie('icon'),
    tie('component'),
  ),
  element: fc
    .record(
      {
        tag: fc.constantFrom(...CUSTOM_CODE_TAGS),
        className: classArbitrary,
        text: textArbitrary,
        attributes: attributesArbitrary,
        children: fc.array(tie('node'), { maxLength: 3 }),
      },
      { requiredKeys: ['tag'] },
    )
    .map((fields) => {
      const node: Record<string, unknown> = { kind: 'element', ...fields };
      // A void element has no content to write; the renderer refuses one too.
      if (VOID_TAGS.has(fields.tag)) {
        delete node['text'];
        delete node['children'];
      }
      // Raw-text content (the door refuses otherwise): an iframe holds nothing, a textarea or option only words.
      if (fields.tag === 'iframe') {
        delete node['text'];
        delete node['children'];
      }
      if (fields.tag === 'textarea' || fields.tag === 'option') delete node['children'];
      return node;
    }),
  icon: fc.record(
    {
      kind: fc.constant('icon' as const),
      name: fc.constantFrom('coffee', 'arrow-right', 'star'),
      className: classArbitrary,
      size: fc.integer({ min: 8, max: 256 }),
      strokeWidth: fc.constantFrom(0.5, 1.5, 2, 4),
      label: textArbitrary,
    },
    { requiredKeys: ['kind', 'name'] },
  ),
  component: fc.record(
    {
      kind: fc.constant('component' as const),
      component: fc.constantFrom('hero', 'contact', "odd'name&<"),
      props: fc.dictionary(fc.string({ maxLength: 6 }), fc.jsonValue({ maxDepth: 2 }), {
        maxKeys: 3,
      }),
      children: fc.array(tie('node'), { maxLength: 2 }),
    },
    { requiredKeys: ['kind', 'component'] },
  ),
}));

describe('serializeTreeMarkup ∘ parseTreeMarkup', () => {
  it('reads back every stored tree it writes, exactly', () => {
    fc.assert(
      fc.property(fc.array(treeArbitrary.node, { maxLength: 4 }), (children) => {
        const tree = { kind: 'root', children };
        expect(canonical(roundTrip(tree))).toEqual(canonical(tree));
      }),
      { numRuns: 500, seed: 0x7ee_3a4c },
    );
  }, 60_000);
});
