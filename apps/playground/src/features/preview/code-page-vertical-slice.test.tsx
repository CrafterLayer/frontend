// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  createSiteBuilder,
  emptyDocument,
  openSite,
  type BuilderSite,
  type CodeFile,
} from '@craftkit/builder';
import { fixedClock, seededIds } from '@craftkit/builder/testing';
import {
  composeManagedCatalog,
  type CompiledPageArtifact,
  type ManagedCatalog,
  type RuntimeSnapshot,
} from '@craftkit/builder/code-runtime';
import { compileProject } from '@craftkit/builder/code-runtime/compiler';
import { exportSite } from '@craftkit/builder/code-runtime/export';

import {
  createReferenceCodePageSite,
  installReferenceCodePage,
  REFERENCE_CODE_PROJECT_ID,
} from './code-page-fixture';
import { createVaultSitePersistence, type SiteArtifactMetadata } from '../vault/site-persistence';
import { createMemoryVaultStore } from '../vault/store';

const SITE_ID = 'playground/reference-code-page';
const ORIGINAL_HEADLINE = 'Turn ambitious ideas into a site people remember.';
const EDITED_HEADLINE = 'Build a site your audience remembers.';

function legacyStartingSite(): BuilderSite {
  const reference = createReferenceCodePageSite();
  const home = reference.pages[0];
  if (home === undefined) throw new Error('The reference fixture needs a home page.');
  return {
    ...reference,
    pages: [{ ...home, document: emptyDocument('site', 'ltr') }],
    codeProjects: {},
  };
}

function catalog(): ManagedCatalog {
  return composeManagedCatalog({
    manifest: {
      catalogVersion: 'craftkit-managed-reference-v1',
      runtimeProfile: 'craftkit-react-v1',
      packages: [
        {
          packageId: 'react',
          version: '19.2.8',
          importSpecifiers: ['react', 'react/jsx-runtime'],
          sourceArtifactId: 'react-reference-runtime',
          cssArtifactIds: [],
          license: 'MIT',
          integrity: 'reference-react-integrity',
        },
        {
          packageId: 'react-dom',
          version: '19.2.8',
          importSpecifiers: ['react-dom/client'],
          sourceArtifactId: 'react-dom-reference-runtime',
          cssArtifactIds: [],
          license: 'MIT',
          integrity: 'reference-react-dom-integrity',
        },
      ],
    },
    modules: {
      react: {
        language: 'js',
        source:
          'export function createElement(type, props) { return { type, props }; } export function useState(initial) { return [initial, () => undefined]; }',
      },
      'react/jsx-runtime': {
        language: 'js',
        source:
          'export const Fragment = Symbol.for("reference.fragment"); export function jsx(type, props) { return { type, props }; } export const jsxs = jsx;',
      },
      'react-dom/client': {
        language: 'js',
        source:
          'export function createRoot() { return { render() {} }; } export function hydrateRoot() { return undefined; }',
      },
    },
  });
}

function snapshot(site: BuilderSite): RuntimeSnapshot {
  const page = site.pages.find(({ id }) => id === 'home');
  const project = site.codeProjects?.[REFERENCE_CODE_PROJECT_ID];
  const root = page?.document.nodes[page.document.rootId];
  if (page === undefined || project === undefined || root?.type !== 'codePage') {
    throw new Error('The site does not contain the installed reference code page.');
  }
  const entry = root.props['entry'];
  const inputs = root.props['inputs'];
  if (
    typeof entry !== 'string' ||
    inputs === null ||
    Array.isArray(inputs) ||
    typeof inputs !== 'object'
  ) {
    throw new Error('The code page reference is malformed.');
  }
  return {
    projectId: REFERENCE_CODE_PROJECT_ID,
    pageId: page.id,
    address: page.address,
    entry,
    project,
    inputs,
  };
}

function fileHash(file: CodeFile): string {
  return JSON.stringify([file.language, file.source]);
}

function metadataOf(artifact: CompiledPageArtifact): SiteArtifactMetadata {
  return {
    artifactId: artifact.artifactId,
    projectId: artifact.projectId,
    pageId: artifact.pageId,
    sourceRevision: artifact.sourceRevision,
    sourceFingerprint: artifact.sourceFingerprint,
    dependencyFingerprint: artifact.dependencyFingerprint,
    compilerFingerprint: artifact.compilerFingerprint,
    runtimeFingerprint: artifact.runtimeFingerprint,
    catalogFingerprint: artifact.catalogFingerprint,
    routeEntries: artifact.routeEntries,
    createdAt: artifact.createdAt,
  };
}

describe('professional builder M0 code-page vertical slice', () => {
  it('creates TSX, compiles, targets a nested element, edits, undoes, reloads, and exports', async () => {
    const store = createMemoryVaultStore();
    const persistence = createVaultSitePersistence({ store, seed: legacyStartingSite });
    const kernel = createSiteBuilder({
      site: legacyStartingSite(),
      ports: { clock: fixedClock(), ids: seededIds('code-page') },
      persistence: { adapter: persistence, siteId: SITE_ID },
    });

    installReferenceCodePage(kernel, 'home');
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.validate()).toMatchObject({ ok: true });

    const firstSnapshot = snapshot(kernel.getSite());
    const firstCompile = await compileProject(firstSnapshot, { catalog: catalog() });
    expect(firstCompile.ok).toBe(true);
    if (!firstCompile.ok) throw new Error(firstCompile.diagnostics[0]?.message);
    const heading = firstCompile.artifact.sourceElements.find(({ tag }) => tag === 'h1');
    expect(heading).toBeDefined();
    if (heading === undefined) throw new Error('The compiled heading has no source handle.');

    const sourceFile = firstSnapshot.project.files[heading.handle.modulePath];
    if (sourceFile === undefined) throw new Error('The selected source module is missing.');
    const selectedSource = sourceFile.source.slice(heading.start, heading.end);
    expect(selectedSource).toContain(ORIGINAL_HEADLINE);
    const editedSelection = selectedSource.replace(ORIGINAL_HEADLINE, EDITED_HEADLINE);
    const editedSource =
      sourceFile.source.slice(0, heading.start) +
      editedSelection +
      sourceFile.source.slice(heading.end);

    kernel.dispatch(
      'applyCodeChanges',
      {
        projectId: REFERENCE_CODE_PROJECT_ID,
        expectedProjectRevision: firstSnapshot.project.revision,
        changes: [
          {
            path: heading.handle.modulePath,
            expectedHash: fileHash(sourceFile),
            file: { ...sourceFile, source: editedSource },
          },
        ],
        attribution: { author: 'user' },
      },
      'user',
    );
    const editedSnapshot = snapshot(kernel.getSite());
    expect(editedSnapshot.project.revision).not.toBe(firstSnapshot.project.revision);
    expect(editedSnapshot.project.files[heading.handle.modulePath]?.source).toContain(
      EDITED_HEADLINE,
    );
    expect(heading.handle.sourceRevision).not.toBe(editedSnapshot.project.revision);

    expect(kernel.undo()).toBe(true);
    expect(snapshot(kernel.getSite()).project.files[heading.handle.modulePath]?.source).toContain(
      ORIGINAL_HEADLINE,
    );
    expect(kernel.redo()).toBe(true);
    expect(snapshot(kernel.getSite()).project.files[heading.handle.modulePath]?.source).toContain(
      EDITED_HEADLINE,
    );

    const editedCompile = await compileProject(snapshot(kernel.getSite()), { catalog: catalog() });
    expect(editedCompile.ok).toBe(true);
    if (!editedCompile.ok) throw new Error(editedCompile.diagnostics[0]?.message);
    await kernel.flush();
    await persistence.saveArtifactMetadata(SITE_ID, metadataOf(editedCompile.artifact));

    const reopenedPersistence = createVaultSitePersistence({ store, seed: legacyStartingSite });
    const reopened = await openSite(reopenedPersistence, SITE_ID, {
      ports: { clock: fixedClock(), ids: seededIds('reopened-code-page') },
    });
    const restoredSnapshot = snapshot(reopened.getSite());
    expect(restoredSnapshot.project.files[heading.handle.modulePath]?.source).toContain(
      EDITED_HEADLINE,
    );
    expect((await reopenedPersistence.loadArtifactMetadata(SITE_ID))['home']).toMatchObject({
      artifactId: editedCompile.artifact.artifactId,
      sourceRevision: restoredSnapshot.project.revision,
    });

    const restoredCompile = await compileProject(restoredSnapshot, { catalog: catalog() });
    expect(restoredCompile.ok).toBe(true);
    if (!restoredCompile.ok) throw new Error(restoredCompile.diagnostics[0]?.message);
    expect(restoredCompile.artifact.artifactId).toBe(editedCompile.artifact.artifactId);

    const exported = await exportSite(
      [
        {
          ...restoredSnapshot,
          title: 'Northstar Studio',
          description: 'An interactive reference page for the CraftKit code runtime.',
          canonicalUrl: 'https://northstar.example/',
        },
      ],
      {
        catalog: catalog(),
        artifacts: new Map([['home', restoredCompile.artifact]]),
        prerender: () =>
          Promise.resolve({
            html: `<main><h1>${EDITED_HEADLINE}</h1><button>Start brief · 12</button></main>`,
            hasPrimaryContent: true,
          }),
      },
    );

    expect(exported.ok).toBe(true);
    if (!exported.ok) throw new Error(exported.diagnostics[0]?.message);
    const html = exported.files.find(({ path }) => path === 'index.html')?.content;
    expect(html).toContain(EDITED_HEADLINE);
    expect(html).toContain('<script type="module"');
    expect(exported.artifactIds).toEqual([restoredCompile.artifact.artifactId]);
  });
});
