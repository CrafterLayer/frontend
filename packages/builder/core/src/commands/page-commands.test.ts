import { describe, expect, it } from 'vitest';

import { emptyDocument, siteFromDocument, type BuilderSite } from '@craftkit/builder-schema';

import { createSiteBuilder } from '../site/create-site-builder';
import { seededIds } from '../testing/fixed-ports';
import { fixtureBlocks } from '../testing/fixtures';
import { resolvePageLink } from './page-commands';

function base(): BuilderSite {
  const site = siteFromDocument(emptyDocument());
  const home = site.pages[0];
  if (!home) throw new Error('fixture home absent');
  home.document.nodes['root']!.props['title'] = 'original';
  return {
    ...site,
    pages: [
      home,
      { ...home, id: 'about', title: 'About', address: '/about', document: emptyDocument() },
    ],
  };
}

function setup(site = base()) {
  return createSiteBuilder({
    site,
    ports: { ids: seededIds('pages') },
    extensions: [fixtureBlocks],
  });
}

describe('atomic page operations', () => {
  it('makes a new home, derives a unique old address, and undoes once', () => {
    const site = base();
    const home = site.pages[0];
    if (!home) throw new Error('fixture home absent');
    const kernel = setup({
      ...site,
      pages: [...site.pages, { ...home, id: 'collision', address: '/home' }],
    });
    const before = kernel.getSite();
    kernel.dispatch('setHomePage', { pageId: 'about' });
    expect(kernel.getSite().pages.find((page) => page.id === 'home')?.address).toBe('/home-2');
    expect(resolvePageLink(kernel.getSite(), { pageId: 'about' })).toBe('/');
    expect(kernel.getSite().pages.filter((page) => page.address === '/')).toHaveLength(1);
    kernel.undo();
    expect(kernel.getSite()).toEqual(before);
  });

  it('refuses final-page deletion and retargets inbound links atomically with home replacement', () => {
    const single = setup(siteFromDocument(emptyDocument()));
    expect(() =>
      single.dispatch('removePage', { pageId: 'home', linkResolution: { action: 'unlink' } }),
    ).toThrow(/final page/);
    const site = base();
    site.pages[1]!.document.nodes['root']!.props['link'] = { kind: 'page', pageId: 'home' };
    const kernel = setup(site);
    const before = kernel.getSite();
    expect(() =>
      kernel.dispatch('removePage', { pageId: 'home', replacementHomePageId: 'about' }),
    ).toThrow(/resolution plan/);
    expect(kernel.getSite()).toBe(before);
    kernel.dispatch('removePage', {
      pageId: 'home',
      replacementHomePageId: 'about',
      linkResolution: { action: 'retarget', pageId: 'about' },
    });
    expect(kernel.currentPage()).toBe('about');
    expect(kernel.getSite().pages[0]?.address).toBe('/');
    expect(kernel.getSite().pages[0]?.document.nodes['root']?.props['link']).toEqual({
      kind: 'page',
      pageId: 'about',
    });
    kernel.undo();
    expect(kernel.getSite()).toEqual(before);
  });

  it('keeps captured page identity when a grouped command reorders before editing', () => {
    const kernel = setup();
    kernel.dispatchGroup([
      { command: 'reorderPage', args: { pageId: 'home', toIndex: 1 } },
      {
        command: 'setProp',
        pageId: 'home',
        args: { id: 'root', key: 'title', value: 'edited home' },
      },
    ]);
    expect(
      kernel.getSite().pages.find((page) => page.id === 'home')?.document.nodes['root']?.props[
        'title'
      ],
    ).toBe('edited home');
    expect(
      kernel.getSite().pages.find((page) => page.id === 'about')?.document.nodes['root']?.props[
        'title'
      ],
    ).toBeUndefined();
    expect(kernel.transactions()).toHaveLength(1);
    kernel.undo();
    expect(kernel.getSite()).toEqual(base());
  });

  it('rejects a group editing a removed target without affecting a neighboring page', () => {
    const kernel = setup();
    const before = kernel.getSite();
    expect(() =>
      kernel.dispatchGroup([
        { command: 'removePage', args: { pageId: 'about', linkResolution: { action: 'unlink' } } },
        {
          command: 'setProp',
          pageId: 'about',
          args: { id: 'root', key: 'title', value: 'wrong page' },
        },
      ]),
    ).toThrow(/no longer exists/);
    expect(kernel.getSite()).toBe(before);
    expect(kernel.transactions()).toEqual([]);
  });

  it('duplicates private code and node identities while retaining shared imports, then clears only the copy', () => {
    const kernel = setup();
    kernel.dispatch('createCodeProject', {
      projectId: 'project',
      project: {
        formatVersion: 1,
        runtimeProfile: 'craftkit-react-v1',
        revision: 'r1',
        dependencyLock: { catalogVersion: 'catalog', packages: {} },
        files: {
          'pages/home/index.tsx': {
            language: 'tsx',
            source: "import Header from '../../shared/header'; export default () => <Header />;",
          },
          'shared/header.tsx': {
            language: 'tsx',
            source: 'export default () => <header>Shared</header>;',
          },
        },
      },
    });
    kernel.dispatch('setCodePage', {
      pageId: 'home',
      reference: {
        projectId: 'project',
        entry: 'pages/home/index.tsx',
        exportName: 'default',
        inputs: {},
      },
    });
    const before = kernel.getSite();
    kernel.dispatch('duplicatePage', { pageId: 'home' });
    const copy = kernel.getSite().pages.find((page) => page.id !== 'home' && page.id !== 'about');
    if (!copy) throw new Error('duplicate absent');
    expect(copy.document.rootId).not.toBe(before.pages[0]?.document.rootId);
    const entry = copy.document.nodes[copy.document.rootId]?.props['entry'];
    expect(entry).toBe(`pages/${copy.id}/index.tsx`);
    const project = kernel.getSite().codeProjects?.['project'];
    expect(project?.files[`pages/${copy.id}/index.tsx`]?.source).toContain('../../shared/header');
    expect(project?.files['shared/header.tsx']).toEqual(
      before.codeProjects?.['project']?.files['shared/header.tsx'],
    );
    kernel.dispatch('clearPage', { pageId: copy.id });
    expect(kernel.getSite().pages.find((page) => page.id === copy.id)?.address).toBe(copy.address);
    expect(kernel.getSite().codeProjects?.['project']?.files['pages/home/index.tsx']).toEqual(
      before.codeProjects?.['project']?.files['pages/home/index.tsx'],
    );
    expect(
      kernel.getSite().codeProjects?.['project']?.files[`pages/${copy.id}/index.tsx`]?.source,
    ).toContain('<main />');
  });

  it('preserves stable link destinations after an address change and leaves literal URLs untouched', () => {
    const site = base();
    site.pages[0]!.document.nodes['root']!.props['links'] = [
      { kind: 'page', pageId: 'about' },
      '/about',
    ];
    const kernel = setup(site);
    kernel.dispatch('renamePage', { pageId: 'about', address: '/team' });
    expect(resolvePageLink(kernel.getSite(), { pageId: 'about', fragment: 'people' })).toBe(
      '/team#people',
    );
    expect(kernel.getSite().pages[0]?.document.nodes['root']?.props['links']).toEqual([
      { kind: 'page', pageId: 'about' },
      '/about',
    ]);
    expect(kernel.undo()).toBe(true);
    expect(resolvePageLink(kernel.getSite(), { pageId: 'about' })).toBe('/about');
    expect(kernel.getSite().pages.filter((page) => page.address === '/')).toHaveLength(1);
  });

  it('duplicates private document identity while retaining explicit shared-region references', () => {
    const site = base();
    site.sharedRegions = {
      nav: { id: 'nav', kind: 'header', document: emptyDocument() },
    };
    site.pages[0]!.regions = ['nav'];
    const kernel = setup(site);

    kernel.dispatch('duplicatePage', { pageId: 'home', address: '/home-copy' });
    const copy = kernel.getSite().pages.find((page) => page.address === '/home-copy');
    if (!copy) throw new Error('duplicate absent');
    expect(copy.regions).toEqual(['nav']);
    expect(copy.document.rootId).not.toBe('root');
    expect(kernel.getSite().sharedRegions['nav']).toBeDefined();

    kernel.dispatch(
      'setProp',
      { id: copy.document.rootId, key: 'title', value: 'copy only' },
      'user',
      copy.id,
    );
    expect(copy.id).not.toBe('home');
    expect(
      kernel.getSite().pages.find((page) => page.id === 'home')?.document.nodes['root']?.props[
        'title'
      ],
    ).toBe('original');
    expect(kernel.undo()).toBe(true);
    expect(
      kernel.getSite().pages.find((page) => page.id === copy.id)?.document.nodes[
        copy.document.rootId
      ]?.props['title'],
    ).toBe('original');
    expect(kernel.undo()).toBe(true);
    expect(kernel.getSite()).toEqual(site);
  });

  it('clears the final page without deleting its identity, route, or home status and undoes once', () => {
    const site = siteFromDocument(emptyDocument());
    site.pages[0]!.document.nodes['root']!.props['title'] = 'Keep me';
    const kernel = setup(site);
    const before = kernel.getSite();

    kernel.dispatch('clearPage', { pageId: 'home' });
    const only = kernel.getSite().pages[0];
    expect(only?.id).toBe('home');
    expect(only?.address).toBe('/');
    expect(kernel.getSite().pages).toHaveLength(1);
    expect(only?.document.nodes[only.document.rootId]?.props['title']).toBeUndefined();
    expect(kernel.getSite().pages.filter((page) => page.address === '/')).toHaveLength(1);
    expect(kernel.undo()).toBe(true);
    expect(kernel.getSite()).toEqual(before);
  });

  it('unlinks references in pages and shared regions in one delete and restores both on undo', () => {
    const site = base();
    site.pages[0]!.document.nodes['root']!.props['destination'] = {
      kind: 'page',
      pageId: 'about',
    };
    const nav = emptyDocument();
    nav.nodes['root']!.props['destination'] = { kind: 'page', pageId: 'about' };
    site.sharedRegions = { nav: { id: 'nav', kind: 'header', document: nav } };
    site.pages[0]!.regions = ['nav'];
    const kernel = setup(site);
    const before = kernel.getSite();

    kernel.dispatch('removePage', {
      pageId: 'about',
      linkResolution: { action: 'unlink' },
    });
    expect(kernel.getSite().pages.map((page) => page.id)).toEqual(['home']);
    expect(kernel.getSite().pages[0]?.document.nodes['root']?.props['destination']).toBeNull();
    expect(
      kernel.getSite().sharedRegions['nav']?.document.nodes['root']?.props['destination'],
    ).toBeNull();
    expect(kernel.getSite().pages.filter((page) => page.address === '/')).toHaveLength(1);
    expect(kernel.undo()).toBe(true);
    expect(kernel.getSite()).toEqual(before);
  });
});
