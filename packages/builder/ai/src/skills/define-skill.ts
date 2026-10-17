import { INTENT_KINDS, type IntentKind } from '../intent/route-intent';
import { AiSkillRegistryError } from './errors';
import { compareSkillText } from './compare';
import { sha256Hex } from './sha256';
import type {
  AiDefinedSkillV1,
  AiSkillActivation,
  AiSkillManifestV1,
  AiSkillScript,
  AiSkillSource,
  AiSkillTrust,
} from './types';

export const AI_SKILL_MAX_INSTRUCTION_BYTES = 128 * 1024;
export const AI_SKILL_MAX_REFERENCE_BYTES = 128 * 1024;
export const AI_SKILL_MAX_TOTAL_REFERENCE_BYTES = 256 * 1024;
export const AI_SKILL_MAX_REFERENCES = 64;
/** Maximum UTF-8 size of one list entry stored in canonical skill metadata. */
export const AI_SKILL_MAX_METADATA_ENTRY_BYTES = 4 * 1024;
/** Maximum UTF-8 size of one complete canonical skill manifest, before its fingerprint. */
export const AI_SKILL_MAX_MANIFEST_METADATA_BYTES = 64 * 1024;

const MAX_ID_LENGTH = 96;
const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 1_000;
const MAX_LIST_ITEMS = 128;
const SKILL_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/;
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const SAFE_REFERENCE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const RESERVED_REFERENCE_SEGMENTS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);
const DEFINITION_KEYS: ReadonlySet<string> = new Set([
  'schemaVersion',
  'id',
  'name',
  'description',
  'version',
  'instructions',
  'tags',
  'source',
  'trust',
  'activation',
  'priority',
  'dependencies',
  'conflicts',
  'restrictToCommands',
  'references',
]);

function fail(code: string, message: string): never {
  throw new AiSkillRegistryError(code, message);
}

function byteLength(value: string): number {
  // UTF-8 byte length without relying on DOM or Node globals in this headless package.
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else bytes += 3;
  }
  return bytes;
}

function requiredText(value: unknown, field: string, maxLength?: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fail('invalid-text', `${field} must be a non-empty string.`);
  }
  const normalized = value.trim();
  if (maxLength !== undefined && normalized.length > maxLength) {
    return fail('text-too-long', `${field} exceeds its maximum length.`);
  }
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rejectUnknownKeys(
  value: Readonly<Record<string, unknown>>,
  allowed: ReadonlySet<string>,
  field: string,
): void {
  const unsupported = Object.keys(value).filter((key) => !allowed.has(key));
  if (unsupported.length > 0) {
    fail(
      'unsupported-field',
      `Unsupported ${field} field${unsupported.length === 1 ? '' : 's'}: ${unsupported.sort().join(', ')}.`,
    );
  }
}

function skillId(value: unknown, field = 'id'): string {
  const normalized = requiredText(value, field, MAX_ID_LENGTH);
  if (!SKILL_ID_PATTERN.test(normalized)) {
    return fail(
      'unsafe-id',
      `${field} must be a lowercase namespaced id containing only letters, numbers, dot, dash, or underscore.`,
    );
  }
  return normalized;
}

function uniqueSortedStrings(
  value: unknown,
  field: string,
  normalize: (entry: string, index: number) => string = (entry) => entry.trim(),
): readonly string[] {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_LIST_ITEMS) {
    return fail('invalid-list', `${field} must contain at most ${String(MAX_LIST_ITEMS)} strings.`);
  }

  const seen = new Set<string>();
  const result = value.map((entry, index) => {
    if (typeof entry !== 'string') {
      return fail('invalid-list-entry', `${field}[${String(index)}] must be a non-empty string.`);
    }
    const trimmed = entry.trim();
    if (trimmed.length === 0) {
      return fail('invalid-list-entry', `${field}[${String(index)}] must be a non-empty string.`);
    }
    if (byteLength(trimmed) > AI_SKILL_MAX_METADATA_ENTRY_BYTES) {
      return fail(
        'metadata-entry-too-large',
        `${field}[${String(index)}] exceeds the per-entry metadata byte limit of ${String(AI_SKILL_MAX_METADATA_ENTRY_BYTES)} bytes.`,
      );
    }
    const normalized = normalize(trimmed, index);
    if (byteLength(normalized) > AI_SKILL_MAX_METADATA_ENTRY_BYTES) {
      return fail(
        'metadata-entry-too-large',
        `${field}[${String(index)}] exceeds the per-entry metadata byte limit of ${String(AI_SKILL_MAX_METADATA_ENTRY_BYTES)} bytes after normalization.`,
      );
    }
    if (seen.has(normalized)) {
      return fail('duplicate-list-entry', `${field} contains duplicate value ${normalized}.`);
    }
    seen.add(normalized);
    return normalized;
  });

  return Object.freeze(result.sort(compareSkillText));
}

function canonicalActivation(value: unknown): AiSkillActivation {
  if (value === undefined) return Object.freeze({ mode: 'explicit' });
  if (!isRecord(value)) {
    return fail('invalid-activation', 'activation must be an object.');
  }
  const mode = value['mode'];
  if (mode === 'explicit' || mode === 'always') {
    rejectUnknownKeys(value, new Set(['mode']), 'activation');
    return Object.freeze({ mode });
  }
  if (mode !== 'auto') {
    return fail('invalid-activation', 'activation.mode must be explicit, always, or auto.');
  }
  rejectUnknownKeys(
    value,
    new Set(['mode', 'keywords', 'selectedBlockTypes', 'scripts', 'intents']),
    'activation',
  );

  const keywords = uniqueSortedStrings(value['keywords'], 'activation.keywords', (entry) =>
    entry.trim().toLowerCase(),
  );
  const selectedBlockTypes = uniqueSortedStrings(
    value['selectedBlockTypes'],
    'activation.selectedBlockTypes',
    (entry) => entry.trim().toLowerCase(),
  );
  const scripts = uniqueSortedStrings(value['scripts'], 'activation.scripts', (entry) =>
    entry.trim().toLowerCase(),
  );
  const unknownScript = scripts.find((script) => !isSkillScript(script));
  if (unknownScript !== undefined) {
    return fail(
      'invalid-activation',
      `activation.scripts may name only ${SKILL_SCRIPTS.join(', ')}; got "${unknownScript}".`,
    );
  }
  if (keywords.length === 0 && selectedBlockTypes.length === 0 && scripts.length === 0) {
    return fail(
      'missing-auto-trigger',
      'An auto activation requires keywords, selectedBlockTypes, or scripts.',
    );
  }
  const intents = canonicalIntents(value['intents']);

  const result: {
    mode: 'auto';
    keywords?: readonly string[];
    selectedBlockTypes?: readonly string[];
    scripts?: readonly AiSkillScript[];
    intents?: readonly IntentKind[];
  } = { mode: 'auto' };
  if (keywords.length > 0) result.keywords = keywords;
  if (selectedBlockTypes.length > 0) result.selectedBlockTypes = selectedBlockTypes;
  if (scripts.length > 0) result.scripts = scripts.filter(isSkillScript);
  if (intents !== undefined) result.intents = intents;
  return Object.freeze(result);
}

/**
 * The intents an auto activation serves: absent is every intent, and an empty
 * list — a skill that could never activate — is refused rather than kept as a
 * silent no-op.
 */
function canonicalIntents(value: unknown): readonly IntentKind[] | undefined {
  if (value === undefined) return undefined;
  const intents = uniqueSortedStrings(value, 'activation.intents');
  if (intents.length === 0) {
    return fail('invalid-activation', 'activation.intents must name at least one intent.');
  }
  const unknown = intents.find((intent) => !isIntentKind(intent));
  if (unknown !== undefined) {
    return fail(
      'invalid-activation',
      `activation.intents may name only ${INTENT_KINDS.join(', ')}; got "${unknown}".`,
    );
  }
  return Object.freeze(intents.filter(isIntentKind));
}

export function isIntentKind(value: string): value is IntentKind {
  return (INTENT_KINDS as readonly string[]).includes(value);
}

/** The writing systems an auto activation may name; matched by `resolve-skills`. */
const SKILL_SCRIPTS: readonly AiSkillScript[] = ['arabic', 'latin'];

function isSkillScript(value: string): value is AiSkillScript {
  return (SKILL_SCRIPTS as readonly string[]).includes(value);
}

function referencePath(value: string): string {
  const normalized = requiredText(value, 'reference path', 240);
  if (
    normalized.startsWith('/') ||
    normalized.startsWith('\\') ||
    normalized.includes('\\') ||
    normalized.includes('://')
  ) {
    return fail('unsafe-reference', `Unsafe skill reference path: ${normalized}`);
  }
  const segments = normalized.split('/');
  if (
    segments.some(
      (segment) =>
        segment === '.' ||
        segment === '..' ||
        RESERVED_REFERENCE_SEGMENTS.has(segment) ||
        !SAFE_REFERENCE_SEGMENT.test(segment),
    )
  ) {
    return fail('unsafe-reference', `Unsafe skill reference path: ${normalized}`);
  }
  return normalized;
}

function canonicalReferences(references: unknown): Readonly<Record<string, string>> {
  if (references === undefined) {
    return Object.freeze(Object.create(null) as Record<string, string>);
  }
  if (!isRecord(references)) {
    return fail('invalid-references', 'references must be a record of logical paths to text.');
  }

  const entries = Object.entries(references);
  if (entries.length > AI_SKILL_MAX_REFERENCES) {
    return fail(
      'too-many-references',
      `A skill may contain at most ${String(AI_SKILL_MAX_REFERENCES)} references.`,
    );
  }

  let totalBytes = 0;
  const canonical: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const [rawPath, rawContent] of entries.sort(([left], [right]) =>
    compareSkillText(left, right),
  )) {
    const path = referencePath(rawPath);
    if (typeof rawContent !== 'string') {
      return fail('invalid-reference', `Reference ${path} must contain text.`);
    }
    const bytes = byteLength(rawContent);
    if (bytes > AI_SKILL_MAX_REFERENCE_BYTES) {
      return fail('reference-too-large', `Reference ${path} exceeds the per-reference byte limit.`);
    }
    totalBytes += bytes;
    if (totalBytes > AI_SKILL_MAX_TOTAL_REFERENCE_BYTES) {
      return fail('references-too-large', 'Skill references exceed the total byte limit.');
    }
    canonical[path] = rawContent;
  }
  return Object.freeze(canonical);
}

function canonicalSource(value: unknown): AiSkillSource {
  if (value === undefined) return 'host';
  if (value !== 'builtin' && value !== 'host') {
    return fail('invalid-source', 'source must be builtin or host.');
  }
  return value;
}

function canonicalTrust(value: unknown, source: AiSkillSource): AiSkillTrust {
  if (value === undefined) return source === 'builtin' ? 'builtin' : 'reviewed';
  if (value !== 'builtin' && value !== 'reviewed' && value !== 'untrusted') {
    return fail('invalid-trust', 'trust must be builtin, reviewed, or untrusted.');
  }
  if (value === 'builtin' && source !== 'builtin') {
    return fail('invalid-trust', 'Only builtin skill sources may use builtin trust.');
  }
  return value;
}

function fingerprint(canonicalContent: string): string {
  return `skill-v1-sha256-${sha256Hex(canonicalContent)}`;
}

export function defineAiSkill(definition: unknown): AiDefinedSkillV1 {
  const candidate: unknown = definition;
  if (!isRecord(candidate)) {
    return fail('invalid-definition', 'A skill definition must be an object.');
  }
  rejectUnknownKeys(candidate, DEFINITION_KEYS, 'skill definition');
  if (candidate['schemaVersion'] !== 1) {
    return fail('unsupported-schema', 'Unsupported skill schemaVersion; expected 1.');
  }

  const id = skillId(candidate['id']);
  const name = requiredText(candidate['name'], 'name', MAX_NAME_LENGTH);
  const description = requiredText(candidate['description'], 'description', MAX_DESCRIPTION_LENGTH);
  const version = requiredText(candidate['version'], 'version', 80);
  if (!SEMVER_PATTERN.test(version)) {
    return fail('invalid-version', 'version must be a valid semantic version.');
  }
  const instructions = candidate['instructions'];
  if (typeof instructions !== 'string' || instructions.trim().length === 0) {
    return fail('invalid-instructions', 'instructions must be non-empty text.');
  }
  if (byteLength(instructions) > AI_SKILL_MAX_INSTRUCTION_BYTES) {
    return fail('instructions-too-large', 'Skill instructions exceed the byte limit.');
  }

  const source = canonicalSource(candidate['source']);
  const trust = canonicalTrust(candidate['trust'], source);
  const activation = canonicalActivation(candidate['activation']);
  const tags = uniqueSortedStrings(candidate['tags'], 'tags', (entry) =>
    entry.trim().toLowerCase(),
  );
  const dependencies = uniqueSortedStrings(
    candidate['dependencies'],
    'dependencies',
    (entry, index) => skillId(entry.trim(), `dependencies[${String(index)}]`),
  );
  const conflicts = uniqueSortedStrings(candidate['conflicts'], 'conflicts', (entry, index) =>
    skillId(entry.trim(), `conflicts[${String(index)}]`),
  );
  if (dependencies.includes(id) || conflicts.includes(id)) {
    return fail('self-reference', 'A skill cannot depend on or conflict with itself.');
  }
  const rawCommandRestriction = candidate['restrictToCommands'];
  const restrictToCommands =
    rawCommandRestriction === undefined
      ? undefined
      : uniqueSortedStrings(rawCommandRestriction, 'restrictToCommands');
  const references = canonicalReferences(candidate['references']);
  const rawPriority = candidate['priority'];
  if (rawPriority !== undefined && typeof rawPriority !== 'number') {
    return fail('invalid-priority', 'priority must be a number.');
  }
  const priority = rawPriority ?? 0;
  if (!Number.isSafeInteger(priority) || priority < -1_000 || priority > 1_000) {
    return fail('invalid-priority', 'priority must be a safe integer between -1000 and 1000.');
  }

  const referencePaths = Object.freeze(Object.keys(references));
  const manifestMetadata = {
    schemaVersion: 1 as const,
    id,
    name,
    description,
    version,
    tags,
    source,
    trust,
    activation,
    priority,
    dependencies,
    conflicts,
    restrictToCommands,
    referencePaths,
  };
  if (byteLength(JSON.stringify(manifestMetadata)) > AI_SKILL_MAX_MANIFEST_METADATA_BYTES) {
    return fail(
      'manifest-metadata-too-large',
      `Skill manifest metadata exceeds the aggregate byte limit of ${String(AI_SKILL_MAX_MANIFEST_METADATA_BYTES)} bytes.`,
    );
  }

  const fingerprintInput = JSON.stringify({
    schemaVersion: 1,
    id,
    name,
    description,
    version,
    instructions,
    tags,
    source,
    trust,
    activation,
    priority,
    dependencies,
    conflicts,
    restrictToCommands,
    references,
  });

  const manifestBase = {
    schemaVersion: 1 as const,
    id,
    name,
    description,
    version,
    tags,
    source,
    trust,
    activation,
    priority,
    dependencies,
    conflicts,
    referencePaths,
    contentFingerprint: fingerprint(fingerprintInput),
  };
  const manifest: AiSkillManifestV1 = Object.freeze(
    restrictToCommands === undefined ? manifestBase : { ...manifestBase, restrictToCommands },
  );

  return Object.freeze({
    manifest,
    instructions,
    references,
  });
}
