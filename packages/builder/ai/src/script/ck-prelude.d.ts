/**
 * Types for `ck-prelude.js` (plain JS so the same file loads in the Vite
 * browser worker, the Node worker and vitest; DESIGN §A.2 D4).
 */

import type {
  ScriptElement,
  ScriptLimits,
  ScriptPage,
  ScriptPhoto,
  ScriptStyleValue,
} from './types';

/** What the host posts into the sandbox (the run request minus the code). */
export interface CkPreludeInput {
  /** `norm` is `normalizeArabic(text).toLowerCase()` (script-host's element-index); computed when missing. */
  readonly elements: readonly ScriptElement[];
  readonly pages: readonly ScriptPage[];
  readonly photos: readonly ScriptPhoto[];
  readonly tools: readonly string[];
  readonly locale: { readonly lang: string; readonly dir: 'rtl' | 'ltr' };
  readonly limits: ScriptLimits;
  readonly seed: number;
  readonly now: number;
}

export interface CkFindQuery {
  readonly kind?: ScriptElement['kind'] | readonly ScriptElement['kind'][];
  readonly text?: string;
  readonly section?: string;
  /** A page id or slug, or '*' for every indexed page. Default: the current page. */
  readonly page?: string;
}

export type CkTarget = ScriptElement | string | readonly (ScriptElement | string)[];

export interface CkFormatOptions {
  readonly digits?: 'arab' | 'latn';
  readonly decimals?: number;
}

export interface CkApi {
  readonly find: ((query?: CkFindQuery) => ScriptElement[]) & { readonly truncated: boolean };
  readonly pages: () => ScriptPage[];
  readonly photos: (
    topic?: string,
    count?: number,
  ) => { readonly src: string; readonly alt: string }[];
  readonly set: (
    target: CkTarget,
    value: {
      readonly text?: string;
      readonly href?: string;
      readonly src?: string;
      readonly alt?: string;
    },
  ) => number;
  readonly style: (
    target: CkTarget,
    styles: Readonly<Record<string, ScriptStyleValue>>,
    options?: { readonly bucket?: 'base' | 'tablet' | 'mobile'; readonly state?: string },
  ) => number;
  readonly tool: (name: string, input?: unknown, options?: { readonly page?: string }) => number;
  readonly fmt: {
    readonly num: (value: number | string, options?: CkFormatOptions) => string;
    readonly money: (
      value: number | string,
      currency?: string,
      options?: CkFormatOptions & { readonly lang?: string },
    ) => string;
  };
  readonly note: (text: unknown) => void;
}

export interface CkPrelude {
  readonly api: CkApi;
  /**
   * JSON of the failed run for a throw (`phase` 'compile' maps a SyntaxError to
   * E_SYNTAX). A sticky prelude error (limits, E_NO_TOOL, E_BAD_TARGET) wins.
   */
  fail(error: unknown, phase?: 'compile' | 'run'): string;
  /** JSON of the finished run: `{ok:true, calls, result?, notes, stats}` (or the sticky failure). */
  finish(result: unknown): string;
  /** Put the real `Math.random` and `Date` back (only matters outside QuickJS, e.g. in tests). */
  restore(): void;
  /** The prelude's matcher normalizer (parity with `normalizeArabic(text).toLowerCase()`). */
  normalize(text: unknown): string;
}

/** Lines QuickJS (and V8) put above a `new Function` body: user line = engine line - 2. */
export declare const CK_USER_LINE_OFFSET: 2;

export declare function ckPrelude(input: CkPreludeInput): CkPrelude;
