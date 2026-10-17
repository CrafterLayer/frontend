// @vitest-environment node
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { createArtifactArchive } from './artifact-archive';

describe('standalone export archive', () => {
  it('unpacks with a standard ZIP tool preserving routes, assets, and Unicode source', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'craftkit-export-'));
    try {
      const files = [
        { path: 'index.html', content: '<h1>أهلاً</h1>' },
        { path: 'about/index.html', content: '<script src="../assets/page.js"></script>' },
        { path: 'assets/page.js', content: 'document.title = "CraftKit";' },
      ];
      const zip = join(directory, 'site.zip');
      await writeFile(zip, createArtifactArchive(files));
      await promisify(execFile)('unzip', ['-qq', zip, '-d', join(directory, 'site')]);
      for (const file of files)
        expect(await readFile(join(directory, 'site', file.path), 'utf8')).toBe(file.content);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('refuses traversal and duplicate names', () => {
    expect(() => createArtifactArchive([{ path: '../outside', content: '' }])).toThrow('unsafe');
    expect(() =>
      createArtifactArchive([
        { path: 'index.html', content: '' },
        { path: 'index.html', content: '' },
      ]),
    ).toThrow('duplicate');
  });
});
