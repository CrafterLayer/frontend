import { describe, expect, it } from 'vitest';

import { recentChangesOf } from './use-recent-changes';

const LOG = [
  { id: 't1', author: 'user', command: 'setProp' },
  { id: 't2', author: 'ai', command: 'insertNode' },
  { id: 't3', author: 'ai', command: 'insertNode' },
] as const;

describe('recentChangesOf', () => {
  it('lists the newest first, at most the limit, one row per run of the same change', () => {
    expect(recentChangesOf(LOG, { limit: 2 })).toEqual({
      changes: [
        { id: 't3', door: 'assistant', label: 'Add block' },
        { id: 't1', door: 'canvas', label: 'Edit property' },
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
      { id: 't1', door: 'canvas', label: 'Edit property' },
    ]);
    // An empty log hid nothing: "No recent changes" is then the truth.
    expect(recentChangesOf([], { exclude: 'assistant' }).spokenElsewhere).toBe(false);
  });

  it('phrases site and element commands, and reads an unphrased command name as words', () => {
    const log = [
      { id: 'a', author: 'user', command: 'setSiteDirection' },
      { id: 'b', author: 'user', command: 'patchTreeNode' },
      { id: 'c', author: 'user', command: 'setFooBar' },
      { id: 'd', author: 'user', command: 'Padding · Hero heading' },
    ];
    expect(recentChangesOf(log, { limit: 4 }).changes.map((change) => change.label)).toEqual([
      'Padding · Hero heading',
      'Set foo bar',
      'Edit element',
      'Page direction',
    ]);
  });
});
