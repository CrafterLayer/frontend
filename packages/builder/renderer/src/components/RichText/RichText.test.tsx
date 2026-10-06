import { renderToStaticMarkup } from 'react-dom/server';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { RichText } from './RichText';
import { safeHref } from './safe-href';

afterEach(cleanup);

const FIXTURE = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Plain ' },
        { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' italic', marks: [{ type: 'italic' }] },
        { type: 'hardBreak' },
        {
          type: 'text',
          text: 'a link',
          marks: [{ type: 'link', attrs: { href: 'https://example.com/x' } }],
        },
      ],
    },
    {
      type: 'orderedList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'step one' }] }],
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'step two' }] }],
        },
      ],
    },
  ],
};

describe('RichText (008 contract §2 r1)', () => {
  it('renders the whitelist as semantic elements with the content intact', () => {
    const { container } = render(<RichText value={FIXTURE} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Title');
    expect(container.querySelector('strong')).toHaveTextContent('bold');
    expect(container.querySelector('em')).toHaveTextContent('italic');
    expect(container.querySelector('br')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'a link' })).toHaveAttribute(
      'href',
      'https://example.com/x',
    );
    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['step one', 'step two']);
    expect(container.querySelector('ol')).not.toBeNull();
  });

  it('r3: unknown node types degrade to readable children; unknown marks are ignored', () => {
    const hostile = {
      type: 'doc',
      content: [
        {
          type: 'mysteryEmbed',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'survives' }] }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'still styled', marks: [{ type: 'blink' }] }],
        },
      ],
    };
    const { container } = render(<RichText value={hostile} />);
    expect(container).toHaveTextContent('survives');
    expect(container).toHaveTextContent('still styled');
    expect(container.textContent).not.toContain('{'); // never raw JSON
  });

  it('r3: malformed shapes render nothing and never throw', () => {
    for (const junk of [null, 42, 'text', { type: 'doc', content: 'nope' }, { no: 'doc' }]) {
      const { container, unmount } = render(<RichText value={junk} />);
      expect(container.querySelector('.bldr-richtext')).not.toBeNull();
      unmount();
    }
  });

  it('SC-005 parity: static markup carries the same text and structure as the DOM path', () => {
    const { container } = render(<RichText value={FIXTURE} />);
    const html = renderToStaticMarkup(<RichText value={FIXTURE} />);
    const probe = document.createElement('div');
    probe.innerHTML = html;
    expect(probe.textContent).toBe(container.textContent);
    for (const selector of ['h2', 'strong', 'em', 'a[href]', 'ol', 'li', 'br']) {
      expect(probe.querySelector(selector), selector).not.toBeNull();
      expect(container.querySelector(selector), selector).not.toBeNull();
    }
  });
});

describe('safeHref (SC-004 hostile table)', () => {
  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    ' javascript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'vbscript:msgbox(1)',
    '//evil.example.com',
    'javascript​:alert(1)',
    'file:///etc/passwd',
    'chrome://settings',
    '',
  ])('neutralizes %j', (href) => {
    expect(safeHref(href)).toBeUndefined();
  });

  it.each([
    'https://example.com/a?b=c#d',
    'http://example.com',
    'HTTPS://EXAMPLE.COM',
    'mailto:hi@example.com',
    '/relative/path',
    './relative',
    '../up',
    '#anchor',
    '?query=1',
  ])('allows %j', (href) => {
    expect(safeHref(href)).toBe(href);
  });

  it('renders a neutralized link as visible text with NO anchor', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'do not click',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
          ],
        },
      ],
    };
    const { container } = render(<RichText value={doc} />);
    expect(container).toHaveTextContent('do not click');
    expect(container.querySelector('a')).toBeNull();
  });
});

describe('coverage of the remaining whitelist branches', () => {
  it('renders heading levels 3 and 4 as their own elements, defaults junk levels to h2', () => {
    const { container } = render(
      <RichText
        value={{
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Three' }] },
            { type: 'heading', attrs: { level: 4 }, content: [{ type: 'text', text: 'Four' }] },
            { type: 'heading', attrs: { level: 'x' }, content: [{ type: 'text', text: 'Junk' }] },
            { type: 'heading', content: [{ type: 'text', text: 'NoAttrs' }] },
          ],
        }}
      />,
    );
    expect(container.querySelector('h3')).toHaveTextContent('Three');
    expect(container.querySelector('h4')).toHaveTextContent('Four');
    const h2s = container.querySelectorAll('h2');
    expect([...h2s].map((h) => h.textContent)).toEqual(['Junk', 'NoAttrs']);
  });

  it('degrades a stray listItem, tolerates junk marks/attrs, and merges className', () => {
    const { container } = render(
      <RichText
        className="extra"
        value={{
          type: 'doc',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'stray' }] }],
            },
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'linkless', marks: [{ type: 'link', attrs: null }] },
                { type: 'text', text: 'markjunk', marks: [null, 7] },
                null,
              ],
            },
            {
              type: 'unknownWrap',
              content: [
                { type: 'text', text: 'inline-in-unknown' },
                { type: 'paragraph', content: [{ type: 'text', text: 'block-in-unknown' }] },
              ],
            },
          ],
        }}
      />,
    );
    expect(container.querySelector('.bldr-richtext.extra')).not.toBeNull();
    expect(container.querySelector('li')).toBeNull(); // stray item degraded
    expect(container).toHaveTextContent('stray');
    expect(container).toHaveTextContent('linkless');
    expect(container.querySelector('a')).toBeNull(); // attrs junk ⇒ neutralized
    expect(container).toHaveTextContent('markjunk');
    expect(container).toHaveTextContent('inline-in-unknown');
    expect(container).toHaveTextContent('block-in-unknown');
  });
});

describe('§10 review fixes — safety hardening', () => {
  it.each([
    '/\\evil.com',
    '/\\\\evil.com',
    '/\\/evil.com',
    '/\\evil.com/@good.example.com',
    '\\\\evil.com',
    'https://good.example.com\\@evil.com',
  ])('neutralizes the backslash protocol-relative bypass %j', (href) => {
    // Browsers implement the WHATWG "relative slash state": a backslash is a
    // slash for special schemes, so these resolve to an ATTACKER origin.
    expect(safeHref(href)).toBeUndefined();
  });

  it('caps recursion instead of overflowing the stack (published path has no boundary)', () => {
    let node: unknown = { type: 'paragraph', content: [{ type: 'text', text: 'bottom' }] };
    for (let at = 0; at < 2000; at += 1) {
      node = { type: 'bulletList', content: [{ type: 'listItem', content: [node] }] };
    }
    const { container } = render(<RichText value={{ type: 'doc', content: [node] }} />);
    expect(container).toHaveTextContent('bottom'); // text survives the cap
    // Static markup must survive the same document (no error boundary there).
    expect(() =>
      renderToStaticMarkup(<RichText value={{ type: 'doc', content: [node] }} />),
    ).not.toThrow();
  });

  it('renders ONE anchor for duplicate link marks — DOM and static markup agree', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'once',
              marks: [
                { type: 'link', attrs: { href: 'https://a.example' } },
                { type: 'link', attrs: { href: 'https://b.example' } },
              ],
            },
          ],
        },
      ],
    };
    const { container } = render(<RichText value={doc} />);
    expect(container.querySelectorAll('a')).toHaveLength(1);
    expect(container.querySelector('a')).toHaveAttribute('href', 'https://a.example');

    const probe = document.createElement('div');
    probe.innerHTML = renderToStaticMarkup(<RichText value={doc} />);
    expect(probe.querySelectorAll('a')).toHaveLength(1);
    expect(probe.textContent).toBe(container.textContent);
  });

  it('degrades block-level unknowns into block containers (valid nesting on both paths)', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'mystery',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
        },
      ],
    };
    const { container } = render(<RichText value={doc} />);
    // <span><p></p></span> is invalid nesting the two paths repair differently.
    expect(container.querySelector('span > p')).toBeNull();
    const probe = document.createElement('div');
    probe.innerHTML = renderToStaticMarkup(<RichText value={doc} />);
    expect(probe.textContent).toBe(container.textContent);
  });
});

// ── block-parts (2026-10-06) ──
describe('RichText text direction (block-parts DESIGN §2.11)', () => {
  const MIXED = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Why CraftKit' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'The site grows.' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'الموقع ينمو.' }] },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Every edit becomes one undo.' }],
              },
            ],
          },
        ],
      },
    ],
  };

  it('gives every paragraph, heading and list item dir="auto" inside an RTL page', () => {
    const { container } = render(
      <div dir="rtl">
        <RichText value={MIXED} />
      </div>,
    );
    const blocks = container.querySelectorAll(
      '.bldr-richtext h3, .bldr-richtext p, .bldr-richtext li',
    );
    expect(blocks).toHaveLength(5);
    for (const block of blocks) {
      expect(block, block.textContent).toHaveAttribute('dir', 'auto');
    }
    expect(screen.getByText('The site grows.').closest('p')).toHaveAttribute('dir', 'auto');
  });

  it('stamps the same direction in static markup, and never on the wrapper or the lists', () => {
    const probe = document.createElement('div');
    probe.innerHTML = renderToStaticMarkup(<RichText value={MIXED} />);
    expect(probe.querySelectorAll('[dir="auto"]')).toHaveLength(5);
    expect(probe.querySelector('.bldr-richtext')).not.toHaveAttribute('dir');
    expect(probe.querySelector('ul')).not.toHaveAttribute('dir');
  });
});
// ── /block-parts ──
