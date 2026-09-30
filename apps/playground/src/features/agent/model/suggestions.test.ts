import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { defineBlockSchema, type BlockSchema } from '@craftkit/builder';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  SUGGESTION_LIMITS,
  catalogSuggestions,
  followUpSuggestions,
  localeOf,
  pageSuggestions,
  panelSuggestions,
  salvageSuggestions,
  selectionSuggestions,
  starterSuggestions,
  type BlockNameResolver,
} from './suggestions';

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

/* The panel's resolver: an instance label when the node has one, else the type's name. */
const NAMES: Readonly<Record<string, string>> = {
  'node:hero-1': 'Opening',
  'node:region-1': 'الخدمات',
  'type:button': 'Button',
  'type:hero': 'Hero',
};
const nameOf: BlockNameResolver = ({ type, nodeId }) =>
  (nodeId === undefined ? undefined : NAMES[`node:${nodeId}`]) ?? NAMES[`type:${type}`] ?? '?';

const hero = block('hero', ['a premium hero for a SaaS company', 'قسم افتتاحي عربي'], {
  inlineEditable: 'heading',
  slots: { actions: { allow: ['button'] } },
}).schema;

/* A free-form region, as every AI-built section is: no slots, no in-place prop. */
const region = block('customCode', [
  'a CV header with a photo, a name, and a card of skills',
]).schema;

describe('localeOf', () => {
  it('reads the script, not a language list', () => {
    expect(localeOf('قسم تواصل عربي')).toBe('ar');
    expect(localeOf('a contact section')).toBe('en');
    expect(localeOf('قسم CTA')).toBe('ar');
  });

  it('answers ar for the whole Arabic SCRIPT, and says where the limit is', () => {
    expect(localeOf('صفحهٔ نخست')).toBe('ar');
    expect(localeOf('ہوم پیج')).toBe('ar');
    expect(localeOf('דף הבית')).toBe('en');
  });
});

describe('starterSuggestions (SPEC §4.16: authored per locale, not translations)', () => {
  it('opens an Arabic panel with the SPEC’s four starters, exactly', () => {
    expect(starterSuggestions('ar').map(({ text }) => text)).toEqual([
      'صفحة لعيادة أسنان في عمّان، والحجز عبر واتساب',
      'مقهى مختص في إربد: القائمة والدوام والموقع',
      'متجر عطور صغير يبيع عبر إنستغرام',
      'مكتب محاماة في رام الله: الخدمات والفريق',
    ]);
  });

  it('opens an English panel with the SPEC’s four starters, exactly', () => {
    expect(starterSuggestions('en').map(({ text }) => text)).toEqual([
      'A dental clinic in Amman with WhatsApp booking',
      'A specialty café: menu, hours and map',
      'A small perfume shop on Instagram',
      'A yoga studio: classes and prices',
    ]);
  });

  it('is authored per locale: the fourth Arabic starter is not the fourth English one', () => {
    expect(starterSuggestions('ar')[3]?.text).toContain('محاماة');
    expect(starterSuggestions('en')[3]?.text).toContain('yoga');
  });

  it('speaks each locale in its own script, and is marked as a starter', () => {
    for (const locale of ['ar', 'en'] as const) {
      const starters = starterSuggestions(locale, { limit: 8 });
      expect(starters).toHaveLength(8);
      expect(starters.every(({ text }) => localeOf(text) === locale)).toBe(true);
      expect(starters.every(({ source }) => source === 'starter')).toBe(true);
    }
  });

  it('keeps the Arabic register: no imperative «صِف», no middle dot, the Arabic comma', () => {
    const text = starterSuggestions('ar', { limit: 8 })
      .map((entry) => entry.text)
      .join('\n');
    expect(text).not.toMatch(/صِف|صف |·/u);
    expect(text).not.toContain(',');
  });

  it('rotates through the authored pool deterministically, never randomly', () => {
    const shifted = starterSuggestions('en', { offset: 4 });
    expect(shifted).toHaveLength(4);
    expect(shifted.map(({ text }) => text)).not.toEqual(
      starterSuggestions('en').map(({ text }) => text),
    );
    expect(starterSuggestions('en', { offset: 4 })).toEqual(shifted);
    expect(starterSuggestions('en', { offset: 8 })).toEqual(starterSuggestions('en'));
  });

  it('gives each row a key that is stable for its text', () => {
    const keys = starterSuggestions('ar').map(({ key }) => key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(starterSuggestions('ar').map(({ key }) => key)).toEqual(keys);
  });
});

describe('catalogSuggestions', () => {
  it("offers the catalog's own example prompts, in the asked-for language", () => {
    const arabic = catalogSuggestions(CATALOG, { locale: 'ar' });
    expect(arabic).not.toHaveLength(0);
    expect(arabic.every(({ text }) => localeOf(text) === 'ar')).toBe(true);
    expect(arabic.map(({ text }) => text)).toContain('قسم افتتاحي عربي لعيادة أسنان');
    expect(arabic.every(({ source }) => source === 'catalog')).toBe(true);
  });

  it('orders by block type, so registration order cannot change what is offered', () => {
    const forward = catalogSuggestions(CATALOG, { locale: 'en', limit: 3 });
    const reversed = catalogSuggestions([...CATALOG].reverse(), { locale: 'en', limit: 3 });
    expect(reversed.map(({ text }) => text)).toEqual(forward.map(({ text }) => text));
  });

  it('rotates deterministically and wraps a large offset', () => {
    const first = catalogSuggestions(CATALOG, { locale: 'en', limit: 2, offset: 0 });
    const second = catalogSuggestions(CATALOG, { locale: 'en', limit: 2, offset: 1 });
    expect(second.map(({ text }) => text)).not.toEqual(first.map(({ text }) => text));
    expect(catalogSuggestions(CATALOG, { locale: 'en', limit: 2, offset: 97 })).toHaveLength(2);
  });

  it('falls back to the other language rather than showing nothing', () => {
    expect(
      catalogSuggestions([block('x', ['only english here'])], { locale: 'ar' }).map(
        ({ text }) => text,
      ),
    ).toEqual(['only english here']);
  });

  it('returns nothing only when the catalog has no examples at all', () => {
    expect(catalogSuggestions([block('x', [])], { locale: 'ar' })).toEqual([]);
  });
});

describe('one source of copy', () => {
  it('writes no sentence of its own: every Arabic word it offers comes from the catalog', () => {
    // The starters were once authored here and in the catalog, and the two drifted.
    const root = join(process.cwd(), 'src', 'features', 'agent', 'model');
    const code = readFileSync(join(root, 'suggestions.ts'), 'utf8')
      .split('\n')
      .filter((line) => !/^\s*(?:\/\/|\/\*|\*)/u.test(line));
    expect(code.filter((line) => /[\u0600-\u06FF]/u.test(line))).toEqual([]);
  });
});

describe('selectionSuggestions (SPEC §4.16: the block’s human label, never schema.type)', () => {
  it('names the selected block through the resolver, never by its type', () => {
    /*
      v1 put `schema.type` in the sentence and shipped «أعد صياغة نص hero ليكون أوضح».
      The resolver gets the node id, so an instance label ("Opening") wins over the type.
    */
    const texts = selectionSuggestions({ nodeId: 'hero-1', schema: hero }, 'en', nameOf, 2).map(
      ({ text }) => text,
    );
    expect(texts).toEqual([
      'Rewrite the text of “Opening” to be clearer',
      'Add a new Button inside “Opening”',
    ]);
    expect(texts.join(' ')).not.toMatch(/\bhero\b|\bbutton\b/u);
  });

  it('speaks Arabic in the masdar register, quoting the label «like this»', () => {
    const arabic = selectionSuggestions({ nodeId: 'hero-1', schema: hero }, 'ar', nameOf);
    expect(arabic[0]?.text).toBe('إعادة صياغة نص «Opening» ليكون أوضح');
    expect(arabic.every(({ source }) => source === 'selection')).toBe(true);
  });

  it('offers a free-form region section actions, not the catalog’s unrelated example', () => {
    /*
      Every AI-built section is a `customCode` region, and its one example is a CV header:
      "make «الخدمات» like: a CV header…" is nonsense on a clinic page.
    */
    const texts = selectionSuggestions({ nodeId: 'region-1', schema: region }, 'ar', nameOf).map(
      ({ text }) => text,
    );
    expect(texts).toEqual(['اختصار نصوص «الخدمات» وتوضيحها', 'إعادة ترتيب «الخدمات» بتخطيط مختلف']);
    expect(texts.join(' ')).not.toContain('CV');
  });

  it('reworks a catalog block after its own in-locale example', () => {
    const texts = selectionSuggestions({ nodeId: 'hero-1', schema: hero }, 'en', nameOf, 3).map(
      ({ text }) => text,
    );
    expect(texts[2]).toBe('Rework “Opening” as a premium hero for a SaaS company');
  });

  it('offers nothing when nothing is selected', () => {
    expect(selectionSuggestions(undefined, 'en', nameOf)).toEqual([]);
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

  it('accepts a single string, and nothing', () => {
    expect(followUpSuggestions('add pricing').map(({ text }) => text)).toEqual(['add pricing']);
    expect(followUpSuggestions(undefined)).toEqual([]);
  });
});

describe('salvageSuggestions (SPEC §4.16: names sections, never commands)', () => {
  it('offers nothing when no section was left undone', () => {
    expect(salvageSuggestions(undefined, 'ar')).toEqual([]);
    expect(salvageSuggestions([], 'ar')).toEqual([]);
  });

  it('names the sections, joined the way each language lists things', () => {
    expect(salvageSuggestions(['Services', 'Pricing'], 'en')).toEqual([
      {
        key: 'salvage:Finish the changes to “Services” and “Pricing”',
        text: 'Finish the changes to “Services” and “Pricing”',
        source: 'salvage',
      },
    ]);
    expect(salvageSuggestions(['الخدمات', 'الأسعار', 'الأسئلة'], 'ar')[0]?.text).toBe(
      'إكمال التعديلات على «الخدمات» و«الأسعار» و«الأسئلة»',
    );
  });

  it('names each section once, in the order given', () => {
    expect(salvageSuggestions(['FAQ', 'FAQ', 'Hero'], 'en')[0]?.text).toBe(
      'Finish the changes to “FAQ” and “Hero”',
    );
  });

  it('never names a command or a page, so a retry cannot scaffold a second one', () => {
    for (const locale of ['ar', 'en'] as const) {
      const [only] = salvageSuggestions(['Hero'], locale);
      expect(only?.text).not.toMatch(/insertNode|setProp|page|صفحة/iu);
    }
  });
});

describe('panelSuggestions: what the list shows, in priority order', () => {
  const base = { blocks: CATALOG, nameOf, followUp: undefined, locale: 'en' as const };

  it('is never empty, even with no server and nothing selected', () => {
    const shown = panelSuggestions({ ...base, locale: 'ar' });
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every(({ source }) => source === 'catalog')).toBe(true);
  });

  it('orders salvage, then follow-ups, then selection, then catalog (SPEC §4.16)', () => {
    const shown = panelSuggestions({
      ...base,
      selected: { nodeId: 'hero-1', schema: hero },
      followUp: ['now add pricing'],
      salvaged: ['Services'],
      limit: 8,
    });
    const sources = shown.map(({ source }) => source);
    expect(sources[0]).toBe('salvage');
    expect(sources[1]).toBe('followUp');
    expect(sources.indexOf('selection')).toBeGreaterThan(sources.indexOf('followUp'));
    expect(sources.lastIndexOf('selection')).toBeLessThan(sources.indexOf('catalog'));
  });

  it('shows at most four in the empty state and three after a run (SPEC §4.16)', () => {
    const blocks = [
      ...CATALOG,
      block('cta', ['a bold call to action', 'a quiet newsletter signup']),
    ];
    expect(SUGGESTION_LIMITS).toEqual({ empty: 4, afterRun: 3 });
    expect(panelSuggestions({ ...base, blocks })).toHaveLength(4);
    expect(panelSuggestions({ ...base, blocks, limit: SUGGESTION_LIMITS.afterRun })).toHaveLength(
      3,
    );
  });

  it('treats a spelling difference as the same suggestion, keeping the first spelling', () => {
    const shown = panelSuggestions({
      ...base,
      blocks: [block('hero', ['add a hero'])],
      followUp: ['Add  a  hero'],
    });
    expect(shown).toHaveLength(1);
    expect(shown[0]?.text).toBe('Add  a  hero');
  });

  it('keys are stable for the same input, so React does not churn the list', () => {
    const input = { ...base, selected: { nodeId: 'hero-1', schema: hero }, followUp: ['x'] };
    expect(panelSuggestions(input).map(({ key }) => key)).toEqual(
      panelSuggestions(input).map(({ key }) => key),
    );
  });
});

describe('pageSuggestions: follow-ups for the page just built (SPEC §4.16)', () => {
  it('offers the sections the page lacks, then warmer colours and the other language', () => {
    const shown = pageSuggestions(['Hero', 'Services', 'What patients say'], 'en', 3);
    expect(shown.map(({ text }) => text)).toEqual([
      'Add a pricing section with clear packages',
      'Add a section that answers common questions',
      'Make the page colours warmer',
    ]);
    expect(shown.every(({ source }) => source === 'page')).toBe(true);
  });

  it('never offers a section the page already has, in either language', () => {
    const texts = pageSuggestions(['الواجهة', 'الأسعار', 'الأسئلة الشائعة', 'تواصل معنا'], 'ar', 4).map(
      ({ text }) => text,
    );
    expect(texts).toEqual([
      'إضافة قسم لآراء العملاء',
      'جعل ألوان الصفحة أدفأ',
      'إضافة نسخة إنجليزية من الصفحة',
    ]);
  });

  it('writes English as full sentences with a capital letter', () => {
    for (const { text } of pageSuggestions(['Hero'], 'en', 6)) {
      expect(text).toMatch(/^[A-Z]/u);
    }
  });

  it('offers nothing without a page', () => {
    expect(pageSuggestions(undefined, 'en')).toEqual([]);
    expect(pageSuggestions([], 'en')).toEqual([]);
  });

  it('ranks above the catalog after a finished run, so a clinic page is not offered a delivery question', () => {
    const shown = panelSuggestions({
      blocks: CATALOG,
      nameOf,
      followUp: undefined,
      locale: 'en',
      pageSections: ['Hero', 'Services'],
      limit: SUGGESTION_LIMITS.afterRun,
    });
    expect(shown).toHaveLength(3);
    expect(shown.every(({ source }) => source === 'page')).toBe(true);
  });
});
