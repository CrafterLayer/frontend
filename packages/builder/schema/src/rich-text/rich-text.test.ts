import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import {
  emptyRichText,
  isRichTextSchema,
  richText,
  richTextDocSchema,
  type RichTextDoc,
} from './rich-text';

const FULL_WHITELIST_DOC: RichTextDoc = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Plain ' },
        { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' and ', marks: [{ type: 'italic' }] },
        {
          type: 'text',
          text: 'a link',
          marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
        },
        { type: 'hardBreak' },
        { type: 'text', text: 'after the break' },
      ],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }],
        },
        {
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'nested parent' }] },
            {
              type: 'orderedList',
              content: [
                {
                  type: 'listItem',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'deep' }] }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe('richText door whitelist (008 contract §1 s2)', () => {
  it('accepts the complete whitelist, nesting included', () => {
    expect(richTextDocSchema.safeParse(FULL_WHITELIST_DOC).success).toBe(true);
    expect(richText().safeParse(FULL_WHITELIST_DOC).success).toBe(true);
  });

  it('accepts the canonical empty document', () => {
    expect(richTextDocSchema.safeParse(emptyRichText()).success).toBe(true);
    expect(emptyRichText()).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
  });

  it.each([
    ['unknown node type', { type: 'doc', content: [{ type: 'iframe', src: 'x' }] }],
    [
      'unknown mark type',
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'x', marks: [{ type: 'underline' }] }],
          },
        ],
      },
    ],
    [
      'heading level 1',
      { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 }, content: [] }] },
    ],
    [
      'heading level 5',
      { type: 'doc', content: [{ type: 'heading', attrs: { level: 5 }, content: [] }] },
    ],
    [
      'extra link attrs',
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'x',
                marks: [{ type: 'link', attrs: { href: 'https://a', target: '_blank' } }],
              },
            ],
          },
        ],
      },
    ],
    [
      'non-string href',
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 7 } }] }],
          },
        ],
      },
    ],
    [
      'extra node attrs',
      { type: 'doc', content: [{ type: 'paragraph', align: 'center', content: [] }] },
    ],
    ['empty list', { type: 'doc', content: [{ type: 'bulletList', content: [] }] }],
    [
      'bare list item at top level',
      { type: 'doc', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
    ],
    ['inline at top level', { type: 'doc', content: [{ type: 'text', text: 'floating' }] }],
  ])('rejects %s with a path-addressed error', (_label, doc) => {
    const result = richTextDocSchema.safeParse(doc);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
      expect(result.error.issues[0]?.path).toBeDefined();
    }
  });
});

describe('marker resolution (s1/s3)', () => {
  it('isRichTextSchema is true for richText() and through wrappers', () => {
    const marked = richText();
    expect(isRichTextSchema(marked)).toBe(true);
    expect(isRichTextSchema(marked.optional())).toBe(true);
    expect(isRichTextSchema(marked.default(emptyRichText() as never))).toBe(true);
    expect(isRichTextSchema(marked.nullable().optional())).toBe(true);
  });

  it('is false for everything else — matching is by META, never shape', () => {
    expect(isRichTextSchema(z.string())).toBe(false);
    expect(isRichTextSchema(z.object({ type: z.literal('doc') }))).toBe(false);
    // Even the UNMARKED structural schema does not match: declaration is the marker.
    expect(isRichTextSchema(richTextDocSchema)).toBe(false);
  });
});

describe('§10 review fixes — the door is no looser than an editor can load', () => {
  const deepList = (levels: number) => {
    let node: unknown = { type: 'listItem', content: [{ type: 'paragraph' }] };
    for (let at = 0; at < levels; at += 1) {
      node = {
        type: 'listItem',
        content: [{ type: 'paragraph' }, { type: 'bulletList', content: [node] }],
      };
    }
    return { type: 'doc', content: [{ type: 'bulletList', content: [node] }] };
  };

  it.each([
    ['an EMPTY document (no editor can load it)', { type: 'doc', content: [] }, ['content']],
    [
      'a list item that does not open with a paragraph',
      {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [{ type: 'listItem', content: [{ type: 'heading', attrs: { level: 2 } }] }],
          },
        ],
      },
      ['content', 0, 'content', 0, 'content', 0, 'type'],
    ],
    [
      'two link marks on one text node',
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'x',
                marks: [
                  { type: 'link', attrs: { href: 'https://a' } },
                  { type: 'link', attrs: { href: 'https://b' } },
                ],
              },
            ],
          },
        ],
      },
      ['content', 0, 'content', 0, 'marks'],
    ],
    [
      'two bold marks on one text node',
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'x', marks: [{ type: 'bold' }, { type: 'bold' }] }],
          },
        ],
      },
      ['content', 0, 'content', 0, 'marks'],
    ],
  ])('rejects %s at the EXACT path', (_label, doc, path) => {
    const result = richTextDocSchema.safeParse(doc);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(path);
    }
  });

  it('rejects pathological nesting instead of overflowing the stack', () => {
    expect(richTextDocSchema.safeParse(deepList(5)).success).toBe(true);
    const deep = richTextDocSchema.safeParse(deepList(400));
    expect(deep.success).toBe(false); // a THROW here would be the defect
    if (!deep.success) {
      expect(deep.error.issues[0]?.message).toContain('depth');
    }
  });

  it('still accepts every legitimate shape the editor produces', () => {
    const list = {
      type: 'doc',
      content: [
        {
          type: 'orderedList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'one' }] },
                {
                  type: 'bulletList',
                  content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
                },
              ],
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'bold link',
              marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://a' } }],
            },
          ],
        },
      ],
    };
    expect(richTextDocSchema.safeParse(list).success).toBe(true);
  });
});
