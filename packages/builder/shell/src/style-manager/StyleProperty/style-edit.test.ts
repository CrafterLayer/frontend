import { describe, expect, it } from 'vitest';

import { applyStyleIntents } from '@craftkit/builder-schema';

import { intentsAt, withDisplayCleanup, type StyleEdit } from './style-edit';

const keyword = (word: string) => ({ kind: 'keyword' as const, keyword: word });
const everywhere = () => false;

describe('withDisplayCleanup', () => {
  it('drops flex-only classes in the same write when Display leaves flex', () => {
    const edits = withDisplayCleanup([{ property: 'display', value: keyword('grid') }]);
    const result = applyStyleIntents(
      'flex flex-col flex-wrap gap-4 p-6',
      intentsAt(edits, 'base', 'default', everywhere),
      { mode: 'free' },
    );
    expect(result.ok && result.className).toBe('grid gap-4 p-6');
  });

  it('keeps direction for flex, hidden and contents, and never overrides an explicit edit', () => {
    for (const word of ['flex', 'inline-flex', 'none', 'contents']) {
      const edits: StyleEdit[] = [{ property: 'display', value: keyword(word) }];
      expect(withDisplayCleanup(edits)).toBe(edits);
    }
    const explicit = withDisplayCleanup([
      { property: 'display', value: keyword('block') },
      { property: 'flexDirection', value: keyword('row') },
    ]);
    expect(explicit.map(({ property }) => property)).toEqual(['display', 'flexDirection', 'flexWrap']);
  });
});
