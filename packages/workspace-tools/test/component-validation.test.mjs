import assert from 'node:assert/strict';
import test from 'node:test';

import {
  discoverComponentFolders,
  requiredComponentArtifacts,
  validateComponents,
} from '../src/components/validate-components.mjs';
import { appManifest, createRepositoryFixture, packageManifest } from './helpers/fixture.mjs';

test('accepts complete package and nested app component contracts', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson('packages/ui/package.json', packageManifest('@fixture/ui'));
  await fixture.writeJson('apps/catalog/package.json', appManifest('@fixture/catalog'));
  await writeCompleteComponent(fixture, 'packages/ui/src/components/Button', 'Button');
  await writeCompleteComponent(
    fixture,
    'apps/catalog/src/features/navigation/components/NavMenu',
    'NavMenu',
  );

  const result = await validateComponents(fixture.repositoryRoot);
  assert.equal(result.valid, true);
  assert.deepEqual(
    result.components.map((component) => component.path),
    [
      'apps/catalog/src/features/navigation/components/NavMenu',
      'packages/ui/src/components/Button',
    ],
  );
  assert.deepEqual(result.diagnostics, []);
});

test('reports every missing artifact with the component owner path', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson('packages/ui/package.json', packageManifest('@fixture/ui'));
  await fixture.writeText(
    'packages/ui/src/components/Incomplete/Incomplete.tsx',
    'export function Incomplete() { return null; }\n',
  );

  const result = await validateComponents(fixture.repositoryRoot);
  assert.equal(result.valid, false);
  assert.equal(result.components.length, 1);
  assert.deepEqual(
    result.diagnostics.map((diagnostic) => diagnostic.message.match(/"([^"]+)"/g)?.[1]).sort(),
    [
      '"Incomplete.docs.mdx"',
      '"Incomplete.stories.tsx"',
      '"Incomplete.test.tsx"',
      '"index.ts"',
    ].sort(),
  );
  assert.ok(
    result.diagnostics.every(
      (diagnostic) =>
        diagnostic.code === 'MISSING_COMPONENT_ARTIFACT' &&
        diagnostic.ownerPath === 'packages/ui/src/components/Incomplete',
    ),
  );
});

test('ignores fixtures, generated output, support folders, and nested package component roots', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson('packages/ui/package.json', packageManifest('@fixture/ui'));
  await fixture.writeJson('apps/catalog/package.json', appManifest('@fixture/catalog'));
  await writeCompleteComponent(fixture, 'packages/ui/src/components/Button', 'Button');
  await fixture.writeText('packages/ui/src/components/helpers/readme.md', 'support only');
  await fixture.writeText(
    'packages/ui/fixtures/src/components/Broken/Broken.tsx',
    'export function Broken() { return null; }\n',
  );
  await fixture.writeText(
    'packages/ui/src/features/example/components/Nested/Nested.tsx',
    'export function Nested() { return null; }\n',
  );
  await fixture.writeText(
    'apps/catalog/src/__fixtures__/components/FixtureOnly/FixtureOnly.tsx',
    'export function FixtureOnly() { return null; }\n',
  );
  await fixture.writeText(
    'apps/catalog/src/generated/components/GeneratedOnly/GeneratedOnly.tsx',
    'export function GeneratedOnly() { return null; }\n',
  );

  const discovery = await discoverComponentFolders(fixture.repositoryRoot);
  assert.deepEqual(
    discovery.components.map((component) => component.name),
    ['Button'],
  );
});

test('requires artifacts to be files rather than same-named directories', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson('packages/ui/package.json', packageManifest('@fixture/ui'));
  const componentPath = 'packages/ui/src/components/Button';
  for (const artifact of requiredComponentArtifacts('Button')) {
    await fixture.writeText(`${componentPath}/${artifact}/placeholder`, 'not a file');
  }

  const result = await validateComponents(fixture.repositoryRoot);
  assert.equal(result.diagnostics.length, 5);
});

test('does not treat non-member placeholder directories as component owners', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeText(
    'packages/placeholder/src/components/Incomplete/Incomplete.tsx',
    'export function Incomplete() { return null; }\n',
  );

  const result = await validateComponents(fixture.repositoryRoot);
  assert.equal(result.valid, true);
  assert.deepEqual(result.components, []);
});

async function writeCompleteComponent(fixture, componentPath, componentName) {
  for (const artifact of requiredComponentArtifacts(componentName)) {
    await fixture.writeText(`${componentPath}/${artifact}`, `${artifact}\n`);
  }
}

test('governs extension-style components living directly under src (011 T031)', async (t) => {
  // The gap this pins: discovery once scanned only `src/components`, so the
  // richtext and code-view extensions — whose components live directly under
  // `src/` — were never governed at all. Deleting a docs file changed nothing,
  // which a boundary negative exposed. Lowercase folders (codec, worker,
  // testing) stay out via the capitalized-name pattern.
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson('packages/code-view/package.json', packageManifest('@fixture/code-view'));
  await writeCompleteComponent(fixture, 'packages/code-view/src/CodeViewPanel', 'CodeViewPanel');
  await fixture.writeText('packages/code-view/src/worker/client.ts', 'export {};\n');
  await fixture.writeText(
    'packages/code-view/src/CodeViewErrors/CodeViewErrors.tsx',
    'export function CodeViewErrors() { return null; }\n',
  );

  const result = await validateComponents(fixture.repositoryRoot);
  assert.equal(result.valid, false);
  assert.deepEqual(
    result.components.map((component) => component.path),
    ['packages/code-view/src/CodeViewErrors', 'packages/code-view/src/CodeViewPanel'],
  );
  const incomplete = result.diagnostics.filter((diagnostic) =>
    diagnostic.ownerPath.includes('CodeViewErrors'),
  );
  assert.ok(incomplete.length > 0, 'the direct-src component must be governed');
});
