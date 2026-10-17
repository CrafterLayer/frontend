import { describe, expect, it, vi } from 'vitest';

import type {
  CompiledPageArtifact,
  ManagedCatalog,
  RuntimeSnapshot,
} from '@craftkit/builder/code-runtime';
import { fingerprint, projectFingerprints } from '@craftkit/builder/code-runtime/compiler';

import { createArtifactStore } from './artifact-store';
import { createCodeRuntimeService } from './code-runtime-service';
import type { RuntimeWorkerSupervisor } from './runtime-workers';

const catalog: ManagedCatalog = {
  manifest: {
    catalogVersion: 'test-v1',
    runtimeProfile: 'craftkit-react-v1',
    packages: [
      {
        packageId: 'react',
        version: '19.2.8',
        importSpecifiers: ['react'],
        sourceArtifactId: 'react-source',
        cssArtifactIds: [],
        license: 'MIT',
        integrity: 'react-integrity',
      },
    ],
  },
  modules: { react: { language: 'js', source: 'export const createElement=()=>null' } },
};

function snapshot(revision = 'r1'): RuntimeSnapshot {
  return {
    projectId: 'project',
    pageId: 'home',
    address: '/',
    entry: 'pages/home.tsx',
    project: {
      formatVersion: 1,
      runtimeProfile: 'craftkit-react-v1',
      dependencyLock: { catalogVersion: 'test-v1', packages: { react: '19.2.8' } },
      revision,
      files: {
        'pages/home.tsx': {
          language: 'tsx',
          source: 'export default function Page(){return <main>Hello</main>}',
        },
      },
    },
    inputs: {},
  };
}

async function artifact(source = snapshot()): Promise<CompiledPageArtifact> {
  const identity = await projectFingerprints(source, catalog);
  const script = 'document.getElementById("root").textContent="Hello"';
  return {
    ...identity,
    projectId: source.projectId,
    pageId: source.pageId,
    sourceRevision: source.project.revision,
    entry: source.entry,
    routeEntries: { [source.address]: source.entry },
    js: [{ path: 'page.js', content: script, integrity: await fingerprint(script) }],
    css: [],
    sourceElements: [],
    diagnostics: [],
    createdAt: 1,
  };
}

describe('code runtime service', () => {
  it('publishes compile artifacts then exports only the matching stored revision', async () => {
    const built = await artifact();
    const run = vi.fn<RuntimeWorkerSupervisor['run']>((payload) =>
      Promise.resolve(
        payload.kind === 'compile'
          ? { kind: 'compile', artifact: built, sourceElements: [], cacheHit: false }
          : { kind: 'prerender', result: { html: '<main>Hello</main>', hasPrimaryContent: true } },
      ),
    );
    const service = createCodeRuntimeService({
      workers: { run },
      catalog: () => Promise.resolve(catalog),
      artifacts: createArtifactStore({ token: () => 'capability' }),
    });
    const compiled = await service.compile(snapshot());
    const cached = await service.compile(snapshot());
    const result = await service.export(
      [
        {
          ...snapshot(),
          title: 'Home',
          description: 'A real page.',
          language: 'ar',
          direction: 'rtl',
        },
      ],
      [compiled.artifact.artifactId],
    );

    expect(compiled.artifact.scriptUrls[0]).toContain('access=capability');
    expect(cached.artifact).toEqual(compiled.artifact);
    expect(result).toMatchObject({ ok: true, artifactIds: [built.artifactId] });
    if (result.ok) {
      expect(result.files.find((file) => file.path === 'index.html')?.content).toContain(
        '<html lang="ar" dir="rtl">',
      );
    }
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ kind: 'prerender' }), undefined);
    expect(run.mock.calls.filter(([payload]) => payload.kind === 'compile')).toHaveLength(1);
  });

  it('rejects stale or cross-project artifact ids before launching prerender', async () => {
    const built = await artifact();
    const run = vi.fn<RuntimeWorkerSupervisor['run']>(() =>
      Promise.resolve({ kind: 'compile', artifact: built, sourceElements: [], cacheHit: false }),
    );
    const service = createCodeRuntimeService({
      workers: { run },
      catalog: () => Promise.resolve(catalog),
    });
    const compiled = await service.compile(snapshot());
    const changed = snapshot('r2');
    const result = await service.export(
      [{ ...changed, title: 'Home', description: 'Changed page.' }],
      [compiled.artifact.artifactId],
    );
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'export-refused' }] });
    expect(run).toHaveBeenCalledTimes(1);
  });
});
