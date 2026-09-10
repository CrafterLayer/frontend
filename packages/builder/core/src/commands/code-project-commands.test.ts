import { describe, expect, it, vi } from 'vitest';

import {
  codeFileHash,
  emptyDocument,
  siteFromDocument,
  type CodeProject,
} from '@craftkit/builder-schema';

import { createSiteBuilder } from '../site/create-site-builder';
import { seededIds } from '../testing/fixed-ports';
import { prepareCodeChangesRebase, type ApplyCodeChangesArgs } from './code-project-commands';

function project(): CodeProject {
  return {
    formatVersion: 1,
    runtimeProfile: 'craftkit-react-v1',
    revision: 'base',
    dependencyLock: { catalogVersion: 'catalog', packages: {} },
    files: {
      'pages/home/index.tsx': {
        language: 'tsx',
        source: 'export default () => <main>Original</main>;',
      },
      'shared/theme.css': { language: 'css', source: 'main { color: black; }' },
    },
  };
}

function setup() {
  return createSiteBuilder({
    site: { ...siteFromDocument(emptyDocument()), codeProjects: { project: project() } },
    ports: { ids: seededIds('code') },
  });
}

function edit(overrides: Partial<ApplyCodeChangesArgs> = {}): ApplyCodeChangesArgs {
  const file = project().files['pages/home/index.tsx'];
  if (!file) throw new Error('fixture file missing');
  return {
    projectId: 'project',
    expectedProjectRevision: 'base',
    attribution: { author: 'user' },
    changes: [
      {
        path: 'pages/home/index.tsx',
        expectedHash: codeFileHash(file),
        file: { language: 'tsx', source: 'recoverable incomplete <main' },
      },
    ],
    ...overrides,
  };
}

describe('code project transactions', () => {
  it('commits a multi-file change as one undo, including recoverable invalid source', () => {
    const kernel = setup();
    const before = kernel.getSite();
    const args = edit();
    args.changes.push({
      path: 'shared/new.css',
      expectedHash: null,
      file: { language: 'css', source: '.hero {}' },
    });
    const transaction = kernel.dispatch('applyCodeChanges', args);
    expect(kernel.transactions()).toHaveLength(1);
    expect(transaction.codeChanges?.[0]).toMatchObject({
      projectId: 'project',
      beforeRevision: 'base',
      attribution: { author: 'user' },
    });
    expect(kernel.getSite().codeProjects?.['project']?.revision).not.toBe('base');
    expect(kernel.getSite().codeProjects?.['project']?.files['shared/new.css']).toBeDefined();
    expect(kernel.undo()).toBe(true);
    expect(kernel.getSite()).toEqual(before);
    expect(kernel.redo()).toBe(true);
    expect(
      kernel.getSite().codeProjects?.['project']?.files['pages/home/index.tsx']?.source,
    ).toContain('incomplete');
  });

  it('rejects one conflicting file without applying any earlier file or logging a transaction', () => {
    const kernel = setup();
    const before = kernel.getSite();
    const args = edit();
    args.changes.push({ path: 'shared/theme.css', expectedHash: 'stale-hash', file: null });
    expect(() => kernel.dispatch('applyCodeChanges', args)).toThrow(/Source changed/);
    expect(kernel.getSite()).toBe(before);
    expect(kernel.transactions()).toEqual([]);
  });

  it('checks expected absence and exact project revision', () => {
    const kernel = setup();
    expect(() =>
      kernel.dispatch(
        'applyCodeChanges',
        edit({
          changes: [
            { path: 'shared/theme.css', expectedHash: null, file: { language: 'css', source: '' } },
          ],
        }),
      ),
    ).toThrow(/Source changed/);
    kernel.dispatch('applyCodeChanges', edit());
    expect(() => kernel.dispatch('applyCodeChanges', edit())).toThrow(/project changed/);
    expect(kernel.transactions()).toHaveLength(1);
  });

  it('refuses duplicate writes to a path and removal of the active entry', () => {
    const kernel = setup();
    const args = edit();
    const first = args.changes[0];
    if (!first) throw new Error('fixture change absent');
    expect(() => kernel.dispatch('applyCodeChanges', { ...args, changes: [first, first] })).toThrow(
      /only once/,
    );
    kernel.dispatch('setCodePage', {
      pageId: 'home',
      reference: { projectId: 'project', entry: first.path, exportName: 'default', inputs: {} },
    });
    const before = kernel.getSite();
    expect(() =>
      kernel.dispatch('applyCodeChanges', { ...args, changes: [{ ...first, file: null }] }),
    ).toThrow(/private entry/);
    expect(kernel.getSite()).toBe(before);
  });

  it('rebases disjoint changes only after the merged graph compiles', async () => {
    const kernel = setup();
    const theme = project().files['shared/theme.css'];
    if (!theme) throw new Error('fixture file missing');
    kernel.dispatch(
      'applyCodeChanges',
      edit({
        changes: [
          {
            path: 'shared/theme.css',
            expectedHash: codeFileHash(theme),
            file: { ...theme, source: 'main { color: navy; }' },
          },
        ],
      }),
    );
    const current = kernel.getSite().codeProjects?.['project'];
    if (!current) throw new Error('fixture project absent');
    const compile = vi.fn((candidate: Readonly<CodeProject>) =>
      Promise.resolve({
        ok: candidate.files['shared/theme.css']?.source.includes('navy') === true,
      }),
    );
    const rebased = await prepareCodeChangesRebase(current, edit(), compile);
    expect(compile).toHaveBeenCalledOnce();
    kernel.dispatch('applyCodeChanges', rebased);
    expect(kernel.getSite().codeProjects?.['project']?.files['shared/theme.css']?.source).toContain(
      'navy',
    );
    expect(kernel.transactions()).toHaveLength(2);
  });

  it('refuses failed merge compilation and a write racing successful compilation', async () => {
    const kernel = setup();
    const current = { ...project(), revision: 'newer' };
    await expect(
      prepareCodeChangesRebase(current, edit(), () => Promise.resolve({ ok: false })),
    ).rejects.toThrow(/did not compile/);
    const ready = await prepareCodeChangesRebase(current, edit(), () => {
      kernel.dispatch('applyCodeChanges', edit());
      return Promise.resolve({ ok: true });
    });
    expect(() => kernel.dispatch('applyCodeChanges', ready)).toThrow(/project changed/);
    expect(kernel.transactions()).toHaveLength(1);
  });

  it('migrates a v1 constructor snapshot before accepting commands', () => {
    const site = siteFromDocument(emptyDocument());
    delete site.codeProjects;
    const kernel = createSiteBuilder({ site: { ...site, siteVersion: 1 } });
    expect(kernel.getSite().siteVersion).toBe(2);
    expect(kernel.getSite().codeProjects).toEqual({});
  });
});
