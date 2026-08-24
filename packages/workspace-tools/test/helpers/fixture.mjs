import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * @param {import('node:test').TestContext} testContext
 */
export async function createRepositoryFixture(testContext) {
  const repositoryRoot = await mkdtemp(path.join(tmpdir(), 'craftkit-workspace-tools-'));
  testContext.after(async () => {
    await rm(repositoryRoot, { recursive: true, force: true });
  });

  return {
    repositoryRoot,
    async writeJson(relativePath, value) {
      await writeText(relativePath, `${JSON.stringify(value, null, 2)}\n`);
    },
    async writeText(relativePath, value = '') {
      await writeText(relativePath, value);
    },
  };

  async function writeText(relativePath, value) {
    const absolutePath = path.join(repositoryRoot, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, value, 'utf8');
  }
}

export function packageManifest(name, overrides = {}) {
  return {
    name,
    version: '0.0.0',
    private: true,
    type: 'module',
    exports: {
      '.': './src/index.mjs',
    },
    ...overrides,
  };
}

export function appManifest(name, overrides = {}) {
  return {
    name,
    version: '0.0.0',
    private: true,
    type: 'module',
    ...overrides,
  };
}
