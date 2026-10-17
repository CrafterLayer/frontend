import assert from 'node:assert/strict';
import test from 'node:test';

import {
  countLines,
  fileSizeKind,
  FILE_SIZE_BASELINE_PATH,
  FILE_SIZE_LIMITS,
  validateFileSizes,
} from '../src/files/validate-file-sizes.mjs';
import { createRepositoryFixture, packageManifest } from './helpers/fixture.mjs';

const lines = (count) => 'x\n'.repeat(count);

function codes(result) {
  return result.diagnostics.map((diagnostic) => `${diagnostic.code} ${diagnostic.ownerPath}`);
}

async function fixtureWithPackage(t) {
  const fixture = await createRepositoryFixture(t);
  await fixture.writeJson('packages/demo/package.json', packageManifest('@craftkit/demo'));
  return fixture;
}

test('counts lines the way wc does, with or without a final newline', () => {
  assert.equal(countLines(''), 0);
  assert.equal(countLines('a\nb\n'), 2);
  assert.equal(countLines('a\nb'), 2);
});

test('holds tests and stories to the test limit, everything else to the source limit', () => {
  assert.equal(fileSizeKind('packages/demo/src/Thing.tsx'), 'source');
  assert.equal(fileSizeKind('packages/demo/src/Thing.test.tsx'), 'test');
  assert.equal(fileSizeKind('packages/demo/src/Thing.stories.tsx'), 'test');
  assert.equal(fileSizeKind('apps/evals/src/x/engines.browser.test.ts'), 'test');
  assert.equal(fileSizeKind('packages/demo/test/helpers/fixture.mjs'), 'test');
});

test('rejects a new file over its limit and accepts one at the limit', async (t) => {
  const fixture = await fixtureWithPackage(t);
  await fixture.writeText('packages/demo/src/ok.ts', lines(FILE_SIZE_LIMITS.source));
  await fixture.writeText('packages/demo/src/big.ts', lines(FILE_SIZE_LIMITS.source + 1));
  await fixture.writeText('packages/demo/src/big.test.ts', lines(FILE_SIZE_LIMITS.source + 1));
  const result = await validateFileSizes(fixture.repositoryRoot);
  assert.equal(result.valid, false);
  assert.deepEqual(codes(result), ['FILE_TOO_LARGE packages/demo/src/big.ts']);
});

test('lets a baselined file shrink but never grow, and reports stale entries', async (t) => {
  const fixture = await fixtureWithPackage(t);
  await fixture.writeText('packages/demo/src/legacy.ts', lines(700));
  await fixture.writeText('packages/demo/src/grown.ts', lines(650));
  await fixture.writeText('packages/demo/src/fixed.ts', lines(120));
  await fixture.writeJson(FILE_SIZE_BASELINE_PATH, {
    files: {
      'packages/demo/src/legacy.ts': 800,
      'packages/demo/src/grown.ts': 600,
      'packages/demo/src/fixed.ts': 900,
      'packages/demo/src/gone.ts': 900,
    },
  });
  const result = await validateFileSizes(fixture.repositoryRoot);
  assert.deepEqual(codes(result), [
    'FILE_BASELINE_STALE packages/demo/src/fixed.ts',
    'FILE_BASELINE_STALE packages/demo/src/gone.ts',
    'FILE_GREW_PAST_BASELINE packages/demo/src/grown.ts',
  ]);
  assert.deepEqual(
    result.shrunk.map((file) => file.path),
    ['packages/demo/src/legacy.ts'],
  );
});

test('skips generated, vendored and data-only files', async (t) => {
  const fixture = await fixtureWithPackage(t);
  const huge = lines(FILE_SIZE_LIMITS.test + 50);
  await fixture.writeText('packages/demo/src/generated/out.ts', huge);
  await fixture.writeText('packages/demo/vendor/lib.ts', huge);
  await fixture.writeText('packages/demo/src/vendor/lib.ts', huge);
  await fixture.writeText('packages/demo/src/photos.data.ts', huge);
  await fixture.writeText('packages/demo/src/tabler-icon-names.ts', huge);
  await fixture.writeText('packages/demo/src/engine-source.ts', huge);
  await fixture.writeText('packages/demo/src/types.d.ts', huge);
  const result = await validateFileSizes(fixture.repositoryRoot);
  assert.equal(result.valid, true);
  assert.equal(result.measured.length, 0);
});
