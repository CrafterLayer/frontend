import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  defineBlockSchema,
  emptyCustomCodeTree,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { parseTreeMarkup } from '../plan/tree-markup';
import {
  assembleAiContext,
  assembleDirectEditContext,
  DOCUMENT_FOCUS_FRAGMENT_SOURCE,
} from './assemble-context';
import {
  namedSection,
  namingWords,
  outlinePageSections,
  resolveDocumentFocus,
  sectionOf,
  speaksOfWholePage,
} from './document-tree-mode';

/*
  fast-edits (2026-09-28): an edit that names its section sees that section
  whole and the rest of the page as one line per section, instead of every
  section's markup (the owner's one-word CV title change carried 11,368 wire
  tokens, 1,601 of them the page's markup and 5,431 the skill catalog).
*/

const NullRender: BlockRenderComponent = () => null;

const blocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'document-focus-fixture',
  version: '0.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'The page root.',
          props: z.object({ title: z.string().default('') }),
          slots: { default: { allow: ['customCode', 'features', 'feature'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'customCode',
          description: 'A freely composed region.',
          props: z.object({
            label: z.string().default('Custom section'),
            tree: customCodeTree().default(emptyCustomCodeTree()),
          }),
          examples: [{ prompt: 'A heading', node: { type: 'customCode', props: { label: 'Example' } } }],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'features',
          description: 'A registered features grid.',
          props: z.object({ heading: z.string().default('') }),
          slots: { items: { allow: ['feature'] } },
          examples: [{ prompt: 'Features', node: { type: 'features', props: { heading: 'Why us' } } }],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'feature',
          description: 'One feature.',
          props: z.object({ title: z.string().default('') }),
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

function region(id: string, label: string, markup: string) {
  return { id, type: 'customCode', props: { label, tree: parseTreeMarkup(markup) }, slots: {} };
}

function pageDocument(): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'rtl',
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'page',
        props: { title: 'عيادة الابتسامة' },
        slots: { default: ['hero', 'services', 'why', 'contact'] },
      },
      hero: region(
        'hero',
        'الرئيسية',
        "<section id='hero'><h1>عيادة الابتسامة</h1><p>رعاية أسنان لكل العائلة في عمّان.</p></section>",
      ),
      services: region(
        'services',
        'خدماتنا',
        "<section id='services'><h2>خدماتنا</h2><ul><li>تقويم الأسنان</li><li>زراعة الأسنان</li><li>تبييض الأسنان</li></ul></section>",
      ),
      why: {
        id: 'why',
        type: 'features',
        props: { heading: 'لماذا نحن' },
        slots: { items: ['why-1', 'why-2'] },
      },
      'why-1': { id: 'why-1', type: 'feature', props: { title: 'أطباء بخبرة عشرين عاماً' }, slots: {} },
      'why-2': { id: 'why-2', type: 'feature', props: { title: 'مواعيد مسائية' }, slots: {} },
      contact: region(
        'contact',
        'التواصل',
        "<section id='contact'><h2>تواصل معنا</h2><a href='tel:+962791234567'>0791 234 567</a></section>",
      ),
    },
  } as unknown as BuilderDocument;
}

function kernel(document: BuilderDocument = pageDocument()): BuilderKernel {
  return createBuilder({
    document,
    extensions: [blocks],
    ports: { clock: fixedClock(1), ids: seededIds('focus') },
  });
}

const focusOf = (request: string, intent: 'edit' | 'add-section' | 'build-page' = 'edit', selection: readonly string[] = []) =>
  resolveDocumentFocus({ request, document: pageDocument(), selection, intent });

describe('outlinePageSections', () => {
  it('names each top-level section by its label, first heading and anchor', () => {
    expect(outlinePageSections(pageDocument())).toEqual([
      { id: 'hero', type: 'customCode', index: 0, label: 'الرئيسية', heading: 'عيادة الابتسامة', anchor: 'hero' },
      { id: 'services', type: 'customCode', index: 1, label: 'خدماتنا', heading: 'خدماتنا', anchor: 'services' },
      { id: 'why', type: 'features', index: 2, heading: 'لماذا نحن' },
      { id: 'contact', type: 'customCode', index: 3, label: 'التواصل', heading: 'تواصل معنا', anchor: 'contact' },
    ]);
  });

  it('finds the section a nested node sits in', () => {
    expect(sectionOf('why-2', pageDocument())).toBe('why');
    expect(sectionOf('root', pageDocument())).toBeUndefined();
  });
});

describe('namedSection', () => {
  const sections = outlinePageSections(pageDocument());

  it.each([
    ['قسم الخدمات', 'services'],
    ['خدماتكم', 'services'],
    ['قسم التواصل', 'contact'],
    ['the contact section', 'contact'],
    ['services', 'services'],
    ['لماذا نحن', 'why'],
    ['the features block', 'why'],
  ])('%s → %s', (words, id) => {
    expect(namedSection(namingWords(words), sections)?.id).toBe(id);
  });

  it('names nothing for words that fit no section, or only function words', () => {
    expect(namedSection(namingWords('قسم الأسعار'), sections)).toBeUndefined();
    expect(namedSection(namingWords('في هذا القسم'), sections)).toBeUndefined();
  });

  it('knows when the words are about the whole page', () => {
    expect(speaksOfWholePage('غير الخط في كل الصفحة')).toBe(true);
    expect(speaksOfWholePage('change every heading')).toBe(true);
    expect(speaksOfWholePage('غير عنوان قسم الخدمات')).toBe(false);
  });
});

describe('resolveDocumentFocus', () => {
  it('focuses the section an edit names', () => {
    expect(focusOf('غير عنوان قسم الخدمات إلى علاجاتنا')).toEqual({ nodeIds: ['services'], kind: 'edit' });
  });

  it('carries add-section, so the region can still be authored', () => {
    expect(focusOf('أضف قسماً بعد قسم الخدمات عن الأسعار', 'add-section')).toEqual({
      nodeIds: ['services'],
      kind: 'add-section',
    });
  });

  it('pins the selection’s section, and adds it to a named one', () => {
    expect(focusOf('اجعله أقصر', 'edit', ['why-1'])).toEqual({ nodeIds: ['why'], kind: 'edit' });
    expect(focusOf('انقل قسم التواصل فوق هذا', 'edit', ['services'])).toEqual({
      nodeIds: ['services', 'contact'],
      kind: 'edit',
    });
  });

  it('keeps the whole page for a build, a page-wide edit, or an edit that names nothing', () => {
    expect(focusOf('غير عنوان قسم الخدمات', 'build-page')).toBeUndefined();
    expect(focusOf('غير الألوان في كل الصفحة')).toBeUndefined();
    expect(focusOf('اجعل التصميم أجمل')).toBeUndefined();
  });

  it('keeps the whole page when focusing would hide nothing', () => {
    const single: BuilderDocument = {
      ...pageDocument(),
      nodes: {
        ...pageDocument().nodes,
        root: { id: 'root', type: 'page', props: { title: '' }, slots: { default: ['services'] } },
      },
    };
    expect(
      resolveDocumentFocus({ request: 'غير قسم الخدمات', document: single, selection: [], intent: 'edit' }),
    ).toBeUndefined();
  });
});

describe('assembleAiContext — documentFocus', () => {
  it('shows the focused section whole and every other section as one outline line', () => {
    const context = assembleAiContext(kernel().context, {
      composition: { catalogMode: 'none', documentFocus: { nodeIds: ['why'], kind: 'edit' } },
    });
    const nodes = new Map(context.document.nodes.map((node) => [node.id, node]));

    expect([...nodes.keys()].sort()).toEqual(['contact', 'hero', 'root', 'services', 'why', 'why-1', 'why-2']);
    // The focused section and everything under it, as they are.
    expect(nodes.get('why')?.slots).toEqual({ items: ['why-1', 'why-2'] });
    expect(nodes.get('why-2')?.props).toEqual({ title: 'مواعيد مسائية' });
    // The rest: a name, no tree, no slots — a heading only where it says more than the label.
    expect(nodes.get('services')).toEqual({ id: 'services', type: 'customCode', props: { label: 'خدماتنا' }, slots: {} });
    expect(nodes.get('contact')?.props).toEqual({ heading: 'تواصل معنا', label: 'التواصل' });
    // The root keeps its slots: the outline is still the page's order.
    expect(nodes.get('root')?.slots).toEqual({ default: ['hero', 'services', 'why', 'contact'] });

    const focus = context.fragments.find(({ source }) => source === DOCUMENT_FOCUS_FRAGMENT_SOURCE);
    expect(JSON.parse(String(focus?.body))).toMatchObject({ shown: ['why'] });
  });

  it('pins a selection inside another section whole as well', () => {
    const context = assembleAiContext(kernel().context, {
      selection: ['contact'],
      composition: { catalogMode: 'none', documentFocus: { nodeIds: ['services'], kind: 'edit' } },
    });
    const contact = context.document.nodes.find(({ id }) => id === 'contact');
    expect(contact?.props['tree']).toEqual(expect.stringContaining('tel:+962791234567'));
  });

  it('sends compact command schemas on a focused run, and the full ones otherwise', () => {
    const focused = assembleAiContext(kernel().context, {
      composition: { catalogMode: 'none', documentFocus: { nodeIds: ['services'], kind: 'edit' } },
    });
    const whole = assembleAiContext(kernel().context, { composition: { catalogMode: 'none' } });

    const text = (value: unknown) => JSON.stringify(value);
    const focusedCommands = focused.commands ?? [];
    const wholeCommands = whole.commands ?? [];
    expect(text(focused.commands)).not.toContain('$schema');
    expect(text(focused.commands)).not.toContain(String(Number.MAX_SAFE_INTEGER));
    expect(text(whole.commands)).toContain('$schema');
    // Same commands, same closed argument keys: only the noise went.
    expect(focusedCommands.map(({ name }) => name)).toEqual(wholeCommands.map(({ name }) => name));
    for (const [index, command] of focusedCommands.entries()) {
      const schema = command.argsSchema as { properties?: object; additionalProperties?: unknown };
      const full = wholeCommands[index]?.argsSchema as { properties?: object; additionalProperties?: unknown };
      expect(Object.keys(schema.properties ?? {})).toEqual(Object.keys(full.properties ?? {}));
      expect(schema.additionalProperties).toEqual(full.additionalProperties);
    }
    expect(text(focused).length).toBeLessThan(text(whole).length);
  });

  it('an edit gets the escape hatch by name only; a new section keeps its full schema', () => {
    const edit = assembleAiContext(kernel().context, {
      composition: { catalogMode: 'none', documentFocus: { nodeIds: ['services'], kind: 'edit' } },
    });
    const add = assembleAiContext(kernel().context, {
      composition: { catalogMode: 'none', documentFocus: { nodeIds: ['services'], kind: 'add-section' } },
    });
    const hatch = (context: typeof edit) => context.blocks.find(({ type }) => type === 'customCode');

    expect(hatch(edit)).toMatchObject({ type: 'customCode', insertable: false, propKeys: ['label', 'tree'] });
    expect(hatch(edit)?.propsSchema).toBeUndefined();
    expect(hatch(add)?.propsSchema).toBeDefined();
  });

  it('changes nothing without a focus', () => {
    const plain = assembleAiContext(kernel().context, { composition: { catalogMode: 'none' } });
    expect(plain.fragments.some(({ source }) => source === DOCUMENT_FOCUS_FRAGMENT_SOURCE)).toBe(false);
    expect(plain.document.nodes).toHaveLength(7);
  });
});

describe('assembleDirectEditContext', () => {
  it('holds only the nodes a direct edit writes, and costs nothing', () => {
    const context = assembleDirectEditContext(kernel().context, { nodeIds: ['services', 'services'] });

    expect(context.totalTokens).toBe(0);
    expect(context.fragments).toEqual([]);
    expect(context.commands).toEqual([]);
    expect(context.document.nodes.map(({ id }) => id)).toEqual(['services']);
    expect(context.document.nodes[0]?.props['tree']).toEqual(expect.stringContaining('<h2>خدماتنا</h2>'));
  });
});
