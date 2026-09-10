import {
  codeFileSchema,
  insertionAnchorSchema,
  isJsonValue,
  modulePathSchema,
  selectionTargetSchema,
  type CodeFile,
  type InsertionAnchor,
  type JsonValue,
  type SelectionTarget,
} from '@craftkit/builder-schema';

import type { IndexedSelectionContext, ProjectIndex } from '../context/context-index';

export const SITE_TOOL_PROTOCOL_VERSION = 1 as const;

export const SITE_TOOL_NAMES = Object.freeze([
  'get_project_index',
  'get_selection_context',
  'resolve_component',
  'edit_element',
  'apply_module_patch',
  'insert_section',
  'page_operations',
  'compile_preview',
  'inspect_preview',
  'commit_draft',
] as const);

export type SiteToolName = (typeof SITE_TOOL_NAMES)[number];

export interface GetProjectIndexInput {
  siteId: string;
  siteRevision: string;
}

export interface GetSelectionContextInput {
  siteId: string;
  selection: SelectionTarget;
}

export interface ResolveComponentInput {
  catalogVersion: string;
  packageId: string;
  exportName?: string;
}

export interface ResolveComponentOutput {
  catalogVersion: string;
  packageId: string;
  version: string;
  importSpecifier: string;
  exportName: string;
  source: string;
  css: readonly string[];
  props: JsonValue;
}

export interface EditElementInput {
  runId: string;
  unitId: string;
  expectedSiteRevision: string;
  expectedSourceRevision?: string;
  target: SelectionTarget;
  edit:
    | { kind: 'text'; value: string }
    | { kind: 'props'; values: Readonly<Record<string, JsonValue>> }
    | { kind: 'classes'; value: string }
    | { kind: 'delete' }
    | { kind: 'duplicate' }
    | { kind: 'move'; anchor: InsertionAnchor };
}

export interface EditElementOutput {
  siteRevision: string;
  sourceRevision: string | null;
  changedTargetIds: readonly string[];
}

export interface ModuleFileChange {
  path: string;
  expectedHash: string | null;
  file: CodeFile | null;
}

export interface ApplyModulePatchInput {
  runId: string;
  unitId: string;
  projectId: string;
  expectedProjectRevision: string;
  changes: readonly ModuleFileChange[];
}

export interface ApplyModulePatchOutput {
  projectId: string;
  beforeRevision: string;
  afterRevision: string;
  changedPaths: readonly string[];
}

export interface InsertSectionInput {
  runId: string;
  unitId: string;
  anchor: InsertionAnchor;
  section: JsonValue;
}

export interface InsertSectionOutput {
  siteRevision: string;
  selection: SelectionTarget;
}

export type PageOperationName =
  | 'addPage'
  | 'renamePage'
  | 'reorderPage'
  | 'duplicatePage'
  | 'setHomePage'
  | 'clearPage'
  | 'removePage'
  | 'setCodePage';

export interface PageOperationsInput {
  runId: string;
  unitId: string;
  expectedSiteRevision: string;
  operation: PageOperationName;
  args: JsonValue;
}

export interface PageOperationsOutput {
  siteRevision: string;
  affectedPageIds: readonly string[];
}

export interface CompilePreviewInput {
  runId: string;
  projectId: string;
  sourceRevision: string;
  pageIds: readonly string[];
}

export interface CompilePreviewOutput {
  artifactId: string;
  sourceRevision: string;
  status: 'valid' | 'invalid' | 'cancelled' | 'stale';
  diagnostics: JsonValue;
}

export interface InspectPreviewInput {
  runId: string;
  artifactId: string;
  sourceRevision: string;
  checks: readonly ('console' | 'layout' | 'screenshot' | 'accessibility')[];
}

export interface InspectPreviewOutput {
  artifactId: string;
  sourceRevision: string;
  passed: boolean;
  findings: JsonValue;
}

export interface CommitDraftInput {
  runId: string;
  projectId: string;
  expectedBaseRevision: string;
  draftRevision: string;
  target?: SelectionTarget;
}

export interface CommitDraftOutput {
  siteRevision: string;
  projectRevision: string;
  transactionId: string;
}

export interface SiteToolInputMap {
  get_project_index: GetProjectIndexInput;
  get_selection_context: GetSelectionContextInput;
  resolve_component: ResolveComponentInput;
  edit_element: EditElementInput;
  apply_module_patch: ApplyModulePatchInput;
  insert_section: InsertSectionInput;
  page_operations: PageOperationsInput;
  compile_preview: CompilePreviewInput;
  inspect_preview: InspectPreviewInput;
  commit_draft: CommitDraftInput;
}

export interface SiteToolOutputMap {
  get_project_index: ProjectIndex;
  get_selection_context: IndexedSelectionContext;
  resolve_component: ResolveComponentOutput;
  edit_element: EditElementOutput;
  apply_module_patch: ApplyModulePatchOutput;
  insert_section: InsertSectionOutput;
  page_operations: PageOperationsOutput;
  compile_preview: CompilePreviewOutput;
  inspect_preview: InspectPreviewOutput;
  commit_draft: CommitDraftOutput;
}

export type SiteToolHandlers = {
  [Name in SiteToolName]: (
    input: SiteToolInputMap[Name],
    context: SiteToolExecutionContext,
  ) => SiteToolOutputMap[Name] | Promise<SiteToolOutputMap[Name]>;
};

export interface SiteToolExecutionContext {
  invocationId: string;
  origin: 'agent' | 'editor';
  runId?: string;
  signal: AbortSignal;
}

export interface SiteToolDefinition<Name extends SiteToolName = SiteToolName> {
  readonly name: Name;
  readonly version: typeof SITE_TOOL_PROTOCOL_VERSION;
  /** All tools call deterministic host ports and never invoke a model. */
  readonly execution: 'deterministic';
  readonly mutatesProject: boolean;
  readonly inputSchema: JsonValue;
  readonly outputSchema: JsonValue;
}

export interface SiteToolRegistry {
  names(): readonly SiteToolName[];
  definitions(): readonly SiteToolDefinition[];
  definition<Name extends SiteToolName>(name: Name): SiteToolDefinition<Name>;
  execute<Name extends SiteToolName>(
    name: Name,
    input: SiteToolInputMap[Name],
    context: SiteToolExecutionContext,
  ): Promise<SiteToolOutputMap[Name]>;
  executeUnknown(
    name: string,
    input: unknown,
    context: SiteToolExecutionContext,
  ): Promise<JsonValue>;
}

export class SiteToolValidationError extends Error {
  readonly tool: string;
  readonly location: 'input' | 'output';

  constructor(tool: string, location: 'input' | 'output', message: string) {
    super(`${tool} ${location}: ${message}`);
    this.name = 'SiteToolValidationError';
    this.tool = tool;
    this.location = location;
  }
}

type InputParserMap = {
  [Name in SiteToolName]: (input: unknown) => SiteToolInputMap[Name];
};

const INPUT_PARSERS: InputParserMap = {
  get_project_index: (input) => {
    const value = exactObject('get_project_index', input, ['siteId', 'siteRevision']);
    return { siteId: stringAt(value, 'siteId'), siteRevision: stringAt(value, 'siteRevision') };
  },
  get_selection_context: (input) => {
    const value = exactObject('get_selection_context', input, ['siteId', 'selection']);
    return {
      siteId: stringAt(value, 'siteId'),
      selection: parseNested('get_selection_context', 'selection', () =>
        selectionTargetSchema.parse(value['selection']),
      ),
    };
  },
  resolve_component: (input) => {
    const value = exactObject(
      'resolve_component',
      input,
      ['catalogVersion', 'packageId'],
      ['exportName'],
    );
    return {
      catalogVersion: stringAt(value, 'catalogVersion'),
      packageId: stringAt(value, 'packageId'),
      ...(value['exportName'] === undefined ? {} : { exportName: stringAt(value, 'exportName') }),
    };
  },
  edit_element: (input) => {
    const value = exactObject(
      'edit_element',
      input,
      ['runId', 'unitId', 'expectedSiteRevision', 'target', 'edit'],
      ['expectedSourceRevision'],
    );
    return {
      runId: stringAt(value, 'runId'),
      unitId: stringAt(value, 'unitId'),
      expectedSiteRevision: stringAt(value, 'expectedSiteRevision'),
      ...(value['expectedSourceRevision'] === undefined
        ? {}
        : { expectedSourceRevision: stringAt(value, 'expectedSourceRevision') }),
      target: parseNested('edit_element', 'target', () =>
        selectionTargetSchema.parse(value['target']),
      ),
      edit: parseElementEdit(value['edit']),
    };
  },
  apply_module_patch: (input) => {
    const value = exactObject(
      'apply_module_patch',
      input,
      ['runId', 'unitId', 'projectId', 'expectedProjectRevision', 'changes'],
    );
    const changes = arrayAt(value, 'changes').map((change, index): ModuleFileChange => {
      const entry = exactObject(
        'apply_module_patch',
        change,
        ['path', 'expectedHash', 'file'],
        [],
        `changes[${String(index)}]`,
      );
      return {
        path: parseNested('apply_module_patch', `changes[${String(index)}].path`, () =>
          modulePathSchema.parse(entry['path']),
        ),
        expectedHash:
          entry['expectedHash'] === null
            ? null
            : stringAt(entry, 'expectedHash', `changes[${String(index)}]`),
        file:
          entry['file'] === null
            ? null
            : parseNested('apply_module_patch', `changes[${String(index)}].file`, () =>
                codeFileSchema.parse(entry['file']),
              ),
      };
    });
    if (changes.length === 0) invalid('apply_module_patch', 'changes must not be empty.');
    if (new Set(changes.map(({ path }) => path)).size !== changes.length) {
      invalid('apply_module_patch', 'each module path may appear only once.');
    }
    return {
      runId: stringAt(value, 'runId'),
      unitId: stringAt(value, 'unitId'),
      projectId: stringAt(value, 'projectId'),
      expectedProjectRevision: stringAt(value, 'expectedProjectRevision'),
      changes,
    };
  },
  insert_section: (input) => {
    const value = exactObject('insert_section', input, ['runId', 'unitId', 'anchor', 'section']);
    return {
      runId: stringAt(value, 'runId'),
      unitId: stringAt(value, 'unitId'),
      anchor: parseNested('insert_section', 'anchor', () =>
        insertionAnchorSchema.parse(value['anchor']),
      ),
      section: jsonAt(value, 'section', 'insert_section'),
    };
  },
  page_operations: (input) => {
    const value = exactObject(
      'page_operations',
      input,
      ['runId', 'unitId', 'expectedSiteRevision', 'operation', 'args'],
    );
    const operation = stringAt(value, 'operation');
    if (!PAGE_OPERATIONS.includes(operation as PageOperationName)) {
      invalid('page_operations', `unsupported operation "${operation}".`);
    }
    return {
      runId: stringAt(value, 'runId'),
      unitId: stringAt(value, 'unitId'),
      expectedSiteRevision: stringAt(value, 'expectedSiteRevision'),
      operation: operation as PageOperationName,
      args: jsonAt(value, 'args', 'page_operations'),
    };
  },
  compile_preview: (input) => {
    const value = exactObject(
      'compile_preview',
      input,
      ['runId', 'projectId', 'sourceRevision', 'pageIds'],
    );
    const pageIds = arrayAt(value, 'pageIds').map((item, index) =>
      nonEmptyString(item, `pageIds[${String(index)}]`, 'compile_preview'),
    );
    return {
      runId: stringAt(value, 'runId'),
      projectId: stringAt(value, 'projectId'),
      sourceRevision: stringAt(value, 'sourceRevision'),
      pageIds,
    };
  },
  inspect_preview: (input) => {
    const value = exactObject(
      'inspect_preview',
      input,
      ['runId', 'artifactId', 'sourceRevision', 'checks'],
    );
    const checks = arrayAt(value, 'checks').map((item, index) => {
      const check = nonEmptyString(item, `checks[${String(index)}]`, 'inspect_preview');
      if (!PREVIEW_CHECKS.includes(check as InspectPreviewInput['checks'][number])) {
        invalid('inspect_preview', `unsupported check "${check}".`);
      }
      return check as InspectPreviewInput['checks'][number];
    });
    return {
      runId: stringAt(value, 'runId'),
      artifactId: stringAt(value, 'artifactId'),
      sourceRevision: stringAt(value, 'sourceRevision'),
      checks,
    };
  },
  commit_draft: (input) => {
    const value = exactObject(
      'commit_draft',
      input,
      ['runId', 'projectId', 'expectedBaseRevision', 'draftRevision'],
      ['target'],
    );
    return {
      runId: stringAt(value, 'runId'),
      projectId: stringAt(value, 'projectId'),
      expectedBaseRevision: stringAt(value, 'expectedBaseRevision'),
      draftRevision: stringAt(value, 'draftRevision'),
      ...(value['target'] === undefined
        ? {}
        : {
            target: parseNested('commit_draft', 'target', () =>
              selectionTargetSchema.parse(value['target']),
            ),
          }),
    };
  },
};

const PAGE_OPERATIONS = Object.freeze([
  'addPage',
  'renamePage',
  'reorderPage',
  'duplicatePage',
  'setHomePage',
  'clearPage',
  'removePage',
  'setCodePage',
] as const);

const PREVIEW_CHECKS = Object.freeze([
  'console',
  'layout',
  'screenshot',
  'accessibility',
] as const);

const STRING_SCHEMA = Object.freeze({ type: 'string', minLength: 1 } as const);
const OUTPUT_SCHEMAS: Readonly<Record<SiteToolName, JsonValue>> = Object.freeze({
  get_project_index: outputSchema(['formatVersion', 'siteId', 'siteRevision', 'pages', 'projects']),
  get_selection_context: outputSchema([
    'formatVersion',
    'siteRevision',
    'selection',
    'page',
    'target',
  ]),
  resolve_component: outputSchema([
    'catalogVersion',
    'packageId',
    'version',
    'importSpecifier',
    'exportName',
    'source',
    'css',
    'props',
  ]),
  edit_element: outputSchema(['siteRevision', 'sourceRevision', 'changedTargetIds']),
  apply_module_patch: outputSchema([
    'projectId',
    'beforeRevision',
    'afterRevision',
    'changedPaths',
  ]),
  insert_section: outputSchema(['siteRevision', 'selection']),
  page_operations: outputSchema(['siteRevision', 'affectedPageIds']),
  compile_preview: outputSchema([
    'artifactId',
    'sourceRevision',
    'status',
    'diagnostics',
  ]),
  inspect_preview: outputSchema([
    'artifactId',
    'sourceRevision',
    'passed',
    'findings',
  ]),
  commit_draft: outputSchema(['siteRevision', 'projectRevision', 'transactionId']),
});

const DEFINITIONS: readonly SiteToolDefinition[] = Object.freeze([
  definition('get_project_index', false, ['siteId', 'siteRevision'], {
    siteId: STRING_SCHEMA,
    siteRevision: STRING_SCHEMA,
  }),
  definition('get_selection_context', false, ['siteId', 'selection'], {
    siteId: STRING_SCHEMA,
    selection: { type: 'object' },
  }),
  definition('resolve_component', false, ['catalogVersion', 'packageId'], {
    catalogVersion: STRING_SCHEMA,
    packageId: STRING_SCHEMA,
    exportName: STRING_SCHEMA,
  }),
  definition(
    'edit_element',
    true,
    ['runId', 'unitId', 'expectedSiteRevision', 'target', 'edit'],
    {
      runId: STRING_SCHEMA,
      unitId: STRING_SCHEMA,
      expectedSiteRevision: STRING_SCHEMA,
      expectedSourceRevision: STRING_SCHEMA,
      target: { type: 'object' },
      edit: { type: 'object' },
    },
  ),
  definition(
    'apply_module_patch',
    true,
    ['runId', 'unitId', 'projectId', 'expectedProjectRevision', 'changes'],
    {
      runId: STRING_SCHEMA,
      unitId: STRING_SCHEMA,
      projectId: STRING_SCHEMA,
      expectedProjectRevision: STRING_SCHEMA,
      changes: { type: 'array', minItems: 1, items: { type: 'object' } },
    },
  ),
  definition('insert_section', true, ['runId', 'unitId', 'anchor', 'section'], {
    runId: STRING_SCHEMA,
    unitId: STRING_SCHEMA,
    anchor: { type: 'object' },
    section: {},
  }),
  definition(
    'page_operations',
    true,
    ['runId', 'unitId', 'expectedSiteRevision', 'operation', 'args'],
    {
      runId: STRING_SCHEMA,
      unitId: STRING_SCHEMA,
      expectedSiteRevision: STRING_SCHEMA,
      operation: { type: 'string', enum: [...PAGE_OPERATIONS] },
      args: {},
    },
  ),
  definition(
    'compile_preview',
    false,
    ['runId', 'projectId', 'sourceRevision', 'pageIds'],
    {
      runId: STRING_SCHEMA,
      projectId: STRING_SCHEMA,
      sourceRevision: STRING_SCHEMA,
      pageIds: { type: 'array', items: STRING_SCHEMA },
    },
  ),
  definition(
    'inspect_preview',
    false,
    ['runId', 'artifactId', 'sourceRevision', 'checks'],
    {
      runId: STRING_SCHEMA,
      artifactId: STRING_SCHEMA,
      sourceRevision: STRING_SCHEMA,
      checks: { type: 'array', items: { type: 'string', enum: [...PREVIEW_CHECKS] } },
    },
  ),
  definition(
    'commit_draft',
    true,
    ['runId', 'projectId', 'expectedBaseRevision', 'draftRevision'],
    {
      runId: STRING_SCHEMA,
      projectId: STRING_SCHEMA,
      expectedBaseRevision: STRING_SCHEMA,
      draftRevision: STRING_SCHEMA,
      target: { type: 'object' },
    },
  ),
]);

/** Registers the complete v1 site-tool surface; missing or extra handlers fail closed. */
export function registerSiteTools(handlers: SiteToolHandlers): SiteToolRegistry {
  const handlerNames = Object.keys(handlers).sort();
  const expectedNames = [...SITE_TOOL_NAMES].sort();
  if (JSON.stringify(handlerNames) !== JSON.stringify(expectedNames)) {
    throw new TypeError('Site tool registration requires exactly the ten v1 handlers.');
  }
  const definitions = new Map(DEFINITIONS.map((entry) => [entry.name, entry]));

  async function executeUnknown(
    name: string,
    input: unknown,
    context: SiteToolExecutionContext,
  ): Promise<JsonValue> {
    throwIfAborted(context.signal);
    if (!isSiteToolName(name)) throw new TypeError(`Unknown site tool "${name}".`);
    const parsed = structuredClone(INPUT_PARSERS[name](input));
    const inputRunId = 'runId' in parsed ? parsed.runId : undefined;
    if (inputRunId !== undefined && inputRunId !== context.runId) {
      invalid(name, 'runId does not match the active invocation.');
    }
    const output = await handlers[name](parsed as never, context);
    throwIfAborted(context.signal);
    if (!isJsonValue(output)) {
      throw new SiteToolValidationError(name, 'output', 'handler returned non-JSON data.');
    }
    validateOutput(name, output);
    return structuredClone(output);
  }

  return Object.freeze({
    names: () => SITE_TOOL_NAMES,
    definitions: () => DEFINITIONS,
    definition: <Name extends SiteToolName>(name: Name): SiteToolDefinition<Name> => {
      const entry = definitions.get(name);
      if (!entry) throw new TypeError(`Unknown site tool "${name}".`);
      return entry as SiteToolDefinition<Name>;
    },
    execute: async <Name extends SiteToolName>(
      name: Name,
      input: SiteToolInputMap[Name],
      context: SiteToolExecutionContext,
    ): Promise<SiteToolOutputMap[Name]> =>
      (await executeUnknown(name, input, context)) as unknown as SiteToolOutputMap[Name],
    executeUnknown,
  });
}

function definition<Name extends SiteToolName>(
  name: Name,
  mutatesProject: boolean,
  required: readonly string[],
  properties: Readonly<Record<string, JsonValue>>,
): SiteToolDefinition<Name> {
  return Object.freeze({
    name,
    version: SITE_TOOL_PROTOCOL_VERSION,
    execution: 'deterministic',
    mutatesProject,
    inputSchema: Object.freeze({
      type: 'object',
      additionalProperties: false,
      required: [...required],
      properties,
    }),
    outputSchema: OUTPUT_SCHEMAS[name],
  });
}

function outputSchema(required: readonly string[]): JsonValue {
  return Object.freeze({ type: 'object', required: [...required] });
}

function parseElementEdit(input: unknown): EditElementInput['edit'] {
  const base = exactObject(
    'edit_element',
    input,
    ['kind'],
    ['value', 'values', 'anchor'],
    'edit',
  );
  const kind = stringAt(base, 'kind', 'edit');
  switch (kind) {
    case 'text':
    case 'classes':
      return { kind, value: stringAt(base, 'value', 'edit') };
    case 'props': {
      const values = exactObject('edit_element', base['values'], [], undefined, 'edit.values');
      for (const [key, value] of Object.entries(values)) {
        if (!isJsonValue(value)) invalid('edit_element', `edit.values.${key} is not JSON-safe.`);
      }
      return { kind, values: values as Readonly<Record<string, JsonValue>> };
    }
    case 'delete':
    case 'duplicate':
      return { kind };
    case 'move':
      return {
        kind,
        anchor: parseNested('edit_element', 'edit.anchor', () =>
          insertionAnchorSchema.parse(base['anchor']),
        ),
      };
    default:
      return invalid('edit_element', `unsupported edit kind "${kind}".`);
  }
}

function exactObject(
  tool: string,
  input: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
  path = 'input',
): Record<string, unknown> {
  if (!isPlainRecord(input)) invalid(tool, `${path} must be a plain object.`);
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) invalid(tool, `${path}.${key} is not allowed.`);
  }
  for (const key of required) {
    if (!Object.hasOwn(input, key)) invalid(tool, `${path}.${key} is required.`);
  }
  return input;
}

function stringAt(value: Record<string, unknown>, key: string, path = 'input'): string {
  return nonEmptyString(value[key], `${path}.${key}`, 'site_tool');
}

function nonEmptyString(value: unknown, path: string, tool: string): string {
  if (typeof value !== 'string' || value.length === 0) invalid(tool, `${path} must be a string.`);
  return value;
}

function arrayAt(value: Record<string, unknown>, key: string): readonly unknown[] {
  const found = value[key];
  if (!Array.isArray(found)) invalid('site_tool', `input.${key} must be an array.`);
  return found;
}

function jsonAt(value: Record<string, unknown>, key: string, tool: string): JsonValue {
  const found = value[key];
  if (!isJsonValue(found)) invalid(tool, `input.${key} must be JSON-safe.`);
  return found;
}

function parseNested<T>(tool: string, path: string, parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    throw new SiteToolValidationError(
      tool,
      'input',
      `${path} is invalid: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
}

function invalid(tool: string, message: string): never {
  throw new SiteToolValidationError(tool, 'input', message);
}

function validateOutput(tool: SiteToolName, output: JsonValue): void {
  if (!isPlainRecord(output)) {
    throw new SiteToolValidationError(tool, 'output', 'handler must return an object.');
  }
  const schema = OUTPUT_SCHEMAS[tool];
  if (!isPlainRecord(schema) || !Array.isArray(schema['required'])) return;
  for (const key of schema['required']) {
    if (typeof key === 'string' && !Object.hasOwn(output, key)) {
      throw new SiteToolValidationError(tool, 'output', `handler omitted ${key}.`);
    }
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value) as object | null;
  return prototype === Object.prototype || prototype === null;
}

function isSiteToolName(value: string): value is SiteToolName {
  return SITE_TOOL_NAMES.includes(value as SiteToolName);
}

function abortError(): Error {
  const error = new Error('Site tool invocation was aborted.');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortError();
}
