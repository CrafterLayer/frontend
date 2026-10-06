import { describe, expect, it } from 'vitest';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import type { BuilderDocument } from '@craftkit/builder-schema';

import { validatePagePlan } from '../../agent/page-plan';
import { skeletonFromPlan } from '../../agent/page-plan/skeleton-from-plan';
import { applyAiPlan } from '../../plan/apply-plan';
import { parseTreeMarkup, serializeTreeMarkup } from '../../plan/tree-markup';
import { resolveAiCommandPolicy } from '../../skills';
import type { AiPlan } from '../../types';
import { agentToolsFixtureBlocks, fixtureKernel, kitCss, toolPlan } from './agent-tools.fixtures';
import { tryDirectTool } from './direct-tool';
import { readElementColour } from './element-colour';
import { expandAgentTools } from './expand';
import { readPageKit, writePageKit } from './page-kit';
import { planChangesLook } from './visible-change';

/*
  colour-target fix (2026-10-05): the owner typed «سارة خليها احمر لونها» on
  an Arabic CV whose hero h1 reads «سارة الحلبي». The agent said «عُدِّلت
  الصفحة» and only the page css changed — a kit rewrite that regrouped the
  font imports and moved nothing on screen. A colour that names an element
  is THAT element's; a page-css rewrite that changes no look never lands.
*/

function blank(dir: 'rtl' | 'ltr' = 'rtl'): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir,
    rootId: 'root',
    nodes: { root: { id: 'root', type: 'page', props: { title: '' }, slots: { default: [] } } },
  };
}

function kernelOf(document: BuilderDocument): BuilderKernel {
  return createBuilder({
    document,
    extensions: [agentToolsFixtureBlocks],
    ports: { clock: fixedClock(1), ids: seededIds('colour') },
  });
}

function land(kernel: BuilderKernel, plan: AiPlan, label?: string): void {
  applyAiPlan({
    kernel,
    plan,
    policy: resolveAiCommandPolicy({ registeredCommands: kernel.context.registry.commandNames() }),
    validationPorts: { clock: fixedClock(2), ids: seededIds('colour-land') },
    ...(label === undefined ? {} : { label }),
  });
}

/** An Arabic CV built the way the product builds one: a PagePlan, its skeleton and its section kits. */
function cvKernel(): BuilderKernel {
  const result = validatePagePlan({
    intent: 'new-page',
    locale: { lang: 'ar' },
    title: 'سارة الحلبي — مصممة واجهات',
    description: 'السيرة الذاتية لسارة الحلبي، مصممة واجهات في عمّان.',
    tokens: {
      bg: 'white',
      surface: 'stone-50',
      ink: 'stone-900',
      muted: 'stone-600',
      accent: 'teal-700',
      onAccent: 'white',
      border: 'stone-200',
      fontDisplay: { family: 'Readex Pro' },
      fontBody: { family: 'IBM Plex Sans Arabic', weights: [400, 700] },
      radius: 'xl',
      signature: 'the name set large',
    },
    primaryCta: { label: 'تواصل معي', href: '#contact' },
    nav: [{ label: 'تواصل', anchorId: 'contact' }],
    sections: [
      { key: 'header', role: 'header', title: 'الترويسة', anchorId: 'top', purpose: 'الاسم.' },
      {
        key: 'hero',
        role: 'hero',
        title: 'الرئيسية',
        anchorId: 'hero',
        purpose: 'من هي سارة.',
        kit: 'hero-centered',
        slots: {
          title: 'سارة الحلبي',
          lead: 'مصممة واجهات بخبرة ثماني سنوات.',
          cta: { label: 'تواصل معي', href: '#contact' },
        },
      },
      {
        key: 'contact',
        role: 'cta',
        title: 'تواصل',
        anchorId: 'contact',
        purpose: 'طريقة واحدة للتواصل.',
        kit: 'cta-split',
        slots: { title: 'لنعمل معاً', cta: { label: 'راسلني', href: '#contact' } },
      },
      { key: 'footer', role: 'footer', title: 'التذييل', anchorId: 'footer', purpose: 'الاسم.' },
    ],
    facts: [],
  });
  if (!result.ok) throw new Error(result.issues.map(({ message }) => message).join('\n'));
  const kernel = kernelOf(blank());
  const { plan } = skeletonFromPlan(result.plan, { parentId: 'root', regionType: 'customCode' });
  land(kernel, plan);
  return kernel;
}

interface Found {
  readonly regionId: string;
  readonly tag: string;
  readonly className: string;
  readonly text: string;
}

/** Every element of every region, with the region it stands in. */
function elements(kernel: BuilderKernel): readonly Found[] {
  const document = kernel.getDocument();
  const out: Found[] = [];
  const walk = (regionId: string, node: unknown): void => {
    if (typeof node !== 'object' || node === null) return;
    const record = node as { kind?: string; tag?: string; className?: string; text?: string; children?: unknown[] };
    if (record.kind === 'element') {
      out.push({ regionId, tag: record.tag ?? '', className: record.className ?? '', text: record.text ?? '' });
    }
    for (const child of record.children ?? []) walk(regionId, child);
  };
  for (const id of document.nodes[document.rootId]?.slots?.['default'] ?? []) walk(id, document.nodes[id]?.props['tree']);
  return out;
}

/** The element a direct plan recoloured: the one whose className differs after it lands. */
function recoloured(kernel: BuilderKernel, request: string): { readonly label: string; readonly changed: readonly Found[] } | undefined {
  const direct = tryDirectTool(request, kernel);
  if (direct === undefined) return undefined;
  const before = elements(kernel);
  land(kernel, direct.plan, direct.label);
  const after = elements(kernel);
  return { label: direct.label, changed: after.filter((element, index) => element.className !== before[index]?.className) };
}

type Row = readonly [request: string, tag: string, text: string, utility: string];

const AR_ROWS: readonly Row[] = [
  // The owner's sentence, word for word.
  ['سارة خليها احمر لونها', 'h1', 'سارة الحلبي', 'text-red-700'],
  ['سارة خليها أحمر لونها', 'h1', 'سارة الحلبي', 'text-red-700'],
  ['خلي سارة حمرا', 'h1', 'سارة الحلبي', 'text-red-700'],
  ['خلي لون سارة احمر', 'h1', 'سارة الحلبي', 'text-red-700'],
  ['لوّن سارة بالأحمر', 'h1', 'سارة الحلبي', 'text-red-700'],
  ['حط لون احمر لسارة', 'h1', 'سارة الحلبي', 'text-red-700'],
  ['غيّر لون العنوان إلى الأزرق', 'h1', 'سارة الحلبي', 'text-blue-700'],
  ['اجعل العنوان باللون الذهبي', 'h1', 'سارة الحلبي', 'text-yellow-700'],
  ['العنوان خليه اخضر', 'h1', 'سارة الحلبي', 'text-emerald-700'],
  ['خلي العنوان الرئيسي كحلي', 'h1', 'سارة الحلبي', 'text-blue-900'],
  ['صير اسم سارة الحلبي احمر', 'h1', 'سارة الحلبي', 'text-red-700'],
  ['سارة الحلبي باللون الأحمر لو سمحت', 'h1', 'سارة الحلبي', 'text-red-700'],
  ['اعمل سارة لونها أبيض', 'h1', 'سارة الحلبي', 'text-white'],
  ['خلي عنوان لنعمل معا بنفسجي', 'h2', 'لنعمل معاً', 'text-violet-700'],
  ['خلي زر راسلني احمر', 'a', 'راسلني', 'bg-red-700'],
];

const EN_ROWS: readonly Row[] = [
  ['make the heading red', 'h1', 'Fresh coffee daily', 'text-red-700'],
  ['Please make the heading red.', 'h1', 'Fresh coffee daily', 'text-red-700'],
  ['turn the title blue', 'h1', 'Fresh coffee daily', 'text-blue-700'],
  ['change the heading colour to red', 'h1', 'Fresh coffee daily', 'text-red-700'],
  ['set the colour of the main heading to purple', 'h1', 'Fresh coffee daily', 'text-purple-700'],
  ['colour the heading green', 'h1', 'Fresh coffee daily', 'text-emerald-700'],
  ['make Fresh coffee red', 'h1', 'Fresh coffee daily', 'text-red-700'],
  ['make "Our story" gold', 'h2', 'Our story', 'text-yellow-700'],
  ['paint the main heading navy', 'h1', 'Fresh coffee daily', 'text-blue-900'],
  ['make the Order button green', 'a', 'Order', 'bg-emerald-700'],
];

describe('element colour — a colour that names an element is that element’s', () => {
  it.each(AR_ROWS)('Arabic CV: «%s» → %s «%s» gets %s', (request, tag, text, utility) => {
    const result = recoloured(cvKernel(), request);
    expect(result?.changed).toHaveLength(1);
    expect(result?.changed[0]).toMatchObject({ tag, text });
    expect(result?.changed[0]?.className.split(' ')).toContain(utility);
  });

  it.each(EN_ROWS)('English page: "%s" → %s “%s” gets %s', (request, tag, text, utility) => {
    const result = recoloured(fixtureKernel(), request);
    expect(result?.changed).toHaveLength(1);
    expect(result?.changed[0]).toMatchObject({ tag, text });
    expect(result?.changed[0]?.className.split(' ')).toContain(utility);
  });

  it('the one button on a page: «خلي الزر ازرق» fills it and keeps its label readable', () => {
    const result = recoloured(fixtureKernel({ locale: 'ar' }), 'خلي الزر ازرق');
    expect(result?.changed).toHaveLength(1);
    expect(result?.changed[0]?.className.split(' ')).toEqual(expect.arrayContaining(['ck-btn', 'bg-blue-700', 'text-white']));
    expect(result?.label).toBe('تلوين «اطلب الآن» بالأزرق');
  });

  it('replaces the colour an element already had instead of stacking two', () => {
    const kernel = cvKernel();
    recoloured(kernel, 'سارة خليها احمر لونها');
    const result = recoloured(kernel, 'خلي سارة زرقا');
    const classes = result?.changed[0]?.className.split(' ') ?? [];
    expect(classes).toContain('text-blue-700');
    expect(classes).not.toContain('text-red-700');
  });

  it('page and theme words keep their meaning: page tokens, never an element', () => {
    for (const request of ['غيّر ألوان الصفحة إلى الأحمر', 'خلي اللون الأساسي أحمر', 'change the theme colour to red', 'غير اللون الى الاحمر']) {
      const kernel = cvKernel();
      expect(readElementColour(request.toLowerCase(), kernel)).toBeUndefined();
      const direct = tryDirectTool(request, kernel);
      expect(direct?.plan.commands.map(({ args }) => (args as { key?: string }).key)).toEqual(['pageCss']);
    }
  });

  it('falls through to the model unless exactly one element is meant', () => {
    const cv = cvKernel();
    for (const request of [
      'خلي الزر احمر', // two buttons on the CV
      'سارة احمر', // a statement, not a change
      'خلي خالد احمر', // no element says it
      'خلي عنوان قسم الخبرات احمر', // a locator this reading does not resolve
      'make the hero feel warmer',
    ]) {
      expect(tryDirectTool(request, cv)).toBeUndefined();
    }
    // Two buttons on the English page: "the button" is not one.
    expect(tryDirectTool('make the button red', fixtureKernel())).toBeUndefined();
  });

  it('the owner’s case: the h1 turns red, nothing else moves, one labelled transaction, Undo restores', () => {
    const kernel = cvKernel();
    const before = kernel.getDocument();
    const direct = tryDirectTool('سارة خليها احمر لونها', kernel);
    expect(direct?.label).toBe('تلوين «سارة الحلبي» بالأحمر');
    expect(direct?.plan.commands).toHaveLength(1);
    expect(direct?.plan.commands[0]).toMatchObject({ command: 'setProp', args: { key: 'tree' } });
    if (direct === undefined) return;

    land(kernel, direct.plan, direct.label);
    const after = kernel.getDocument();
    const heroId = (direct.plan.commands[0]?.args as { id: string }).id;

    // Only the hero region's tree changed; the page css (and every other node) is untouched.
    for (const id of Object.keys(after.nodes)) {
      if (id === heroId) continue;
      expect(after.nodes[id]?.props).toEqual(before.nodes[id]?.props);
    }
    const was = serializeTreeMarkup(before.nodes[heroId]?.props['tree']) ?? '';
    const now = serializeTreeMarkup(after.nodes[heroId]?.props['tree']) ?? '';
    expect(now).not.toBe(was);
    expect(now.replace(' text-red-700', '')).toBe(was);
    expect(elements(kernel).find(({ tag }) => tag === 'h1')?.className.split(' ')).toContain('text-red-700');

    expect(kernel.undo()).toBe(true);
    expect(kernel.getDocument().nodes[heroId]?.props).toEqual(before.nodes[heroId]?.props);
  });
});

describe('a page-css rewrite that changes no look never lands', () => {
  function rootCss(kernel: BuilderKernel): string {
    const document = kernel.getDocument();
    const css = document.nodes[document.rootId]?.props['pageCss'];
    return typeof css === 'string' ? css : '';
  }

  function rewrite(kernel: BuilderKernel, colours: Partial<Record<string, string>>) {
    const css = rootCss(kernel);
    const { state } = readPageKit(css, true);
    const next = writePageKit(css, { ...state, colours: { ...state.colours, ...colours } }, { lang: 'ar', dir: 'rtl' });
    return [{ command: 'setProp', args: { id: 'root', key: 'pageCss', value: next } }];
  }

  it('the kit re-written with the values it holds differs as text, and is still no change', () => {
    const kernel = cvKernel();
    const steps = rewrite(kernel, {});
    expect(steps[0]?.args.value === rootCss(kernel)).toBe(false);
    expect(planChangesLook(steps, kernel)).toBe(false);
  });

  it('a token the page reads is a change; one it never reads is not', () => {
    const cv = cvKernel(); // its buttons read the accent, every region reads the ink
    expect(planChangesLook(rewrite(cv, { accent: '#b91c1c', accentInk: '#b91c1c' }), cv)).toBe(true);
    expect(planChangesLook(rewrite(cv, { ink: '#7f1d1d' }), cv)).toBe(true);

    const plain = kernelOf({
      ...blank(),
      nodes: {
        root: { id: 'root', type: 'page', props: { title: 'سارة', lang: 'ar', pageCss: kitCss('ar') }, slots: { default: ['hero'] } },
        hero: {
          id: 'hero',
          type: 'customCode',
          props: { label: 'الرئيسية', tree: parseTreeMarkup("<section class='py-16'><h1 class='text-5xl'>سارة الحلبي</h1><p>مصممة</p></section>"), css: '' },
          slots: {},
        },
      },
    } as unknown as BuilderDocument);
    expect(planChangesLook(rewrite(plain, { accent: '#b91c1c', accentInk: '#b91c1c' }), plain)).toBe(false);
    // So «غيّر اللون إلى الأحمر» on that page is not reported as an edit: the model decides.
    expect(tryDirectTool('غيّر اللون إلى الأحمر', plain)).toBeUndefined();
    // …while the same request on the CV, whose buttons read the accent, still lands.
    expect(tryDirectTool('غيّر اللون إلى الأحمر', cv)).toBeDefined();
  });

  it('theme.apply with the values the page already holds expands to nothing', () => {
    const kernel = cvKernel();
    const { state } = readPageKit(rootCss(kernel), true);
    const expanded = expandAgentTools(toolPlan('theme.apply', { accent: state.colours.accent }), kernel);
    expect(expanded.issues).toEqual([]);
    expect((expanded.plan as { commands: unknown[] }).commands).toEqual([]);
  });
});
