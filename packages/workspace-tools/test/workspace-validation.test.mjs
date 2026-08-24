import assert from 'node:assert/strict';
import test from 'node:test';

import { discoverWorkspace } from '../src/workspace/discover-workspace.mjs';
import { validateWorkspace } from '../src/workspace/validate-workspace.mjs';
import { appManifest, createRepositoryFixture, packageManifest } from './helpers/fixture.mjs';

test('accepts a valid direct app-to-package graph and ignores nested manifests', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson(
    'apps/catalog/package.json',
    appManifest('@fixture/catalog', {
      dependencies: { '@fixture/ui': 'workspace:*' },
    }),
  );
  await fixture.writeJson('packages/ui/package.json', packageManifest('@fixture/ui'));
  await fixture.writeJson(
    'packages/ui/fixtures/nested/package.json',
    packageManifest('@fixture/not-a-member'),
  );

  const discovery = await discoverWorkspace(fixture.repositoryRoot);
  assert.deepEqual(
    discovery.members.map((member) => member.name),
    ['@fixture/catalog', '@fixture/ui'],
  );

  const result = await validateWorkspace(fixture.repositoryRoot);
  assert.equal(result.valid, true);
  assert.deepEqual(result.diagnostics, []);
});

test('reports missing and duplicate member names together', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson('apps/unnamed/package.json', appManifest('', {}));
  await fixture.writeJson('packages/alpha/package.json', packageManifest('@fixture/duplicate'));
  await fixture.writeJson('packages/beta/package.json', packageManifest('@fixture/duplicate'));

  const result = await validateWorkspace(fixture.repositoryRoot);
  assert.equal(result.valid, false);
  assertDiagnostic(result, 'MISSING_MEMBER_NAME', 'apps/unnamed/package.json');
  const duplicate = assertDiagnostic(
    result,
    'DUPLICATE_MEMBER_NAME',
    'packages/alpha/package.json',
  );
  assert.match(duplicate.message, /packages\/beta\/package\.json/);
});

test('does not misreport a duplicate dependency target as missing', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson(
    'apps/catalog/package.json',
    appManifest('@fixture/catalog', {
      dependencies: { '@fixture/duplicate': 'workspace:*' },
    }),
  );
  await fixture.writeJson('packages/alpha/package.json', packageManifest('@fixture/duplicate'));
  await fixture.writeJson('packages/beta/package.json', packageManifest('@fixture/duplicate'));

  const result = await validateWorkspace(fixture.repositoryRoot);
  assertDiagnostic(result, 'DUPLICATE_MEMBER_NAME');
  assert.equal(
    result.diagnostics.some((diagnostic) => diagnostic.code === 'MISSING_WORKSPACE_TARGET'),
    false,
  );
});

test('reports existing internal members without exact workspace:* ranges', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson(
    'apps/catalog/package.json',
    appManifest('@fixture/catalog', {
      dependencies: { '@fixture/ui': '^1.0.0' },
      devDependencies: { '@fixture/config': 'workspace:^' },
    }),
  );
  await fixture.writeJson('packages/config/package.json', packageManifest('@fixture/config'));
  await fixture.writeJson('packages/ui/package.json', packageManifest('@fixture/ui'));

  const result = await validateWorkspace(fixture.repositoryRoot);
  const invalidRanges = result.diagnostics.filter(
    (diagnostic) => diagnostic.code === 'INVALID_WORKSPACE_RANGE',
  );
  assert.equal(invalidRanges.length, 2);
  assert.deepEqual(invalidRanges.map((diagnostic) => diagnostic.dependency).sort(), [
    '@fixture/config',
    '@fixture/ui',
  ]);
  assert.ok(invalidRanges.every((diagnostic) => diagnostic.message.includes('workspace:*')));
});

test('reports workspace protocol references to missing targets', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson(
    'packages/alpha/package.json',
    packageManifest('@fixture/alpha', {
      dependencies: { '@fixture/missing': 'workspace:*' },
    }),
  );

  const result = await validateWorkspace(fixture.repositoryRoot);
  const diagnostic = assertDiagnostic(
    result,
    'MISSING_WORKSPACE_TARGET',
    'packages/alpha/package.json',
  );
  assert.equal(diagnostic.dependency, '@fixture/missing');
  assert.match(diagnostic.message, /@fixture\/missing/);
});

test('reports app-to-app and package-to-app dependency direction', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson(
    'apps/admin/package.json',
    appManifest('@fixture/admin', {
      dependencies: { '@fixture/storefront': 'workspace:*' },
    }),
  );
  await fixture.writeJson('apps/storefront/package.json', appManifest('@fixture/storefront'));
  await fixture.writeJson(
    'packages/domain/package.json',
    packageManifest('@fixture/domain', {
      devDependencies: { '@fixture/admin': 'workspace:*' },
    }),
  );

  const result = await validateWorkspace(fixture.repositoryRoot);
  assertDiagnostic(result, 'APP_TO_APP_DEPENDENCY', 'apps/admin/package.json');
  assertDiagnostic(result, 'PACKAGE_TO_APP_DEPENDENCY', 'packages/domain/package.json');
});

test('reports non-private apps and packages', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson(
    'apps/catalog/package.json',
    appManifest('@fixture/catalog', { private: false }),
  );
  await fixture.writeJson(
    'packages/ui/package.json',
    packageManifest('@fixture/ui', { private: false }),
  );

  const result = await validateWorkspace(fixture.repositoryRoot);
  const diagnostics = result.diagnostics.filter(
    (diagnostic) => diagnostic.code === 'MEMBER_NOT_PRIVATE',
  );
  assert.deepEqual(
    diagnostics.map((diagnostic) => diagnostic.ownerPath),
    ['apps/catalog/package.json', 'packages/ui/package.json'],
  );
});

test('reports a complete internal dependency cycle path', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson(
    'packages/alpha/package.json',
    packageManifest('@fixture/alpha', {
      dependencies: { '@fixture/beta': 'workspace:*' },
    }),
  );
  await fixture.writeJson(
    'packages/beta/package.json',
    packageManifest('@fixture/beta', {
      dependencies: { '@fixture/gamma': 'workspace:*' },
    }),
  );
  await fixture.writeJson(
    'packages/gamma/package.json',
    packageManifest('@fixture/gamma', {
      dependencies: { '@fixture/alpha': 'workspace:*' },
    }),
  );

  const result = await validateWorkspace(fixture.repositoryRoot);
  const diagnostic = assertDiagnostic(result, 'WORKSPACE_DEPENDENCY_CYCLE');
  assert.match(
    diagnostic.message,
    /@fixture\/alpha -> @fixture\/beta -> @fixture\/gamma -> @fixture\/alpha/,
  );
});

test('requires explicit package exports and rejects unsafe keys and targets', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson('packages/missing/package.json', {
    name: '@fixture/missing-exports',
    version: '0.0.0',
    private: true,
    type: 'module',
  });
  await fixture.writeJson(
    'packages/unsafe/package.json',
    packageManifest('@fixture/unsafe', {
      exports: {
        '.': '../outside.mjs',
        './../private': './src/private.mjs',
      },
    }),
  );

  const result = await validateWorkspace(fixture.repositoryRoot);
  assertDiagnostic(result, 'MISSING_PACKAGE_EXPORTS', 'packages/missing/package.json');
  assertDiagnostic(result, 'UNSAFE_PACKAGE_EXPORT_KEY', 'packages/unsafe/package.json');
  const targetDiagnostic = assertDiagnostic(
    result,
    'UNSAFE_PACKAGE_EXPORT_TARGET',
    'packages/unsafe/package.json',
  );
  assert.match(targetDiagnostic.message, /\.\.\/outside\.mjs/);
});

test('reports malformed member manifests without stopping other checks', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeText('packages/broken/package.json', '{ invalid JSON');
  await fixture.writeJson('packages/valid/package.json', packageManifest('@fixture/valid'));

  const result = await validateWorkspace(fixture.repositoryRoot);
  assertDiagnostic(result, 'INVALID_MEMBER_MANIFEST', 'packages/broken/package.json');
  assertDiagnostic(result, 'MISSING_MEMBER_NAME', 'packages/broken/package.json');
  assert.equal(result.members.length, 2);
});

function assertDiagnostic(result, code, ownerPath) {
  const diagnostic = result.diagnostics.find(
    (candidate) =>
      candidate.code === code && (ownerPath === undefined || candidate.ownerPath === ownerPath),
  );
  assert.ok(
    diagnostic,
    `Expected ${code}${ownerPath === undefined ? '' : ` at ${ownerPath}`}; got ${result.diagnostics.map((entry) => `${entry.code}:${entry.ownerPath}`).join(', ')}`,
  );
  return diagnostic;
}
