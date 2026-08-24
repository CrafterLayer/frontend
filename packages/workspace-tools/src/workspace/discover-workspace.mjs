import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { createDiagnostic, compareDiagnostics } from '../shared/diagnostics.mjs';
import { toRepositoryPath } from '../shared/paths.mjs';

const MEMBER_ROOTS = Object.freeze([
  Object.freeze({ directory: 'apps', kind: 'app' }),
  Object.freeze({ directory: 'packages', kind: 'package' }),
]);

/**
 * @typedef {'app' | 'package'} WorkspaceMemberKind
 */

/**
 * @typedef {object} WorkspaceMember
 * @property {string} absolutePath
 * @property {string} path
 * @property {string} manifestPath
 * @property {WorkspaceMemberKind} kind
 * @property {Record<string, unknown>} manifest
 * @property {string | undefined} name
 */

/**
 * Discover only direct `apps/*` and `packages/*` directories that own a package.json.
 * Nested fixtures and generated output are intentionally outside this member model.
 *
 * @param {string} repositoryRoot
 * @returns {Promise<{repositoryRoot: string, members: WorkspaceMember[], diagnostics: import('../shared/diagnostics.mjs').ContractDiagnostic[]}>}
 */
export async function discoverWorkspace(repositoryRoot) {
  const normalizedRoot = path.resolve(repositoryRoot);
  /** @type {WorkspaceMember[]} */
  const members = [];
  /** @type {import('../shared/diagnostics.mjs').ContractDiagnostic[]} */
  const diagnostics = [];

  for (const memberRoot of MEMBER_ROOTS) {
    const absoluteMemberRoot = path.join(normalizedRoot, memberRoot.directory);
    const entries = await readDirectoryIfPresent(absoluteMemberRoot);

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const absolutePath = path.join(absoluteMemberRoot, entry.name);
      const absoluteManifestPath = path.join(absolutePath, 'package.json');
      const manifestText = await readFileIfPresent(absoluteManifestPath);

      if (manifestText === undefined) {
        continue;
      }

      const memberPath = toRepositoryPath(normalizedRoot, absolutePath);
      let manifest = {};

      try {
        const parsedManifest = JSON.parse(manifestText);
        if (!isPlainObject(parsedManifest)) {
          throw new TypeError('package.json must contain a JSON object');
        }
        manifest = parsedManifest;
      } catch (error) {
        diagnostics.push(
          createDiagnostic({
            code: 'INVALID_MEMBER_MANIFEST',
            ownerPath: `${memberPath}/package.json`,
            message: `Unable to parse the member manifest: ${errorMessage(error)}. Fix the JSON before running validation again.`,
          }),
        );
      }

      const manifestName = manifest.name;
      members.push({
        absolutePath,
        path: memberPath,
        manifestPath: `${memberPath}/package.json`,
        kind: /** @type {WorkspaceMemberKind} */ (memberRoot.kind),
        manifest,
        name:
          typeof manifestName === 'string' && manifestName.trim() !== ''
            ? manifestName.trim()
            : undefined,
      });
    }
  }

  members.sort((left, right) => left.path.localeCompare(right.path));
  diagnostics.sort(compareDiagnostics);

  return { repositoryRoot: normalizedRoot, members, diagnostics };
}

async function readDirectoryIfPresent(directoryPath) {
  try {
    return (await readdir(directoryPath, { withFileTypes: true })).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  } catch (error) {
    if (isMissingPathError(error)) {
      return [];
    }
    throw error;
  }
}

async function readFileIfPresent(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (isMissingPathError(error)) {
      return undefined;
    }
    throw error;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isMissingPathError(error) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
