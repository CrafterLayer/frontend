import { describe, expect, it, vi } from 'vitest';

import { createReferenceCodePageSite } from './code-page-fixture';
import { createCodeRuntimeClient, runtimeSnapshotFromSite } from './code-runtime-client';

describe('playground code runtime client', () => {
  it('projects the source-backed page without copying its project', () => {
    const site = createReferenceCodePageSite();
    const snapshot = runtimeSnapshotFromSite(site, 'home');

    expect(snapshot?.project).toBe(site.codeProjects?.['reference-react-project']);
    expect(snapshot?.entry).toBe('pages/home/index.tsx');
  });

  it('sends the exact snapshot and refuses malformed compile responses', async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true, artifact: {} }), { status: 200 })),
    );
    const client = createCodeRuntimeClient({ endpoint: 'https://runtime.example.test/', fetcher });
    const snapshot = runtimeSnapshotFromSite(createReferenceCodePageSite(), 'home');
    if (snapshot === undefined) throw new Error('Missing test snapshot.');

    await expect(client.compile(snapshot)).rejects.toThrow(/malformed/u);
    expect(fetcher).toHaveBeenCalledWith(
      'https://runtime.example.test/v1/code/compile',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ snapshot }) }),
    );
  });

  it('refuses stale compiler identities and invalid source ranges at the response boundary', async () => {
    const snapshot = runtimeSnapshotFromSite(createReferenceCodePageSite(), 'home');
    if (snapshot === undefined) throw new Error('Missing test snapshot.');
    const artifact = {
      artifactId: 'a',
      projectId: snapshot.projectId,
      pageId: 'home',
      sourceRevision: 'stale',
      scriptUrls: [],
      stylesheetUrls: [],
      targetIds: [],
    };
    let payload: unknown = { ok: true, artifact, sourceElements: [] };
    const fetcher = vi.fn(() => Promise.resolve(new Response(JSON.stringify(payload))));
    const client = createCodeRuntimeClient({ endpoint: 'http://127.0.0.1:8787', fetcher });
    await expect(client.compile(snapshot)).rejects.toThrow(/different source revision/);
    payload = {
      ok: true,
      artifact: { ...artifact, sourceRevision: snapshot.project.revision },
      sourceElements: [{ handle: {}, start: -1, end: 10 }],
    };
    await expect(client.compile(snapshot)).rejects.toThrow(/malformed/);
    expect(fetcher).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        credentials: 'omit',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
      }),
    );
  });

  it('does not permit credentials in endpoints or plaintext remote connections', () => {
    expect(() => createCodeRuntimeClient({ endpoint: 'https://user:pass@example.com' })).toThrow(
      /HTTPS/,
    );
    expect(() => createCodeRuntimeClient({ endpoint: 'http://example.com' })).toThrow(/HTTPS/);
  });
});
