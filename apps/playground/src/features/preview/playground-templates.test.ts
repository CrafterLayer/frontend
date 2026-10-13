import { describe, expect, it, vi } from 'vitest';

import type * as Builder from '@craftkit/builder';
import { runAiAgent, type AiPlanProvider, type BuilderKernel } from '@craftkit/builder';
import { fixedClock, seededIds } from '@craftkit/builder/testing';

import { catalogPolicyFor } from './components/AssistantPanel/catalogPolicyFor';
import { createPlaygroundKernel } from './create-playground-kernel';
import {
  hydratePlaygroundTemplates,
  loadPlaygroundTemplates,
  playgroundTemplatesState,
  preloadPlaygroundTemplatesWhenIdle,
  subscribePlaygroundTemplates,
  withPlaygroundTemplates,
} from './playground-templates';

/*
  The page templates load on demand (performance pass, 2026-10-13): ~100 KB gzip
  of copy, photos and compositions left the first load. These tests walk the one
  load a page has — module state, so the cold path runs first — and pin what the
  rest of the suite relies on: a kernel created before the load has no templates
  and still works, gains them the moment they land, and a request after that
  sees them.
*/

const realLoad = vi.hoisted(() => ({ calls: 0, failNext: false }));
vi.mock('@craftkit/builder', async (original) => {
  const actual = await original<typeof Builder>();
  return {
    ...actual,
    loadMarketingTemplates: () => {
      realLoad.calls += 1;
      if (realLoad.failNext) {
        realLoad.failNext = false;
        return Promise.reject(new Error('chunk fetch failed'));
      }
      return actual.loadMarketingTemplates();
    },
  };
});

/** One agent request against `kernel`: which templates its context offered. */
async function offeredTemplates(kernel: BuilderKernel, runId: string) {
  let offered: readonly string[] | undefined;
  const provider: AiPlanProvider = {
    propose: (_request, context) => {
      offered = (context.templates ?? []).map(({ id }) => id);
      return Promise.resolve({
        rationale: 'Keep the page direction.',
        commands: [{ command: 'setDocMeta', args: { dir: 'ltr' } }],
      });
    },
  };
  const result = await runAiAgent({
    runId,
    clock: fixedClock(100),
    kernel,
    provider,
    request: 'Start this page from a template.',
    validationPorts: { clock: fixedClock(200), ids: seededIds(runId) },
    ...catalogPolicyFor('offline', []),
    apply: 'never',
  });
  return { status: result.status, offered };
}

function compositionIds(kernel: BuilderKernel): string[] {
  return kernel.context.registry.compositions('site').map(({ id }) => id);
}

describe('playground templates, loaded on demand', () => {
  it('keeps a kernel working before the load, retries a failed one when idle, and registers on arrival', async () => {
    expect(playgroundTemplatesState()).toEqual({ status: 'pending' });
    const kernel = createPlaygroundKernel({ fixture: 'empty' });
    expect(kernel.validate()).toEqual([]);
    expect(compositionIds(kernel)).toEqual([]);
    expect(realLoad.calls).toBe(0); // Creating a kernel never starts the fetch.

    // A request before the load is offered no templates, and still reaches the provider.
    const before = await offeredTemplates(kernel, 'before-load');
    expect(before).toEqual({ status: 'proposed', offered: [] });

    // A failed fetch is a state the Library can show, and is not remembered as the answer.
    const seen: string[] = [];
    const off = subscribePlaygroundTemplates(() => {
      seen.push(playgroundTemplatesState().status);
    });
    realLoad.failNext = true;
    await expect(loadPlaygroundTemplates()).rejects.toThrow('chunk fetch failed');
    expect(playgroundTemplatesState()).toEqual({ status: 'failed' });
    expect(compositionIds(kernel)).toEqual([]);

    // The vault's fallback waits 4 s before it asks for an idle moment; the canvas going live asks
    // at once and is queued beside it; asking again adds nothing. The idle fetch is the retry.
    const idle: (() => void)[] = [];
    const delays: number[] = [];
    const recordDelay = (_handler: unknown, ms?: number) => {
      delays.push(ms ?? 0);
      return 0;
    };
    const timers = vi
      .spyOn(window, 'setTimeout')
      .mockImplementation(recordDelay as unknown as typeof window.setTimeout);
    Object.assign(window, { requestIdleCallback: (callback: () => void) => idle.push(callback) });
    try {
      preloadPlaygroundTemplatesWhenIdle(4000);
      preloadPlaygroundTemplatesWhenIdle();
      preloadPlaygroundTemplatesWhenIdle();
      preloadPlaygroundTemplatesWhenIdle(4000);
    } finally {
      Reflect.deleteProperty(window, 'requestIdleCallback');
      timers.mockRestore();
    }
    expect(delays).toEqual([4000]);
    expect(idle).toHaveLength(1);
    expect(realLoad.calls).toBe(1);
    idle[0]?.();
    expect(realLoad.calls).toBe(2);
    const templates = await loadPlaygroundTemplates(); // Shares the fetch the idle callback started.
    expect(realLoad.calls).toBe(2);
    off();
    expect(seen).toEqual(['failed', 'pending', 'ready']);
    expect(playgroundTemplatesState()).toEqual({ status: 'ready', templates });

    // The kernel created before the load holds every template now, and a request sees them.
    const shipped = (templates.marketingTemplates.contributes?.compositions ?? []).map(
      ({ id }) => id,
    );
    expect(shipped.length).toBeGreaterThan(0);
    expect(compositionIds(kernel)).toEqual(shipped);
    const after = await offeredTemplates(kernel, 'after-load');
    expect(after.status).toBe('proposed');
    expect(after.offered?.length).toBeGreaterThan(0);
    expect(shipped).toEqual(expect.arrayContaining([...(after.offered ?? [])]));
  });

  it('registers a kernel created after the load at once, and only once', async () => {
    const templates = await loadPlaygroundTemplates();
    const calls = realLoad.calls;
    const kernel = createPlaygroundKernel({ fixture: 'empty' });
    expect(compositionIds(kernel)).toHaveLength(templates.marketingTemplateCatalog.length);
    const version = kernel.extensions.version();

    // Asking again (a StrictMode effect, a test helper) is not a duplicate registration.
    hydratePlaygroundTemplates(kernel);
    await expect(withPlaygroundTemplates(kernel)).resolves.toBe(kernel);
    expect(kernel.extensions.version()).toBe(version);
    preloadPlaygroundTemplatesWhenIdle();
    await expect(loadPlaygroundTemplates()).resolves.toBe(templates);
    expect(realLoad.calls).toBe(calls);
  });
});
