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
  type NodeId,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { resolveAiCommandPolicy } from '../skills';
import { applyAiPlan } from './apply-plan';
import { tryDirectEdit, type DirectEdit } from './direct-edit';
import { parseTreeMarkup, serializeTreeMarkup } from './tree-markup';

/*
  fast-edits (2026-09-28): the owner's «تغيير عنوان قسم التعليم والشهادات إلى
  مرحبا» cost 11,368 wire tokens and 46 s. These tables pin the phrasings a
  person types for a small edit — Arabic (MSA and Levantine) and English —
  to the ONE element each points at, and the ones that must fall through to
  the model (null) because they point at none, or at more than one.
*/

const NullRender: BlockRenderComponent = () => null;

const blocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'direct-edit-fixture',
  version: '0.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'The page root.',
          props: z.object({ title: z.string().default('') }),
          slots: { default: { allow: ['customCode', 'heroBanner', 'ctaButton'] } },
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
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'heroBanner',
          description: 'A registered hero.',
          props: z.object({
            heading: z.string().default(''),
            subheading: z.string().default(''),
          }),
          inlineEditable: 'heading',
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'ctaButton',
          description: 'A registered call-to-action button.',
          props: z.object({ label: z.string().default(''), href: z.string().default('#') }),
          inlineEditable: 'label',
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

type Section = readonly [id: string, label: string, markup: string];

/** A nine-section Arabic CV like the one the owner edited, trimmed to seven. */
const CV: readonly Section[] = [
  [
    'hero',
    'الرئيسية',
    "<section id='hero' class='py-24'><h1 class='text-5xl font-bold'>ريم خالد</h1><p class='text-lg'>مهندسة برمجيات</p><a class='rounded-full bg-teal-600 px-6 py-3 text-white' href='#contact'>تواصل معي</a></section>",
  ],
  [
    'about',
    'نبذة عني',
    "<section id='about' class='py-16'><h2 class='text-3xl'>نبذة عني</h2><p>أبني تطبيقات ويب سريعة وسهلة الاستخدام.</p></section>",
  ],
  [
    'experience',
    'الخبرات',
    "<section id='experience' class='py-16'><h2 class='text-3xl'>الخبرات العملية</h2><div><h3>مطورة واجهات في شركة نون</h3><p>2021 - 2024</p></div><div><h3>مطورة مبتدئة في شركة أرامكس</h3><p>2019 - 2021</p></div></section>",
  ],
  [
    'education',
    'التعليم والشهادات',
    "<section id='education' class='py-16'><h2 class='text-3xl'>التعليم والشهادات</h2><div><h3>بكالوريوس علوم الحاسوب</h3><p>الجامعة الأردنية، 2019</p></div></section>",
  ],
  [
    'skills',
    'المهارات',
    "<section id='skills' class='py-16'><h2 class='text-3xl'>المهارات</h2><ul><li>React</li><li>TypeScript</li></ul></section>",
  ],
  [
    'projects',
    'المشاريع',
    "<section id='projects' class='py-16'><h2 class='text-3xl'>مشاريعي</h2><p>متجر إلكتروني لبيع القهوة.</p><a class='rounded-lg border border-teal-600 px-5 py-2' href='#projects'>شاهد المشاريع</a></section>",
  ],
  [
    'contact',
    'التواصل',
    "<section id='contact' class='py-16'><h2 class='text-3xl'>تواصل معي</h2><p>يسعدني سماع أخبارك.</p><a href='tel:+962791234567'>0791 234 567</a><a href='mailto:reem@example.com'>reem@example.com</a><button class='rounded bg-teal-600 px-4 py-2'>أرسل رسالة</button></section>",
  ],
];

const MENU =
  "<section id='menu' class='py-16'><h2 class='text-3xl'>Our Menu</h2><div><h3>Sourdough loaf</h3><p>$6</p></div><div><h3>Croissant</h3><p>$3.50</p></div></section>";
const FIND_US =
  "<section id='find-us' class='py-16'><h2 class='text-3xl'>Find us</h2><p>Call us: +1 (555) 010-2030</p><a href='tel:+15550102030'>Call now</a><a href='mailto:hello@crumb.example'>hello@crumb.example</a></section>";

function composed(id: string, label: string, markup: string) {
  return { id, type: 'customCode', props: { label, tree: parseTreeMarkup(markup) }, slots: {} };
}

function cvDocument(): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'rtl',
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'page',
        props: { title: 'ريم خالد' },
        slots: { default: CV.map(([id]) => id) },
      },
      ...Object.fromEntries(CV.map(([id, label, markup]) => [id, composed(id, label, markup)])),
    },
  } as unknown as BuilderDocument;
}

function bakeryDocument(): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'page',
        props: { title: 'Crumb' },
        slots: { default: ['hero', 'menu', 'order', 'find'] },
      },
      hero: {
        id: 'hero',
        type: 'heroBanner',
        props: { heading: 'Fresh bread daily', subheading: 'Baked in Amman since 1998' },
        slots: {},
      },
      menu: composed('menu', 'Menu', MENU),
      order: { id: 'order', type: 'ctaButton', props: { label: 'Order now', href: '#menu' }, slots: {} },
      find: composed('find', 'Find us', FIND_US),
    },
  } as unknown as BuilderDocument;
}

function kernelFor(document: BuilderDocument): BuilderKernel {
  return createBuilder({
    document,
    extensions: [blocks],
    ports: { clock: fixedClock(1), ids: seededIds('direct-edit') },
  });
}

const cv = (): BuilderKernel => kernelFor(cvDocument());
const bakery = (): BuilderKernel => kernelFor(bakeryDocument());

/** The document after the direct edit lands through the door. */
function landed(kernel: BuilderKernel, edit: DirectEdit): BuilderDocument {
  applyAiPlan({
    kernel,
    plan: edit.plan,
    policy: resolveAiCommandPolicy({ registeredCommands: kernel.context.registry.commandNames() }),
    validationPorts: { clock: fixedClock(2), ids: seededIds('landed') },
  });
  return kernel.getDocument();
}

function markupOf(document: BuilderDocument, id: NodeId): string {
  return serializeTreeMarkup(document.nodes[id]?.props['tree']) ?? '';
}

interface Hit {
  readonly nodeId: NodeId;
  readonly before: string;
  readonly after: string;
}

type Row = readonly [request: string, expected: readonly Hit[] | null, selection?: readonly NodeId[]];

function changesOf(edit: DirectEdit | null): readonly Hit[] | null {
  return edit === null
    ? null
    : edit.target.changes.map(({ nodeId, before, after }) => ({ nodeId, before, after }));
}

const cvRows: readonly Row[] = [
  // The owner's sentence, word for word.
  [
    'تغيير عنوان قسم التعليم والشهادات إلى مرحبا',
    [{ nodeId: 'education', before: 'التعليم والشهادات', after: 'مرحبا' }],
  ],
  [
    'غيّر عنوان قسم التعليم إلى الشهادات الأكاديمية',
    [{ nodeId: 'education', before: 'التعليم والشهادات', after: 'الشهادات الأكاديمية' }],
  ],
  [
    'غير عنوان التعليم والشهادات لـ مرحبا',
    [{ nodeId: 'education', before: 'التعليم والشهادات', after: 'مرحبا' }],
  ],
  [
    'غيرلي عنوان قسم التعليم الى اهلا',
    [{ nodeId: 'education', before: 'التعليم والشهادات', after: 'اهلا' }],
  ],
  [
    'بدّل عنوان قسم المهارات بـ"مهاراتي"',
    [{ nodeId: 'skills', before: 'المهارات', after: 'مهاراتي' }],
  ],
  [
    'عدّل عنوان الخبرات ليصبح خبرتي المهنية',
    [{ nodeId: 'experience', before: 'الخبرات العملية', after: 'خبرتي المهنية' }],
  ],
  [
    'خلّي عنوان قسم المشاريع أعمالي',
    [{ nodeId: 'projects', before: 'مشاريعي', after: 'أعمالي' }],
  ],
  [
    'اجعل عنوان قسم نبذة عني "من أنا"',
    [{ nodeId: 'about', before: 'نبذة عني', after: 'من أنا' }],
  ],
  [
    'ممكن تغير عنوان قسم المشاريع لـ"أعمالي المختارة" لو سمحت',
    [{ nodeId: 'projects', before: 'مشاريعي', after: 'أعمالي المختارة' }],
  ],
  [
    'غير اسم قسم المهارات إلى القدرات',
    [{ nodeId: 'skills', before: 'المهارات', after: 'القدرات' }],
  ],
  [
    'سمّي قسم المهارات مهاراتي التقنية',
    [{ nodeId: 'skills', before: 'المهارات', after: 'مهاراتي التقنية' }],
  ],
  ['غير العنوان الرئيسي إلى ريم الخالد', [{ nodeId: 'hero', before: 'ريم خالد', after: 'ريم الخالد' }]],
  // The selection says where when the words do not.
  ['غير العنوان إلى مرحبا', [{ nodeId: 'education', before: 'التعليم والشهادات', after: 'مرحبا' }], ['education']],
  ['غير عنوان هذا القسم إلى مرحبا', [{ nodeId: 'skills', before: 'المهارات', after: 'مرحبا' }], ['skills']],
  // English on an Arabic page: the section's anchor names it.
  [
    'change the title of the education section to Hello',
    [{ nodeId: 'education', before: 'التعليم والشهادات', after: 'Hello' }],
  ],
  // Buttons: by their own text, or as the one button of a named section.
  ['غير زر تواصل معي إلى احجز موعد', [{ nodeId: 'hero', before: 'تواصل معي', after: 'احجز موعد' }]],
  ['غير نص زر أرسل رسالة إلى إرسال', [{ nodeId: 'contact', before: 'أرسل رسالة', after: 'إرسال' }]],
  ['غير زر قسم التواصل إلى اتصل بي', [{ nodeId: 'contact', before: 'أرسل رسالة', after: 'اتصل بي' }]],
  // Phone and email: the link's text and its href change together.
  [
    'غير رقم الهاتف إلى 0799 888 777',
    [
      { nodeId: 'contact', before: 'tel:+962791234567', after: 'tel:0799888777' },
      { nodeId: 'contact', before: '0791 234 567', after: '0799 888 777' },
    ],
  ],
  [
    'رقم الهاتف صار 0788123456',
    [
      { nodeId: 'contact', before: 'tel:+962791234567', after: 'tel:0788123456' },
      { nodeId: 'contact', before: '0791 234 567', after: '0788123456' },
    ],
  ],
  [
    'حط الإيميل reem.khaled@gmail.com',
    [
      { nodeId: 'contact', before: 'mailto:reem@example.com', after: 'mailto:reem.khaled@gmail.com' },
      { nodeId: 'contact', before: 'reem@example.com', after: 'reem.khaled@gmail.com' },
    ],
  ],
  [
    'عدل البريد الإلكتروني إلى reem@work.example',
    [
      { nodeId: 'contact', before: 'mailto:reem@example.com', after: 'mailto:reem@work.example' },
      { nodeId: 'contact', before: 'reem@example.com', after: 'reem@work.example' },
    ],
  ],
  // Text swaps: quoted or bare, new-first («بدل») or old-first.
  [
    'غير «مهندسة برمجيات» إلى «مطورة ويب»',
    [{ nodeId: 'hero', before: 'مهندسة برمجيات', after: 'مطورة ويب' }],
  ],
  [
    'حط "مطورة ويب" بدل "مهندسة برمجيات"',
    [{ nodeId: 'hero', before: 'مهندسة برمجيات', after: 'مطورة ويب' }],
  ],
  ['بدّل React بـ Vue', [{ nodeId: 'skills', before: 'React', after: 'Vue' }]],

  // ── Null: the model path runs ──
  // No section named, nothing selected: «العنوان» could be any heading, or an address.
  ['غير العنوان إلى مرحبا', null],
  // "This section" with nothing selected.
  ['غير عنوان هذا القسم إلى مرحبا', null],
  // Three buttons on the page.
  ['غير الزر إلى اضغط هنا', null],
  // A colour is a style, not a title.
  ['غير عنوان قسم التعليم إلى أزرق', null],
  // «عنوان البيت» is a street address.
  ['غير عنوان البيت إلى شارع الجامعة', null],
  // No such section.
  ['غير عنوان قسم الخدمات إلى مرحبا', null],
  // «لمرحبا» glued without a tatweel reads as one word: not guessed.
  ['بدي غير عنوان التعليم لمرحبا', null],
  // Not an edit at all.
  ['اعمل لي صفحة لعيادة أسنان', null],
  ['شو رأيك بالتصميم؟', null],
  // A phone with too few digits.
  ['غير رقم الهاتف إلى 12', null],
];

const bakeryRows: readonly Row[] = [
  ['change the title of the menu section to Our Breads', [{ nodeId: 'menu', before: 'Our Menu', after: 'Our Breads' }]],
  ['rename the Menu section to Bakery Menu', [{ nodeId: 'menu', before: 'Our Menu', after: 'Bakery Menu' }]],
  [
    'set the heading of the Find us section to Come say hi',
    [{ nodeId: 'find', before: 'Find us', after: 'Come say hi' }],
  ],
  ['change the hero heading to Warm bread', [{ nodeId: 'hero', before: 'Fresh bread daily', after: 'Warm bread' }]],
  ['change the Order now button to Order today', [{ nodeId: 'order', before: 'Order now', after: 'Order today' }]],
  ['change the heading to Welcome', [{ nodeId: 'menu', before: 'Our Menu', after: 'Welcome' }], ['menu']],
  [
    'change the phone number to +1 555 999 0000',
    [
      { nodeId: 'find', before: 'Call us: +1 (555) 010-2030', after: 'Call us: +1 555 999 0000' },
      { nodeId: 'find', before: 'tel:+15550102030', after: 'tel:+15559990000' },
    ],
  ],
  [
    'update the email to hello@crumb.co',
    [
      { nodeId: 'find', before: 'mailto:hello@crumb.example', after: 'mailto:hello@crumb.co' },
      { nodeId: 'find', before: 'hello@crumb.example', after: 'hello@crumb.co' },
    ],
  ],
  ['change the price of the croissant to $4', [{ nodeId: 'menu', before: '$3.50', after: '$4' }]],
  ['make the sourdough price 7', [{ nodeId: 'menu', before: '$6', after: '$7' }]],
  [
    "replace 'Fresh bread daily' with 'Baked every morning'",
    [{ nodeId: 'hero', before: 'Fresh bread daily', after: 'Baked every morning' }],
  ],
  ['change Fresh bread daily to Baked at dawn', [{ nodeId: 'hero', before: 'Fresh bread daily', after: 'Baked at dawn' }]],
  ['please change the title of the menu section to "Today\'s bakes"', [{ nodeId: 'menu', before: 'Our Menu', after: "Today's bakes" }]],

  // ── Null ──
  ['make the button blue', null],
  ['change the title to bold', null],
  ['make the title bigger', null],
  // Two prices on the page, no item named.
  ['change the price to 5', null],
  ['change the title of the section to Hello', null],
  ['change the email to not-an-email', null],
  ['build me a landing page for a bakery', null],
  ['add a testimonials section', null],
  ['what fonts does this page use?', null],

  /*
    A pronoun is never the new title (final test, 2026-09-28): «retitle it»
    with a block selected wrote the title "it" with no model call. The
    pronoun points at the selection; the new text must still be said.
  */
  ['retitle it', null, ['menu']],
  ['rename it', null, ['menu']],
  ['retitle them', null, ['menu']],
  ['change the title to it', null, ['menu']],
  ['call it Launch', [{ nodeId: 'menu', before: 'Our Menu', after: 'Launch' }], ['menu']],
  ['rename it to Launch', [{ nodeId: 'menu', before: 'Our Menu', after: 'Launch' }], ['menu']],
  // "It" with nothing selected points at nothing.
  ['call it Launch', null],
  /*
    An @mention is the panel's way to point at a block; the panel turns it
    into the run's selection, which only the model path reads with the
    words. «retitle @selected-hero» wrote the title "selected-hero".
  */
  ['retitle @menu', null, ['menu']],
  ['retitle @selected-hero', null, ['hero']],
  ['rename @menu to Bakery Menu', null, ['menu']],
  ['change the title of @menu to Our Breads', null, ['menu']],
];

describe('tryDirectEdit — the Arabic CV', () => {
  it.each(cases(cvRows))('$request', ({ request, expected, selection }) => {
    expect(sortedChanges(tryDirectEdit(request, cv(), selection === undefined ? {} : { selection }))).toEqual(
      expected === null ? null : [...expected].sort(byBefore),
    );
  });

  it('lands the owner’s edit as one setProp on the region, changing only that heading', () => {
    const kernel = cv();
    const before = markupOf(kernel.getDocument(), 'education');
    const edit = tryDirectEdit('تغيير عنوان قسم التعليم والشهادات إلى مرحبا', kernel);

    expect(edit).not.toBeNull();
    if (edit === null) return;
    expect(edit.language).toBe('ar');
    expect(edit.summary).toBe('تغيير العنوان «التعليم والشهادات» إلى «مرحبا»');
    expect(edit.target).toMatchObject({ role: 'title', sectionId: 'education', sectionName: 'التعليم والشهادات' });
    expect(edit.plan.commands).toHaveLength(1);
    expect(edit.plan.commands[0]).toMatchObject({ command: 'setProp', args: { id: 'education', key: 'tree' } });

    const after = landed(kernel, edit);
    expect(markupOf(after, 'education')).toBe(before.replace('>التعليم والشهادات</h2>', '>مرحبا</h2>'));
    // Every other section is exactly as it was.
    for (const [id] of CV.filter(([id]) => id !== 'education')) {
      expect(markupOf(after, id)).toBe(markupOf(cvDocument(), id));
    }
  });

  it('writes a phone into the link text and its href in one step', () => {
    const kernel = cv();
    const edit = tryDirectEdit('غير رقم الهاتف إلى 0799 888 777', kernel);
    expect(edit?.target.role).toBe('phone');
    expect(edit?.plan.commands).toHaveLength(1);
    if (edit === null) return;
    expect(markupOf(landed(kernel, edit), 'contact')).toContain("<a href='tel:0799888777'>0799 888 777</a>");
  });

  it('never writes: the document is untouched until the plan is applied', () => {
    const kernel = cv();
    const document = kernel.getDocument();
    tryDirectEdit('تغيير عنوان قسم التعليم والشهادات إلى مرحبا', kernel);
    expect(kernel.getDocument()).toBe(document);
  });

  it('returns null for a route that is not an edit, whatever the words', () => {
    const edit = tryDirectEdit('تغيير عنوان قسم التعليم والشهادات إلى مرحبا', cv(), {
      route: { kind: 'build-page', confidence: 1, reason: 'test', target: 'replace' },
    });
    expect(edit).toBeNull();
  });

  it('returns null for a multi-line brief and an empty request', () => {
    expect(tryDirectEdit('غير عنوان قسم التعليم إلى مرحبا\nوأضف قسم آراء العملاء', cv())).toBeNull();
    expect(tryDirectEdit('   ', cv())).toBeNull();
  });

  it('dryRun: false leaves the rehearsal to the door and builds the same plan', () => {
    const request = 'تغيير عنوان قسم التعليم والشهادات إلى مرحبا';
    const rehearsed = tryDirectEdit(request, cv());
    const kernel = cv();
    const unrehearsed = tryDirectEdit(request, kernel, { dryRun: false });

    expect(unrehearsed?.plan).toEqual(rehearsed?.plan);
    expect(unrehearsed?.target).toEqual(rehearsed?.target);
    if (unrehearsed === null) return;
    expect(markupOf(landed(kernel, unrehearsed), 'education')).toContain('>مرحبا</h2>');
  });

  it('refuses a plan the run policy does not allow', () => {
    const kernel = cv();
    const edit = tryDirectEdit('تغيير عنوان قسم التعليم والشهادات إلى مرحبا', kernel, {
      policy: resolveAiCommandPolicy({
        registeredCommands: kernel.context.registry.commandNames(),
        session: { deniedCommands: ["setProp"] },
      }),
    });
    expect(edit).toBeNull();
  });
});

describe('tryDirectEdit — the English bakery', () => {
  it.each(cases(bakeryRows))('$request', ({ request, expected, selection }) => {
    expect(sortedChanges(tryDirectEdit(request, bakery(), selection === undefined ? {} : { selection }))).toEqual(
      expected === null ? null : [...expected].sort(byBefore),
    );
  });

  it('sets a registered block’s inline-editable prop directly', () => {
    const kernel = bakery();
    const edit = tryDirectEdit('change the Order now button to Order today', kernel);
    expect(edit?.language).toBe('en');
    expect(edit?.summary).toBe('Change the “Order now” button to “Order today”');
    expect(edit?.plan.commands).toEqual([
      {
        command: 'setProp',
        args: { id: 'order', key: 'label', value: 'Order today' },
        title: 'Change the “Order now” button to “Order today”',
      },
    ]);
    if (edit === null) return;
    expect(landed(kernel, edit).nodes['order']?.props['label']).toBe('Order today');
  });
});

/*
  A section whose own name holds a demonstrative and a locator: "Roasted
  this week in Irbid". The English edit went to the model (1 request, 8 s)
  while its Arabic twin landed with none (final test, 2026-09-28).
*/
const ROASTED =
  "<section id='roasted' class='py-16'><h2 class='text-3xl'>Roasted this week in Irbid</h2><p>Ethiopia Guji, washed.</p></section>";
const VISIT =
  "<section id='visit' class='py-16'><h2 class='text-3xl'>Come by the roastery</h2><p>Visit us in Irbid</p></section>";

function coffee(): BuilderKernel {
  return kernelFor({
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'page', props: { title: 'Irbid Roasters' }, slots: { default: ['roasted', 'visit'] } },
      roasted: composed('roasted', 'Roasted this week in Irbid', ROASTED),
      visit: composed('visit', 'Visit', VISIT),
    },
  } as unknown as BuilderDocument);
}

const coffeeRows: readonly Row[] = [
  [
    'Change the title of the Roasted this week in Irbid section to Welcome home',
    [{ nodeId: 'roasted', before: 'Roasted this week in Irbid', after: 'Welcome home' }],
  ],
  [
    'change the Roasted this week in Irbid heading to Fresh this week',
    [{ nodeId: 'roasted', before: 'Roasted this week in Irbid', after: 'Fresh this week' }],
  ],
  [
    'change the title of this section to Welcome home',
    [{ nodeId: 'visit', before: 'Come by the roastery', after: 'Welcome home' }],
    ['visit'],
  ],
  // «this» still points at the selection, and with nothing selected at nothing.
  ['change the title of this section to Welcome home', null],
  // A pronoun is not the text to replace: "it" is inside «Visit», once.
  ['change it to Hello', null, ['visit']],
];

describe('tryDirectEdit — a section name that says "this" and "in"', () => {
  it.each(cases(coffeeRows))('$request', ({ request, expected, selection }) => {
    expect(sortedChanges(tryDirectEdit(request, coffee(), selection === undefined ? {} : { selection }))).toEqual(
      expected === null ? null : [...expected].sort(byBefore),
    );
  });
});

interface Case {
  readonly request: string;
  readonly expected: readonly Hit[] | null;
  readonly selection: readonly NodeId[] | undefined;
}

function cases(rows: readonly Row[]): readonly Case[] {
  return rows.map(([request, expected, selection]) => ({ request, expected, selection }));
}

function sortedChanges(edit: DirectEdit | null): readonly Hit[] | null {
  const changes = changesOf(edit);
  return changes === null ? null : [...changes].sort(byBefore);
}

function byBefore(left: Hit, right: Hit): number {
  return left.before < right.before ? -1 : left.before > right.before ? 1 : 0;
}
