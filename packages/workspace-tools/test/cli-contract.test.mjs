import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createRepositoryFixture, packageManifest } from './helpers/fixture.mjs';

const execFileAsync = promisify(execFile);
const workspaceCli = fileURLToPath(new URL('../src/cli/check-workspace.mjs', import.meta.url));
const componentCli = fileURLToPath(new URL('../src/cli/check-components.mjs', import.meta.url));

test('workspace CLI reports success to stdout and leaves the fixture unchanged', async (t) => {
  const fixture = await createRepositoryFixture(t);
  const relativeManifestPath = 'packages/valid/package.json';
  const manifest = packageManifest('@fixture/valid');
  await fixture.writeJson(relativeManifestPath, manifest);

  const result = await execFileAsync(process.execPath, [workspaceCli, fixture.repositoryRoot]);
  assert.match(result.stdout, /Workspace contract passed for 1 member\(s\)\./);
  assert.equal(result.stderr, '');

  const afterValidation = await import('node:fs/promises').then(({ readFile }) =>
    readFile(`${fixture.repositoryRoot}/${relativeManifestPath}`, 'utf8'),
  );
  assert.equal(afterValidation, `${JSON.stringify(manifest, null, 2)}\n`);
});

test('workspace CLI reports actionable failures to stderr and exits non-zero', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson(
    'packages/invalid/package.json',
    packageManifest('@fixture/invalid', {
      dependencies: { '@fixture/missing': 'workspace:*' },
    }),
  );

  await assert.rejects(
    execFileAsync(process.execPath, [workspaceCli, fixture.repositoryRoot]),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /\[MISSING_WORKSPACE_TARGET\] packages\/invalid\/package\.json/);
      assert.match(error.stderr, /@fixture\/missing/);
      return true;
    },
  );
});

test('component CLI prints each missing artifact and exits non-zero', async (t) => {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson('packages/ui/package.json', packageManifest('@fixture/ui'));
  await fixture.writeText(
    'packages/ui/src/components/Incomplete/Incomplete.tsx',
    'export function Incomplete() { return null; }\n',
  );

  await assert.rejects(
    execFileAsync(process.execPath, [componentCli, fixture.repositoryRoot]),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /\[MISSING_COMPONENT_ARTIFACT\]/);
      assert.match(error.stderr, /Incomplete\.stories\.tsx/);
      assert.match(error.stderr, /Incomplete\.docs\.mdx/);
      assert.match(error.stderr, /Incomplete\.test\.tsx/);
      assert.match(error.stderr, /index\.ts/);
      assert.match(error.stderr, /failed with 4 missing artifact\(s\)/);
      return true;
    },
  );
});
