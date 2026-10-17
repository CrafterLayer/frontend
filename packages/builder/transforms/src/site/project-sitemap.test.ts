import { describe, expect, it } from 'vitest';

import {
  emptyDocument,
  type AssetEntry,
  type BuilderSite,
  type SharedRegion,
} from '@craftkit/builder-schema';
import { fivePageSite } from '@craftkit/builder-schema/testing';

import { projectSitemap } from './project-sitemap';

describe('projectSitemap', () => {
  it('preserves order and projects home, fallback, and provided thumbnails', () => {
    const site = fivePageSite();
    const map = projectSitemap(site, { thumbnailByPageId: { work: 'blob:work-preview' } });
    expect(map.pages.map((page) => page.id)).toEqual(site.pages.map((page) => page.id));
    expect(map.pages.find((page) => page.id === 'home')?.isHome).toBe(true);
    expect(map.pages.find((page) => page.id === 'work')?.thumbnail).toEqual({
      kind: 'provided',
      src: 'blob:work-preview',
      alt: 'Work preview',
    });
    expect(map.pages.find((page) => page.id === 'about')?.thumbnail.kind).toBe('fallback');
  });

  it('uses the first rendered asset and projects explicit shared-region impact', () => {
    const site = fivePageSite();
    (site.assets as Record<string, AssetEntry>)['hero'] = {
      id: 'hero',
      url: '/assets/hero.webp',
      description: 'Hero',
      mood: [],
      palette: [],
      alt: 'Team working together',
      width: 1200,
      height: 800,
    };
    (site.sharedRegions as Record<string, SharedRegion>)['nav'] = {
      id: 'nav',
      kind: 'header',
      document: emptyDocument(),
    };
    site.pages[0]!.regions = ['nav'];
    site.pages[0]!.document.nodes['intro']!.props['image'] = { assetId: 'hero' };
    const work = projectSitemap(site).pages[0]!;
    expect(work.thumbnail).toEqual({
      kind: 'asset',
      src: '/assets/hero.webp',
      alt: 'Team working together',
    });
    expect(work.sharedReferences).toEqual([{ id: 'nav', label: 'header', kind: 'region' }]);
  });

  it('projects shared imports from a code page without repeating an import', () => {
    const site: BuilderSite = fivePageSite();
    site.codeProjects = {
      project: {
        formatVersion: 1,
        runtimeProfile: 'craftkit-react-v1',
        revision: 'r1',
        dependencyLock: { catalogVersion: 'v1', packages: {} },
        files: {
          'pages/work/index.tsx': {
            language: 'tsx',
            source:
              "import Header from '../../shared/Header.tsx'; import Footer from '../../shared/Footer'; export { Header } from '../../shared/Header.tsx';",
          },
        },
      },
    };
    site.pages[0]!.document = {
      ...emptyDocument(),
      rootId: 'code',
      nodes: {
        code: {
          id: 'code',
          type: 'codePage',
          props: {
            projectId: 'project',
            entry: 'pages/work/index.tsx',
            exportName: 'default',
            inputs: {},
            seo: { image: '/social/work.png' },
          },
        },
      },
    };
    const work = projectSitemap(site).pages[0]!;
    expect(work.thumbnail.kind).toBe('seo');
    expect(work.sharedReferences).toEqual([
      { id: '../../shared/Header.tsx', label: 'Header', kind: 'module' },
      { id: '../../shared/Footer', label: 'Footer', kind: 'module' },
    ]);
  });
});
