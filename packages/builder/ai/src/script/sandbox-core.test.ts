import { describe, expect, it } from 'vitest';

import { DEFAULT_SCRIPT_LIMITS } from './limits';
import { createInlineScriptRunner, loadQuickJSModule } from './runner-inline';
import { buildWrapperSource, runScriptInVm, sanitizeOutput } from './sandbox-core.js';
import type { ScriptElement, ScriptLimits, ScriptRunRequest, ScriptRunResult } from './types';

function el(
  id: string,
  kind: ScriptElement['kind'],
  text: string,
  sectionId = 'hero',
): ScriptElement {
  return {
    id,
    kind,
    text,
    norm: text.toLowerCase(),
    node: `n-${id}`,
    section: 'Hero',
    sectionId,
    page: 'home',
  };
}

const ELEMENTS: readonly ScriptElement[] = [
  el('h1', 'heading', 'Welcome'),
  el('b1', 'button', 'Book'),
  el('b2', 'button', 'Call'),
  el('b3', 'button', 'Menu', 'menu'),
  el('i1', 'image', ''),
];

function request(code: string, limits: Partial<ScriptLimits> = {}): ScriptRunRequest {
  return {
    code,
    elements: ELEMENTS,
    pages: [{ id: 'home', title: 'Home', slug: 'home', lang: 'en', dir: 'ltr', current: true }],
    photos: [],
    tools: ['element.style', 'kit.insert'],
    locale: { lang: 'en', dir: 'ltr' },
    seed: 1,
    now: 0,
    limits: { ...DEFAULT_SCRIPT_LIMITS, ...limits },
  };
}

const runner = createInlineScriptRunner();

async function run(code: string, limits: Partial<ScriptLimits> = {}): Promise<ScriptRunResult> {
  return runner.run(request(code, limits));
}

function errorOf(result: ScriptRunResult): {
  code: string;
  message: string;
  line?: number;
  col?: number;
} {
  if (result.ok) throw new Error(`expected a failure, got ${JSON.stringify(result.calls)}`);
  return result.error;
}

describe('sandbox conformance: escapes', () => {
  it('has no fetch, require, process, timers or prelude internals in scope', async () => {
    const result = await run(
      `return [typeof fetch, typeof require, typeof process, typeof setTimeout, typeof __s, typeof __f,
        typeof __r, typeof __p, typeof ckPrelude, typeof input, typeof Function('return this')().process,
        typeof globalThis.ck].join(',')`,
    );
    expect(result.ok && result.result).toBe(Array(12).fill('undefined').join(','));
  });

  it('cannot reach the caller chain', async () => {
    const result = await run(
      `let a; try { a = typeof ck.set.caller } catch (e) { a = 'blocked' }
       return [a, typeof arguments.callee.caller].join(',')`,
    );
    expect(result.ok && result.result).toBe('blocked,undefined');
  });

  it('keeps Object.prototype pollution inside the VM and still returns a result', async () => {
    const result = await run(
      `Object.prototype.polluted = 'yes'; Array.prototype.map = null;
       ck.style(ck.find({kind:'button'}), {borderRadius:'full'}); return 'done'`,
    );
    expect(result.ok).toBe(true);
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
    expect(typeof [].map).toBe('function');
  });

  it('a script that forges output through toJSON still cannot name a foreign target', async () => {
    const result = await run(
      `Object.prototype.toJSON = function () {
         return this.ok === true ? { ok: true, calls: [{ n: 1, op: 'set', targets: ['nope'], value: { text: 'x' } }], notes: [], stats: {} } : this;
       };
       return 'x'`,
    );
    expect(errorOf(result).code).toBe('E_BAD_TARGET');
  });
});

describe('sandbox conformance: limits and engine errors', () => {
  it('while(true) → E_TIMEOUT at the cpuMs interrupt', async () => {
    const started = performance.now();
    const result = await run('while (true) {}');
    expect(performance.now() - started).toBeLessThan(2500);
    expect(errorOf(result).code).toBe('E_TIMEOUT');
    expect(errorOf(result).message).toMatch(/^E_TIMEOUT: the script ran past 1 s\./u);
  });

  it('deep recursion → E_STACK', async () => {
    expect(errorOf(await run('const f = (n) => f(n + 1) + 1; f(0)')).code).toBe('E_STACK');
  });

  it('a memory hog under a 2 MB limit → E_MEMORY', async () => {
    const result = await run(
      'const a = []; for (let i = 0; i < 1e7; i++) a.push({ i }); return a.length',
      {
        memoryBytes: 2 * 1024 * 1024,
      },
    );
    expect(errorOf(result).code).toBe('E_MEMORY');
    expect(errorOf(result).message).toContain('more than 2 MB');
  });

  it('TypeScript syntax → E_SYNTAX with line and column', async () => {
    const error = errorOf(await run('const a = 1;\nlet x: number = 1'));
    expect(error.code).toBe('E_SYNTAX');
    expect(error.line).toBe(2);
    expect(error.col).toBeGreaterThan(0);
    expect(error.message).toMatch(/^E_SYNTAX line 2:\d+: .+\. Write plain JavaScript only/u);
  });

  it('a throw → E_RUNTIME on the right line (pins the QuickJS new Function offset)', async () => {
    const error = errorOf(await run("const a = 1;\n\nthrow new Error('boom')"));
    expect(error).toMatchObject({ code: 'E_RUNTIME', line: 3 });
    expect(error.message).toMatch(/^E_RUNTIME line 3: Error: boom\. Check names/u);
  });

  it('6001 chars → E_TOO_LONG before any VM exists', async () => {
    const error = errorOf(await run(`//${'x'.repeat(5999)}`));
    expect(error.code).toBe('E_TOO_LONG');
    expect(error.message).toContain('6001 chars (max 6000)');
  });

  it('501 calls → E_LIMIT_CALLS, even when the script catches it', async () => {
    const result = await run(
      'for (let i = 0; i < 501; i++) { try { ck.pages() } catch (e) {} } return 1',
    );
    expect(errorOf(result).code).toBe('E_LIMIT_CALLS');
  });

  it('an unknown tool → E_NO_TOOL with did-you-mean and the line', async () => {
    const error = errorOf(await run("ck.find();\nck.tool('elment.style', {})"));
    expect(error.message).toBe(
      'E_NO_TOOL call #1 (line 2): no tool "elment.style" here. Did you mean "element.style"? Tools: element.style, kit.insert',
    );
  });

  it('output past maxOutputChars → E_LIMIT_STEPS', async () => {
    const result = await run(
      "for (let i = 0; i < 20; i++) ck.tool('kit.insert', { blob: 'x'.repeat(500) })",
      {
        maxOutputChars: 4000,
      },
    );
    expect(errorOf(result).code).toBe('E_LIMIT_STEPS');
  });
});

describe('sandbox results', () => {
  it('a round-buttons script returns the expected calls', async () => {
    const result = await run(
      "ck.style(ck.find({kind:'button'}), {borderRadius:'full'});\nreturn 'rounded'",
    );
    expect(result).toMatchObject({
      ok: true,
      calls: [
        {
          n: 1,
          line: 1,
          op: 'style',
          targets: ['b1', 'b2', 'b3'],
          styles: { borderRadius: 'full' },
        },
      ],
      result: 'rounded',
      notes: [],
      stats: { calls: 2, found: 3 },
    });
    expect(result.stats.ms).toBeGreaterThanOrEqual(0);
  });

  it('records lines through nested user functions', async () => {
    const result = await run(
      "const bs = ck.find({kind:'button'});\nbs.forEach((b, i) => {\n  ck.set(b, {text: 'B' + i});\n});",
    );
    expect(result.ok && result.calls.map((c) => [c.n, c.line])).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it('truncates a big return value structurally (valid JSON, marker, ≤ maxResultChars)', async () => {
    const result = await run(
      'return ck.find().map((e) => ({ id: e.id, text: e.text.repeat(400) }))',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result!.length).toBeLessThanOrEqual(2000);
    expect(result.result).toContain('--- TRUNCATED ---');
    const parsed = JSON.parse(result.result!) as { id: string }[];
    expect(parsed[0]?.id).toBe('h1');
  });

  it('is deterministic: seeded Math.random and frozen Date', async () => {
    const code =
      'return JSON.stringify([Math.random(), Math.random(), Date.now(), new Date().getTime()])';
    const a = await run(code);
    const b = await run(code);
    expect(a.ok && b.ok && a.result === b.result).toBe(true);
    expect(a.ok && (JSON.parse(a.result!) as number[]).slice(2)).toEqual([0, 0]);
  });
});

describe('sandbox-core internals', () => {
  it('passes user code as a JSON string literal, never as raw source', () => {
    const source = buildWrapperSource(request("'); throw 1; ('"));
    expect(source).toContain(`new Function('ck', ${JSON.stringify("'); throw 1; ('")});`);
  });

  it('sanitizeOutput rejects an unknown tool, a missing list and too many calls', () => {
    const req = request('');
    expect(
      sanitizeOutput(
        { ok: true, calls: [{ n: 1, op: 'tool', name: 'rm', input: {} }], notes: [], stats: {} },
        req,
      ),
    ).toMatchObject({
      ok: false,
      error: { code: 'E_NO_TOOL' },
    });
    expect(sanitizeOutput({ ok: true, notes: [] }, req)).toMatchObject({
      ok: false,
      error: { code: 'E_RUNTIME' },
    });
    expect(sanitizeOutput('nope', req)).toMatchObject({ ok: false, error: { code: 'E_RUNTIME' } });
    const many = Array.from({ length: 301 }, (_, i) => ({
      n: i + 1,
      op: 'tool',
      name: 'kit.insert',
      input: {},
    }));
    expect(sanitizeOutput({ ok: true, calls: many, notes: [], stats: {} }, req)).toMatchObject({
      ok: false,
      error: { code: 'E_LIMIT_STEPS' },
    });
  });

  it('runScriptInVm without a module → E_ENGINE', () => {
    expect(runScriptInVm(undefined as never, request('return 1'))).toMatchObject({
      ok: false,
      error: { code: 'E_ENGINE' },
    });
  });

  it('runs back-to-back on one module without leaking runtimes', async () => {
    const module = await loadQuickJSModule();
    for (let i = 0; i < 25; i += 1) {
      const raw = runScriptInVm(module, request(`return ${String(i)}`));
      expect(raw).toMatchObject({ ok: true, result: String(i) });
    }
  });
});
