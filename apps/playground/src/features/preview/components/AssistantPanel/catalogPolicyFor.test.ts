import { describe, expect, it } from 'vitest';

import { catalogPolicyFor } from './catalogPolicyFor';

/**
 * The one decision point between "what the provider needs" and "what the run
 * sends". Small, and worth pinning: the first version of it inferred the
 * provider kind and broke every Storybook provider that wraps the offline one.
 */
describe('catalogPolicyFor', () => {
  it('gives an offline provider the full catalog and room to hold it', () => {
    expect(catalogPolicyFor('offline', [])).toEqual({
      composition: { catalogMode: 'full' },
      policy: { maxContextTokens: 256_000 },
    });
  });

  it('gives a remote provider NO catalog — the model builds, it does not browse', () => {
    expect(catalogPolicyFor('remote', [])).toEqual({
      composition: { catalogMode: 'none' },
    });
  });

  it('keeps no catalog with a selection too; the selection itself brings its blocks', () => {
    // generate-plan derives `scopedBlockTypes` from the selection under `none`,
    // so the selected block arrives in full without anything else coming along.
    expect(catalogPolicyFor('remote', ['hero-1'])).toEqual({
      composition: { catalogMode: 'none' },
    });
  });

  it('lets the host policy win over its own budget', () => {
    // The context-budget story sets maxContextTokens: 1 and expects the
    // failure; a helper that silently raised it would make that story lie.
    expect(catalogPolicyFor('offline', [], { maxContextTokens: 1 })).toEqual({
      composition: { catalogMode: 'full' },
      policy: { maxContextTokens: 1 },
    });
  });

  it('carries unrelated host policy through on the remote path', () => {
    expect(catalogPolicyFor('remote', [], { maxCommands: 3 })).toEqual({
      composition: { catalogMode: 'none' },
      policy: { maxCommands: 3 },
    });
  });

  it('does not conjure an empty policy object', () => {
    expect(catalogPolicyFor('remote', [])).not.toHaveProperty('policy');
  });
});
