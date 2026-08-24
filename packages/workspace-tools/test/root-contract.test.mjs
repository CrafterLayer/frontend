import assert from 'node:assert/strict';
import test from 'node:test';

import { readRepositoryJson, readRepositoryText } from './helpers/repository.mjs';

const REQUIRED_ROOT_SCRIPTS = [
  'build',
  'dev',
  'lint',
  'typecheck',
  'test',
  'test:coverage',
  'storybook',
  'build-storybook',
  'format',
  'format:check',
  'check:workspace',
  'check:components',
  'check:boundaries',
  'check:graph',
  'test:workspace',
  'test:storybook',
  'verify',
];

test('pins the private root to the supported Node and pnpm toolchain', async () => {
  const manifest = await readRepositoryJson('package.json');
  assert.equal(manifest.private, true);
  assert.equal(manifest.type, 'module');
  assert.equal(manifest.packageManager, 'pnpm@11.23.0');
  assert.equal(manifest.engines?.node, '>=24.15.0 <25');
  assert.equal(manifest.engines?.pnpm, '11.23.0');
  assert.deepEqual(manifest.devEngines?.packageManager, {
    name: 'pnpm',
    version: '11.23.0',
    onFail: 'error',
  });
  assert.equal((await readRepositoryText('.node-version')).trim(), '24.19.0');
  assert.equal((await readRepositoryText('.nvmrc')).trim(), '24.19.0');
});

test('exposes the complete stable root command contract', async () => {
  const manifest = await readRepositoryJson('package.json');
  for (const script of REQUIRED_ROOT_SCRIPTS) {
    assert.equal(
      typeof manifest.scripts?.[script],
      'string',
      `package.json is missing required script "${script}"`,
    );
  }

  assert.equal(
    manifest.scripts['check:workspace'],
    'node packages/workspace-tools/src/cli/check-workspace.mjs',
  );
  assert.equal(
    manifest.scripts['check:components'],
    'node packages/workspace-tools/src/cli/check-components.mjs',
  );

  const verifyCommand = manifest.scripts.verify;
  for (const requiredGate of [
    'format:check',
    'test:workspace',
    'check:workspace',
    'check:components',
    'check:boundaries',
    'lint',
    'typecheck',
    'test:coverage',
    'build',
    'test:storybook',
    'build-storybook',
  ]) {
    assert.match(verifyCommand, new RegExp(`pnpm ${escapeRegExp(requiredGate)}(?:\\s|$)`));
  }
});

test('uses only direct workspace globs and deterministic pnpm safety settings', async () => {
  const workspaceConfig = await readRepositoryText('pnpm-workspace.yaml');

  assert.match(workspaceConfig, /^\s*-\s*["']apps\/\*["']\s*$/m);
  assert.match(workspaceConfig, /^\s*-\s*["']packages\/\*["']\s*$/m);
  assert.doesNotMatch(workspaceConfig, /^\s*-\s*["'](?:apps|packages)\/\*\*\//m);
  assert.match(workspaceConfig, /^sharedWorkspaceLockfile:\s*true\s*$/m);
  assert.match(workspaceConfig, /^disallowWorkspaceCycles:\s*true\s*$/m);
  assert.match(workspaceConfig, /^engineStrict:\s*true\s*$/m);
  assert.match(workspaceConfig, /^strictPeerDependencies:\s*true\s*$/m);
  assert.match(workspaceConfig, /^\s*turbo:\s*2\.10\.10\s*$/m);
});

test('keeps the workspace-tools package private with explicit module and CLI surfaces', async () => {
  const manifest = await readRepositoryJson('packages/workspace-tools/package.json');
  assert.equal(manifest.name, '@craftkit/workspace-tools');
  assert.equal(manifest.private, true);
  assert.equal(manifest.type, 'module');
  assert.deepEqual(Object.keys(manifest.exports).sort(), [
    '.',
    './components',
    './package.json',
    './workspace',
  ]);
  assert.deepEqual(Object.keys(manifest.bin).sort(), [
    'craftkit-check-components',
    'craftkit-check-workspace',
  ]);
  assert.deepEqual(Object.keys(manifest.dependencies ?? {}), []);
  assert.deepEqual(Object.keys(manifest.devDependencies ?? {}), []);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
