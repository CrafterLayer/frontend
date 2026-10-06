import { describe, expect, it } from 'vitest';

import { richTextPlainText } from './rich-text-plain-text';

describe('richTextPlainText', () => {
  it('projects headings, paragraphs and marks to lines of plain text', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Why it holds' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Every edit is ' },
            { type: 'text', text: 'one transaction', marks: [{ type: 'bold' }] },
            { type: 'text', text: '.' },
          ],
        },
      ],
    };
    expect(richTextPlainText(doc)).toBe('Why it holds\nEvery edit is one transaction.');
  });

  it('numbers ordered lists, bullets unordered ones, and keeps hard breaks', () => {
    const item = (text: string) => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    });
    const doc = {
      type: 'doc',
      content: [
        { type: 'bulletList', content: [item('أولاً'), item('Second')] },
        { type: 'orderedList', content: [item('One'), item('Two')] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'a' },
            { type: 'hardBreak' },
            { type: 'text', text: 'b' },
          ],
        },
      ],
    };
    expect(richTextPlainText(doc)).toBe('• أولاً\n• Second\n1. One\n2. Two\na\nb');
  });

  it('never throws and never returns JSON for odd input', () => {
    expect(richTextPlainText(undefined)).toBe('');
    expect(richTextPlainText(null)).toBe('');
    expect(richTextPlainText(42)).toBe('');
    expect(richTextPlainText('already text')).toBe('already text');
    expect(richTextPlainText({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe('');
    expect(richTextPlainText({ type: 'doc', content: 'nope' })).toBe('');
    expect(richTextPlainText({ type: 'mystery', content: [{ type: 'text', text: 'kept' }] })).toBe(
      'kept',
    );
  });
});
