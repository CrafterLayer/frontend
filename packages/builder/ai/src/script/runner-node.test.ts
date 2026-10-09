import { afterAll, describe, expect, it } from 'vitest';

import { DEFAULT_SCRIPT_LIMITS } from './limits';
import { createNodeScriptRunner } from './runner-node';
import type { ScriptLimits, ScriptRunRequest } from './types';

function request(code: string, limits: Partial<ScriptLimits> = {}): ScriptRunRequest {
  return {
    code,
    elements: [
      {
        id: 'b1',
        kind: 'button',
        text: 'Book',
        norm: 'book',
        node: 'n1',
        section: 'Hero',
        sectionId: 'hero',
        page: 'home',
      },
      {
        id: 'b2',
        kind: 'button',
        text: 'Call',
        norm: 'call',
        node: 'n2',
        section: 'Hero',
        sectionId: 'hero',
        page: 'home',
      },
    ],
    pages: [{ id: 'home', title: 'Home', slug: 'home', lang: 'en', dir: 'ltr', current: true }],
    photos: [],
    tools: ['element.style'],
    locale: { lang: 'en', dir: 'ltr' },
    seed: 3,
    now: 0,
    limits: { ...DEFAULT_SCRIPT_LIMITS, ...limits },
  };
}

// A real worker_threads worker: cold start + wasm load can take a second or two under load.
const SLOW = 60_000;

describe('createNodeScriptRunner (real worker thread)', () => {
  const runner = createNodeScriptRunner();
  afterAll(() => {
    runner.dispose();
  });

  it(
    'runs a script in the worker',
    async () => {
      const result = await runner.run(
        request("ck.style(ck.find({kind:'button'}), {borderRadius:'full'}); return 'ok'"),
      );
      expect(result).toMatchObject({
        ok: true,
        calls: [{ n: 1, line: 1, op: 'style', targets: ['b1', 'b2'] }],
        result: 'ok',
      });
    },
    SLOW,
  );

  it(
    "stops a 'x'.repeat(1e5) bomb at hardMs with E_TIMEOUT_HARD, then the next run respawns and succeeds",
    async () => {
      const bomb =
        "const a = []; for (let i = 0; i < 1e6; i++) a.push('x'.repeat(1e5)); return a.length";
      const started = performance.now();
      const stopped = await runner.run(request(bomb, { hardMs: 300 }));
      expect(performance.now() - started).toBeLessThan(5000);
      expect(stopped.ok).toBe(false);
      if (!stopped.ok) {
        expect(stopped.error.code).toBe('E_TIMEOUT_HARD');
        expect(stopped.error.message).toMatch(
          /^E_TIMEOUT_HARD: the script was stopped after 0\.3 s/u,
        );
      }
      const next = await runner.run(request('return 1 + 1'));
      expect(next).toMatchObject({ ok: true, result: '2' });
    },
    SLOW,
  );

  it(
    'serializes concurrent runs',
    async () => {
      const results = await Promise.all([
        runner.run(request('return 1')),
        runner.run(request('return 2')),
        runner.run(request('return 3')),
      ]);
      expect(results.map((r) => (r.ok ? r.result : r.error.code))).toEqual(['1', '2', '3']);
    },
    SLOW,
  );

  it(
    'dispose() terminates the worker and later runs return E_ENGINE',
    async () => {
      const own = createNodeScriptRunner();
      expect((await own.run(request('return 7'))).ok).toBe(true);
      own.dispose();
      const after = await own.run(request('return 8'));
      expect(after.ok).toBe(false);
      if (!after.ok) expect(after.error.code).toBe('E_ENGINE');
    },
    SLOW,
  );

  it(
    'a worker that cannot start → E_ENGINE',
    async () => {
      const broken = createNodeScriptRunner({
        workerUrl: new URL('./does-not-exist.mjs', import.meta.url),
      });
      const result = await broken.run(request('return 1'));
      broken.dispose();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('E_ENGINE');
    },
    SLOW,
  );
});
