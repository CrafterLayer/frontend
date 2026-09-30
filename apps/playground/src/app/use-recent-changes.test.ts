import { describe, expect, it } from 'vitest';

import { recentChangesOf } from './use-recent-changes';

const LOG = [
  { id: 't1', author: 'user', command: 'setProp' },
  { id: 't2', author: 'ai', command: 'insertNode' },
  { id: 't3', author: 'ai', command: 'insertNode' },
] as const;

describe('recentChangesOf', () => {
  it('lists the newest first, at most the limit', () => {
    expect(recentChangesOf(LOG, { limit: 2 })).toEqual({
      changes: [
        { id: 't3', door: 'assistant', label: 'add block' },
        { id: 't2', door: 'assistant', label: 'add block' },
      ],
      spokenElsewhere: false,
    });
  });

  it('says when an excluded door hid changes, so the strip never reads "No recent changes"', () => {
    const aiOnly = LOG.slice(1);
    expect(recentChangesOf(aiOnly, { exclude: 'assistant' })).toEqual({
      changes: [],
      spokenElsewhere: true,
    });
    expect(recentChangesOf(LOG, { exclude: 'assistant' }).changes).toEqual([
      { id: 't1', door: 'canvas', label: 'edit property' },
    ]);
    // An empty log hid nothing: "No recent changes" is then the truth.
    expect(recentChangesOf([], { exclude: 'assistant' }).spokenElsewhere).toBe(false);
  });
});
