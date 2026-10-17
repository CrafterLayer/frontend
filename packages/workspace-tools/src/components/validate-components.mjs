import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';

import { createDiagnostic, compareDiagnostics } from '../shared/diagnostics.mjs';
import { toRepositoryPath } from '../shared/paths.mjs';
import { discoverWorkspace } from '../workspace/discover-workspace.mjs';

const COMPONENT_NAME_PATTERN = /^[A-Z][A-Za-z0-9]*$/;
const IGNORED_DIRECTORY_NAMES = new Set([
  '.next',
  '.turbo',
  '__fixtures__',
  '__tests__',
  'build',
  'coverage',
  'dist',
  'fixtures',
  'generated',
  'node_modules',
  'storybook-static',
  'test',
  'tests',
]);

/**
 * @param {string} componentName
 */
export function requiredComponentArtifacts(componentName) {
  return Object.freeze([
    `${componentName}.tsx`,
    `${componentName}.stories.tsx`,
    `${componentName}.docs.mdx`,
    `${componentName}.test.tsx`,
    'index.ts',
  ]);
}

/**
 * Discover package components in each direct package's `src/components` directory and
 * app components below every directory named `components` within a direct app's `src`.
 *
 * @param {string} repositoryRoot
 */
export async function discoverComponentFolders(repositoryRoot) {
  const normalizedRoot = path.resolve(repositoryRoot);
  const componentFolders = [];
  const workspace = await discoverWorkspace(normalizedRoot);

  for (const member of workspace.members.filter((candidate) => candidate.kind === 'package')) {
    await collectDirectComponents(
      path.join(member.absolutePath, 'src', 'components'),
      componentFolders,
    );
    // Extension packages keep their components directly under `src/` (the
    // richtext and code-view convention since B3b). Leaving that root
    // unscanned meant NONE of their components were governed — a gap found by
    // 011 T031's negative check, where deleting a docs file changed nothing.
    // The capitalized-name pattern keeps codec/worker/testing folders out.
    await collectDirectComponents(path.join(member.absolutePath, 'src'), componentFolders);
  }

  for (const member of workspace.members.filter((candidate) => candidate.kind === 'app')) {
    await findApplicationComponentRoots(path.join(member.absolutePath, 'src'), componentFolders);
  }

  const deduplicatedFolders = [
    ...new Map(componentFolders.map((folder) => [folder.absolutePath, folder])).values(),
  ];
  deduplicatedFolders.sort((left, right) => left.path.localeCompare(right.path));
  return { repositoryRoot: normalizedRoot, components: deduplicatedFolders };

  async function collectDirectComponents(componentRoot, target) {
    for (const entry of await directDirectories(componentRoot)) {
      if (!COMPONENT_NAME_PATTERN.test(entry.name) || IGNORED_DIRECTORY_NAMES.has(entry.name)) {
        continue;
      }
      const absolutePath = path.join(componentRoot, entry.name);
      target.push({
        name: entry.name,
        absolutePath,
        path: toRepositoryPath(normalizedRoot, absolutePath),
      });
    }
  }

  async function findApplicationComponentRoots(directoryPath, target) {
    const entries = await directDirectories(directoryPath);
    for (const entry of entries) {
      if (IGNORED_DIRECTORY_NAMES.has(entry.name)) {
        continue;
      }

      const absolutePath = path.join(directoryPath, entry.name);
      if (entry.name === 'components') {
        await collectDirectComponents(absolutePath, target);
        continue;
      }

      await findApplicationComponentRoots(absolutePath, target);
    }
  }
}

/**
 * Validate presence of the five mandatory artifacts for every discovered component.
 * Content remains the responsibility of ESLint, TypeScript, tests, and Storybook.
 *
 * @param {string} repositoryRoot
 */
export async function validateComponents(repositoryRoot) {
  const discovery = await discoverComponentFolders(repositoryRoot);
  const diagnostics = [];

  for (const component of discovery.components) {
    for (const artifact of requiredComponentArtifacts(component.name)) {
      const artifactPath = path.join(component.absolutePath, artifact);
      if (await isRegularFile(artifactPath)) {
        continue;
      }
      diagnostics.push(
        createDiagnostic({
          code: 'MISSING_COMPONENT_ARTIFACT',
          ownerPath: component.path,
          message: `Component "${component.name}" is missing "${artifact}". Add the complete implementation/export/story/MDX/test contract.`,
        }),
      );
    }
  }

  diagnostics.sort(compareDiagnostics);
  return {
    repositoryRoot: discovery.repositoryRoot,
    components: discovery.components,
    diagnostics,
    valid: diagnostics.length === 0,
  };
}

async function directDirectories(directoryPath) {
  try {
    return (await readdir(directoryPath, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .sort((left, right) => left.name.localeCompare(right.name));
  } catch (error) {
    if (isMissingPathError(error)) {
      return [];
    }
    throw error;
  }
}

async function isRegularFile(filePath) {
  try {
    return (await lstat(filePath)).isFile();
  } catch (error) {
    if (isMissingPathError(error)) {
      return false;
    }
    throw error;
  }
}

function isMissingPathError(error) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
