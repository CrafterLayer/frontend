import { describe, expect, it } from 'vitest';

import {
  defaultDesignSystem,
  emptyDocument,
  type BuilderSite,
  type SelectionTarget,
} from '@craftkit/builder-schema';

import { createContextIndex } from './context-index';

function site(): BuilderSite {
  const about = emptyDocument('site', 'ltr');
  about.nodes[about.rootId] = {
    ...about.nodes[about.rootId]!,
    slots: { children: ['copy'] },
  };
  about.nodes['copy'] = { id: 'copy', type: 'text', props: { text: 'About us' } };
  return {
    siteVersion: 2,
    dir: 'ltr',
    pages: [
      {
        id: 'home',
        address: '/',
        title: 'Home',
        purpose: 'Convert visitors',
        audience: 'Teams',
        document: {
          schemaVersion: 1,
          surface: 'site',
          dir: 'ltr',
          rootId: 'code-root',
          nodes: {
            'code-root': {
              id: 'code-root',
              type: 'codePage',
              props: {
                projectId: 'project',
                entry: 'pages/home/Page.tsx',
                exportName: 'default',
                inputs: {},
              },
            },
          },
        },
        regions: ['header'],
      },
      {
        id: 'about',
        address: '/about',
        title: 'About',
        purpose: 'Explain the company',
        audience: 'Customers',
        document: about,
        regions: ['header'],
      },
    ],
    sharedRegions: {
      header: { id: 'header', kind: 'header', document: emptyDocument('site', 'ltr') },
    },
    designSystem: defaultDesignSystem(),
    assets: {},
    codeProjects: {
      project: {
        formatVersion: 1,
        runtimeProfile: 'craftkit-react-v1',
        dependencyLock: { catalogVersion: 'catalog-1', packages: { react: '19.2.8' } },
        revision: 'source-1',
        files: {
          'pages/home/Page.tsx': {
            language: 'tsx',
            source: 'export default function Page(){return <main>Hello</main>}',
          },
          'shared/theme.css': { language: 'css', source: 'main { color: navy; }' },
        },
      },
    },
  };
}

describe('context index', () => {
  it('indexes relationships and module metadata without including source bodies', () => {
    const index = createContextIndex({ siteId: 'site', siteRevision: 'site-1', site: site() });
    const compact = index.getProjectIndex();

    expect(compact.pages[0]?.codePage).toEqual({
      projectId: 'project',
      entry: 'pages/home/Page.tsx',
      exportName: 'default',
    });
    expect(compact.projects[0]?.files).toEqual([
      expect.objectContaining({ path: 'pages/home/Page.tsx', scope: 'page', pageId: 'home' }),
      expect.objectContaining({ path: 'shared/theme.css', scope: 'shared' }),
    ]);
    expect(compact.sharedRegions[0]?.pageIds).toEqual(['home', 'about']);
    expect(JSON.stringify(compact)).not.toContain('export default function');
    expect(JSON.stringify(compact)).not.toContain('color: navy');
  });

  it('returns only the selected source module and rejects stale source handles', () => {
    const index = createContextIndex({ siteId: 'site', siteRevision: 'site-1', site: site() });
    const selection: SelectionTarget = {
      pageId: 'home',
      revision: 'site-1',
      capabilities: ['inspect', 'editSource'],
      sourceOrNodeId: {
        projectId: 'project',
        modulePath: 'pages/home/Page.tsx',
        sourceRevision: 'source-1',
        astNodeId: 'main',
      },
    };

    const context = index.getSelectionContext(selection);
    expect(context.target.kind).toBe('source');
    if (context.target.kind !== 'source') throw new Error('Expected source context.');
    expect(context.target.language).toBe('tsx');
    expect(context.target.source).toContain('<main>Hello</main>');
    expect(JSON.stringify(context)).not.toContain('color: navy');

    const stale = {
      ...selection,
      sourceOrNodeId: {
        projectId: 'project',
        modulePath: 'pages/home/Page.tsx',
        sourceRevision: 'source-old',
        astNodeId: 'main',
      },
    } as SelectionTarget;
    expect(() => index.getSelectionContext(stale)).toThrow(/older project revision/);
  });

  it('returns one native node plus its ancestry and rejects an old site revision', () => {
    const index = createContextIndex({ siteId: 'site', siteRevision: 'site-1', site: site() });
    const selection: SelectionTarget = {
      pageId: 'about',
      revision: 'site-1',
      capabilities: ['inspect', 'editText'],
      sourceOrNodeId: 'copy',
    };
    expect(index.getSelectionContext(selection).target).toEqual({
      kind: 'node',
      node: { id: 'copy', type: 'text', props: { text: 'About us' } },
      ancestors: [{ id: 'root', type: 'page' }],
    });
    expect(() => index.getSelectionContext({ ...selection, revision: 'site-old' })).toThrow(
      /older site revision/,
    );
  });
});
