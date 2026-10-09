import { renderToStaticMarkup } from 'react-dom/server';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import { RichTextBlock } from './RichTextBlock';
import { richTextBlockSchema, type RichTextBlockProps } from './schema';

afterEach(cleanup);

const CONTENT = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'About us' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'We build ' },
        { type: 'text', text: 'reliable', marks: [{ type: 'bold' }] },
        {
          type: 'text',
          text: ' tools',
          marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
        },
        { type: 'text', text: '.' },
      ],
    },
  ],
};

const renderProps = (content: unknown): BlockRenderProps<RichTextBlockProps> => ({
  node: { id: 'r1', type: 'richText', props: { content: content as never } },
  props: { content },
  slots: {},
  data: {},
  isCanvas: false,
});

describe('RichTextBlock (008 contract §4)', () => {
  it('door: the schema accepts whitelist content and rejects unknown nodes', () => {
    expect(richTextBlockSchema.props.safeParse({ content: CONTENT }).success).toBe(true);
    expect(
      richTextBlockSchema.props.safeParse({
        content: { type: 'doc', content: [{ type: 'iframe' }] },
      }).success,
    ).toBe(false);

    const defaults = richTextBlockSchema.props.parse({});
    expect(Object.keys(defaults)).toEqual(['content']);
    const optionalSharedStyleProps = [
      'background',
      'textColor',
      'fontFamily',
      'fontSize',
      'fontWeight',
      'lineHeight',
      'letterSpacing',
      'textAlign',
      'textCase',
      'paddingBlockStart',
      'paddingBlockEnd',
      'paddingInlineStart',
      'paddingInlineEnd',
      'marginBlockStart',
      'marginBlockEnd',
      'marginInlineStart',
      'marginInlineEnd',
    ] as const;
    for (const property of optionalSharedStyleProps) {
      expect(richTextBlockSchema.props.shape).toHaveProperty(property);
      expect(richTextBlockSchema.propertyGroups).toHaveProperty(property);
      expect(defaults).not.toHaveProperty(property);
    }
  });

  it('renders prose through the zero-dependency read path', () => {
    const { container } = render(<RichTextBlock {...renderProps(CONTENT)} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('About us');
    expect(screen.getByRole('link', { name: 'tools' })).toHaveAttribute(
      'href',
      'https://example.com',
    );
    expect(document.querySelector('strong')).toHaveTextContent('reliable');
    expect(container.firstElementChild).not.toHaveAttribute('style');
  });

  it('applies shared typography and spacing with colour roles on the root', () => {
    const props = richTextBlockSchema.props.parse({
      content: CONTENT,
      textColor: 'textMuted',
      fontSize: 'lg',
      marginBlockEnd: 5,
    });
    const blockRenderProps = { ...renderProps(props.content), props };
    const { container } = render(<RichTextBlock {...blockRenderProps} />);

    const section = container.firstElementChild as HTMLElement;
    /* The shared wide column (blocks-polish 2026-10-08); the prose keeps a narrow measure inside it. */
    expect(section).toHaveClass(
      'max-w-content-wide',
      'px-gutter',
      'py-section-sm',
      'mkt-type--size-lg',
    );
    expect(section.firstElementChild).toHaveClass('max-w-content-narrow');
    expect(section.style.color).toBe('var(--t-text-muted)');
    expect(section.style.marginBlockEnd).toBe('calc(var(--t-space-unit, 4px) * 5)');
  });

  it('US2/AC1 parity: static output carries the same text and structure', () => {
    const html = renderToStaticMarkup(<RichTextBlock {...renderProps(CONTENT)} />);
    const probe = document.createElement('div');
    probe.innerHTML = html;
    const { container } = render(<RichTextBlock {...renderProps(CONTENT)} />);
    expect(probe.textContent).toBe(container.textContent);
    for (const selector of ['h2', 'strong', 'a[href]']) {
      expect(probe.querySelector(selector), selector).not.toBeNull();
    }
  });

  it('US2/AC2+AC3: hostile hrefs are neutralized and unknown nodes degrade', () => {
    const hostile = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'trap',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
          ],
        },
        {
          type: 'widget',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'still here' }] }],
        },
      ],
    };
    const { container } = render(<RichTextBlock {...renderProps(hostile)} />);
    expect(container).toHaveTextContent('trap');
    expect(container).toHaveTextContent('still here');
    expect(container.querySelector('a')).toBeNull();
  });
});
