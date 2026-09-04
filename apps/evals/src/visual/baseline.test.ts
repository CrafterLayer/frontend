import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  baselinePath,
  diffImagePath,
  InvalidBaselineNameError,
  readBaseline,
  resolveBaseline,
  writeDiffImage,
} from './baseline';
import { BLACK, pngField, WHITE } from './test-images';

const FIRST = pngField({ width: 8, height: 8, colour: WHITE });
const SECOND = pngField({
  width: 8,
  height: 8,
  colour: WHITE,
  squares: [{ x: 2, y: 2, size: 2, colour: BLACK }],
});

describe('baseline store', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'craftkit-visual-baseline-'));
  });

  afterEach(async () => {
    await rm(directory, { force: true, recursive: true });
  });

  it('records the first screenshot as the baseline and says nothing was verified', async () => {
    const resolved = await resolveBaseline({ directory, name: 'home-hero', candidate: FIRST });

    expect(resolved.status).toBe('created');
    expect(resolved.path).toBe(join(directory, 'home-hero.png'));
    expect(resolved.comparable).toBe(false);
    expect(resolved.message).toContain('Nothing was verified');
    await expect(readFile(resolved.path)).resolves.toEqual(FIRST);
  });

  it('reuses the recorded baseline on the next run rather than the new screenshot', async () => {
    await resolveBaseline({ directory, name: 'home-hero', candidate: FIRST });

    const resolved = await resolveBaseline({ directory, name: 'home-hero', candidate: SECOND });

    expect(resolved.status).toBe('reused');
    expect(resolved.comparable).toBe(true);
    // The point of a baseline is that it is the OLD image. Returning the candidate here would make
    // every comparison trivially identical and every regression invisible.
    expect(resolved.baseline).toEqual(FIRST);
    expect(resolved.baseline).not.toEqual(SECOND);
  });

  it('overwrites the baseline in update mode and refuses to call that a comparison', async () => {
    await resolveBaseline({ directory, name: 'home-hero', candidate: FIRST });

    const resolved = await resolveBaseline({
      directory,
      name: 'home-hero',
      candidate: SECOND,
      update: true,
    });

    expect(resolved.status).toBe('updated');
    expect(resolved.comparable).toBe(false);
    expect(resolved.baseline).toEqual(SECOND);
    await expect(readFile(resolved.path)).resolves.toEqual(SECOND);
  });

  it('reports a missing baseline as null rather than throwing', async () => {
    await expect(readBaseline(directory, 'never-captured')).resolves.toBeNull();
  });

  it('writes a diff image next to the baseline it came from', async () => {
    const path = await writeDiffImage(directory, 'home-hero', SECOND);

    expect(path).toBe(join(directory, 'home-hero.diff.png'));
    await expect(readFile(path)).resolves.toEqual(SECOND);
  });

  it('creates the baseline directory when it does not exist yet', async () => {
    const nested = join(directory, 'shots', 'desktop');

    const resolved = await resolveBaseline({ directory: nested, name: 'home', candidate: FIRST });

    await expect(readFile(resolved.path)).resolves.toEqual(FIRST);
  });

  it.each([
    ['../escape', 'a parent-directory traversal'],
    ['shots/home', 'a path separator'],
    ['Home', 'an uppercase letter that collides case-insensitively'],
    ['', 'an empty name'],
  ])('refuses %s (%s)', async (name) => {
    expect(() => baselinePath('/tmp/anywhere', name)).toThrow(InvalidBaselineNameError);
    expect(() => diffImagePath('/tmp/anywhere', name)).toThrow(InvalidBaselineNameError);
    await expect(resolveBaseline({ directory, name, candidate: FIRST })).rejects.toBeInstanceOf(
      InvalidBaselineNameError,
    );
  });
});
