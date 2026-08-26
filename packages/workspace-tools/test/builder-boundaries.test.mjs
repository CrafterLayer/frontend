import assert from 'node:assert/strict';
import test from 'node:test';

import { validateWorkspace } from '../src/workspace/validate-workspace.mjs';
import { createRepositoryFixture, appManifest, packageManifest } from './helpers/fixture.mjs';

function builderCodes(result) {
  return result.diagnostics
    .filter((diagnostic) => diagnostic.code.startsWith('BUILDER_'))
    .map((diagnostic) => diagnostic.code)
    .sort();
}

test('accepts downward builder dependencies and tooling devDependencies', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson(
    'packages/builder/schema/package.json',
    packageManifest('@craftkit/builder-schema', {
      devDependencies: { '@craftkit/test-config': 'workspace:*' },
    }),
  );
  await fixture.writeJson(
    'packages/builder/core/package.json',
    packageManifest('@craftkit/builder-core', {
      dependencies: { '@craftkit/builder-schema': 'workspace:*' },
    }),
  );
  await fixture.writeJson(
    'packages/test-config/package.json',
    packageManifest('@craftkit/test-config'),
  );

  const result = await validateWorkspace(fixture.repositoryRoot);
  assert.deepEqual(builderCodes(result), []);
  assert.equal(result.valid, true);
});

test('rejects an upward builder dependency (schema → core)', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson(
    'packages/builder/schema/package.json',
    packageManifest('@craftkit/builder-schema', {
      dependencies: { '@craftkit/builder-core': 'workspace:*' },
    }),
  );
  await fixture.writeJson(
    'packages/builder/core/package.json',
    packageManifest('@craftkit/builder-core'),
  );

  const result = await validateWorkspace(fixture.repositoryRoot);
  assert.deepEqual(builderCodes(result), ['BUILDER_LAYER_VIOLATION']);
  assert.equal(result.valid, false);
});

test('rejects extension-to-extension coupling', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson(
    'packages/builder/extensions/blocks-marketing/package.json',
    packageManifest('@craftkit/builder-ext-blocks-marketing', {
      dependencies: { '@craftkit/builder-ext-widgets': 'workspace:*' },
    }),
  );
  await fixture.writeJson(
    'packages/builder/extensions/widgets/package.json',
    packageManifest('@craftkit/builder-ext-widgets'),
  );

  const result = await validateWorkspace(fixture.repositoryRoot);
  assert.deepEqual(builderCodes(result), ['BUILDER_EXTENSION_COUPLING']);
});

test('restricts non-builder members to the preset entrypoint', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson(
    'apps/site/package.json',
    appManifest('@craftkit/site', {
      dependencies: {
        '@craftkit/builder': 'workspace:*',
        '@craftkit/builder-core': 'workspace:*',
      },
    }),
  );
  await fixture.writeJson(
    'packages/builder/editor/package.json',
    packageManifest('@craftkit/builder'),
  );
  await fixture.writeJson(
    'packages/builder/core/package.json',
    packageManifest('@craftkit/builder-core'),
  );

  const result = await validateWorkspace(fixture.repositoryRoot);
  // The preset dependency passes; only the deep builder-core edge is flagged.
  assert.deepEqual(builderCodes(result), ['BUILDER_FAMILY_ACCESS']);
});

test('leaves non-builder dependencies governed by the existing workspace rules', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson(
    'apps/storybook/package.json',
    appManifest('@craftkit/storybook', {
      dependencies: { '@craftkit/ui': 'workspace:*' },
    }),
  );
  await fixture.writeJson('packages/ui/package.json', packageManifest('@craftkit/ui'));
  await fixture.writeJson(
    'packages/builder/core/package.json',
    packageManifest('@craftkit/builder-core'),
  );

  const result = await validateWorkspace(fixture.repositoryRoot);
  assert.deepEqual(builderCodes(result), []);
  assert.equal(result.valid, true);
});

test('flags builder dependencies on non-tooling workspace members', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson(
    'packages/builder/core/package.json',
    packageManifest('@craftkit/builder-core', {
      dependencies: { '@craftkit/ui': 'workspace:*' },
    }),
  );
  await fixture.writeJson('packages/ui/package.json', packageManifest('@craftkit/ui'));

  const result = await validateWorkspace(fixture.repositoryRoot);
  assert.deepEqual(builderCodes(result), ['BUILDER_FOREIGN_DEPENDENCY']);
});

test('flags builder members without a deliberate layer assignment', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson(
    'packages/builder/mystery/package.json',
    packageManifest('@craftkit/builder-mystery'),
  );

  const result = await validateWorkspace(fixture.repositoryRoot);
  assert.deepEqual(builderCodes(result), ['BUILDER_UNKNOWN_LAYER']);
});

test('contained engine (008 §3 e6): only the designated owner may declare tiptap/prosemirror', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson(
    'packages/builder/shell/package.json',
    packageManifest('@craftkit/builder-shell', {
      dependencies: { '@tiptap/react': '3.30.3' },
    }),
  );

  const result = await validateWorkspace(fixture.repositoryRoot);
  assert.deepEqual(builderCodes(result), ['BUILDER_CONTAINED_DEPENDENCY']);
  assert.equal(result.valid, false);
});

test('contained engine: the owner package declares it freely, non-builder members cannot', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson(
    'packages/builder/extensions/richtext/package.json',
    packageManifest('@craftkit/builder-richtext', {
      dependencies: { '@tiptap/react': '3.30.3', 'prosemirror-model': '1.25.11' },
    }),
  );
  await fixture.writeJson(
    'apps/web/package.json',
    appManifest('@craftkit/web', {
      dependencies: { 'prosemirror-view': '1.41.9' },
    }),
  );

  const result = await validateWorkspace(fixture.repositoryRoot);
  assert.deepEqual(builderCodes(result), ['BUILDER_CONTAINED_DEPENDENCY']);
  const offender = result.diagnostics.find(
    (diagnostic) => diagnostic.code === 'BUILDER_CONTAINED_DEPENDENCY',
  );
  assert.match(offender.ownerPath, /apps\/web/);
});

test('contained engine: the WORKSPACE ROOT manifest is checked too (it hoists to every package)', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson('package.json', {
    name: 'craftkit-root',
    private: true,
    devDependencies: { '@tiptap/react': '3.30.3' },
  });

  const result = await validateWorkspace(fixture.repositoryRoot);
  assert.deepEqual(builderCodes(result), ['BUILDER_CONTAINED_DEPENDENCY']);
  assert.equal(result.valid, false);
});

test('contained engine: an npm ALIAS cannot smuggle it past the name matcher', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson(
    'packages/builder/shell/package.json',
    packageManifest('@craftkit/builder-shell', {
      dependencies: { 'editor-engine': 'npm:@tiptap/react@3.30.3' },
    }),
  );

  const result = await validateWorkspace(fixture.repositoryRoot);
  assert.deepEqual(builderCodes(result), ['BUILDER_CONTAINED_DEPENDENCY']);
});

test('contained engine: peerDependencies and optionalDependencies are covered', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson(
    'apps/web/package.json',
    appManifest('@craftkit/web', {
      peerDependencies: { '@tiptap/core': '3.30.3' },
    }),
  );
  await fixture.writeJson(
    'packages/ui/package.json',
    packageManifest('@craftkit/ui', {
      optionalDependencies: { 'prosemirror-view': '1.41.9' },
    }),
  );

  const result = await validateWorkspace(fixture.repositoryRoot);
  assert.deepEqual(builderCodes(result), [
    'BUILDER_CONTAINED_DEPENDENCY',
    'BUILDER_CONTAINED_DEPENDENCY',
  ]);
});
