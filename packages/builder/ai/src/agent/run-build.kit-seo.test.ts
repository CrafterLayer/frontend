import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  customCss,
  defineBlockSchema,
  emptyCustomCodeTree,
  pageSeoSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { selectCatalogPhotos } from '../context/providers/photo-catalog';
import { createCraftkitAiSkillRegistry } from '../skills';
import type {
  AiPlan,
  AiPlanProvider,
  AiPlanValidationIssue,
  AssembledAiContext,
  PagePlanCandidate,
} from '../types';
import { revertBuildSection } from './build-revert';
import { runAiBuild } from './index';

/*
  The section kit and the SEO pass in a page build (2026-09-30, DESIGN §0,
  §B, §D). A kit-backed writer answers with ONE `kit.section` tool step —
  tens of output tokens instead of a section's markup — which generation
  expands into an ordinary `setProp tree` before the door and the target
  guard see it. A kit step the door refuses falls back to today's markup
  writer. After the last section lands, a zero-token pass syncs the menu and
  applies the safe SEO fixes as ONE transaction labelled `Assistant: SEO`.
*/

const NullRender: BlockRenderComponent = () => null;
const SEO_LABEL = 'Assistant: SEO';
const SAMPLE_PHONE = '+962 7 9646 1275';
const LONG_TITLE =
  'محمصة الهيل في عمّان — قهوة مختصة تُحمّص كل صباح وتصلك طازجة إلى باب بيتك في كل أحياء المدينة';

/** The product page root, as far as a build writes it (editor Page/schema.ts). */
function manifest(): TrustedExtensionManifest {
  return {
    tier: 1,
    name: 'kit-seo-build-fixture',
    version: '0.0.0',
    contributes: {
      blocks: [
        {
          schema: defineBlockSchema({
            type: 'page',
            description: 'The page root.',
            props: z.object({
              title: z.string().max(120).default(''),
              description: z.string().max(200).default(''),
              lang: z.string().max(12).default(''),
              slug: z.string().max(120).default(''),
              pageCss: customCss(20_000),
              seo: pageSeoSchema.optional(),
            }),
            slots: { default: { allow: ['customCode'] } },
            examples: [],
          }),
          render: NullRender,
        },
        {
          schema: defineBlockSchema({
            type: 'customCode',
            description: 'A freely composed region.',
            props: z.object({
              label: z.string().max(80).default('Custom section'),
              tree: customCodeTree().default(emptyCustomCodeTree()),
              css: customCss(8_000),
            }),
            examples: [],
          }),
          render: NullRender,
        },
      ],
    },
  };
}

function kernel(): BuilderKernel {
  const document: BuilderDocument = {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: { root: { id: 'root', type: 'page', props: { title: 'Home' }, slots: { default: [] } } },
  };
  return createBuilder({
    document,
    extensions: [manifest()],
    ports: { clock: { now: () => 1 }, ids: seededIds('kit-seo') },
  });
}

/** An Arabic café page: header, a photo hero, a priced menu, a short cta the planner filled, footer. */
function cafe(): PagePlanCandidate {
  return {
    intent: 'replace',
    locale: { lang: 'ar' },
    title: LONG_TITLE,
    description: 'قهوة مختصة محمصة في عمّان، تصلك طازجة.',
    tokens: {
      bg: 'lime-50',
      surface: 'white',
      ink: 'emerald-950',
      muted: 'emerald-800',
      accent: 'orange-700',
      onAccent: 'white',
      border: 'stone-200',
      fontDisplay: { family: 'Lalezar' },
      fontBody: { family: 'Almarai', weights: [400, 700] },
      radius: 'xl',
      signature: 'the brand name at text-8xl, faint behind the menu',
    },
    primaryCta: { label: 'اطلب الآن', href: '#order' },
    nav: [
      { label: 'القائمة', anchorId: 'menu' },
      { label: 'اطلب', anchorId: 'order' },
    ],
    sections: [
      { key: 'header', role: 'header', title: 'الترويسة', anchorId: 'top', purpose: 'العلامة.' },
      {
        key: 'hero',
        role: 'hero',
        title: 'قهوة تُحمّص كل صباح',
        anchorId: 'hero',
        purpose: 'ما هي المحمصة.',
        variant: 'split',
        images: [{ subject: 'cafe', aspect: 'landscape', alt: 'حبوب قهوة محمصة' }],
      },
      {
        key: 'menu',
        role: 'band',
        title: 'القائمة',
        anchorId: 'menu',
        purpose: 'المشروبات وأسعارها.',
        variant: 'menu',
      },
      {
        key: 'order',
        role: 'cta',
        title: 'اطلب',
        anchorId: 'order',
        purpose: 'طريقة واحدة للطلب.',
        kit: 'cta-split',
        slots: { title: 'حبوب طازجة تصلك في عمّان', cta: { label: 'اطلب الآن', href: '#order' } },
      },
      { key: 'footer', role: 'footer', title: 'التذييل', anchorId: 'footer', purpose: 'العنوان.' },
    ],
    facts: [{ key: 'phone', sample: SAMPLE_PHONE, section: 'footer' }],
    seo: { keyword: 'قهوة مختصة في عمّان', pageKind: 'home', businessType: 'CafeOrCoffeeShop' },
  };
}

const PHOTO = selectCatalogPhotos('cafe coffee')[0]?.url ?? 'https://images.unsplash.com/photo-1';

const KIT_BRIEF = 'ANSWER with ONE tool step';

function regionIdOf(request: string): string {
  return /REGION ID: (\S+)/u.exec(request)?.[1] ?? 'missing';
}

function anchorOf(request: string): string {
  return /ANCHOR:[^\n]*id="([^"]+)"/u.exec(request)?.[1] ?? 'missing';
}

/** A markup section: its heading and, when asked, a catalog photo with no alt and no loading hint. */
function markup(request: string, photo: boolean): AiPlan {
  const hero = request.includes('ROLE: HERO');
  const title = /SECTION \d+ OF \d+: ([^\n]+)/u.exec(request)?.[1] ?? 'قسم';
  const tag = hero ? 'h1' : 'h2';
  const img = photo ? `<img src='${PHOTO}' class='w-full rounded-xl'/>` : '';
  const action = hero ? `<a class='ck-btn' href='#order'>اطلب الآن</a>` : '';
  return {
    rationale: 'كتابة القسم',
    commands: [
      {
        command: 'setProp',
        args: {
          id: regionIdOf(request),
          key: 'tree',
          value: `<section id='${anchorOf(request)}' class='py-16'><${tag}>${title}</${tag}>${img}${action}</section>`,
        },
      },
    ],
  };
}

function heroKitStep(request: string): AiPlan {
  return {
    rationale: 'البطل من القالب',
    commands: [
      {
        command: 'tool',
        args: {
          name: 'kit.section',
          input: {
            id: regionIdOf(request),
            kit: 'hero-split',
            heading: 'h1',
            slots: {
              title: 'قهوة تُحمّص كل صباح',
              lead: 'محمصة صغيرة في عمّان.',
              cta: { label: 'اطلب الآن', href: '#order' },
              image: { subject: 'cafe', alt: 'حبوب قهوة محمصة' },
            },
          },
        },
      },
    ],
  };
}

interface Call {
  readonly request: string;
  readonly context: AssembledAiContext;
}

function provider(
  fill: (request: string) => AiPlan,
  repair?: (request: string, issues: readonly AiPlanValidationIssue[]) => AiPlan,
): { provider: AiPlanProvider; calls: Call[]; repairs: (readonly AiPlanValidationIssue[])[] } {
  const calls: Call[] = [];
  const repairs: (readonly AiPlanValidationIssue[])[] = [];
  return {
    calls,
    repairs,
    provider: {
      propose(request, context) {
        calls.push({ request, context });
        return Promise.resolve(fill(request));
      },
      ...(repair === undefined
        ? {}
        : {
            repair(request: string, _context: AssembledAiContext, _plan: AiPlan, issues) {
              repairs.push(issues);
              return Promise.resolve(repair(request, issues));
            },
          }),
      proposePagePlan() {
        return Promise.resolve({ pagePlan: cafe(), rationale: 'صفحة محمصة دافئة.' });
      },
    },
  };
}

function options(live: BuilderKernel, planProvider: AiPlanProvider, signal?: AbortSignal) {
  return {
    runId: 'kit-seo',
    clock: { now: () => 1 },
    kernel: live,
    provider: planProvider,
    request: 'صمم صفحة لمحمصة قهوة مختصة في عمّان',
    validationPorts: { clock: { now: () => 1 }, ids: seededIds('kit-seo-door') },
    skillRegistry: createCraftkitAiSkillRegistry(),
    target: 'replace' as const,
    fillConcurrency: 1,
    ...(signal === undefined ? {} : { signal }),
  };
}

function labels(live: BuilderKernel): readonly string[] {
  return live.transactions().map((transaction) => transaction.command);
}

interface Element {
  readonly tag?: string;
  readonly className?: string;
  readonly text?: string;
  readonly attributes?: Record<string, string>;
  readonly children?: Element[];
}

function elements(value: unknown): Element[] {
  const found: Element[] = [];
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const node = stack.pop();
    if (Array.isArray(node)) {
      stack.push(...(node as unknown[]));
      continue;
    }
    if (typeof node !== 'object' || node === null) continue;
    const record = node as Element & { kind?: unknown };
    if (record.kind === 'element') found.push(record);
    stack.push(...(Object.values(record) as unknown[]));
  }
  return found;
}

function regionTree(live: BuilderKernel, anchor: string): unknown {
  const document = live.getDocument();
  const ids = document.nodes[document.rootId]?.slots?.['default'] ?? [];
  const id = ids.find((node) =>
    elements(document.nodes[node]?.props['tree']).some(({ attributes }) => attributes?.['id'] === anchor),
  );
  return id === undefined ? undefined : document.nodes[id]?.props['tree'];
}

/*
  A whole build per test: under a full parallel run these outlive vitest's 5s
  default (they pass in ~10s per file alone). The budget only bounds a hang.
*/
vi.setConfig({ testTimeout: 20_000 });

describe('runAiBuild — kit-backed writers and the SEO pass', () => {
  it('lands a writer’s single kit.section step as its region, inside the target guard', async () => {
    const live = kernel();
    const script = provider((request) =>
      request.includes(KIT_BRIEF) && request.includes('ROLE: HERO')
        ? heroKitStep(request)
        : markup(request, false),
    );
    const result = await runAiBuild(options(live, script.provider));

    expect(result.outcome).toBe('completed');
    const hero = result.tasks.find(({ sectionKey }) => sectionKey === 'hero');
    expect(hero?.status).toBe('applied');
    expect(hero?.attempts).toBe(1);
    // The expanded setProp is the writer's own region's tree: nothing was dropped by the guard.
    expect(hero?.outOfScope).toBeUndefined();

    const tree = regionTree(live, 'hero');
    const all = elements(tree);
    expect(all.some(({ className }) => (className ?? '').split(/\s+/u).includes('ck-kit-hero-split'))).toBe(true);
    expect(all.filter(({ tag }) => tag === 'h1').map(({ text }) => text)).toEqual(['قهوة تُحمّص كل صباح']);

    // The kit writer's brief: the kit index and the section lane's tools, not the variant library.
    const heroCall = script.calls.find(({ request }) => request.includes('ROLE: HERO'));
    expect(heroCall?.request).toContain(KIT_BRIEF);
    expect(heroCall?.request).toContain('kit.section');
    expect(heroCall?.request).toContain('hero-split');
    expect(heroCall?.request).not.toContain('VARIANT:');
    expect(heroCall?.request).not.toContain('DESIGN CODE —');
    expect(heroCall?.request).not.toContain('SLOTS —');
    expect((heroCall?.context.skills ?? []).map(({ id }) => id)).not.toContain(
      'craftkit.section-variants',
    );

    // The cta the planner filled was written by the skeleton: no writer was asked for it.
    expect(script.calls.some(({ request }) => request.includes('SECTION 4 OF 5'))).toBe(false);
    expect(result.tasks.find(({ sectionKey }) => sectionKey === 'order')?.attempts).toBe(0);
  });

  it('falls back to the markup writer when the kit step is refused', async () => {
    const live = kernel();
    const script = provider((request) => {
      if (request.includes(KIT_BRIEF) && request.includes('SECTION 3 OF 5')) {
        // No title: menu-list cannot be filled, so the step never expands.
        return {
          rationale: 'القائمة',
          commands: [
            {
              command: 'tool',
              args: { name: 'kit.section', input: { id: regionIdOf(request), kit: 'menu-list', slots: {} } },
            },
          ],
        };
      }
      return markup(request, request.includes('SECTION 3 OF 5'));
    });
    const result = await runAiBuild(options(live, script.provider));

    const menu = result.tasks.find(({ sectionKey }) => sectionKey === 'menu');
    expect(menu?.status).toBe('applied');
    expect(menu?.attempts).toBe(2);
    const menuCalls = script.calls.filter(({ request }) => request.includes('SECTION 3 OF 5'));
    expect(menuCalls[0]?.request).toContain(KIT_BRIEF);
    // Attempt 2 is today's writer: the page's kit classes and the variant recipe, no tool answer.
    expect(menuCalls.at(-1)?.request).not.toContain(KIT_BRIEF);
    expect(menuCalls.at(-1)?.request).toContain("KIT — the page's classes");
    expect(elements(regionTree(live, 'menu')).some(({ tag }) => tag === 'img')).toBe(true);
  });

  it('ends with one "Assistant: SEO" transaction: alt, the hero’s fetchpriority, a clamped Arabic title', async () => {
    const live = kernel();
    // Markup everywhere, with photos: no alt, no loading hint — what the pass is for.
    const script = provider((request) =>
      markup(request, request.includes('ROLE: HERO') || request.includes('SECTION 3 OF 5')),
    );
    const result = await runAiBuild(options(live, script.provider));

    expect(result.outcome).toBe('completed');
    const history = labels(live);
    expect(history.at(-1)).toBe(SEO_LABEL);
    expect(history.filter((label) => label === SEO_LABEL)).toHaveLength(1);

    const heroImage = elements(regionTree(live, 'hero')).find(({ tag }) => tag === 'img');
    expect(heroImage?.attributes?.['fetchpriority']).toBe('high');
    expect(heroImage?.attributes?.['loading']).toBe('eager');
    expect(heroImage?.attributes?.['alt'] ?? '').not.toBe('');
    const menuImage = elements(regionTree(live, 'menu')).find(({ tag }) => tag === 'img');
    expect(menuImage?.attributes?.['alt'] ?? '').not.toBe('');
    expect(menuImage?.attributes?.['loading']).toBe('lazy');

    const root = live.getDocument().nodes['root'];
    const title = root?.props['title'];
    expect(typeof title).toBe('string');
    expect((title as string).length).toBeLessThan(LONG_TITLE.length);
    expect(title as string).toMatch(/^محمصة الهيل/u);
    // The plan's SEO rides on the root, with the facts' samples to keep out of structured data.
    expect(root?.props['seo']).toMatchObject({
      keyword: 'قهوة مختصة في عمّان',
      pageKind: 'home',
      samples: [SAMPLE_PHONE],
    });

    // The pass rewrote regions the sections landed, yet each section still reverts on its own.
    const menu = result.tasks.find((task) => task.title === 'القائمة' && task.landing !== undefined)
      ?? result.tasks.find((task) => task.attempts > 0 && task.landing !== undefined);
    expect(menu).toBeDefined();
    if (menu === undefined) return;
    expect(() =>
      revertBuildSection(live, menu, { clock: { now: () => 2 }, ids: seededIds('kit-seo-revert') }),
    ).not.toThrow();
    expect(labels(live).at(-1)).toMatch(/^Assistant: revert /u);
  });

  it('keeps the plan’s curated menu: the SEO pass never re-syncs it to every section (fix pass 2026-10-05)', async () => {
    const live = kernel();
    const script = provider((request) => markup(request, false));
    const curated = { ...cafe(), nav: [{ label: 'المشروبات', anchorId: 'menu' }] };
    const planned: AiPlanProvider = {
      ...script.provider,
      proposePagePlan: () => Promise.resolve({ pagePlan: curated, rationale: 'صفحة محمصة.' }),
    };

    const result = await runAiBuild(options(live, planned));

    expect(result.outcome).toBe('completed');
    const headerLinks = elements(regionTree(live, 'top'))
      .filter(({ tag, attributes }) => tag === 'a' && (attributes?.['href'] ?? '').startsWith('#'))
      .filter(({ className }) => !(className ?? '').includes('ck-btn'))
      .map(({ text, attributes }) => [text, attributes?.['href']]);
    expect(headerLinks).toContainEqual(['المشروبات', '#menu']);
    // The order section's title is no menu item the plan named.
    expect(headerLinks.some(([text]) => text === 'اطلب')).toBe(false);
  });

  it('lands a kit the planner filled even when its slots word a mustSay their own way', async () => {
    const live = kernel();
    const script = provider((request) => markup(request, false));
    const plan = cafe() as Record<string, unknown> & { sections: Record<string, unknown>[] };
    const worded = {
      ...plan,
      sections: plan.sections.map((section) =>
        section['key'] === 'order' ? { ...section, mustSay: ['توصيل مجاني لكل عمّان'] } : section,
      ),
    };
    const planned: AiPlanProvider = {
      ...script.provider,
      proposePagePlan: () => Promise.resolve({ pagePlan: worded, rationale: 'صفحة محمصة.' }),
    };

    const result = await runAiBuild(options(live, planned));

    expect(result.outcome).toBe('completed');
    // No writer was asked for the order section: the planner's slots are its contract.
    expect(script.calls.some(({ request }) => anchorOf(request) === 'order')).toBe(false);
    expect(result.tasks.find(({ sectionKey }) => sectionKey === 'order')?.attempts).toBe(0);
  });

  it('moves a writer’s palette classes onto the tokens before the check: no repair round', async () => {
    const live = kernel();
    const script = provider(
      (request) => {
        const plan = markup(request, false);
        if (!request.includes('ROLE: HERO')) return plan;
        const [step] = plan.commands;
        const args = step?.args as { value: string };
        return {
          ...plan,
          commands: [{ ...step!, args: { ...args, value: args.value.replace("class='py-16'", "class='py-16 bg-blue-50'") } }],
        };
      },
      (request) => markup(request, false),
    );
    const events: string[] = [];
    const result = await runAiBuild({
      ...options(live, script.provider),
      onEvent: (event) => {
        if (event.type === 'task.completed' && event.transactionId !== undefined) {
          events.push(`${event.label ?? ''}|${event.transactionId}`);
        }
      },
    });

    expect(result.outcome).toBe('completed');
    expect(script.repairs).toHaveLength(0);
    const hero = elements(regionTree(live, 'hero')).find(({ tag }) => tag === 'section');
    const heroClasses = hero?.className?.split(/\s+/u) ?? [];
    expect(heroClasses.some((name) => name === 'ck-ground' || name === 'ck-surface')).toBe(true);
    expect(hero?.className).not.toContain('bg-blue-50');
    // Every landed section says which transaction it landed in, and under which label.
    expect(events.length).toBeGreaterThanOrEqual(result.applied);
    expect(events.every((line) => /^Assistant: .+\|.+$/u.test(line))).toBe(true);
  });

  it('keeps a sample phone out of seo.site.business: the tool refuses it, and the repair is told why', async () => {
    const live = kernel();
    const script = provider(
      (request) => {
        if (request.includes(KIT_BRIEF) && request.includes('ROLE: HERO')) {
          return {
            rationale: 'بيانات النشاط',
            commands: [
              {
                command: 'tool',
                args: {
                  name: 'seo.business',
                  input: { type: 'CafeOrCoffeeShop', name: 'محمصة الهيل', telephone: SAMPLE_PHONE },
                },
              },
            ],
          };
        }
        return markup(request, false);
      },
      (request) => heroKitStep(request),
    );
    const result = await runAiBuild(options(live, script.provider));

    expect(result.outcome).toBe('completed');
    const messages = script.repairs.flat().map(({ message }) => message);
    expect(messages.some((message) => /sample value|seo\.business/u.test(message))).toBe(true);
    const seo = live.getDocument().nodes['root']?.props['seo'] as
      | { site?: { business?: Record<string, unknown> } }
      | undefined;
    // The plan's businessType still names the business (name only); the sample phone never lands.
    expect(seo?.site?.business?.['type']).toBe('CafeOrCoffeeShop');
    expect(JSON.stringify(seo)).not.toContain('"telephone"');
    expect(JSON.stringify(seo?.site)).not.toContain(SAMPLE_PHONE);
  });

  it('runs no SEO pass after a Stop', async () => {
    const live = kernel();
    const controller = new AbortController();
    const script = provider((request) => {
      if (request.includes('SECTION 3 OF 5')) controller.abort();
      return markup(request, true);
    });
    const result = await runAiBuild(options(live, script.provider, controller.signal));

    expect(result.outcome).toBe('signal');
    expect(labels(live)).not.toContain(SEO_LABEL);
  });
});
