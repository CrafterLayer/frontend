import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import type { CodeRuntimeService } from './code-runtime-service';
import type { AuthoredRunCoordinator } from './authored-run';
import { createHandler } from './handler';

const snapshot = {
  projectId: 'project',
  pageId: 'home',
  address: '/',
  entry: 'pages/home.tsx',
  project: {
    formatVersion: 1 as const,
    runtimeProfile: 'craftkit-react-v1' as const,
    dependencyLock: { catalogVersion: 'catalog-v1', packages: {} },
    revision: 'r1',
    files: {
      'pages/home.tsx': {
        language: 'tsx' as const,
        source: 'export default function Page(){return <main>Hello</main>}',
      },
    },
  },
  inputs: {},
};

function request(path: string, body: unknown, authorization = 'Bearer token'): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization },
    body: JSON.stringify(body),
  });
}

function setup() {
  const compile = vi.fn<CodeRuntimeService['compile']>(() =>
    Promise.resolve({
      ok: true,
      artifact: {
        artifactId: 'artifact',
        projectId: 'project',
        pageId: 'home',
        sourceRevision: 'r1',
        scriptUrls: ['/artifacts/artifact/page.js?access=secret'],
        stylesheetUrls: [],
        targetIds: ['node'],
      },
      sourceElements: [],
    }),
  );
  const exportCode = vi.fn<CodeRuntimeService['export']>(() =>
    Promise.resolve({
      ok: true,
      files: [{ path: 'index.html', content: '<main>Hello</main>' }],
      artifactIds: ['artifact'],
    }),
  );
  const serveArtifact = vi.fn<CodeRuntimeService['serveArtifact']>(
    () => new Response('export {}', { headers: { 'content-type': 'text/javascript' } }),
  );
  const runtime: CodeRuntimeService = {
    compile,
    export: exportCode,
    serveArtifact,
  };
  const run = vi.fn<AuthoredRunCoordinator['run']>((runRequest, options) => {
    const unit = {
      unitId: 'hero',
      status: 'completed' as const,
      attempts: 1,
      output: {
        unitId: 'hero',
        summary: 'Built hero',
        changes: [],
        model: 'gpt-5.6-terra',
        provider: 'openai',
        effort: 'medium',
        attempt: 1,
        escalated: false,
      },
    };
    options?.onUnit?.(unit);
    return Promise.resolve({
      version: 1,
      mode: runRequest.mode,
      runId: runRequest.runId,
      projectId: runRequest.projectId,
      sourceRevision: runRequest.sourceRevision,
      units: [unit],
    });
  });
  const authoredRuns: AuthoredRunCoordinator = {
    run,
  };
  const handle = createHandler({
    client: {} as Anthropic,
    authToken: 'token',
    codeRuntime: runtime,
    authoredRuns,
  });
  return { handle, runtime, compile, exportCode, serveArtifact, authoredRuns };
}

describe('code runtime HTTP contract', () => {
  it('authenticates compile and returns only published artifact URLs plus source handles', async () => {
    const { handle, compile } = setup();
    expect((await handle(request('/v1/code/compile', { snapshot }, ''))).status).toBe(401);

    const response = await handle(request('/v1/code/compile', { snapshot }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      artifact: { artifactId: 'artifact', sourceRevision: 'r1' },
      sourceElements: [],
    });
    expect(compile).toHaveBeenCalledWith(snapshot, expect.any(AbortSignal));
  });

  it('rejects malformed snapshots without invoking the compiler', async () => {
    const { handle, compile } = setup();
    const response = await handle(request('/v1/code/compile', { snapshot: { pageId: 'home' } }));
    expect(response.status).toBe(400);
    expect(compile).not.toHaveBeenCalled();
  });

  it('passes optional canonical, language, and direction through export', async () => {
    const { handle, exportCode } = setup();
    const page = {
      ...snapshot,
      title: 'Home',
      description: 'A complete home page.',
      language: 'ar',
      direction: 'rtl',
    };
    const response = await handle(
      request('/v1/code/export', { pages: [page], artifactIds: ['artifact'] }),
    );
    expect(response.status).toBe(200);
    expect(exportCode).toHaveBeenCalledWith([page], ['artifact'], expect.any(AbortSignal));
  });

  it('returns a stale export refusal as a conflict with diagnostics', async () => {
    const { handle, exportCode } = setup();
    exportCode.mockResolvedValueOnce({
      ok: false,
      diagnostics: [
        { code: 'export-refused', severity: 'error', message: 'revision does not match' },
      ],
    });
    const response = await handle(
      request('/v1/code/export', {
        pages: [{ ...snapshot, title: 'Home', description: 'Description' }],
        artifactIds: ['old'],
      }),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ ok: false, diagnostics: [{}] });
  });

  it('serves artifact GETs by capability without exposing the server bearer token', async () => {
    const { handle, serveArtifact } = setup();
    const response = await handle(
      new Request('http://localhost/artifacts/artifact/page.js?access=capability'),
    );
    expect(response.status).toBe(200);
    expect(serveArtifact).toHaveBeenCalled();
  });

  it('checks actual UTF-8 body bytes when Content-Length is absent', async () => {
    const { runtime, compile } = setup();
    const handle = createHandler({
      client: {} as Anthropic,
      authToken: 'token',
      codeRuntime: runtime,
      maxRequestBytes: 10,
    });
    const response = await handle(request('/v1/code/compile', { snapshot }));
    expect(response.status).toBe(413);
    expect(compile).not.toHaveBeenCalled();
  });

  it('streams each completed authored-file unit before the final run record', async () => {
    const { handle } = setup();
    const response = await handle(
      new Request('http://localhost/v1/agent/run', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer token',
          accept: 'text/event-stream',
        },
        body: JSON.stringify({
          version: 1,
          mode: 'auto',
          runId: 'run',
          projectId: 'project',
          sourceRevision: 'r1',
          designContract: {},
          projectIndex: {},
          units: [
            {
              unitId: 'hero',
              role: 'code',
              filePaths: ['pages/hero.tsx'],
              prompt: 'Build hero',
              relevantContext: {},
            },
          ],
        }),
      }),
    );
    const text = await response.text();
    expect(text.indexOf('event: unit')).toBeLessThan(text.indexOf('event: result'));
    expect(text).toContain('"unitId":"hero"');
  });
});
