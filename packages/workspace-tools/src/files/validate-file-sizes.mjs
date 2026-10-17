import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { createDiagnostic, compareDiagnostics } from '../shared/diagnostics.mjs';
import { toRepositoryPath } from '../shared/paths.mjs';
import { discoverWorkspace } from '../workspace/discover-workspace.mjs';

/**
 * The file-size policy (2026-10-12, owner request: "keep the code split properly; no very
 * large files"). A file is one idea: past these line counts it is several, and the split
 * belongs in the code, not in the reader's head.
 *
 * - `source`: every module, component, hook and stylesheet.
 * - `test`: tests and stories, which repeat setup on purpose and may run longer.
 *
 * Files that were already over the limit when the policy arrived are recorded in
 * `file-size-baseline.json` with their size at that moment. They may shrink, never grow,
 * and an entry that no longer applies must be removed: the baseline only ratchets down.
 */
export const FILE_SIZE_LIMITS = Object.freeze({ source: 500, test: 800 });

export const FILE_SIZE_BASELINE_PATH = 'packages/workspace-tools/file-size-baseline.json';

const SCANNED_DIRECTORIES = Object.freeze(['src', 'scripts', 'test']);
const EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.mjs', '.js', '.css']);
const IGNORED_DIRECTORY_NAMES = new Set([
  '.next',
  '.turbo',
  '__fixtures__',
  'build',
  'coverage',
  'dist',
  'fixtures',
  'generated',
  'node_modules',
  'storybook-static',
  'vendor',
]);

/**
 * Generated or data-only files: a list of 6,000 icon names or a bundled engine source is
 * not code anyone reads top to bottom, so splitting it buys nothing.
 */
const EXEMPT_FILE_PATTERNS = Object.freeze([
  /\.d\.ts$/u,
  /\.data\.ts$/u,
  /-source\.ts$/u,
  /icon-names\.ts$/u,
]);

const TEST_FILE_PATTERN = /\.(test|spec|stories)\.[cm]?[jt]sx?$/u;

/**
 * @param {string} repositoryPath
 * @returns {'source' | 'test'}
 */
export function fileSizeKind(repositoryPath) {
  return TEST_FILE_PATTERN.test(repositoryPath) || repositoryPath.includes('/test/')
    ? 'test'
    : 'source';
}

/**
 * @param {string} text
 */
export function countLines(text) {
  if (text.length === 0) return 0;
  const breaks = text.split('\n').length - 1;
  return text.endsWith('\n') ? breaks : breaks + 1;
}

/**
 * @param {string} repositoryRoot
 * @returns {Promise<{path: string, lines: number, kind: 'source' | 'test'}[]>}
 */
export async function measureFiles(repositoryRoot) {
  const normalizedRoot = path.resolve(repositoryRoot);
  const workspace = await discoverWorkspace(normalizedRoot);
  const roots = [
    path.join(normalizedRoot, 'scripts'),
    ...workspace.members.flatMap((member) =>
      SCANNED_DIRECTORIES.map((directory) => path.join(member.absolutePath, directory)),
    ),
  ];
  /** @type {{path: string, lines: number, kind: 'source' | 'test'}[]} */
  const measured = [];
  const seen = new Set();
  for (const root of roots) {
    await walk(root, async (absolutePath) => {
      if (seen.has(absolutePath)) return;
      seen.add(absolutePath);
      const repositoryPath = toRepositoryPath(normalizedRoot, absolutePath);
      if (EXEMPT_FILE_PATTERNS.some((pattern) => pattern.test(repositoryPath))) return;
      const lines = countLines(await readFile(absolutePath, 'utf8'));
      measured.push({ path: repositoryPath, lines, kind: fileSizeKind(repositoryPath) });
    });
  }
  return measured.sort((left, right) => left.path.localeCompare(right.path));
}

/**
 * @param {string} directory
 * @param {(absolutePath: string) => Promise<void>} visit
 */
async function walk(directory, visit) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORY_NAMES.has(entry.name)) await walk(absolutePath, visit);
    } else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) {
      await visit(absolutePath);
    }
  }
}

/**
 * @param {string} repositoryRoot
 * @returns {Promise<Record<string, number>>}
 */
export async function readFileSizeBaseline(repositoryRoot) {
  try {
    const parsed = JSON.parse(
      await readFile(path.join(repositoryRoot, FILE_SIZE_BASELINE_PATH), 'utf8'),
    );
    const files = parsed?.files;
    return files !== null && typeof files === 'object' ? files : {};
  } catch {
    return {};
  }
}

/**
 * The oversized files now, as a baseline would record them.
 *
 * @param {{path: string, lines: number, kind: 'source' | 'test'}[]} measured
 */
export function oversizedFiles(measured) {
  return Object.fromEntries(
    measured
      .filter((file) => file.lines > FILE_SIZE_LIMITS[file.kind])
      .map((file) => [file.path, file.lines]),
  );
}

/**
 * @param {string} repositoryRoot
 */
export async function validateFileSizes(repositoryRoot) {
  const normalizedRoot = path.resolve(repositoryRoot);
  const measured = await measureFiles(normalizedRoot);
  const baseline = await readFileSizeBaseline(normalizedRoot);
  const byPath = new Map(measured.map((file) => [file.path, file]));
  const diagnostics = [];

  for (const file of measured) {
    const limit = FILE_SIZE_LIMITS[file.kind];
    if (file.lines <= limit) continue;
    const recorded = baseline[file.path];
    if (recorded === undefined) {
      diagnostics.push(
        createDiagnostic({
          code: 'FILE_TOO_LARGE',
          ownerPath: file.path,
          message: `${String(file.lines)} lines, over the ${file.kind} limit of ${String(limit)}. Split it into focused modules.`,
        }),
      );
    } else if (file.lines > recorded) {
      diagnostics.push(
        createDiagnostic({
          code: 'FILE_GREW_PAST_BASELINE',
          ownerPath: file.path,
          message: `${String(file.lines)} lines; its baseline is ${String(recorded)}. An oversized file may only shrink: move the new code into its own module.`,
        }),
      );
    }
  }

  for (const [recordedPath, recorded] of Object.entries(baseline)) {
    const file = byPath.get(recordedPath);
    if (file === undefined || file.lines <= FILE_SIZE_LIMITS[file.kind]) {
      diagnostics.push(
        createDiagnostic({
          code: 'FILE_BASELINE_STALE',
          ownerPath: recordedPath,
          message:
            file === undefined
              ? `Recorded at ${String(recorded)} lines but no longer exists. Remove it from ${FILE_SIZE_BASELINE_PATH}.`
              : `Now ${String(file.lines)} lines, within the limit. Remove it from ${FILE_SIZE_BASELINE_PATH}.`,
        }),
      );
    }
  }

  const shrunk = measured.filter((file) => {
    const recorded = baseline[file.path];
    return (
      recorded !== undefined && file.lines < recorded && file.lines > FILE_SIZE_LIMITS[file.kind]
    );
  });

  return Object.freeze({
    valid: diagnostics.length === 0,
    measured,
    diagnostics: diagnostics.sort(compareDiagnostics),
    /** Baselined files that shrank: their entries can be tightened with --write-baseline. */
    shrunk,
  });
}
