import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { compareScreenshots, judgeComparison, resolveBaseline, writeDiffImage } from './index';
import { BLACK, pngField, WHITE } from './test-images';

/**
 * These exercise the module only through its public surface, in the order the module docs tell a
 * caller to use it, so that a re-export that stops matching the implementation is caught here
 * rather than by whoever wires the first real screenshot pipeline.
 */
describe('visual verification, end to end', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'craftkit-visual-e2e-'));
  });

  afterEach(async () => {
    await rm(directory, { force: true, recursive: true });
  });

  const page = { width: 100, height: 100, colour: WHITE } as const;
  const hero = { x: 0, y: 0, width: 100, height: 50 } as const;

  it('catches an agent that reported a change it never made', async () => {
    const before = pngField(page);
    await resolveBaseline({ directory, name: 'home', candidate: before });

    const resolved = await resolveBaseline({ directory, name: 'home', candidate: before });
    expect(resolved.comparable).toBe(true);

    const verdict = judgeComparison(compareScreenshots(resolved.baseline, before), {
      expectedRegions: [hero],
    });

    expect(verdict.kind).toBe('identical');
    expect(verdict.passed).toBe(false);
  });

  it('catches a change that broke a section nobody was editing, and writes the diff', async () => {
    const before = pngField(page);
    await resolveBaseline({ directory, name: 'home', candidate: before });
    const after = pngField({
      ...page,
      squares: [
        { x: 10, y: 10, size: 10, colour: BLACK },
        { x: 10, y: 70, size: 10, colour: BLACK },
      ],
    });

    const resolved = await resolveBaseline({ directory, name: 'home', candidate: after });
    const comparison = compareScreenshots(resolved.baseline, after, { produceDiffImage: true });
    const verdict = judgeComparison(comparison, { expectedRegions: [hero] });

    expect(verdict.kind).toBe('changed-too-much');
    expect(verdict.changedInsideExpected).toBe(100);
    expect(verdict.changedOutsideExpected).toBe(100);

    const diffPath = await writeDiffImage(directory, 'home', comparison.diff!);
    await expect(readFile(diffPath)).resolves.toEqual(comparison.diff);
  });

  it('accepts a change confined to the section that was edited', async () => {
    const before = pngField(page);
    await resolveBaseline({ directory, name: 'home', candidate: before });
    const after = pngField({ ...page, squares: [{ x: 10, y: 10, size: 10, colour: BLACK }] });

    const resolved = await resolveBaseline({ directory, name: 'home', candidate: after });
    const verdict = judgeComparison(compareScreenshots(resolved.baseline, after), {
      expectedRegions: [hero],
    });

    expect(verdict.kind).toBe('changed-as-expected');
    expect(verdict.passed).toBe(true);
  });
});
