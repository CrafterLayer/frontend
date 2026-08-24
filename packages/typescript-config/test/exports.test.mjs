import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

for (const configName of ['base', 'node', 'react-library', 'storybook']) {
  test(`${configName}.json is valid and exported`, async () => {
    const manifest = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'));
    const config = JSON.parse(
      await readFile(resolve(packageRoot, `${configName}.json`), 'utf8'),
    );

    assert.equal(manifest.exports[`./${configName}.json`], `./${configName}.json`);
    assert.equal(typeof config.compilerOptions, 'object');
  });
}
