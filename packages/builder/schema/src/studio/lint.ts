import { scanLibKeys } from './detect';
import { fnv1a64 } from './hash';
import { STUDIO_CODE_MAX } from './schemas';
import { STUDIO_LIB_KEYS, type Bilingual } from './types';

/**
 * The door's checks on a region script and the Studio's lint, in one place
 * (pixi-studio DESIGN.md §A.1, §E.4).
 *
 * Headless: the syntax check constructs `new AsyncFunction('ck', code)` — the
 * exact wrapper the runtime uses — and never CALLS it, so nothing in the code
 * runs. Constructing compiles; where a CSP forbids that (`EvalError`), the
 * syntax check is skipped rather than reported as the author's fault.
 */

export type ScriptIssueCode =
  | 'syntax'
  | 'too-long'
  | 'script-close'
  | 'eval'
  | 'document-write'
  | 'local-storage'
  | 'unknown-lib'
  | 'dynamic-lib'
  | 'arabic-split'
  | 'free-code-off';

export type ScriptIssueSeverity = 'error' | 'warning';

export interface ScriptCodeIssue {
  code: ScriptIssueCode;
  severity: ScriptIssueSeverity;
  message: Bilingual;
  /** 1-based, when the issue has a place. */
  line?: number;
  column?: number;
}

export interface ScriptCodeIssueOptions {
  /** The composer's free-code switch. */
  switchOn: boolean;
  /**
   * With the switch OFF, code is admitted only when its `fnv1a64` is in this
   * set (the builtin presets, D11). Omitted: the switch-off rule is the door's
   * business and this lint stays silent about it.
   */
  builtinHashes?: ReadonlySet<string>;
}

type AsyncFunctionConstructor = new (...args: string[]) => unknown;

const AsyncFunction = Object.getPrototypeOf(async function probe() {
  /* the constructor of async functions, never this function */
}).constructor as AsyncFunctionConstructor;

/*
  V8 reports a SyntaxError from the Function constructor with no position.
  So the place is found by bisection: the shortest prefix of lines that fails
  for a reason OTHER than "it ends too early" contains the fault on its last
  line. Hard errors are monotonic in the prefix length, which is what makes
  the bisection sound; the incomplete-input messages are what make a prefix
  "not yet wrong".
*/
const INCOMPLETE =
  /end of input|unterminated|missing \S+ (?:after|before|in)|expected expression, got end|unexpected eof|unexpected end/iu;

type CompileResult = { ok: true } | { ok: false; message: string; incomplete: boolean } | 'blocked';

function compile(source: string): CompileResult {
  try {
    new AsyncFunction('ck', source);
    return { ok: true };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { ok: false, message: error.message, incomplete: INCOMPLETE.test(error.message) };
    }
    // EvalError under a CSP without 'unsafe-eval', or anything else: not the author's fault.
    return 'blocked';
  }
}

function isHard(result: CompileResult): boolean {
  return result !== 'blocked' && !result.ok && !result.incomplete;
}

/*
  A prefix cut inside a block comment, a string or a regex fails with "invalid
  token", which is not the author's fault but the cut's. Closing what the cut
  may have opened tells the two apart: when any closer makes the prefix
  compile (or merely incomplete), the prefix is not yet wrong.
*/
const CLOSERS: readonly string[] = ['*/', "'", '"', '`', '/'];

function hardFailure(source: string): boolean {
  if (!isHard(compile(source))) return false;
  return CLOSERS.every((closer) => isHard(compile(source + closer)));
}

/** The 1-based line and column of a syntax fault, by bisection over prefixes. */
function locate(code: string): { line: number; column: number } | undefined {
  const lines = code.split('\n');
  const prefix = (count: number) => lines.slice(0, count).join('\n');
  if (!hardFailure(code)) {
    // Only incomplete-input errors: the fault is the end of the code.
    const last = lines.length;
    return { line: last, column: (lines[last - 1] ?? '').length + 1 };
  }
  let low = 1;
  let high = lines.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (hardFailure(prefix(middle))) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }
  const before = lines.slice(0, low - 1).join('\n');
  const text = lines[low - 1] ?? '';
  const joiner = low > 1 ? '\n' : '';
  let left = 1;
  let right = text.length;
  while (left < right) {
    const middle = Math.floor((left + right) / 2);
    if (hardFailure(before + joiner + text.slice(0, middle))) {
      right = middle;
    } else {
      left = middle + 1;
    }
  }
  return { line: low, column: Math.max(1, left) };
}

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/u;
const TEXTISH = '[\\w$.]*(?:text|str|word|title|label|name|letter|char|line|caption|quote|heading)[\\w$]*';
const PER_LETTER: readonly RegExp[] = [
  /\.split\(\s*(['"`])\1\s*\)/u,
  /\.split\(\s*\/\(\?:\)\/u?\s*\)/u,
  new RegExp(`Array\\.from\\(\\s*${TEXTISH}\\s*\\)`, 'iu'),
  new RegExp(`\\[\\s*\\.\\.\\.\\s*${TEXTISH}\\s*\\]`, 'iu'),
  new RegExp(`for\\s*\\(\\s*(?:const|let|var)\\s+\\w+\\s+of\\s+${TEXTISH}\\s*\\)`, 'iu'),
];

const BANNED: readonly { code: ScriptIssueCode; pattern: RegExp; message: Bilingual }[] = [
  {
    code: 'eval',
    pattern: /(?<![\w$.])eval\s*\(/u,
    message: {
      en: 'eval() is not allowed in a region script.',
      ar: 'لا يُسمح باستخدام eval()‎ في سكربت المنطقة.',
    },
  },
  {
    code: 'document-write',
    pattern: /\bdocument\s*\.\s*write(?:ln)?\s*\(/u,
    message: {
      en: 'document.write() is not allowed: draw inside ck.root.',
      ar: 'لا يُسمح باستخدام document.write()‎: ارسم داخل ck.root.',
    },
  },
  {
    code: 'local-storage',
    pattern: /\blocalStorage\b/u,
    message: {
      en: 'localStorage is not allowed: a page script keeps no state in the visitor’s browser.',
      ar: 'لا يُسمح باستخدام localStorage: سكربت الصفحة لا يحفظ بيانات في متصفح الزائر.',
    },
  },
];

function lineColumnOf(code: string, index: number): { line: number; column: number } {
  const before = code.slice(0, index);
  const line = before.split('\n').length;
  const column = index - before.lastIndexOf('\n');
  return { line, column };
}

/**
 * Every problem with a region script, errors first (§A.1). An empty list means
 * the door accepts it (with the switch state given) and the Studio shows no
 * squiggles.
 */
export function scriptCodeIssues(code: string, options: ScriptCodeIssueOptions): ScriptCodeIssue[] {
  const issues: ScriptCodeIssue[] = [];

  if (!options.switchOn && options.builtinHashes !== undefined) {
    if (!options.builtinHashes.has(fnv1a64(code))) {
      issues.push({
        code: 'free-code-off',
        severity: 'error',
        message: {
          en: 'Free code is off: only CraftKit’s built-in scripts can be placed unchanged. Turn the free-code switch on to write or edit a script.',
          ar: 'وضع الكود الحر مُطفأ: يمكن وضع سكربتات كرافت كيت الجاهزة كما هي فقط. شغّل مفتاح الكود الحر لكتابة سكربت أو تعديله.',
        },
      });
    }
  }

  if (code.length > STUDIO_CODE_MAX) {
    issues.push({
      code: 'too-long',
      severity: 'error',
      message: {
        en: `The script is ${String(code.length)} characters; the limit is ${String(STUDIO_CODE_MAX)}.`,
        ar: `طول السكربت ${String(code.length)} حرفاً، والحد ${String(STUDIO_CODE_MAX)}.`,
      },
    });
    // Past the limit nothing else is worth compiling.
    return issues;
  }

  const close = /<\/script/iu.exec(code);
  if (close !== null) {
    issues.push({
      code: 'script-close',
      severity: 'error',
      message: {
        en: 'The script contains "</script", which would end the page script. Write it as "<\\/script".',
        ar: 'السكربت يحتوي "</script" وهذا ينهي سكربت الصفحة. اكتبه "<\\/script".',
      },
      ...lineColumnOf(code, close.index),
    });
  }

  const compiled = compile(code);
  if (compiled !== 'blocked' && !compiled.ok) {
    const place = locate(code);
    const at = place === undefined ? '' : ` (line ${String(place.line)}, column ${String(place.column)})`;
    const atAr =
      place === undefined ? '' : ` (السطر ${String(place.line)}، العمود ${String(place.column)})`;
    issues.push({
      code: 'syntax',
      severity: 'error',
      message: {
        en: `Syntax error${at}: ${compiled.message}`,
        ar: `خطأ في الصياغة${atAr}: ${compiled.message}`,
      },
      ...(place ?? {}),
    });
  }

  for (const banned of BANNED) {
    const match = banned.pattern.exec(code);
    if (match !== null) {
      issues.push({
        code: banned.code,
        severity: 'error',
        message: banned.message,
        ...lineColumnOf(code, match.index),
      });
    }
  }

  const libs = scanLibKeys(code);
  if (libs.unknown.length > 0) {
    const known = STUDIO_LIB_KEYS.join(', ');
    issues.push({
      code: 'unknown-lib',
      severity: 'error',
      message: {
        en: `Unknown library ${libs.unknown.map((key) => `"${key}"`).join(', ')}. Known: ${known}.`,
        ar: `مكتبة غير معروفة ${libs.unknown.map((key) => `«${key}»`).join('، ')}. المعروفة: ${known}.`,
      },
    });
  }
  if (libs.dynamic) {
    issues.push({
      code: 'dynamic-lib',
      severity: 'warning',
      message: {
        en: "Write library keys literally (ck.use('filters'), libs: ['physics']): the published page finds them by reading the code.",
        ar: "اكتب أسماء المكتبات حرفياً (ck.use('filters')، libs: ['physics']): الصفحة المنشورة تجدها بقراءة الكود.",
      },
    });
  }

  if (ARABIC.test(code)) {
    for (const pattern of PER_LETTER) {
      const match = pattern.exec(code);
      if (match === null) continue;
      issues.push({
        code: 'arabic-split',
        severity: 'warning',
        message: {
          en: 'Arabic text must not be split into letters: the letters lose their joined forms. Use s.words(text) or s.text(text).',
          ar: 'لا تقسّم النص العربي إلى حروف: تفقد الحروف أشكال اتصالها. استخدم s.words(text)‎ أو s.text(text)‎.',
        },
        ...lineColumnOf(code, match.index),
      });
      break;
    }
  }

  return issues.sort(
    (a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1),
  );
}

/** Only the errors: what the door refuses. */
export function scriptCodeErrors(code: string, options: ScriptCodeIssueOptions): ScriptCodeIssue[] {
  return scriptCodeIssues(code, options).filter((entry) => entry.severity === 'error');
}

/** One line of repair text per issue, in English, for plan refusals and command errors. */
export function describeScriptIssues(issues: readonly ScriptCodeIssue[]): string {
  return issues.map((entry) => entry.message.en).join(' ');
}
