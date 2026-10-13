import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import type { JsonValue } from '@craftkit/builder-schema';

import { linkSitePages } from '../../../agent/site-plan/link-pages';
import { parseTreeMarkup, serializeTreeMarkup } from '../../../plan/tree-markup';
import {
  agentToolsFixtureBlocks,
  expandAndValidate,
  fixtureDocument,
  fixtureKernel,
  liveContext,
} from '../agent-tools.fixtures';
import { navPagesTool } from './nav-pages';

const PAGES = [
  { label: 'Home', href: '/' },
  { label: 'About us', href: '/about-us' },
  { label: 'Contact', href: '/contact' },
];

/** The trees an accepted plan writes, as markup, by region id. */
function trees(result: ReturnType<typeof expandAndValidate>): Map<string, string> {
  const out = new Map<string, string>();
  if (result.result?.ok !== true) return out;
  for (const step of result.result.plan.commands) {
    const args = step.args as { id?: string; key?: string; value?: unknown };
    if (step.command === 'setProp' && args.key === 'tree') {
      out.set(args.id ?? '', serializeTreeMarkup(args.value) ?? '');
    }
  }
  return out;
}

/** The fixture page with its header and footer replaced by `header` and `footer` markup. */
function pageWith(header: string, footer: string) {
  const document = fixtureDocument();
  const nodes = { ...document.nodes };
  for (const [id, markup] of [
    ['r-header', header],
    ['r-footer', footer],
  ] as const) {
    const node = nodes[id];
    const tree = parseTreeMarkup(markup) as unknown as JsonValue;
    if (node !== undefined) nodes[id] = { ...node, props: { ...node.props, tree } };
  }
  return createBuilder({
    document: { ...document, nodes },
    extensions: [agentToolsFixtureBlocks],
    ports: { clock: fixedClock(1), ids: seededIds('nav-pages') },
  });
}

describe('nav.pages — input', () => {
  it.each([
    ['nothing', undefined],
    ['no pages', {}],
    ['one page', { pages: [PAGES[0]] }],
    [
      'nine pages',
      {
        pages: Array.from({ length: 9 }, (_, at) => ({
          label: `P${String(at)}`,
          href: `/p${String(at)}`,
        })),
      },
    ],
    ['an absolute link', { pages: [PAGES[0], { label: 'Away', href: 'https://example.com/' }] }],
    ['a host-relative link', { pages: [PAGES[0], { label: 'Away', href: '//example.com' }] }],
    ['a bare word', { pages: [PAGES[0], { label: 'About', href: 'about' }] }],
    ['a space', { pages: [PAGES[0], { label: 'About', href: '/about us' }] }],
    ['a parent step', { pages: [PAGES[0], { label: 'Up', href: '/a/../b' }] }],
    ['a page twice', { pages: [PAGES[0], { label: 'Again', href: '/' }] }],
    ['an empty label', { pages: [PAGES[0], { label: ' ', href: '/about' }] }],
    ['a current page that is no page', { pages: PAGES, current: '/missing' }],
    ['an unknown key', { pages: PAGES, extra: true }],
  ])('refuses %s', (_, input) => {
    expect(navPagesTool.parse(input).ok).toBe(false);
  });

  it('reads 2 to 8 pages, labels tidied, current optional', () => {
    const parsed = navPagesTool.parse({
      pages: [{ label: '  About   us ', href: '/about-us' }, PAGES[0]],
    });
    expect(parsed).toEqual({
      ok: true,
      value: {
        pages: [
          { label: 'About us', href: '/about-us' },
          { label: 'Home', href: '/' },
        ],
      },
    });
  });
});

describe('nav.pages — the menus', () => {
  it('rewrites the header menu and the footer list from their own templates', () => {
    const result = expandAndValidate(fixtureKernel(), 'nav.pages', {
      pages: PAGES,
      current: '/about-us',
    });
    expect(result.issues).toEqual([]);
    const header = trees(result).get('r-header') ?? '';
    expect(header).toContain(
      "<nav class='flex gap-4'><a class='ck-link' href='/'>Home</a><a class='ck-link' aria-current='page' href='/about-us'>About us</a><a class='ck-link' href='/contact'>Contact</a></nav>",
    );
    // The brand and the action button are not menu entries.
    expect(header).toContain("href='#top'>Brew</a>");
    expect(header).toContain("<a class='ck-btn' href='#visit'>Order</a>");
    const footer = trees(result).get('r-footer') ?? '';
    expect(footer).toContain(
      "<ul class='space-y-2'><li><a class='ck-link' href='/'>Home</a></li><li><a class='ck-link' aria-current='page' href='/about-us'>About us</a></li><li><a class='ck-link' href='/contact'>Contact</a></li></ul>",
    );
    expect(footer).toContain('<p>© Brew</p>');
  });

  it('marks no page current when none is named', () => {
    const result = expandAndValidate(fixtureKernel(), 'nav.pages', { pages: PAGES });
    expect(result.issues).toEqual([]);
    expect(trees(result).get('r-header')).not.toContain('aria-current');
  });

  it('links an already linked menu again, moving the current mark', () => {
    const kernel = pageWith(
      "<header><a class='ck-link' href='#top'>Brew</a><nav><a class='ck-link' href='/' aria-current='page'>Home</a><a class='ck-link' href='/contact'>Contact</a></nav></header>",
      '<footer><p>© Brew</p></footer>',
    );
    const result = expandAndValidate(kernel, 'nav.pages', { pages: PAGES, current: '/contact' });
    expect(result.issues).toEqual([]);
    expect(trees(result).get('r-header')).toContain(
      "<nav><a class='ck-link' href='/'>Home</a><a class='ck-link' href='/about-us'>About us</a><a class='ck-link' aria-current='page' href='/contact'>Contact</a></nav>",
    );
    // Nothing to do the second time.
    const again = navPagesTool.run({ pages: PAGES, current: '/contact' }, liveContext(kernel));
    expect(again.ok).toBe(true);
  });

  it('leaves a page without a menu as it is', () => {
    const kernel = pageWith(
      "<header><a class='ck-link' href='#top'>Brew</a><a class='ck-btn' href='#visit'>Order</a></header>",
      '<footer><p>© Brew</p><a href="#top">Back to top</a></footer>',
    );
    const run = navPagesTool.run({ pages: PAGES }, liveContext(kernel));
    expect(run).toMatchObject({ ok: true, steps: [] });
    expect(
      linkSitePages({
        kernel,
        pages: PAGES,
        current: '/',
        label: 'Link',
        validationPorts: { clock: fixedClock(2), ids: seededIds('door') },
      }),
    ).toBeNull();
    expect(kernel.transactions()).toHaveLength(0);
  });
});

describe('linkSitePages', () => {
  it('lands the linked menus as one labelled AI transaction', () => {
    const kernel = fixtureKernel();
    const tx = linkSitePages({
      kernel,
      pages: PAGES,
      current: '/',
      label: "Assistant: link the site's pages",
      validationPorts: { clock: fixedClock(2), ids: seededIds('door') },
    });
    expect(tx?.author).toBe('ai');
    expect(kernel.transactions().map(({ command }) => command)).toEqual([
      "Assistant: link the site's pages",
    ]);
    const header = serializeTreeMarkup(kernel.getDocument().nodes['r-header']?.props['tree']) ?? '';
    expect(header).toContain("aria-current='page' href='/'>Home</a>");
    expect(header).toContain("href='/contact'>Contact</a>");
  });
});
