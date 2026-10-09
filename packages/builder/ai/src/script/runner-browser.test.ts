import { describe, expect, it } from 'vitest';

import type { RawScriptRunResult } from './errors';
import { DEFAULT_SCRIPT_LIMITS } from './limits';
import {
  createBrowserScriptRunner,
  type ScriptWorkerEvent,
  type ScriptWorkerLike,
} from './runner-browser';
import { loadQuickJSModule } from './runner-inline';
import { runScriptInVm } from './sandbox-core.js';
import type { ScriptLimits, ScriptRunRequest } from './types';

type Listener = (event: ScriptWorkerEvent) => void;

/** Answers the protocol like sandbox-worker.browser.ts, under test control. */
class FakeWorker implements ScriptWorkerLike {
  static created: FakeWorker[] = [];
  readonly posted: { id: number; request: ScriptRunRequest }[] = [];
  terminated = false;
  private readonly listeners: Record<string, Listener[]> = {};

  constructor(
    private readonly behaviour: {
      ready?: boolean | 'never';
      answer?: (
        request: ScriptRunRequest,
      ) => RawScriptRunResult | Promise<RawScriptRunResult> | undefined;
    } = {},
  ) {
    FakeWorker.created.push(this);
    if (behaviour.ready !== 'never') {
      queueMicrotask(() => {
        this.emit('message', {
          data:
            behaviour.ready === false ? { ready: false, error: 'wasm blocked' } : { ready: true },
        });
      });
    }
  }

  addEventListener(type: string, listener: Listener): void {
    (this.listeners[type] ??= []).push(listener);
  }

  emit(type: string, event: ScriptWorkerEvent): void {
    if (this.terminated) return;
    for (const listener of this.listeners[type] ?? []) listener(event);
  }

  postMessage(message: unknown): void {
    const { id, request } = message as { id: number; request: ScriptRunRequest };
    this.posted.push({ id, request });
    const answer = this.behaviour.answer ?? (() => ok(`ran ${String(id)}`));
    void Promise.resolve(answer(request)).then((result) => {
      if (result !== undefined) this.emit('message', { data: { id, result } });
    });
  }

  terminate(): void {
    this.terminated = true;
  }
}

function ok(result: string): RawScriptRunResult {
  return { ok: true, calls: [], result, notes: [], stats: { ms: 1, calls: 0, found: 0 } };
}

function request(code = 'return 1', limits: Partial<ScriptLimits> = {}): ScriptRunRequest {
  return {
    code,
    elements: [],
    pages: [],
    photos: [],
    tools: [],
    locale: { lang: 'en', dir: 'ltr' },
    seed: 0,
    now: 0,
    limits: { ...DEFAULT_SCRIPT_LIMITS, ...limits },
  };
}

describe('createBrowserScriptRunner (fake Worker)', () => {
  it('waits for ready, posts {id, request} and finalizes the answer', async () => {
    let worker: FakeWorker | undefined;
    const runner = createBrowserScriptRunner({ createWorker: () => (worker = new FakeWorker()) });
    const result = await runner.run(request('return 1'));
    expect(result).toMatchObject({ ok: true, result: 'ran 1' });
    expect(worker?.posted[0]?.request.code).toBe('return 1');
    expect(worker?.posted[0]?.request.limits).toEqual(DEFAULT_SCRIPT_LIMITS);
  });

  it('runs the real sandbox behind the protocol', async () => {
    const module = await loadQuickJSModule();
    const runner = createBrowserScriptRunner({
      createWorker: () => new FakeWorker({ answer: (req) => runScriptInVm(module, req) }),
    });
    const result = await runner.run(request('ck.note("hi"); return 6 * 7'));
    expect(result).toMatchObject({ ok: true, result: '42', notes: ['hi'] });
  });

  it('terminates on the hard timeout, returns E_TIMEOUT_HARD and respawns for the next run', async () => {
    let hang = true;
    const runner = createBrowserScriptRunner({
      createWorker: () => new FakeWorker({ answer: () => (hang ? undefined : ok('fresh')) }),
    });
    const before = FakeWorker.created.length;
    const stopped = await runner.run(request('while(true){}', { hardMs: 40 }));
    expect(stopped.ok).toBe(false);
    if (!stopped.ok) expect(stopped.error.code).toBe('E_TIMEOUT_HARD');
    const first = FakeWorker.created[before];
    expect(first?.terminated).toBe(true);

    hang = false;
    const next = await runner.run(request());
    expect(next).toMatchObject({ ok: true, result: 'fresh' });
    expect(FakeWorker.created.length - before).toBe(2);
  });

  it('queues runs: one request in flight at a time, answers in order', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const runner = createBrowserScriptRunner({
      createWorker: () =>
        new FakeWorker({
          answer: async (req) => {
            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await new Promise((resolve) => setTimeout(resolve, 5));
            inFlight -= 1;
            return ok(req.code);
          },
        }),
    });
    const results = await Promise.all(['a', 'b', 'c'].map((code) => runner.run(request(code))));
    expect(results.map((r) => (r.ok ? r.result : ''))).toEqual(['a', 'b', 'c']);
    expect(maxInFlight).toBe(1);
  });

  it('a worker whose wasm fails to load → E_ENGINE, retried on the next run', async () => {
    let attempts = 0;
    const runner = createBrowserScriptRunner({
      createWorker: () => {
        attempts += 1;
        return new FakeWorker({ ready: attempts > 1 });
      },
    });
    const failed = await runner.run(request());
    expect(failed.ok ? '' : failed.error.message).toBe(
      'E_ENGINE: the script engine is unavailable right now. Write the same change as plain tool steps.',
    );
    expect((await runner.run(request())).ok).toBe(true);
  });

  it('a worker that never says ready → E_ENGINE after startupMs', async () => {
    const runner = createBrowserScriptRunner({
      createWorker: () => new FakeWorker({ ready: 'never' }),
      startupMs: 30,
    });
    const result = await runner.run(request());
    expect(result.ok ? '' : result.error.code).toBe('E_ENGINE');
  });

  it('a Worker constructor that throws (CSP) → E_ENGINE', async () => {
    const runner = createBrowserScriptRunner({
      createWorker: () => {
        throw new Error('blocked by CSP');
      },
    });
    const result = await runner.run(request());
    expect(result.ok ? '' : result.error.code).toBe('E_ENGINE');
  });

  it('a worker error mid-run → E_ENGINE', async () => {
    let worker: FakeWorker | undefined;
    const runner = createBrowserScriptRunner({
      createWorker: () =>
        (worker = new FakeWorker({
          answer: () => {
            queueMicrotask(() => worker?.emit('error', { message: 'boom' }));
            return undefined;
          },
        })),
    });
    const result = await runner.run(request());
    expect(result.ok ? '' : result.error.code).toBe('E_ENGINE');
    expect(worker?.terminated).toBe(true);
  });

  it('E_TOO_LONG short-circuits without spawning a worker', async () => {
    let spawned = 0;
    const runner = createBrowserScriptRunner({
      createWorker: () => {
        spawned += 1;
        return new FakeWorker();
      },
    });
    const result = await runner.run(request('x'.repeat(6001)));
    expect(result.ok ? '' : result.error.code).toBe('E_TOO_LONG');
    expect(spawned).toBe(0);
  });

  it('dispose() terminates, settles the pending run and refuses later runs', async () => {
    let worker: FakeWorker | undefined;
    const runner = createBrowserScriptRunner({
      createWorker: () => (worker = new FakeWorker({ answer: () => undefined })),
    });
    const pending = runner.run(request());
    await new Promise((resolve) => setTimeout(resolve, 10));
    runner.dispose();
    const result = await pending;
    expect(result.ok ? '' : result.error.code).toBe('E_ENGINE');
    expect(worker?.terminated).toBe(true);
    const later = await runner.run(request());
    expect(later.ok ? '' : later.error.code).toBe('E_ENGINE');
  });
});
