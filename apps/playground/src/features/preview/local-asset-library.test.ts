import { describe, expect, it } from 'vitest';

import { selectAssets } from '@craftkit/builder';

import { LOCAL_ASSETS, createLocalAssetLibrary } from './local-asset-library';

describe('the playground asset library', () => {
  it('describes every picture truthfully enough to choose between them (FR-044)', () => {
    for (const entry of LOCAL_ASSETS) {
      expect(entry.description.length, entry.id).toBeGreaterThan(20);
      expect(entry.alt.length, entry.id).toBeGreaterThan(20);
      expect(entry.mood.length, entry.id).toBeGreaterThan(0);
      expect(entry.palette.length, entry.id).toBeGreaterThan(0);
      /* Selection scores palettes by string equality, so the case must be one. */
      for (const colour of entry.palette) expect(colour, entry.id).toMatch(/^#[0-9a-f]{6}$/u);
    }
  });

  it('gives every picture a distinct identity', () => {
    const ids = LOCAL_ASSETS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('carries its pictures with it, depending on no other host', () => {
    /*
      Every URL is a data URI. A remote address would make every generated site
      depend on a third party staying up, and would put a licence this
      repository has not checked in front of someone's visitors.
    */
    for (const entry of LOCAL_ASSETS) {
      expect(entry.url.startsWith('data:image/svg+xml,'), entry.id).toBe(true);
    }
  });

  it('answers selection well enough to fill a real brief', async () => {
    const result = await selectAssets({
      brief: 'a law office in Amman handling company registration',
      positions: [{ id: 'hero', intent: 'a formal ground for the opening claim' }],
      library: createLocalAssetLibrary(),
    });

    /*
      Not asserting WHICH picture: that is scoring, and pinning it here would
      make this test fail every time a mood word is improved. What matters is
      that a real brief resolves to a real picture rather than an absence.
    */
    expect(result.choices[0]?.image).toHaveProperty('assetId');
    expect(result.used).toHaveLength(1);
  });

  it('honours an abort, because the next implementation will be a network call', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(createLocalAssetLibrary().list({ signal: controller.signal })).rejects.toThrow(
      /aborted/iu,
    );
  });

  it('can be empty, which the pipeline must survive (FR-051)', async () => {
    const result = await selectAssets({
      brief: 'anything',
      positions: [{ id: 'hero', intent: 'a ground' }],
      library: createLocalAssetLibrary({ entries: [] }),
    });

    expect(result.choices[0]?.image).toMatchObject({ absent: true });
  });
});
