/**
 * The host↔sandbox contract for agent code mode (DESIGN §A.3, written verbatim).
 *
 * The model answers a bulk request with ONE plan step
 * `{"command":"tool","args":{"name":"script.run","input":{"code":"…"}}}`. The
 * editor runs that code once in a QuickJS sandbox over a read-only element
 * index; the script returns a list of queued calls, which the host maps to
 * ordinary kernel steps (one plan, one transaction, one Undo).
 *
 * Field names are load-bearing: `script-host`, `script-wiring` and
 * `script-servers` code against this file.
 */

export const SCRIPT_TOOL_NAME = 'script.run';

export const SCRIPT_ELEMENT_KINDS = [
  'section',
  'heading',
  'text',
  'button',
  'link',
  'image',
  'icon',
  'card',
  'item',
  'input',
  'video',
] as const;
export type ScriptElementKind = (typeof SCRIPT_ELEMENT_KINDS)[number];

/** One addressable element, as the script sees it (built by script-host's element-index). */
export interface ScriptElement {
  readonly id: string; // opaque handle, see A.5 (never built by the model)
  readonly kind: ScriptElementKind;
  readonly text: string; // visible text, ≤ 500 chars ('' for images/icons)
  readonly norm: string; // Arabic-normalized, lower-cased text for find({text})
  readonly tag?: string; // 'h2', 'a', 'img', 'li' … (tree elements) or the part kind
  readonly node: string; // kernel node id (what tool inputs call `id`)
  readonly section: string; // the top-level section's label in the page language
  readonly sectionId: string; // that section's node id
  readonly page: string; // page id
  readonly path?: string; // formatPath() of a customCode element
  readonly part?: string; // part name of a registered block
  readonly index?: number; // part instance index (lists)
  readonly src?: string;
  readonly href?: string;
  readonly alt?: string;
}

export interface ScriptPage {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly lang: string;
  readonly dir: 'rtl' | 'ltr';
  readonly current: boolean;
}

export interface ScriptPhoto {
  readonly topic: string;
  readonly src: string;
  readonly alt: string;
}

export interface ScriptLimits {
  readonly maxSourceChars: number; // 6000
  readonly cpuMs: number; // 1000  (QuickJS interrupt deadline)
  readonly hardMs: number; // 3000  (worker terminate)
  readonly memoryBytes: number; // 16 * 1024 * 1024
  readonly stackBytes: number; // 256 * 1024
  readonly maxCalls: number; // 500   ck.* calls
  readonly maxTargets: number; // 2000  elements named across all set/style calls
  readonly maxSteps: number; // 300   queued edits before coalescing
  readonly maxFind: number; // 500   elements per find()
  readonly maxResultChars: number; // 2000
  readonly maxNotes: number; // 5
  readonly maxNoteChars: number; // 200
  readonly maxOutputChars: number; // 262144  (the JSON string read back from the VM)
  readonly maxErrorChars: number; // 600
}

export interface ScriptRunRequest {
  readonly code: string;
  readonly elements: readonly ScriptElement[];
  readonly pages: readonly ScriptPage[];
  readonly photos: readonly ScriptPhoto[];
  readonly tools: readonly string[]; // the lane's allowed tool names for ck.tool
  readonly locale: { readonly lang: string; readonly dir: 'rtl' | 'ltr' };
  readonly seed: number; // uint32, from the plan hash
  readonly now: number; // epoch ms frozen for Date
  readonly limits: ScriptLimits;
}

export type ScriptStyleValue =
  | string
  | number
  | null
  | {
      readonly value: string | number | null;
      readonly bucket?: 'base' | 'tablet' | 'mobile';
      readonly state?: string;
    };

export type ScriptCall =
  | {
      readonly n: number;
      readonly line?: number;
      readonly op: 'set';
      readonly targets: readonly string[];
      readonly value: {
        readonly text?: string;
        readonly href?: string;
        readonly src?: string;
        readonly alt?: string;
      };
    }
  | {
      readonly n: number;
      readonly line?: number;
      readonly op: 'style';
      readonly targets: readonly string[];
      readonly styles: Readonly<Record<string, ScriptStyleValue>>;
      readonly options?: {
        readonly bucket?: 'base' | 'tablet' | 'mobile';
        readonly state?: string;
      };
    }
  | {
      readonly n: number;
      readonly line?: number;
      readonly op: 'tool';
      readonly name: string;
      readonly input: unknown;
      readonly page?: string;
    };

export const SCRIPT_ERROR_CODES = [
  'E_TOO_LONG',
  'E_SYNTAX',
  'E_RUNTIME',
  'E_TIMEOUT',
  'E_TIMEOUT_HARD',
  'E_MEMORY',
  'E_STACK',
  'E_LIMIT_CALLS',
  'E_LIMIT_STEPS',
  'E_NO_TOOL',
  'E_BAD_TARGET',
  'E_TOOL_INPUT',
  'E_EMPTY',
  'E_OTHER_PAGE',
  'E_TOO_MANY_WRITES',
  'E_ENGINE',
] as const;
export type ScriptErrorCode = (typeof SCRIPT_ERROR_CODES)[number];

export interface ScriptError {
  readonly code: ScriptErrorCode;
  readonly message: string;
  readonly line?: number;
  readonly col?: number;
}

export interface ScriptRunStats {
  readonly ms: number;
  readonly calls: number;
  readonly found: number;
}

export type ScriptRunResult =
  | {
      readonly ok: true;
      readonly calls: readonly ScriptCall[];
      readonly result?: string;
      readonly notes: readonly string[];
      readonly stats: ScriptRunStats;
    }
  | {
      readonly ok: false;
      readonly error: ScriptError;
      readonly notes: readonly string[];
      readonly stats: ScriptRunStats;
    };

export interface ScriptRunner {
  run(request: ScriptRunRequest): Promise<ScriptRunResult>;
  dispose(): void;
}
