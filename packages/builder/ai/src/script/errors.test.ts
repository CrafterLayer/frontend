import { describe, expect, it } from 'vitest';

import {
  didYouMean,
  finalizeScriptRun,
  isScriptErrorCode,
  levenshtein,
  rawScriptFailure,
  scriptError,
  scriptErrorMessage,
} from './errors';
import { DEFAULT_SCRIPT_LIMITS } from './limits';
import { SCRIPT_ERROR_CODES } from './types';

describe('scriptErrorMessage: the exact DESIGN §A.8 texts', () => {
  it.each([
    [
      'E_TOO_LONG',
      { chars: 6400 },
      'E_TOO_LONG: the script is 6400 chars (max 6000). Put repeated data in one array and loop over it; if every edit is different, write plain steps instead.',
    ],
    [
      'E_SYNTAX',
      { line: 2, col: 7, message: "expecting ';'" },
      "E_SYNTAX line 2:7: expecting ';'. Write plain JavaScript only: no TypeScript types, no import/export, no await, single quotes inside the JSON string.",
    ],
    [
      'E_RUNTIME',
      { line: 4, message: 'TypeError: not a function' },
      'E_RUNTIME line 4: TypeError: not a function. Check names: only ck.find/pages/photos/set/style/tool/fmt/note exist; El fields are id,kind,text,tag,node,section,page,path,part,index,src,href.',
    ],
    [
      'E_TIMEOUT',
      {},
      'E_TIMEOUT: the script ran past 1 s. Loop over ck.find() results; never while(true) or nested loops over all elements.',
    ],
    [
      'E_TIMEOUT_HARD',
      {},
      'E_TIMEOUT_HARD: the script was stopped after 3 s (it built very large strings or arrays). Queue edits with ck.set/ck.style instead of building text.',
    ],
    [
      'E_MEMORY',
      {},
      'E_MEMORY: the script used more than 16 MB. Do not build big strings or arrays; queue edits directly.',
    ],
    ['E_STACK', {}, 'E_STACK: recursion too deep. Use a for loop instead of recursion.'],
    [
      'E_LIMIT_CALLS',
      {},
      "E_LIMIT_CALLS: more than 500 ck calls. Pass arrays: ck.style(ck.find({kind:'button'}), {...}) is ONE call.",
    ],
    [
      'E_LIMIT_STEPS',
      {},
      'E_LIMIT_STEPS: more than 300 edits in one script. Narrow with ck.find({section}) or do the rest in followUp.',
    ],
    [
      'E_NO_TOOL',
      {
        n: 3,
        line: 5,
        name: 'elment.style',
        suggestion: 'element.style',
        tools: ['element.style', 'kit.insert'],
      },
      'E_NO_TOOL call #3 (line 5): no tool "elment.style" here. Did you mean "element.style"? Tools: element.style, kit.insert',
    ],
    [
      'E_BAD_TARGET',
      { n: 1, line: 2, message: 'target 1 is "hero-title", not an element from ck.find()' },
      'E_BAD_TARGET call #1 (line 2): target 1 is "hero-title", not an element from ck.find(). Pass elements returned by ck.find(), not ids you wrote.',
    ],
    [
      'E_TOOL_INPUT',
      { n: 2, line: 9, name: 'kit.insert', message: 'Unknown kit "menu-grid".' },
      'E_TOOL_INPUT call #2 (line 9) tool "kit.insert": Unknown kit "menu-grid".',
    ],
    [
      'E_EMPTY',
      { kind: 'button', found: 0, kinds: { heading: 12, button: 0, image: 6 } },
      "E_EMPTY: the script changed nothing. ck.find({kind:'button'}) found 0 here; kinds on this page: heading 12, image 6",
    ],
    [
      'E_OTHER_PAGE',
      { page: 'home' },
      'E_OTHER_PAGE: this edit can only change the open page (page "home"). Edit this page now and say in followUp which other pages need the same change.',
    ],
    [
      'E_TOO_MANY_WRITES',
      { count: 80 },
      'E_TOO_MANY_WRITES: the script touches 80 sections (max 64 writes per plan). Limit it with ck.find({section}) and put the rest in followUp.',
    ],
    [
      'E_ENGINE',
      {},
      'E_ENGINE: the script engine is unavailable right now. Write the same change as plain tool steps.',
    ],
  ] as const)('%s', (code, detail, text) => {
    expect(scriptErrorMessage(code, detail)).toBe(text);
  });

  it('covers every code in SCRIPT_ERROR_CODES', () => {
    for (const code of SCRIPT_ERROR_CODES)
      expect(scriptErrorMessage(code, {})).toMatch(new RegExp(`^${code}`, 'u'));
  });

  it('omits the line / call parts that are unknown', () => {
    expect(scriptErrorMessage('E_SYNTAX', { message: 'x' })).toMatch(/^E_SYNTAX: x\. /u);
    expect(scriptErrorMessage('E_NO_TOOL', { name: 'zz', tools: [] })).toBe(
      'E_NO_TOOL: no tool "zz" here. Tools: (none)',
    );
    expect(scriptErrorMessage('E_EMPTY', { kinds: { heading: 2 } })).toBe(
      'E_EMPTY: the script changed nothing. Kinds on this page: heading 2',
    );
  });

  it('quotes the request limits when they differ from the defaults', () => {
    expect(scriptErrorMessage('E_TIMEOUT', { limits: { cpuMs: 500 } })).toContain('ran past 0.5 s');
    expect(scriptErrorMessage('E_MEMORY', { limits: { memoryBytes: 2 * 1024 * 1024 } })).toContain(
      'more than 2 MB',
    );
    expect(scriptErrorMessage('E_TIMEOUT_HARD', { limits: { hardMs: 300 } })).toContain(
      'stopped after 0.3 s',
    );
  });

  it('caps every message at maxErrorChars (600)', () => {
    const long = scriptErrorMessage('E_RUNTIME', { message: 'x'.repeat(2000) });
    expect(long).toHaveLength(600);
    expect(long.endsWith('…')).toBe(true);
    const tools = Array.from({ length: 100 }, (_, i) => `tool.number${String(i)}`);
    expect(scriptErrorMessage('E_NO_TOOL', { name: 'q', tools }).length).toBeLessThanOrEqual(600);
    expect(
      scriptErrorMessage('E_RUNTIME', { message: 'y'.repeat(900), limits: { maxErrorChars: 100 } }),
    ).toHaveLength(100);
  });

  it('scriptError carries line and col', () => {
    expect(scriptError('E_SYNTAX', { line: 1, col: 4, message: 'bad' })).toMatchObject({
      code: 'E_SYNTAX',
      line: 1,
      col: 4,
    });
    expect(scriptError('E_STACK')).toEqual({
      code: 'E_STACK',
      message: scriptErrorMessage('E_STACK'),
    });
  });
});

describe('didYouMean / levenshtein', () => {
  it('measures edit distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('same', 'same')).toBe(0);
  });

  it('suggests the closest name within distance 3, case-insensitively', () => {
    const tools = ['element.style', 'element.attr', 'kit.insert', 'media.add'];
    expect(didYouMean('elment.style', tools)).toBe('element.style');
    expect(didYouMean('Kit.Insrt', tools)).toBe('kit.insert');
    expect(didYouMean('media.ad', tools)).toBe('media.add');
    expect(didYouMean('totally.different', tools)).toBeUndefined();
  });
});

describe('finalizeScriptRun', () => {
  it('turns a raw error into the §A.8 text for the request limits', () => {
    const raw = rawScriptFailure('E_MEMORY', {}, { ms: 4, calls: 1, found: 0 }, ['n']);
    const out = finalizeScriptRun(raw, { ...DEFAULT_SCRIPT_LIMITS, memoryBytes: 8 * 1024 * 1024 });
    expect(out).toEqual({
      ok: false,
      error: {
        code: 'E_MEMORY',
        message: scriptErrorMessage('E_MEMORY', { limits: { memoryBytes: 8 * 1024 * 1024 } }),
      },
      notes: ['n'],
      stats: { ms: 4, calls: 1, found: 0 },
    });
  });

  it('passes a success through and maps an unknown code to E_ENGINE', () => {
    const success = {
      ok: true as const,
      calls: [],
      notes: [],
      stats: { ms: 0, calls: 0, found: 0 },
    };
    expect(finalizeScriptRun(success)).toBe(success);
    const odd = rawScriptFailure('E_NOPE' as never);
    const out = finalizeScriptRun(odd);
    expect(out.ok ? '' : out.error.code).toBe('E_ENGINE');
    expect(isScriptErrorCode('E_SYNTAX')).toBe(true);
    expect(isScriptErrorCode('E_NOPE')).toBe(false);
  });
});
