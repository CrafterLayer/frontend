import { describe, expect, it, vi } from 'vitest';
import type { CompiledPageArtifact, ManagedCatalog, RuntimeSnapshot } from './contracts';
import { compileProject } from './compiler/compile-project';
import { instrumentSource } from './compiler/instrument-source';
import { resolveProjectModule, validateManagedCatalog } from './compiler/resolve-project';
import { createBuildCache } from './cache/build-cache';
import { canonicalJson, fingerprint, projectFingerprints } from './fingerprint';
import { validatePreviewEnvelope } from './browser/protocol';
import { exportSite } from './export/export-site';

const catalog: ManagedCatalog = {
  manifest: {
    catalogVersion: 'test-1',
    runtimeProfile: 'craftkit-react-v1',
    packages: [
      {
        packageId: 'react',
        version: '19.2.8',
        importSpecifiers: ['react', 'react/jsx-runtime'],
        sourceArtifactId: 'react',
        cssArtifactIds: [],
        license: 'MIT',
        integrity: 'test',
      },
      {
        packageId: 'react-dom',
        version: '19.2.8',
        importSpecifiers: ['react-dom/client'],
        sourceArtifactId: 'react-dom',
        cssArtifactIds: [],
        license: 'MIT',
        integrity: 'test',
      },
    ],
  },
  modules: {
    react: {
      language: 'js',
      source: 'export function createElement(type,props){return {type,props}}',
    },
    'react/jsx-runtime': {
      language: 'js',
      source: 'export function jsx(type,props){return {type,props}};export const jsxs=jsx;',
    },
    'react-dom/client': {
      language: 'js',
      source:
        'export function createRoot(root){return {render(node){root.textContent=JSON.stringify(node)}}};export function hydrateRoot(root,node){createRoot(root).render(node)}',
    },
  },
};

function snapshot(
  source = 'export default function Page(){return <main><h1>Hello</h1><button>Go</button></main>}',
): RuntimeSnapshot {
  return {
    projectId: 'project',
    pageId: 'home',
    address: '/',
    entry: 'pages/home/Page.tsx',
    inputs: {},
    project: {
      formatVersion: 1,
      runtimeProfile: 'craftkit-react-v1',
      revision: 'r1',
      dependencyLock: {
        catalogVersion: 'test-1',
        packages: { react: '19.2.8', 'react-dom': '19.2.8' },
      },
      files: { 'pages/home/Page.tsx': { language: 'tsx', source } },
    },
  };
}

async function built(): Promise<CompiledPageArtifact> {
  const result = await compileProject(snapshot(), { catalog });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.artifact;
}

describe('fingerprints and cache', () => {
  it('has canonical property order, rejects non-JSON, and pins complete source/catalog inputs', async () => {
    expect(await fingerprint({ b: 2, a: 1 })).toBe(await fingerprint({ a: 1, b: 2 }));
    expect(() => canonicalJson({ invalid: undefined })).toThrow(/JSON/);
    const original = await projectFingerprints(snapshot(), catalog);
    const edit = snapshot('export default()=> <main>Different</main>');
    expect((await projectFingerprints(edit, catalog)).artifactId).not.toBe(original.artifactId);
    expect(
      (await projectFingerprints(snapshot(), { ...catalog, stylesheet: 'p{color:red}' }))
        .artifactId,
    ).not.toBe(original.artifactId);
  });

  it('caches a complete build, protects against alias mutation and evicts oldest entries', async () => {
    const cache = createBuildCache(1);
    const result = await compileProject(snapshot(), { catalog, cache });
    expect(result.ok).toBe(true);
    const repeat = await compileProject(snapshot(), { catalog, cache });
    expect(repeat).toMatchObject({ ok: true, cacheHit: true });
    if (!repeat.ok) return;
    repeat.artifact.js[0]!.content = 'mutated';
    expect((await cache.get(repeat.artifact.artifactId))?.js[0]?.content).not.toBe('mutated');
    const other = await compileProject(snapshot('export default()=> <main>Next</main>'), {
      catalog,
      cache,
    });
    expect(other.ok).toBe(true);
    expect(await cache.get(repeat.artifact.artifactId)).toBeUndefined();
  });
});

describe('managed virtual compiler', () => {
  it('resolves local modules and locked managed imports without a filesystem fallback', () => {
    const state = snapshot();
    state.project.files['shared/copy.ts'] = {
      language: 'ts',
      source: 'export const title="Hello"',
    };
    expect(resolveProjectModule(state, catalog, '../../shared/copy', state.entry).path).toBe(
      'shared/copy.ts',
    );
    expect(resolveProjectModule(state, catalog, 'react', state.entry).kind).toBe('managed');
    for (const invalid of [
      '../../../secret',
      'node:fs',
      '/etc/passwd',
      'https://example.com/x.js',
      'unlisted',
    ])
      expect(() => resolveProjectModule(state, catalog, invalid, state.entry)).toThrow();
    const wrong = { ...catalog, manifest: { ...catalog.manifest, catalogVersion: 'other' } };
    expect(() => {
      validateManagedCatalog(state, wrong);
    }).toThrow(/lock/);
  });

  it('instruments deterministic handles and original offsets without executing authored code', async () => {
    const state = snapshot();
    const source = state.project.files[state.entry]!.source;
    const first = await instrumentSource(state, state.entry, source);
    const second = await instrumentSource(state, state.entry, source);
    expect(first).toEqual(second);
    expect(first.elements.map((element) => element.tag)).toEqual(['main', 'h1', 'button']);
    expect(first.source).toContain('data-ck-source=');
    expect(source.slice(first.elements[1]!.start, first.elements[1]!.end)).toBe('<h1>Hello</h1>');
    await expect(
      instrumentSource(state, state.entry, 'export default()=> <div data-ck-source="forged"/>'),
    ).rejects.toThrow(/Reserved/);
  });

  it('rejects computed module imports before compilation', async () => {
    const result = await compileProject(
      snapshot('const x="https://example.com/a.js"; import(x); export default()=> <main/>'),
      { catalog },
    );
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.diagnostics[0]?.message).toContain('Dynamic import');
  });

  it('compiles TSX with bundled hydration, CSS and a source map', async () => {
    const state = snapshot(
      'import "./page.css"; export default function Page(){return <main className="font-bold">Hello</main>}',
    );
    state.project.files['pages/home/page.css'] = {
      language: 'css',
      source: 'main { color: red; }',
    };
    const result = await compileProject(state, { catalog });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.js[0]?.content).toContain('hydrateRoot');
    expect(result.artifact.css[0]?.content).toContain('color: red');
    expect(result.artifact.sourceMap?.content).toContain('sources');
    expect(result.artifact.sourceElements[0]?.handle.sourceRevision).toBe('r1');
    expect(result.artifact.sourceMap?.content).not.toContain('sourcesContent');
  });

  it('refuses missing imports, syntax errors and oversized source', async () => {
    expect(
      await compileProject(snapshot('import bad from "missing"; export default bad'), { catalog }),
    ).toMatchObject({ ok: false });
    expect(await compileProject(snapshot('export default function {'), { catalog })).toMatchObject({
      ok: false,
    });
    expect(await compileProject(snapshot(), { catalog, maxSourceBytes: 1 })).toMatchObject({
      ok: false,
    });
  });

  it('rejects pre-aborted work and abort during an asynchronous cache lookup', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      compileProject(snapshot(), { catalog, signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    const pending = new AbortController();
    const cache = {
      get: vi.fn(() => {
        pending.abort();
        return Promise.resolve(undefined);
      }),
      put: vi.fn(),
    };
    await expect(
      compileProject(snapshot(), { catalog, cache, signal: pending.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(cache.put).not.toHaveBeenCalled();
  });

  it('pins source before an async lookup and provides source locations for syntax diagnostics', async () => {
    const state = snapshot();
    const before = await projectFingerprints(state, catalog);
    const cache = {
      get: vi.fn(() => {
        state.project.files[state.entry]!.source = 'export default()=> <h1>Raced</h1>';
        return Promise.resolve(undefined);
      }),
      put: vi.fn(),
    };
    const result = await compileProject(state, { catalog, cache });
    expect(result).toMatchObject({ ok: true, artifact: { artifactId: before.artifactId } });
    if (result.ok) expect(result.artifact.js[0]?.content).not.toContain('Raced');
    const invalid = await compileProject(snapshot('export default function {'), { catalog });
    expect(invalid).toMatchObject({
      ok: false,
      diagnostics: [{ modulePath: 'pages/home/Page.tsx', line: 1 }],
    });
  });
});

describe('preview protocol', () => {
  const artifact = {
    projectId: 'project',
    pageId: 'home',
    artifactId: 'a',
    sourceRevision: 'r1',
    targetIds: ['s-1'],
  };
  const envelope = {
    version: 1,
    channel: 'channel',
    projectId: 'project',
    pageId: 'home',
    artifactId: 'a',
    sourceRevision: 'r1',
    type: 'focus',
    payload: { astNodeId: 's-1' },
  };
  it('accepts only revision-pinned declared targets and known commands', () => {
    expect(validatePreviewEnvelope(envelope, artifact, 'channel').ok).toBe(true);
    for (const changed of [
      { channel: 'forged' },
      { sourceRevision: 'old' },
      { type: 'eval' },
      { payload: { astNodeId: 'unknown' } },
      { extra: true },
    ])
      expect(validatePreviewEnvelope({ ...envelope, ...changed }, artifact, 'channel').ok).toBe(
        false,
      );
  });
  it('refuses oversized messages and nonfinite geometry', () => {
    expect(
      validatePreviewEnvelope(
        {
          ...envelope,
          type: 'diagnostic',
          payload: { message: 'x'.repeat(40_000), severity: 'error' },
        },
        artifact,
        'channel',
      ).ok,
    ).toBe(false);
    expect(
      validatePreviewEnvelope(
        {
          ...envelope,
          type: 'geometry',
          payload: { astNodeId: 's-1', x: NaN, y: 0, width: 1, height: 1 },
        },
        artifact,
        'channel',
      ).ok,
    ).toBe(false);
  });
});

describe('revision-pinned export', () => {
  it('keeps Arabic direction and omits canonical metadata until a public domain is known', async () => {
    const artifact = await built();
    const result = await exportSite(
      [{ ...snapshot(), title: 'عنوان', description: 'وصف', language: 'ar', direction: 'rtl' }],
      {
        catalog,
        artifacts: new Map([['home', artifact]]),
        prerender: () => Promise.resolve({ html: '<main>مرحبا</main>', hasPrimaryContent: true }),
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Export failed.');
    const html = result.files.find((file) => file.path === 'index.html')?.content;
    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).not.toContain('rel="canonical"');
  });

  it('emits standalone HTML, indexable content, metadata, CSS and hydration', async () => {
    const artifact = await built();
    const page = {
      ...snapshot(),
      title: 'A <good> page',
      description: 'Description',
      canonicalUrl: 'https://example.com/',
    };
    const result = await exportSite([page], {
      catalog,
      artifacts: new Map([['home', artifact]]),
      prerender: () => Promise.resolve({ html: '<main>Hello</main>', hasPrimaryContent: true }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const html = result.files.find((file) => file.path === 'index.html')?.content;
    expect(html).toContain('<main>Hello</main>');
    expect(html).toContain('A &lt;good&gt; page');
    expect(html).toContain('type="module"');
    expect(result.files.some((file) => file.path.endsWith('.css'))).toBe(true);
  });

  it('refuses stale source, corrupt artifacts and missing primary content', async () => {
    const artifact = await built();
    const prerender = vi.fn(() =>
      Promise.resolve({ html: '<main>Hello</main>', hasPrimaryContent: true }),
    );
    const page = {
      ...snapshot(),
      title: 'Title',
      description: 'Description',
      canonicalUrl: 'https://example.com/',
    };
    const changed = { ...page, project: { ...page.project, revision: 'r2' } };
    expect(
      await exportSite([changed], { catalog, artifacts: new Map([['home', artifact]]), prerender }),
    ).toMatchObject({ ok: false });
    expect(prerender).not.toHaveBeenCalled();
    expect(
      await exportSite([page], {
        catalog,
        artifacts: new Map([['home', artifact]]),
        prerender: () => Promise.resolve({ html: '', hasPrimaryContent: false }),
      }),
    ).toMatchObject({ ok: false });
    artifact.js[0]!.content = 'corrupted';
    prerender.mockClear();
    expect(
      await exportSite([page], { catalog, artifacts: new Map([['home', artifact]]), prerender }),
    ).toMatchObject({ ok: false });
    expect(prerender).not.toHaveBeenCalled();
  });
});
