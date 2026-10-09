import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import * as engine from './engine';

const dir = new URL('./', import.meta.url);

function source(file: string): string {
  return readFileSync(new URL(file, dir), 'utf8');
}

/** Static (non-type, non-dynamic) import specifiers of a module. */
function staticImports(file: string): string[] {
  const text = source(file);
  const out: string[] = [];
  for (const match of text.matchAll(/^\s*import\s+(?!type\b)[^'"]*?from\s+'([^']+)'/gmu)) {
    if (match[1] !== undefined) out.push(match[1]);
  }
  for (const match of text.matchAll(/^\s*import\s+'([^']+)'/gmu)) {
    if (match[1] !== undefined) out.push(match[1]);
  }
  for (const match of text.matchAll(/^\s*export\s+(?!type\b)[^'"]*?from\s+'([^']+)'/gmu)) {
    if (match[1] !== undefined) out.push(match[1]);
  }
  return out;
}

function resolveLocal(specifier: string): string | undefined {
  if (!specifier.startsWith('./')) return undefined;
  const bare = specifier.slice(2);
  if (bare.endsWith('.js') || bare.endsWith('.mjs')) return bare;
  return `${bare}.ts`;
}

/** Every module reachable from `entry` through static imports, plus the external specifiers. */
function staticGraph(entry: string): { files: Set<string>; externals: Set<string> } {
  const files = new Set<string>();
  const externals = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (files.has(file)) continue;
    files.add(file);
    for (const specifier of staticImports(file)) {
      const local = resolveLocal(specifier);
      if (local === undefined) externals.add(specifier);
      else queue.push(local);
    }
  }
  return { files, externals };
}

describe('script engine barrel', () => {
  it('a plan without script.run loads no engine: the barrel imports neither QuickJS nor the sandbox', () => {
    const { files, externals } = staticGraph('engine.ts');
    expect([...externals].filter((name) => /quickjs|^node:/u.test(name))).toEqual([]);
    expect(files.has('sandbox-core.js')).toBe(false);
    expect(files.has('runner-browser.ts')).toBe(false);
    expect(files.has('runner-node.ts')).toBe(false);
  });

  it('nothing on the browser path imports node:*', () => {
    for (const entry of [
      'engine.ts',
      'runner-browser.ts',
      'sandbox-worker.browser.ts',
      'runner-inline.ts',
    ]) {
      const { externals } = staticGraph(entry);
      expect(
        [...externals].filter((name) => name.startsWith('node:')),
        entry,
      ).toEqual([]);
    }
    for (const file of ['runner-inline.ts', 'default-runner.ts', 'runner-browser.ts']) {
      expect(source(file)).not.toMatch(/import\(\s*'node:/u);
    }
  });

  it('the Node runner is reachable only from the script-node subpath', () => {
    expect(staticGraph('node.ts').externals.has('node:worker_threads')).toBe(true);
    expect('createNodeScriptRunner' in engine).toBe(false);
  });

  it('exports the contract, limits, errors, normalizer, truncation and the runners', () => {
    expect(engine.SCRIPT_TOOL_NAME).toBe('script.run');
    expect(engine.DEFAULT_SCRIPT_LIMITS.maxSourceChars).toBe(6000);
    expect(typeof engine.scriptErrorMessage).toBe('function');
    expect(typeof engine.normalizeScriptCode).toBe('function');
    expect(typeof engine.truncateResult).toBe('function');
    expect(typeof engine.createInlineScriptRunner).toBe('function');
    expect(typeof engine.defaultScriptRunner).toBe('function');
  });
});
