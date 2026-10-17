import type { BuilderDocument } from '@craftkit/builder';
import { describe, expect, it } from 'vitest';

import {
  insertMention,
  MENTION_PATTERN,
  mentionCandidatesFor,
  mentionedIds,
} from './AssistantPanel.mentions';

const document: BuilderDocument = {
  schemaVersion: 1,
  rootId: 'root',
  dir: 'rtl',
  surface: 'light',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { children: ['hero', 'prices'] } },
    hero: { id: 'hero', type: 'hero', props: { title: 'ابنِ موقعك في دقيقة' }, slots: {} },
    prices: { id: 'prices', type: 'pricing-table', props: { plans: 3 }, slots: {} },
  },
} as unknown as BuilderDocument;

describe('MENTION_PATTERN', () => {
  it('matches only a mention the text ENDS with', () => {
    expect(MENTION_PATTERN.exec('حسّن @he')?.[1]).toBe('he');
    expect(MENTION_PATTERN.exec('@')?.[1]).toBe('');
    expect(MENTION_PATTERN.exec('@hero ثم')).toBeNull();
  });
});

describe('mentionCandidatesFor', () => {
  it('offers nothing when no mention is open', () => {
    expect(mentionCandidatesFor(document, null)).toEqual([]);
  });

  it('offers every block on a bare @', () => {
    expect(mentionCandidatesFor(document, '').map((row) => row.id)).toEqual(['hero', 'prices']);
  });

  it('never offers the root — the page is always there, and naming it says nothing', () => {
    expect(mentionCandidatesFor(document, '').some((row) => row.id === 'root')).toBe(false);
  });

  it('matches on type as well as id, because a person may know it by either', () => {
    expect(mentionCandidatesFor(document, 'pricing').map((row) => row.id)).toEqual(['prices']);
  });

  it('is case-insensitive in both directions', () => {
    expect(mentionCandidatesFor(document, 'HER').map((row) => row.id)).toEqual(['hero']);
  });

  it('carries the first non-empty string prop, so a block is known by its words', () => {
    expect(mentionCandidatesFor(document, 'hero')[0]?.excerpt).toBe('ابنِ موقعك في دقيقة');
  });

  it('leaves the excerpt out when a block has no words', () => {
    expect(mentionCandidatesFor(document, 'prices')[0]?.excerpt).toBeUndefined();
  });

  it('shows at most eight — more is a list to read, not a choice', () => {
    const many = {
      ...document,
      nodes: Object.fromEntries(
        Array.from({ length: 20 }, (_unused, index) => [
          `card-${String(index)}`,
          { id: `card-${String(index)}`, type: 'card', props: {}, slots: {} },
        ]),
      ),
    } as unknown as BuilderDocument;
    expect(mentionCandidatesFor(many, 'card')).toHaveLength(8);
  });
});

describe('insertMention', () => {
  it('replaces the fragment being typed rather than appending after it', () => {
    expect(insertMention('حسّن @he', 'he', 'hero')).toBe('حسّن @hero ');
  });

  it('keeps whatever followed the fragment', () => {
    expect(insertMention('@he ثم أضف', 'he', 'hero')).toBe('@hero  ثم أضف');
  });

  it('replaces the LAST fragment, not an earlier finished mention', () => {
    expect(insertMention('@hero و @pr', 'pr', 'prices')).toBe('@hero و @prices ');
  });

  it('appends only when the fragment is gone — there is nothing left to replace', () => {
    expect(insertMention('حسّن', 'he', 'hero')).toBe('حسّن@hero ');
  });
});

describe('mentionedIds', () => {
  it('reads every mention in the order it was written', () => {
    expect(mentionedIds('حسّن @hero ثم @prices', document)).toEqual(['hero', 'prices']);
  });

  it('drops a mention no block answers to, so a typo cannot become the focus', () => {
    expect(mentionedIds('حسّن @her', document)).toEqual([]);
  });

  it('finds nothing in a request that names nothing', () => {
    expect(mentionedIds('أضف قسم أسعار', document)).toEqual([]);
  });
});
