import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  EvalCase,
  EvalCaseBudget,
  EvalCaseMust,
  EvalCaseShould,
  EvalDirection,
  EvalFixture,
} from './types';

/**
 * Find `apps/evals/` from wherever this module happens to be executing.
 *
 * It runs from three different places — `src/` under vitest, `dist/` under
 * promptfoo, and the repo root when someone runs a script by hand — and a
 * relative path that is correct in one is wrong in the others. Anchoring on
 * this package's own manifest is the only rule that holds in all three, and it
 * fails loudly rather than silently loading an empty corpus.
 */
function packageRoot(): string {
  let directory = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const manifest = join(directory, 'package.json');
    if (existsSync(manifest)) {
      const parsed: unknown = JSON.parse(readFileSync(manifest, 'utf8'));
      if (isRecord(parsed) && parsed['name'] === '@craftkit/evals') return directory;
    }
    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error(
        'Could not locate the @craftkit/evals package root above this module. The eval corpus cannot be loaded.',
      );
    }
    directory = parent;
  }
}

export function corpusDirectory(): string {
  return join(packageRoot(), 'corpus');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(where: string, message: string): never {
  throw new Error(`Eval case ${where}: ${message}`);
}

function requireString(record: Record<string, unknown>, key: string, where: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    fail(where, `"${key}" must be a non-empty string.`);
  }
  return value;
}

function requireStringArray(
  record: Record<string, unknown>,
  key: string,
  where: string,
): readonly string[] {
  const value = record[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    fail(where, `"${key}" must be an array of strings.`);
  }
  return value as readonly string[];
}

function optionalStringArray(
  record: Record<string, unknown>,
  key: string,
  where: string,
): readonly string[] | undefined {
  return record[key] === undefined ? undefined : requireStringArray(record, key, where);
}

function requireNumber(record: Record<string, unknown>, key: string, where: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(where, `"${key}" must be a finite number.`);
  }
  return value;
}

function optionalNumber(
  record: Record<string, unknown>,
  key: string,
  where: string,
): number | undefined {
  return record[key] === undefined ? undefined : requireNumber(record, key, where);
}

function requireRecord(
  record: Record<string, unknown>,
  key: string,
  where: string,
): Record<string, unknown> {
  const value = record[key];
  if (!isRecord(value)) fail(where, `"${key}" must be an object.`);
  return value;
}

function parseMust(record: Record<string, unknown>, where: string): EvalCaseMust {
  const outcome = requireString(record, 'outcome', where);
  if (outcome !== 'plan' && outcome !== 'refusal' && outcome !== 'any') {
    fail(where, 'must.outcome must be "plan", "refusal" or "any".');
  }
  return {
    outcome,
    forbiddenCommands: requireStringArray(record, 'forbiddenCommands', where),
    forbiddenText: requireStringArray(record, 'forbiddenText', where),
    requiredTargetNodeIds: requireStringArray(record, 'requiredTargetNodeIds', where),
  };
}

/*
  `exactOptionalPropertyTypes` is on, so an absent clause must be an ABSENT key
  rather than an explicit `undefined`. Spreading a conditional empty object is
  the workspace's idiom for that, and it is why this reads as it does.
*/
function parseShould(record: Record<string, unknown>, where: string): EvalCaseShould {
  const minCommands = optionalNumber(record, 'minCommands', where);
  const maxCommands = optionalNumber(record, 'maxCommands', where);
  const anyBlockTypes = optionalStringArray(record, 'anyBlockTypes', where);
  const allBlockTypes = optionalStringArray(record, 'allBlockTypes', where);
  const anyCommands = optionalStringArray(record, 'anyCommands', where);
  const forbiddenBlockTypes = optionalStringArray(record, 'forbiddenBlockTypes', where);
  return {
    ...(minCommands === undefined ? {} : { minCommands }),
    ...(maxCommands === undefined ? {} : { maxCommands }),
    ...(anyBlockTypes === undefined ? {} : { anyBlockTypes }),
    ...(allBlockTypes === undefined ? {} : { allBlockTypes }),
    ...(anyCommands === undefined ? {} : { anyCommands }),
    ...(forbiddenBlockTypes === undefined ? {} : { forbiddenBlockTypes }),
  };
}

function parseBudget(record: Record<string, unknown>, where: string): EvalCaseBudget {
  return {
    maxCommands: requireNumber(record, 'maxCommands', where),
    maxContextTokens: requireNumber(record, 'maxContextTokens', where),
    maxElapsedMs: requireNumber(record, 'maxElapsedMs', where),
  };
}

/** Parse one corpus file's parsed JSON into a case, or throw naming the file. */
export function parseEvalCase(candidate: unknown, where: string): EvalCase {
  if (!isRecord(candidate)) fail(where, 'the file must contain a JSON object.');
  const fixture = requireString(candidate, 'fixture', where);
  if (fixture !== 'empty' && fixture !== 'starter') {
    fail(where, 'fixture must be "empty" or "starter".');
  }
  const dir = requireString(candidate, 'dir', where);
  if (dir !== 'ltr' && dir !== 'rtl') fail(where, 'dir must be "ltr" or "rtl".');
  /*
    The request is the ONE field allowed to be whitespace: case 12 is a blank
    ask, and the point of it is that a blank ask must reach the agent intact
    rather than being filtered out by the loader.
  */
  const request = candidate['request'];
  if (typeof request !== 'string') fail(where, '"request" must be a string.');

  return {
    id: requireString(candidate, 'id', where),
    title: requireString(candidate, 'title', where),
    category: requireString(candidate, 'category', where),
    fixture: fixture satisfies EvalFixture,
    dir: dir satisfies EvalDirection,
    request,
    must: parseMust(requireRecord(candidate, 'must', where), where),
    should: parseShould(requireRecord(candidate, 'should', where), where),
    budget: parseBudget(requireRecord(candidate, 'budget', where), where),
    rubric: requireString(candidate, 'rubric', where),
    why: requireString(candidate, 'why', where),
  };
}

/** Every case in the corpus, ordered by file name so runs are reproducible. */
export function loadCorpus(directory: string = corpusDirectory()): readonly EvalCase[] {
  const files = readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  const seen = new Set<string>();
  const cases = files.map((name) => {
    const path = resolve(directory, name);
    const parsed = parseEvalCase(JSON.parse(readFileSync(path, 'utf8')), name);
    if (seen.has(parsed.id)) {
      throw new Error(`Eval case ${name}: duplicate id "${parsed.id}".`);
    }
    seen.add(parsed.id);
    return parsed;
  });
  if (cases.length === 0) {
    throw new Error(
      `No eval cases found in ${directory}. The corpus must never be silently empty.`,
    );
  }
  return cases;
}

/** One case by id, for a grader that has only the provider's output to go on. */
export function findEvalCase(id: string, corpus: readonly EvalCase[] = loadCorpus()): EvalCase {
  const found = corpus.find((item) => item.id === id);
  if (found === undefined) throw new Error(`Unknown eval case id "${id}".`);
  return found;
}
