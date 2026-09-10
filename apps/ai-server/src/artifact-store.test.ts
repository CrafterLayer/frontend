import { describe, expect, it } from 'vitest';

import { createArtifactStore } from './artifact-store';
import type { CompiledPageArtifact } from '@craftkit/builder/code-runtime';

function artifact(id = 'artifact-1'): CompiledPageArtifact {
  return {
    artifactId: id,
    projectId: 'project',
    pageId: 'home',
    sourceRevision: 'r1',
    entry: 'pages/home.tsx',
    sourceFingerprint: 'source',
    dependencyFingerprint: 'dependency',
    compilerFingerprint: 'compiler',
    runtimeFingerprint: 'runtime',
    catalogFingerprint: 'catalog',
    routeEntries: { '/': 'pages/home.tsx' },
    js: [{ path: 'page.js', content: 'export {}', integrity: 'js' }],
    css: [{ path: 'page.css', content: 'body{}', integrity: 'css' }],
    sourceElements: [],
    diagnostics: [],
    createdAt: 1,
  };
}

describe('artifact store', () => {
  it('serves immutable content only with its unguessable capability', async () => {
    const store = createArtifactStore({ token: () => 'capability' });
    const preview = store.put(artifact());
    const scriptUrl = preview.scriptUrls[0];
    expect(scriptUrl).toContain('access=capability');
    expect(store.serve(new URL('https://preview.test/artifacts/artifact-1/page.js')).status).toBe(
      404,
    );
    if (scriptUrl === undefined) throw new Error('missing script URL');
    const response = store.serve(new URL(`https://preview.test${scriptUrl}`));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('immutable');
    expect(response.headers.get('content-type')).toContain('javascript');
    expect(await response.text()).toBe('export {}');
  });

  it('returns the same capability for the same immutable artifact', () => {
    const store = createArtifactStore({ token: () => 'stable' });
    expect(store.put(artifact())).toEqual(store.put(artifact()));
  });

  it('refuses an identity collision', () => {
    const store = createArtifactStore();
    store.put(artifact());
    expect(() =>
      store.put({ ...artifact(), js: [{ path: 'page.js', content: 'changed' }] }),
    ).toThrow('collision');
  });

  it('evicts rebuildable artifacts at the entry limit', () => {
    const store = createArtifactStore({ maxArtifacts: 1 });
    store.put(artifact('one'));
    store.put(artifact('two'));
    expect(store.find('one')).toBeUndefined();
    expect(store.find('two')?.artifactId).toBe('two');
    expect(store.metrics()).toMatchObject({ artifacts: 1, evictions: 1 });
  });
});
