import { afterEach, describe, expect, it } from 'vitest';

import {
  canUseBrowserWorker,
  createUnavailableScriptRunner,
  defaultScriptRunner,
  resetDefaultScriptRunner,
} from './default-runner';
import { DEFAULT_SCRIPT_LIMITS } from './limits';
import type { ScriptRunRequest } from './types';

function request(code: string): ScriptRunRequest {
  return {
    code,
    elements: [],
    pages: [],
    photos: [],
    tools: [],
    locale: { lang: 'en', dir: 'ltr' },
    seed: 0,
    now: 0,
    limits: DEFAULT_SCRIPT_LIMITS,
  };
}

const scope = globalThis as { Worker?: unknown; window?: unknown };

afterEach(() => {
  resetDefaultScriptRunner();
  delete scope.Worker;
  delete scope.window;
});

describe('defaultScriptRunner', () => {
  it('uses the inline runner outside a page, memoized', async () => {
    expect(canUseBrowserWorker()).toBe(false);
    const first = defaultScriptRunner();
    expect(defaultScriptRunner()).toBe(first);
    const result = await (await first).run(request('return 40 + 2'));
    expect(result).toMatchObject({ ok: true, result: '42' });
  });

  it('picks the browser Worker runner in a page, and a Worker that fails resolves to E_ENGINE', async () => {
    scope.Worker = function BrokenWorker(): never {
      throw new Error('Worker blocked');
    };
    scope.window = {};
    expect(canUseBrowserWorker()).toBe(true);
    const runner = await defaultScriptRunner();
    const result = await runner.run(request('return 1'));
    expect(result.ok ? '' : result.error.code).toBe('E_ENGINE');
  });

  it('createUnavailableScriptRunner answers every run with E_ENGINE', async () => {
    const runner = createUnavailableScriptRunner('wasm missing');
    const result = await runner.run(request('return 1'));
    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'E_ENGINE',
        message:
          'E_ENGINE: the script engine is unavailable right now. Write the same change as plain tool steps.',
      },
    });
    runner.dispose();
  });
});
