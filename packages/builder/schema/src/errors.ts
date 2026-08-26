import type { JsonValue } from './json/json-value';

export type BuilderErrorCode =
  | 'doc/root-missing'
  | 'doc/root-parented'
  | 'doc/orphan'
  | 'doc/cycle'
  | 'doc/duplicate-membership'
  | 'doc/duplicate-in-slot'
  | 'doc/dangling-child'
  | 'doc/empty-slot-array'
  | 'doc/id-mismatch'
  | 'doc/invalid-slot-name'
  | 'doc/unknown-type'
  | 'doc/unknown-slot'
  | 'doc/slot-not-allowed'
  | 'doc/slot-capacity'
  | 'doc/non-json-value'
  | 'doc/non-finite-number'
  | 'doc/raw-style-literal'
  | 'doc/invalid-props'
  | 'doc/migration-gap'
  | 'block/non-json-props'
  | 'cmd/unknown'
  | 'cmd/invalid-args'
  | 'cmd/structural-violation'
  | 'ext/cycle'
  | 'ext/duplicate'
  | 'ext/missing-dependency'
  | 'ext/tier2-executable'
  | 'ext/tier2-invalid'
  | 'widget/missing-states'
  | 'persist/seq-conflict';

export interface BuilderErrorInit {
  code: BuilderErrorCode;
  message: string;
  path?: (string | number)[] | undefined;
  meta?: Record<string, JsonValue> | undefined;
}

/**
 * Typed, path-addressed error. Validators return arrays of these; the dispatch door
 * throws them. `path` addresses the offending location inside a document, manifest,
 * or command args.
 */
export class BuilderError extends Error {
  readonly code: BuilderErrorCode;
  readonly path: (string | number)[] | undefined;
  readonly meta: Record<string, JsonValue> | undefined;

  constructor(init: BuilderErrorInit) {
    super(init.message);
    this.name = 'BuilderError';
    this.code = init.code;
    this.path = init.path;
    this.meta = init.meta;
  }
}

export function builderError(
  code: BuilderErrorCode,
  message: string,
  path?: (string | number)[],
  meta?: Record<string, JsonValue>,
): BuilderError {
  return new BuilderError({ code, message, path, meta });
}

export function isBuilderError(value: unknown): value is BuilderError {
  return value instanceof BuilderError;
}
