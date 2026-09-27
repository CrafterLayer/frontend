import { describe, expect, it } from 'vitest';

import { customCodeTreeSchema } from '@craftkit/builder-schema';

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

  it('declines a tree with a component reference, which markup cannot spell', () => {
    expect(
      serializeTreeMarkup({ kind: 'root', children: [{ kind: 'component', component: 'hero' }] }),
    ).toBeUndefined();
  });
});
