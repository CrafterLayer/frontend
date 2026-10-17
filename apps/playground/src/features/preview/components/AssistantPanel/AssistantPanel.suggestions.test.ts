import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { defineBlockSchema, type BlockSchema } from '@craftkit/builder';

import {
  catalogSuggestions,
  followUpSuggestions,
  localeOf,
  panelSuggestions,
  selectionSuggestions,
  salvageSuggestions,
} from './AssistantPanel.suggestions';

function block(
  type: string,
  prompts: readonly string[],
  extra: { inlineEditable?: string; slots?: Record<string, { allow: string[] }> } = {},
): { schema: BlockSchema } {
  return {
    schema: defineBlockSchema({
      type,
      description: `A ${type}.`,
      props: z.object({ heading: z.string().default('') }),
      ...(extra.inlineEditable === undefined ? {} : { inlineEditable: extra.inlineEditable }),
      ...(extra.slots === undefined ? {} : { slots: extra.slots }),
      examples: prompts.map((prompt) => ({ prompt, node: { type, props: {} } })),
    }),
  };
}

const CATALOG = [
  block('testimonials', ['one strong developer testimonial', 'شهادتا عميلين لمتجر']),
  block('hero', ['a premium hero for a SaaS company', 'قسم افتتاحي عربي لعيادة أسنان']),
  block('faq', ['a short FAQ about billing', 'أسئلة شائعة عن الشحن']),
];

describe('localeOf', () => {
  it('reads the script, not a language list', () => {
    expect(localeOf('قسم تواصل عربي')).toBe('ar');
    expect(localeOf('a contact section')).toBe('en');
    // Mixed: any Arabic at all means the sentence is Arabic to a reader.
    expect(localeOf('قسم CTA')).toBe('ar');
  });

  it('answers ar for the whole Arabic SCRIPT, and says where the limit is', () => {
    /*
      Persian and Urdu are written in this script, and for a reader of either an
      Arabic suggestion is closer to right than an English one — and the
      direction is certainly right. Hebrew is RTL in a different script and
      answers 'en': the honest limit of a two-locale panel, asserted so it is a
      known boundary rather than a surprise.
    */
    expect(localeOf('صفحهٔ نخست')).toBe('ar');
    expect(localeOf('ہوم پیج')).toBe('ar');
    expect(localeOf('דף הבית')).toBe('en');
  });
});

describe('catalogSuggestions', () => {
  it("offers the catalog's own example prompts, in the asked-for language", () => {
    /*
      Derived, not a second list. `BlockSchema.examples[].prompt` is already a
      sentence a person would say — that is what an example IS — so a new block
      arrives with its suggestions written, in both languages, by whoever knew
      the block.
    */
    const arabic = catalogSuggestions(CATALOG, { locale: 'ar' });

    expect(arabic).not.toHaveLength(0);
    expect(arabic.every(({ text }) => localeOf(text) === 'ar')).toBe(true);
    expect(arabic.map(({ text }) => text)).toContain('قسم افتتاحي عربي لعيادة أسنان');
    expect(arabic.every(({ kind }) => kind === 'example')).toBe(true);
  });

  it('offers English ones for an English panel, and never mixes the two', () => {
    const english = catalogSuggestions(CATALOG, { locale: 'en' });

    expect(english.every(({ text }) => localeOf(text) === 'en')).toBe(true);
    expect(english.map(({ text }) => text)).toContain('a short FAQ about billing');
  });

  it('orders by block type, so registration order cannot change what is offered', () => {
    const forward = catalogSuggestions(CATALOG, { locale: 'en', limit: 3 });
    const reversed = catalogSuggestions([...CATALOG].reverse(), { locale: 'en', limit: 3 });

    expect(reversed.map(({ text }) => text)).toEqual(forward.map(({ text }) => text));
  });

  it('rotates deterministically rather than randomly', () => {
    const first = catalogSuggestions(CATALOG, { locale: 'en', limit: 2, offset: 0 });
    const second = catalogSuggestions(CATALOG, { locale: 'en', limit: 2, offset: 1 });

    expect(second.map(({ text }) => text)).not.toEqual(first.map(({ text }) => text));
    // Same offset, same answer — a person who reopens the panel is not shown a
    // different four for no reason, and a story can pin one.
    expect(catalogSuggestions(CATALOG, { locale: 'en', limit: 2, offset: 1 })).toEqual(second);
  });

  it('wraps a large offset instead of running out', () => {
    const wrapped = catalogSuggestions(CATALOG, { locale: 'en', limit: 2, offset: 97 });
    expect(wrapped).toHaveLength(2);
  });

  it('falls back to the other language rather than showing nothing', () => {
    /*
      A catalog with only English examples — a host's own blocks, an extension
      written by one person — must not leave an Arabic panel with an empty
      strip, which is the exact failure this module exists to end. The reader is
      bilingual by construction; an English example they can adapt beats a
      blinking cursor.
    */
    const englishOnly = [block('x', ['only english here'])];

    expect(catalogSuggestions(englishOnly, { locale: 'ar' }).map(({ text }) => text)).toEqual([
      'only english here',
    ]);
  });

  it('still prefers the asked-for language whenever the catalog has any', () => {
    const mixed = [block('x', ['english one']), block('y', ['عربي واحد'])];

    expect(catalogSuggestions(mixed, { locale: 'ar' }).map(({ text }) => text)).toEqual([
      'عربي واحد',
    ]);
  });

  it('returns nothing only when the catalog has no examples at all', () => {
    expect(catalogSuggestions([block('x', [])], { locale: 'ar' })).toEqual([]);
  });
});

describe('selectionSuggestions', () => {
  const hero = block('hero', ['a premium hero for a SaaS company', 'قسم افتتاحي عربي'], {
    inlineEditable: 'heading',
    slots: { actions: { allow: ['button'] } },
  }).schema;

  it('reads what can be done from the block’s OWN schema', () => {
    const english = selectionSuggestions(hero, 'en');
    const text = english.map(({ text }) => text);

    // Inline-editable → rewriting its text is a real next request.
    expect(text.some((entry) => entry.includes('rewrite the hero text'))).toBe(true);
    // A declared slot names what may go inside it.
    expect(text.some((entry) => entry.includes('add a button inside the hero'))).toBe(true);
    expect(english.every(({ kind }) => kind === 'selection')).toBe(true);
  });

  it('speaks Arabic for an Arabic panel', () => {
    const arabic = selectionSuggestions(hero, 'ar');
    expect(arabic.every(({ text }) => localeOf(text) === 'ar')).toBe(true);
  });

  it('offers nothing when nothing is selected', () => {
    expect(selectionSuggestions(undefined, 'en')).toEqual([]);
  });

  it('offers nothing a block does not declare', () => {
    // No inlineEditable, no slots: only the example-derived suggestion survives.
    const plain = block('divider', ['a thin divider']).schema;
    const out = selectionSuggestions(plain, 'en');

    expect(out.every(({ text }) => !text.includes('rewrite'))).toBe(true);
    expect(out.every(({ text }) => !text.includes('inside'))).toBe(true);
  });
});

describe('followUpSuggestions', () => {
  it('takes the model’s own follow-ups, trimmed and deduplicated', () => {
    expect(
      followUpSuggestions(['  add pricing  ', 'add pricing', 'add a FAQ', '   ']).map(
        ({ text }) => text,
      ),
    ).toEqual(['add pricing', 'add a FAQ']);
  });

  it('accepts a single string, because a provider may send one', () => {
    expect(followUpSuggestions('add pricing').map(({ text }) => text)).toEqual(['add pricing']);
  });

  it('is empty when the provider gave none — which is why the other kinds exist', () => {
    expect(followUpSuggestions(undefined)).toEqual([]);
  });
});

describe('panelSuggestions — what the strip actually shows', () => {
  const hero = block('hero', ['a premium hero for a SaaS company'], {
    inlineEditable: 'heading',
  }).schema;

  it('is NEVER empty, even with no server and nothing selected', () => {
    /*
      The whole point. The panel used to show four hardcoded English sentences
      that appeared only before the first message and never came back, so a
      person who wrote one thing and paused was left with an empty box.
    */
    const shown = panelSuggestions({
      blocks: CATALOG,
      selected: undefined,
      followUp: undefined,
      locale: 'ar',
    });

    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every(({ kind }) => kind === 'example')).toBe(true);
  });

  it('puts the model’s follow-ups first — they are about this conversation', () => {
    const shown = panelSuggestions({
      blocks: CATALOG,
      selected: hero,
      followUp: ['now add pricing'],
      locale: 'en',
      limit: 4,
    });

    expect(shown[0]).toMatchObject({ kind: 'followUp', text: 'now add pricing' });
    // And the rest still fills up, so a single follow-up is not the whole strip.
    expect(shown).toHaveLength(4);
  });

  it('puts the selection before the catalog, and fills the rest from it', () => {
    const shown = panelSuggestions({
      blocks: CATALOG,
      selected: hero,
      followUp: undefined,
      locale: 'en',
      limit: 4,
    });

    expect(shown[0]?.kind).toBe('selection');
    expect(shown.some(({ kind }) => kind === 'example')).toBe(true);
  });

  it('treats a spelling difference as the same suggestion', () => {
    /*
      Four slots on a rail. Two chips reading "Add a hero" and "add  a hero" are
      one suggestion to a person, and showing both spends a slot saying nothing
      new. The ORIGINAL spelling is what is displayed and sent — only the
      comparison is normalised.
    */
    const shown = panelSuggestions({
      blocks: [block('hero', ['add a hero'])],
      selected: undefined,
      followUp: ['Add  a  hero'],
      locale: 'en',
      limit: 4,
    });

    expect(shown).toHaveLength(1);
    expect(shown[0]?.text).toBe('Add  a  hero');
  });

  it('never shows the same sentence twice', () => {
    const shown = panelSuggestions({
      blocks: CATALOG,
      selected: hero,
      // Deliberately the same sentence the catalog would offer.
      followUp: ['a premium hero for a SaaS company'],
      locale: 'en',
      limit: 4,
    });

    expect(new Set(shown.map(({ text }) => text)).size).toBe(shown.length);
  });

  it('keys are stable for the same text, so React does not churn the strip', () => {
    const input = {
      blocks: CATALOG,
      selected: hero,
      followUp: ['now add pricing'],
      locale: 'en' as const,
    };
    expect(panelSuggestions(input).map(({ id }) => id)).toEqual(
      panelSuggestions(input).map(({ id }) => id),
    );
  });
});

describe('salvageSuggestions', () => {
  it('offers nothing when nothing was dropped', () => {
    expect(salvageSuggestions(undefined, 'ar')).toEqual([]);
    expect(salvageSuggestions([], 'ar')).toEqual([]);
  });

  it('names the commands that did not apply', () => {
    const [only] = salvageSuggestions([{ command: 'insertNode' }], 'en');
    expect(only?.kind).toBe('salvage');
    expect(only?.text).toBe('retry only what did not apply: insertNode');
  });

  it('names each command once — four lost setProps are one kind of loss', () => {
    const [only] = salvageSuggestions(
      [{ command: 'setProp' }, { command: 'setProp' }, { command: 'setProp' }],
      'en',
    );
    expect(only?.text).toBe('retry only what did not apply: setProp');
  });

  it('keeps the order the door refused them in', () => {
    const [only] = salvageSuggestions([{ command: 'moveNode' }, { command: 'insertNode' }], 'en');
    expect(only?.text).toBe('retry only what did not apply: moveNode, insertNode');
  });

  it('says it in the reader’s own language', () => {
    const [only] = salvageSuggestions([{ command: 'insertNode' }], 'ar');
    expect(only?.text).toBe('أعد محاولة ما لم يُطبَّق فقط: insertNode');
  });

  it('never names a page, so a retry cannot scaffold a second one', () => {
    for (const locale of ['ar', 'en'] as const) {
      const [only] = salvageSuggestions([{ command: 'insertNode' }], locale);
      expect(only?.text).not.toMatch(/page|صفحة/i);
    }
  });
});

describe('panelSuggestions with a salvage', () => {
  const blocks = [block('hero', ['a hero for a coffee shop'])];

  it('puts the salvage FIRST, above even the model’s own follow-up', () => {
    const [first] = panelSuggestions({
      blocks,
      selected: undefined,
      followUp: 'now add pricing',
      dropped: [{ command: 'insertNode' }],
      locale: 'en',
    });
    expect(first?.kind).toBe('salvage');
  });

  it('still shows the follow-up beneath it', () => {
    const kinds = panelSuggestions({
      blocks,
      selected: undefined,
      followUp: 'now add pricing',
      dropped: [{ command: 'insertNode' }],
      locale: 'en',
    }).map((entry) => entry.kind);
    expect(kinds).toContain('followUp');
  });

  it('changes nothing when there was no salvage', () => {
    const [first] = panelSuggestions({
      blocks,
      selected: undefined,
      followUp: 'now add pricing',
      locale: 'en',
    });
    expect(first?.kind).toBe('followUp');
  });
});
