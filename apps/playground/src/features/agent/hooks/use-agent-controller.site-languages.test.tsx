/**
 * A whole site in two languages (T230c), with the real engine, the real site kernel, the
 * host's own page opener and language port: "Build a 3-page website: home, about, contact,
 * in English and Arabic" builds three English pages, adds an Arabic version of each (and of
 * nothing the person had before), translates every version, and each language's menus then
 * link that language's own pages.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  createSiteBuilder,
  siteFromDocument,
  type AiPlanProvider,
  type BuilderKernel,
  type BuilderSiteKernel,
} from '@craftkit/builder';
import { fixedClock, seededIds } from '@craftkit/builder/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { pageOpener } from '../../../app/agent-host';
import { marketingLanding, playgroundExtensions } from '../../preview/create-playground-kernel';
import { createLanguageVersions } from '../model/language-versions';
import { forgetAgentSite } from '../model/script-site';
import { memoryStorage, planningProvider } from '../testing/scripted-engine';
import { useAgentController, type UseAgentControllerOptions } from './use-agent-controller';

const WAIT = { timeout: 30_000 } as const;
const REQUEST = 'Build a 3-page website: home, about, contact, in English and Arabic';

function englishSite(): BuilderSiteKernel {
  return createSiteBuilder({
    site: siteFromDocument(marketingLanding('ltr')),
    extensions: playgroundExtensions('landing'),
    ports: { clock: fixedClock(), ids: seededIds('agent-site-languages') },
  });
}

/** Each Arabic version's name for itself, as its translation writes it in its own menu. */
const ARABIC_NAMES: Readonly<Record<string, string>> = {
  '/ar/home': 'الرئيسية',
  '/ar/about': 'من نحن',
  '/ar/contact': 'تواصل',
};

interface TreeNode {
  text?: string;
  attributes?: Record<string, string>;
  children?: TreeNode[];
}

/** The tree with its own link (to `address`) renamed: what a page's translation does to it. */
function renamed(node: TreeNode, address: string, name: string): TreeNode {
  const own = node.attributes?.['href'] === address && node.attributes['lang'] === undefined;
  return {
    ...node,
    ...(own ? { text: name } : {}),
    ...(node.children === undefined
      ? {}
      : { children: node.children.map((child) => renamed(child, address, name)) }),
  };
}

/**
 * Pages a site build plans and fills; a translation sets the open page's title and renames
 * ONLY the page's own link in its header (each page knows its own name, not the others').
 */
function siteProvider(siteKernel: BuilderSiteKernel) {
  const planning = planningProvider();
  const translated: string[] = [];
  const provider: AiPlanProvider = {
    ...planning,
    propose(request, context, live) {
      if (!request.includes('Translate this page to'))
        return planning.propose(request, context, live);
      translated.push(request);
      const address = /\((\/ar\/\w+)\)/u.exec(request)?.[1] ?? '';
      const document = siteKernel.page(siteKernel.currentPage()).getDocument();
      const header = (document.nodes[document.rootId]?.slots?.['default'] ?? []).find((id) => {
        const tree = document.nodes[id]?.props['tree'] as
          { children?: { tag?: string }[] } | undefined;
        return tree?.children?.[0]?.tag === 'header';
      });
      const tree = header === undefined ? undefined : document.nodes[header]?.props['tree'];
      return Promise.resolve({
        rationale: 'Translate the page.',
        commands: [
          { command: 'setProp', args: { id: document.rootId, key: 'title', value: 'بالعربية' } },
          ...(header === undefined || tree === undefined
            ? []
            : [
                {
                  command: 'setProp',
                  args: {
                    id: header,
                    key: 'tree',
                    value: renamed(tree as TreeNode, address, ARABIC_NAMES[address] ?? ''),
                  },
                },
              ]),
        ],
      });
    },
  };
  return { provider, translated };
}

/** The addresses a page's header menu links (its navs, not the phone sheet or the switcher). */
function menuOf(
  kernel: BuilderKernel,
): { readonly href: string; readonly current: boolean; readonly label: string }[] {
  const document = kernel.getDocument();
  const links: { href: string; current: boolean; label: string }[] = [];
  const walk = (node: unknown, inNav: boolean): void => {
    const element = node as {
      tag?: string;
      text?: string;
      attributes?: Record<string, string>;
      children?: unknown[];
    };
    if (element.tag === 'nav' && element.attributes?.['popover'] !== undefined) return;
    const href = element.attributes?.['href'];
    if (
      inNav &&
      element.tag === 'a' &&
      href !== undefined &&
      element.attributes?.['lang'] === undefined
    ) {
      links.push({
        href,
        current: element.attributes?.['aria-current'] === 'page',
        label: element.text ?? '',
      });
    }
    for (const child of element.children ?? []) walk(child, inNav || element.tag === 'nav');
  };
  for (const id of document.nodes[document.rootId]?.slots?.['default'] ?? []) {
    const tree = document.nodes[id]?.props['tree'] as { children?: unknown[] } | undefined;
    const top = tree?.children?.[0] as { tag?: string } | undefined;
    if (top?.tag === 'header') walk(top, false);
  }
  return links;
}

function pageAt(siteKernel: BuilderSiteKernel, address: string): BuilderKernel {
  const page = siteKernel.getSite().pages.find((entry) => entry.address === address);
  if (page === undefined) throw new Error(`No page at ${address}.`);
  return siteKernel.page(page.id);
}

afterEach(() => {
  forgetAgentSite();
});

describe('useAgentController · a site in two languages', () => {
  it('builds the site, versions every built page, translates them, and links each language', async () => {
    const siteKernel = englishSite();
    const { provider, translated } = siteProvider(siteKernel);
    const options: UseAgentControllerOptions = {
      kernel: siteKernel.page(siteKernel.currentPage()),
      locale: 'en',
      storage: memoryStorage(),
      enhancer: null,
      provider,
      addPage: pageOpener(siteKernel),
      languageVersions: createLanguageVersions(siteKernel),
    };
    const hook = renderHook((props: UseAgentControllerOptions) => useAgentController(props), {
      initialProps: options,
    });
    act(() => {
      hook.result.current.setDraft(REQUEST);
    });
    act(() => {
      hook.result.current.send();
    });

    await waitFor(() => {
      expect(translated).toHaveLength(3);
      expect(hook.result.current.state.run).toBeNull();
    }, WAIT);

    const english = ['/home', '/about', '/contact'];
    const arabic = ['/ar/home', '/ar/about', '/ar/contact'];
    // The person's own landing stays one page: only the built pages got versions, each beside it.
    expect(siteKernel.getSite().pages.map(({ address }) => address)).toEqual([
      '/',
      ...english.flatMap((address, at) => [address, arabic[at]]),
    ]);
    expect(translated.map((request) => /\((\/ar\/\w+)\)/u.exec(request)?.[1])).toEqual(arabic);
    for (const pages of [english, arabic]) {
      for (const address of pages) {
        const menu = menuOf(pageAt(siteKernel, address));
        expect(menu.map(({ href }) => href)).toEqual(pages);
        expect(menu.filter(({ current }) => current).map(({ href }) => href)).toEqual([address]);
        // Each language's pages show every page under the name its own translation gave it.
        expect(menu.map(({ label }) => label)).toEqual(
          pages === arabic
            ? arabic.map((page) => ARABIC_NAMES[page])
            : ['Home', 'About', 'Contact'],
        );
      }
    }
    // One linking entry per page and language: three by the site build, three after translation.
    const linked = siteKernel
      .transactions()
      .filter(({ command }) => command === "Assistant: link the site's pages");
    expect(linked).toHaveLength(6);
    // The thread: the site, its three page records and its summary; the versions' note; one
    // translation (the person's turn and its edit) per version.
    expect(hook.result.current.state.turns.map(({ kind }) => kind)).toEqual([
      'user',
      'answer',
      'build',
      'build',
      'build',
      'answer',
      'answer',
      'user',
      'edit',
      'user',
      'edit',
      'user',
      'edit',
    ]);
    const note = hook.result.current.state.turns[6];
    expect(note?.kind === 'answer' ? note.view.text : '').toBe(
      'Added the Arabic versions: /ar/home, /ar/about, /ar/contact. Every version is linked to the others for search and has a language switcher. Translating them now, one page at a time.',
    );
  }, 90_000);
});
