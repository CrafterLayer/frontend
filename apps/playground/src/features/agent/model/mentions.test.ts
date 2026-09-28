import type { BuilderDocument } from '@craftkit/builder';
import { describe, expect, it } from 'vitest';

import {
  MENTION_PATTERN,
  consumeMentionFragment,
  mentionCandidatesFor,
  mentionQuery,
  mentionedIds,
} from './mentions';

/*
  An AI-built page: every section is a free-form region known by its `label` prop, the
  way `blockDisplayName` names it. Its ids are the engine's, never shown.
*/
const document = {
  schemaVersion: 1,
  rootId: 'root',
  dir: 'rtl',
  surface: 'site',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['n1', 'n2', 'n3'] } },
    n1: { id: 'n1', type: 'customCode', props: { label: 'البطل' }, slots: {} },
    n2: {
      id: 'n2',
      type: 'customCode',
      props: { label: 'الخدمات' },
      slots: { default: ['cta'] },
    },
    n3: { id: 'n3', type: 'customCode', props: { label: 'آراء العملاء' }, slots: {} },
    cta: { id: 'cta', type: 'button', props: { text: 'احجز الآن' }, slots: {} },
  },
} as unknown as BuilderDocument;

const NAMES: Readonly<Record<string, string>> = {
  n1: 'البطل',
  n2: 'الخدمات',
  n3: 'آراء العملاء',
  cta: 'Button',
};
const nameOf = (id: string): string => NAMES[id] ?? id;

describe('MENTION_PATTERN (SPEC §4.17: letters in any script)', () => {
  it('is the SPEC’s pattern with combining marks added (§4.17 amendment requested)', () => {
    expect(MENTION_PATTERN.source).toBe('@([\\p{L}\\p{M}\\p{N}_-]*)$');
    expect(MENTION_PATTERN.flags).toBe('u');
  });

  it('keeps the list open through tashkeel: a shadda is part of the word being typed', () => {
    // «حسّن» and «عمّان» carry a shadda (U+0651, category Mn); the panel's own starters
    // write «عمّان». Without \p{M} the fragment ended at the mark and the list closed.
    expect(MENTION_PATTERN.exec('نقل @الخدّ')?.[1]).toBe('الخدّ');
    expect(mentionQuery('طابق @حسّن')).toBe('حسّن');
    expect(mentionQuery('@مُقدِّمة')).toBe('مُقدِّمة');
  });

  it('matches an Arabic fragment, which the v1 ASCII class silently refused', () => {
    expect(MENTION_PATTERN.exec('نقل @الخد')?.[1]).toBe('الخد');
    expect(MENTION_PATTERN.exec('حسّن @آراء')?.[1]).toBe('آراء');
    expect(MENTION_PATTERN.exec('move @Serv')?.[1]).toBe('Serv');
  });

  it('matches only a mention the text ENDS with', () => {
    expect(MENTION_PATTERN.exec('@')?.[1]).toBe('');
    expect(MENTION_PATTERN.exec('@البطل ثم')).toBeNull();
  });
});

describe('mentionQuery', () => {
  it('reads the fragment being typed before the caret', () => {
    expect(mentionQuery('طابق الخدمات مع @الب')).toBe('الب');
    expect(mentionQuery('@')).toBe('');
  });

  it('is null when no mention is open', () => {
    expect(mentionQuery('أضف قسم أسعار')).toBeNull();
    expect(mentionQuery('@البطل ثم')).toBeNull();
  });

  it('does not open the list inside an email address', () => {
    expect(mentionQuery('send the form to info@clinic')).toBeNull();
    expect(mentionQuery('(@hero')).toBe('hero');
  });
});

describe('a mention after an Arabic proclitic (و ف ب ل ك)', () => {
  it('opens the list after a proclitic written attached, as Arabic writes it', () => {
    expect(mentionQuery('طابق الخدمات و@الب')).toBe('الب');
    expect(mentionQuery('ف@الأسعار')).toBe('الأسعار');
    expect(mentionQuery('نقل الصور ب@المعرض')).toBe('المعرض');
    expect(mentionQuery('زر ل@الحجز')).toBe('الحجز');
    expect(mentionQuery('عنوان ك@الترويسة')).toBe('الترويسة');
    // Tashkeel on the proclitic is still the proclitic.
    expect(mentionQuery('وَ@الفوتر')).toBe('الفوتر');
  });

  it('still refuses an @ inside a word, or after a letter that only ends one', () => {
    expect(mentionQuery('info@clinic')).toBeNull();
    // «كتاب» ends in «ب», which here is the word's own last letter, not a proclitic.
    expect(mentionQuery('كتاب@الب')).toBeNull();
    expect(mentionQuery('وو@الب')).toBeNull();
  });

  it('consumes the fragment and keeps the proclitic in the person’s words', () => {
    expect(consumeMentionFragment('طابق الخدمات و@الب')).toEqual({
      text: 'طابق الخدمات و',
      caret: 'طابق الخدمات و'.length,
    });
    expect(consumeMentionFragment('info@clinic').text).toBe('info@clinic');
  });
});

describe('mentionCandidatesFor with tashkeel in the fragment', () => {
  it('finds the block although the name on the page carries no mark', () => {
    expect(
      mentionCandidatesFor(document, mentionQuery('@الخدّ'), { nameOf }).map(({ id }) => id),
    ).toEqual(['n2']);
  });
});

describe('mentionCandidatesFor', () => {
  it('offers nothing when no mention is open', () => {
    expect(mentionCandidatesFor(document, null, { nameOf })).toEqual([]);
  });

  it('lists the page’s sections first, by human name, with their place on the page', () => {
    expect(mentionCandidatesFor(document, '', { nameOf })).toEqual([
      { id: 'n1', label: 'البطل', section: { position: 1, total: 3 } },
      { id: 'n2', label: 'الخدمات', section: { position: 2, total: 3 } },
      { id: 'n3', label: 'آراء العملاء', section: { position: 3, total: 3 } },
      { id: 'cta', label: 'Button' },
    ]);
  });

  it('never offers the root: the page is always there, and naming it says nothing', () => {
    expect(mentionCandidatesFor(document, '', { nameOf }).some(({ id }) => id === 'root')).toBe(
      false,
    );
  });

  it('matches Arabic by the name a person reads, not the id', () => {
    expect(mentionCandidatesFor(document, 'الخد', { nameOf }).map(({ id }) => id)).toEqual(['n2']);
    expect(mentionCandidatesFor(document, 'n2', { nameOf })).toEqual([]);
  });

  it('folds the alef a keyboard may or may not type: «اراء» finds «آراء العملاء»', () => {
    expect(mentionCandidatesFor(document, 'اراء', { nameOf }).map(({ id }) => id)).toEqual(['n3']);
  });

  it('ignores case and ranks a name that starts with the query, then a word, then any match', () => {
    const cards = {
      ...document,
      nodes: {
        root: { id: 'root', type: 'page', props: {}, slots: { default: ['a', 'b', 'c'] } },
        a: { id: 'a', type: 'text', props: {}, slots: {} },
        b: { id: 'b', type: 'text', props: {}, slots: {} },
        c: { id: 'c', type: 'text', props: {}, slots: {} },
      },
    } as unknown as BuilderDocument;
    const names: Readonly<Record<string, string>> = {
      a: 'Reprice notes',
      b: 'Our pricing',
      c: 'Pricing FAQ',
    };
    expect(
      mentionCandidatesFor(cards, 'PRIC', { nameOf: (id) => names[id] ?? id }).map(
        ({ label }) => label,
      ),
    ).toEqual(['Pricing FAQ', 'Our pricing', 'Reprice notes']);
  });

  it('leaves out what is already a chip', () => {
    expect(
      mentionCandidatesFor(document, '', { nameOf, exclude: ['n1', 'cta'] }).map(({ id }) => id),
    ).toEqual(['n2', 'n3']);
  });

  it('shows at most eight: more is a list to read, not a choice', () => {
    const many = {
      ...document,
      nodes: {
        root: {
          id: 'root',
          type: 'page',
          props: {},
          slots: { default: Array.from({ length: 20 }, (_unused, index) => `c${String(index)}`) },
        },
        ...Object.fromEntries(
          Array.from({ length: 20 }, (_unused, index) => [
            `c${String(index)}`,
            { id: `c${String(index)}`, type: 'card', props: {}, slots: {} },
          ]),
        ),
      },
    } as unknown as BuilderDocument;
    expect(mentionCandidatesFor(many, '', { nameOf: () => 'بطاقة' })).toHaveLength(8);
  });
});

describe('consumeMentionFragment (chips carry ids; the text keeps only words)', () => {
  it('removes the @fragment and leaves the caret where it was typed', () => {
    expect(consumeMentionFragment('طابق الخدمات مع @الب')).toEqual({
      text: 'طابق الخدمات مع ',
      caret: 'طابق الخدمات مع '.length,
    });
  });

  it('keeps what follows the caret untouched', () => {
    const draft = 'move @so then stop';
    const caret = 'move @so'.length;
    expect(consumeMentionFragment(draft, caret)).toEqual({
      text: 'move  then stop',
      caret: 'move '.length,
    });
  });

  it('empties a draft that was only the mention', () => {
    expect(consumeMentionFragment('@الخدمات')).toEqual({ text: '', caret: 0 });
  });

  it('changes nothing when no mention is open', () => {
    expect(consumeMentionFragment('أضف قسم أسعار')).toEqual({
      text: 'أضف قسم أسعار',
      caret: 'أضف قسم أسعار'.length,
    });
  });

  it('never writes an id into the text', () => {
    expect(consumeMentionFragment('حسّن @الب').text).not.toMatch(/n1|@/u);
  });

  it('consumes a fragment with tashkeel whole, not up to the mark', () => {
    expect(consumeMentionFragment('طابق مع @الخدّ')).toEqual({
      text: 'طابق مع ',
      caret: 'طابق مع '.length,
    });
  });

  it('leaves an email address alone, by the same word-start rule as mentionQuery', () => {
    const draft = 'send the form to info@clinic';
    expect(consumeMentionFragment(draft)).toEqual({ text: draft, caret: draft.length });
    expect(consumeMentionFragment('(@hero')).toEqual({ text: '(', caret: 1 });
  });
});

describe('mentionedIds (legacy @id text, e.g. a reused v1 request)', () => {
  it('reads every mention in the order it was written', () => {
    expect(mentionedIds('حسّن @n1 ثم @cta', document)).toEqual(['n1', 'cta']);
  });

  it('drops a mention no block answers to, so a typo cannot become the focus', () => {
    expect(mentionedIds('حسّن @n9 و@البطل', document)).toEqual([]);
  });

  it('finds nothing in a request that names nothing', () => {
    expect(mentionedIds('أضف قسم أسعار', document)).toEqual([]);
  });
});
