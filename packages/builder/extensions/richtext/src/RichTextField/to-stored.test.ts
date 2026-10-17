import { describe, expect, it } from 'vitest';

import { richTextDocSchema } from '@craftkit/builder-schema';

import { toStoredRichText } from './to-stored';

describe('toStoredRichText (008 contract §3 e2 projection)', () => {
  it("strips the engine's extra link attributes down to href", () => {
    const projected = toStoredRichText({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'x',
              marks: [
                {
                  type: 'link',
                  attrs: { href: 'https://a', target: '_blank', rel: 'noopener', class: null },
                },
                { type: 'bold' },
              ],
            },
          ],
        },
      ],
    });
    expect(projected).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'x',
              marks: [{ type: 'link', attrs: { href: 'https://a' } }, { type: 'bold' }],
            },
          ],
        },
      ],
    });
  });

  it('drops unknown marks, unknown nodes, malformed items, and clamps heading levels', () => {
    const projected = toStoredRichText({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 9 }, content: [{ type: 'text', text: 'H' }] },
        { type: 'horizontalRule' },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'kept', marks: [{ type: 'underline' }, null, { type: 'link' }] },
            { type: 'mention', attrs: { id: 1 } },
            { type: 'hardBreak' },
            42,
          ],
        },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [] },
            { type: 'listItem', content: [{ type: 'paragraph' }] },
            'junk',
          ],
        },
      ],
    });
    expect(projected).toEqual({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'H' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'kept' }, { type: 'hardBreak' }] },
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
        },
      ],
    });
  });

  it('level 3/4 pass through; empty lists vanish; ordered lists project', () => {
    const projected = toStoredRichText({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 3 } },
        { type: 'heading', attrs: { level: 4 } },
        { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
        { type: 'bulletList', content: ['junk'] },
      ],
    });
    expect(projected).toEqual({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 3 } },
        { type: 'heading', attrs: { level: 4 } },
        { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
      ],
    });
  });

  it('junk roots project to the canonical empty document', () => {
    for (const junk of [null, 7, 'x', {}, { type: 'paragraph' }, { type: 'doc', content: 'no' }]) {
      expect(toStoredRichText(junk)).toEqual({
        type: 'doc',
        content: [{ type: 'paragraph' }],
      });
    }
  });

  it('drops primitive top-level blocks and defaults an attribute-free heading to level 2', () => {
    expect(
      toStoredRichText({
        type: 'doc',
        content: [42, { type: 'heading', content: [{ type: 'text', text: 'Heading' }] }],
      }),
    ).toEqual({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Heading' }],
        },
      ],
    });
  });
});

describe('§10 review fixes — the projection can never produce a door-invalid document', () => {
  it('guarantees a list item opens with a paragraph', () => {
    const projected = toStoredRichText({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'heading', attrs: { level: 2 } }],
            },
          ],
        },
      ],
    });
    const list = projected.content[0];
    expect(list.type).toBe('bulletList');
    if (list.type === 'bulletList') {
      expect(list.content[0]?.content[0]?.type).toBe('paragraph');
    }
  });

  it('never emits an empty document', () => {
    expect(toStoredRichText({ type: 'doc', content: [] }).content).toHaveLength(1);
    expect(toStoredRichText({ type: 'doc', content: [{ type: 'unknown' }] }).content).toEqual([
      { type: 'paragraph' },
    ]);
  });

  it('every projection of hostile input passes the DOOR (the pairing that matters)', () => {
    const hostile = [
      { type: 'doc', content: [] },
      { type: 'doc', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
      {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [{ type: 'listItem', content: [{ type: 'orderedList', content: [] }] }],
          },
        ],
      },
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'x', marks: [{ type: 'bold' }, { type: 'bold' }] }],
          },
        ],
      },
      null,
      'junk',
    ];
    for (const input of hostile) {
      expect(
        richTextDocSchema.safeParse(toStoredRichText(input)).success,
        JSON.stringify(input),
      ).toBe(true);
    }
  });
});
