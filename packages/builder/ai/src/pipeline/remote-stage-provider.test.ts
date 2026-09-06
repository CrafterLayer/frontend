import { describe, expect, it, vi } from 'vitest';

import { createRemoteSiteStageProvider } from './remote-stage-provider';
import type { SitemapRequest } from './wire';
import { SITE_STAGE_WIRE_VERSION } from './wire';

const request: SitemapRequest = {
  version: SITE_STAGE_WIRE_VERSION,
  stage: 'sitemap',
  runId: 'run-1',
  stageId: 'run-1/sitemap',
  seed: 'seed-1',
  attempt: 1,
  baseFingerprint: 'site-v1-sha256-abc',
  dir: 'ltr',
  limits: { maxPages: 4, maxSectionsPerPage: 6, maxTokens: 20_000 },
  brief: 'a ceramics studio',
};

const answer = {
  stage: 'sitemap',
  dir: 'ltr',
  pages: [{ id: 'home', title: 'Home', purpose: 'Say what this is.' }],
};

/** A fetch stand-in, typed as one so the calls it records are typed too. */
const ok = (body: unknown) =>
  vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify(body), { status: 200 })));

describe('createRemoteSiteStageProvider', () => {
  it('POSTs the whole envelope to ONE endpoint, with the stage as a field', async () => {
    const call = ok(answer);
    const provider = createRemoteSiteStageProvider({
      endpoint: 'https://ai.test/stage',
      fetch: call,
    });

    await provider.run(request);

    const [url, init] = call.mock.calls[0] ?? [];
    expect(url).toBe('https://ai.test/stage');
    const sent = init?.body;
    expect(typeof sent).toBe('string');
    const body: unknown = JSON.parse(typeof sent === 'string' ? sent : '{}');
    /*
      The stage is a field, not a path. A client owning five URLs would make
      every stage addition a two-sided release.
    */
    expect(body).toMatchObject({ stage: 'sitemap', seed: 'seed-1', attempt: 1 });
  });

  it('returns the answer WITHOUT validating it — that is the orchestrator’s door', async () => {
    const nonsense = { stage: 'sitemap', dir: 'ltr', pages: [] };
    const provider = createRemoteSiteStageProvider({
      endpoint: 'https://ai.test/stage',
      fetch: ok(nonsense),
    });
    // An empty sitemap is invalid, and this provider still hands it back: a
    // second door here would be a second opinion the pipeline could not
    // reconcile.
    await expect(provider.run(request)).resolves.toEqual(nonsense);
  });

  it('refuses an answer for a DIFFERENT stage', async () => {
    const provider = createRemoteSiteStageProvider({
      endpoint: 'https://ai.test/stage',
      fetch: ok({ stage: 'structure', pages: [] }),
    });
    await expect(provider.run(request)).rejects.toThrow(/got "structure"/u);
  });

  it('treats a 5xx as worth retrying and a 4xx as not', async () => {
    const server = (status: number) =>
      createRemoteSiteStageProvider({
        endpoint: 'https://ai.test/stage',
        fetch: vi.fn<typeof fetch>(() => Promise.resolve(new Response('no', { status }))),
      });

    await expect(server(503).run(request)).rejects.toMatchObject({ retryable: true, status: 503 });
    await expect(server(400).run(request)).rejects.toMatchObject({ retryable: false, status: 400 });
  });

  it('refuses a body that is not JSON', async () => {
    const provider = createRemoteSiteStageProvider({
      endpoint: 'https://ai.test/stage',
      fetch: vi.fn<typeof fetch>(() => Promise.resolve(new Response('<html>', { status: 200 }))),
    });
    await expect(provider.run(request)).rejects.toThrow(/not JSON/u);
  });

  it('refuses a body past the size ceiling', async () => {
    const provider = createRemoteSiteStageProvider({
      endpoint: 'https://ai.test/stage',
      maxResponseBytes: 10,
      fetch: ok(answer),
    });
    await expect(provider.run(request)).rejects.toMatchObject({ code: 'response-limit' });
  });

  it('refuses a plain http endpoint unless a host says otherwise', () => {
    expect(() => createRemoteSiteStageProvider({ endpoint: 'http://ai.test/stage' })).toThrow(
      /must be https/u,
    );
    expect(() =>
      createRemoteSiteStageProvider({
        endpoint: 'http://localhost:1/stage',
        allowInsecureHttp: true,
      }),
    ).not.toThrow();
  });

  it('aborts the request when the CALLER cancels, not only on its own deadline', async () => {
    const controller = new AbortController();
    const call = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );
    const provider = createRemoteSiteStageProvider({
      endpoint: 'https://ai.test/stage',
      fetch: call,
    });

    const pending = provider.run(request, { signal: controller.signal });
    controller.abort();
    /*
      A provider honouring only its own timeout would leave a stopped run's
      request in flight — paid for, and its answer discarded.
    */
    await expect(pending).rejects.toThrow(/abort/iu);
  });

  it('gives each stage its OWN deadline', async () => {
    vi.useFakeTimers();
    const call = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );
    const provider = createRemoteSiteStageProvider({
      endpoint: 'https://ai.test/stage',
      timeoutMs: 50,
      fetch: call,
    });

    const pending = provider.run(request);
    const settled = expect(pending).rejects.toThrow(/took too long/u);
    await vi.advanceTimersByTimeAsync(51);
    await settled;
    vi.useRealTimers();
  });
});
