import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  customCss,
  defineBlockSchema,
  emptyCustomCodeTree,
  type BlockRenderComponent,
  type BuilderDocument,
  type CustomCodeRoot,
  type JsonValue,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { prepareAiSkillsForGeneration } from '../plan/generate-plan';
import { AiPlanRejectedError } from '../plan/validate-plan';
import { createCraftkitAiSkillRegistry } from '../skills';
import { DIRECTION_DECK_ROWS, type DirectionDeckRow } from '../skills/direction-deck';
import type {
  AiPagePlanAttempt,
  AiPlan,
  AiPlanProvider,
  AssembledAiContext,
  PagePlanCandidate,
} from '../types';
import {
  PAGE_PLAN_PALETTE_HEX,
  PAGE_SKELETON_LABEL,
  runAiBuild,
  type AiBuildEvent,
  type AiBuildOwnEvent,
  type PagePlanIntent,
} from './index';
import { PAGE_KIT_CLASSES } from './page-plan/skeleton-from-plan';
import type { AiBuildPlanFallback } from './types';

/*
  The plan path, where it can give out and what it tells writers
  (orchestration wave 3, 2026-09-28).

  The wave-2 verifier found an automatic build that THREW AWAY a validated
  page plan when the door refused the code-written skeleton, and ran the
  ~25k-character model skeleton instead with no event and no field saying so
  (r2-silent-fallback2.mjs). The cause it points at was real: at 09:21 the
  skeleton wrote lg:flex-nowrap and lg:flex-initial, which the static
  vocabulary does not generate, so every automatic page-plan build would have
  quietly become a scaffold build. The pin below lands the code skeleton of
  every direction-deck row, Arabic and English, under every intent, through
  the door with the static vocabulary — and a fallback that still happens is
  said out loud.
*/

const NullRender: BlockRenderComponent = () => null;

/** A page root shaped like the product's (editor Page/schema.ts); `pageCssMax` shrinks its CSS room. */
function manifest(pageCssMax = 20_000): TrustedExtensionManifest {
  return {
    tier: 1,
    name: 'plan-path-fixture',
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
              pageCss: customCss(pageCssMax),
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

/** A region a person wrote into: a heading AND a line, so it is content, not a placeholder. */
function written(heading: string, line: string): JsonValue {
  return {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        children: [
          { kind: 'element', tag: 'h2', text: heading, children: [] },
          { kind: 'element', tag: 'p', text: line, children: [] },
        ],
      },
    ],
  };
}

function page(sections: readonly (readonly [string, string])[] = []): BuilderDocument {
  const nodes: BuilderDocument['nodes'] = {
    root: {
      id: 'root',
      type: 'page',
      props: { title: 'Home' },
      slots: { default: sections.map((_section, index) => `old-${String(index)}`) },
    },
  };
  sections.forEach(([heading, line], index) => {
    const id = `old-${String(index)}`;
    nodes[id] = { id, type: 'customCode', props: { label: heading, tree: written(heading, line) } };
  });
  return { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes };
}

function kernel(document: BuilderDocument = page(), pageCssMax?: number): BuilderKernel {
  return createBuilder({
    document,
    extensions: [manifest(pageCssMax)],
    ports: { clock: { now: () => 1 }, ids: seededIds('plan-path') },
  });
}

function ports() {
  return { clock: { now: () => 1 }, ids: seededIds('plan-path-door') };
}

const REQUEST = 'Build a landing page for my specialty coffee roastery in Amman, Northlight Coffee';

/** An English roastery page: hero, menu, order, footer. */
function roastery(overrides: Record<string, unknown> = {}): PagePlanCandidate {
  return {
    intent: 'replace',
    locale: { lang: 'en' },
    title: 'Northlight Coffee | Amman roastery',
    description: 'Specialty coffee roasted in Amman every morning.',
    tokens: {
      bg: 'stone-50',
      surface: 'white',
      ink: 'stone-900',
      muted: 'stone-600',
      accent: 'emerald-800',
      onAccent: 'white',
      border: '#e7e5e4',
      fontDisplay: { family: 'Archivo Black' },
      fontBody: { family: 'Archivo', weights: [400, 600] },
      radius: 'md',
      signature: 'one oversized origin name per section',
    },
    primaryCta: { label: 'Order beans', href: '#order' },
    nav: [{ label: 'Menu', anchorId: 'menu' }],
    sections: [
      {
        key: 'hero',
        role: 'hero',
        title: 'Roasted this morning',
        anchorId: 'hero',
        purpose: 'Say what the roastery is and invite the first order.',
        mustSay: ['Roasted in Amman'],
        variant: 'split',
        images: [{ subject: 'cafe', aspect: '16:9', alt: 'Freshly roasted coffee beans' }],
      },
      {
        key: 'menu',
        role: 'band',
        title: 'Our coffees',
        anchorId: 'menu',
        purpose: 'The coffees and their prices.',
        variant: 'menu',
      },
      {
        key: 'order',
        role: 'cta',
        title: 'Order today',
        anchorId: 'order',
        purpose: 'One clear way to order.',
      },
      {
        key: 'footer',
        role: 'footer',
        title: 'Footer',
        anchorId: 'footer',
        purpose: 'Address and hours.',
      },
    ],
    facts: [{ key: 'phone', sample: '+962 7 9000 0000', section: 'footer' }],
    ...overrides,
  };
}

/** What a writer that honours its contract writes, read back from the request it was given. */
function honestSection(request: string): CustomCodeRoot {
  const anchor = /ANCHOR:[^\n]*id="([^"]+)"/u.exec(request)?.[1] ?? 'missing';
  const title = /SECTION \d+ OF \d+: ([^\n]+)/u.exec(request)?.[1] ?? 'Section';
  const hero = request.includes('ROLE: HERO');
  const mustSay = [...(/MUST SAY: ([^\n]+)/u.exec(request)?.[1] ?? '').matchAll(/"([^"]+)"/gu)].map(
    (match) => match[1] ?? '',
  );
  const action = /PRIMARY ACTION: "([^"]+)" → (\S+)/u.exec(request);
  const cta = hero || request.includes('ROLE: CTA');
  return {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        attributes: { id: anchor },
        className: 'py-16',
        children: [
          { kind: 'element', tag: hero ? 'h1' : 'h2', text: title, children: [] },
          ...mustSay.map((line) => ({
            kind: 'element' as const,
            tag: 'p' as const,
            text: line,
            children: [],
          })),
          ...(cta && action !== null
            ? [
                {
                  kind: 'element' as const,
                  tag: 'a' as const,
                  className: 'ck-btn',
                  attributes: { href: action[2] ?? '#' },
                  text: action[1] ?? '',
                  children: [],
                },
              ]
            : []),
        ],
      },
    ],
  };
}

function regionIdOf(request: string): string {
  return /REGION ID: (\S+)/u.exec(request)?.[1] ?? 'missing';
}

interface Call {
  readonly request: string;
  readonly context: AssembledAiContext;
}

interface Scripted {
  readonly provider: AiPlanProvider;
  readonly planCalls: Call[];
  /** Section writers: every propose that names a region. */
  readonly fills: Call[];
  /** Model skeletons and ordinary runs: every propose that names none. */
  readonly scaffolds: Call[];
}

function scripted(
  options: {
    readonly pagePlan?: (attempt: AiPagePlanAttempt | undefined) => PagePlanCandidate;
    readonly noPagePlan?: boolean;
  } = {},
): Scripted {
  const planCalls: Call[] = [];
  const fills: Call[] = [];
  const scaffolds: Call[] = [];
  const provider: AiPlanProvider = {
    propose(request, context) {
      if (request.includes('REGION ID: ')) {
        fills.push({ request, context });
        return Promise.resolve({
          rationale: 'filled',
          commands: [
            {
              command: 'setProp',
              args: { id: regionIdOf(request), key: 'tree', value: honestSection(request) },
            },
          ],
        });
      }
      scaffolds.push({ request, context });
      const scaffold: AiPlan = {
        rationale: 'A roastery. 1 Hero · 2 Menu',
        commands: ['Hero', 'Menu'].map((title) => ({
          command: 'insertNode',
          args: {
            type: 'customCode',
            parentId: context.document.rootId,
            props: { label: title, tree: written(title, 'soon') },
          },
        })),
      };
      return Promise.resolve(scaffold);
    },
    ...(options.noPagePlan === true
      ? {}
      : {
          proposePagePlan(
            request: string,
            context: AssembledAiContext,
            live?: { attempt?: AiPagePlanAttempt },
          ) {
            planCalls.push({ request, context });
            return Promise.resolve({
              pagePlan: options.pagePlan?.(live?.attempt) ?? roastery(),
              rationale: 'A warm, bean-forward roastery page.',
            });
          },
        }),
  };
  return { provider, planCalls, fills, scaffolds };
}

function own(events: readonly AiBuildEvent[]): AiBuildOwnEvent[] {
  return events.filter(
    (event): event is AiBuildOwnEvent =>
      event.type.startsWith('build.') || event.type.startsWith('task.'),
  );
}

function fallbacksOf(events: readonly AiBuildEvent[]): readonly AiBuildPlanFallback[] {
  return own(events).flatMap((event) =>
    event.type === 'build.scaffolding' && 'fallback' in event ? [event.fallback] : [],
  );
}

function baseOptions(live: BuilderKernel, provider: AiPlanProvider, events?: AiBuildEvent[]) {
  return {
    runId: 'plan-path',
    clock: { now: () => 1 },
    kernel: live,
    provider,
    request: REQUEST,
    validationPorts: ports(),
    ...(events === undefined ? {} : { onEvent: (event: AiBuildEvent) => events.push(event) }),
  };
}

// ── A fallback is never silent ──────────────────────────────────────────────

describe('when the plan path gives out, the build says so — event and result', () => {
  /*
    The one door refusal of a code skeleton left on 2026-09-28, reproduced as
    it happens: an APPEND keeps the page's own CSS and adds the plan's block
    (2,700–2,801 characters across the 22 deck rows, Arabic and English), and
    the product page holds 20,000. Measured the same day: a page keeping
    17,500 characters of its own CSS takes the append, one keeping 18,000 is
    refused ("Too big: expected string to have <=20000 characters").
  */
  it('reports the door’s refusal of the code skeleton, and still builds with the model skeleton', async () => {
    const full = page([
      ['Old hero', 'Welcome'],
      ['Old band', 'Our story'],
    ]);
    (full.nodes['root'] as { props: Record<string, unknown> }).props['pageCss'] =
      '.ck-own{margin:0}'.repeat(1_059); // 18,003 characters of the page's own CSS
    const live = kernel(full);
    const events: AiBuildEvent[] = [];
    const appended = roastery();
    const script = scripted({
      pagePlan: () => ({
        ...appended,
        intent: 'append',
        nav: [],
        facts: [],
        sections: (appended['sections'] as Record<string, unknown>[])
          .filter(({ role }) => role === 'band' || role === 'cta')
          .map((section) => ({ ...section, key: `more-${String(section['key'])}` })),
        primaryCta: { label: 'Order beans', href: '#order' },
      }),
    });

    const result = await runAiBuild({
      ...baseOptions(live, script.provider, events),
      target: 'append',
    });

    expect(script.planCalls).toHaveLength(1);
    expect(script.scaffolds).toHaveLength(1);
    expect(result.pagePlan).toBeUndefined();
    expect(result.scaffold?.status).toBe('applied');
    expect(result.outcome).toBe('completed');
    expect(result.planFallback?.stage).toBe('skeleton');
    expect(result.planFallback?.error.code).toBe('plan-rejected');
    expect(result.planFallback?.issues.some((issue) => issue.includes('pageCss'))).toBe(true);
    // The event carries the same reasons, on the one event that means "laying the skeleton".
    expect(fallbacksOf(events)).toEqual([result.planFallback]);
    expect(own(events).filter(({ type }) => type === 'build.scaffolding')).toHaveLength(2);
  });

  it('reports why T1 gave out when its plan is refused twice', async () => {
    const live = kernel();
    const events: AiBuildEvent[] = [];
    const oneSection = roastery();
    const script = scripted({
      // A plan that can never pass: one section.
      pagePlan: () => ({
        ...oneSection,
        sections: [(oneSection['sections'] as unknown[])[0]],
      }),
    });

    const result = await runAiBuild(baseOptions(live, script.provider, events));

    expect(script.planCalls).toHaveLength(2);
    expect(result.pagePlan).toBeUndefined();
    expect(result.planFallback?.stage).toBe('plan');
    expect(result.planFallback?.error.code).toBe('plan-rejected');
    // The validator's own words, path first: what the repair round was told and could not fix.
    expect(result.planFallback?.issues.some((issue) => /^sections\b/u.test(issue))).toBe(true);
    expect(fallbacksOf(events)).toEqual([result.planFallback]);
  });

  it('says nothing of a fallback when the provider cannot plan a page at all', async () => {
    const events: AiBuildEvent[] = [];
    const script = scripted({ noPagePlan: true });

    const result = await runAiBuild(baseOptions(kernel(), script.provider, events));

    expect(result.planFallback).toBeUndefined();
    expect(fallbacksOf(events)).toEqual([]);
    expect(own(events).filter(({ type }) => type === 'build.scaffolding')).toHaveLength(1);
  });

  it('never swaps an APPROVED plan for another build: its skeleton’s refusal is thrown, nothing written', async () => {
    const live = kernel(page(), 200);
    const script = scripted();

    await expect(
      runAiBuild({
        ...baseOptions(live, script.provider),
        target: 'replace',
        onPlanned: () => 'build',
      }),
    ).rejects.toBeInstanceOf(AiPlanRejectedError);
    expect(live.transactions()).toHaveLength(0);
    expect(script.scaffolds).toHaveLength(0);
  });
});

// ── The door accepts the code skeleton of every deck row, under every intent ──

const slug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');

/**
 * The plan T1 writes from a deck row, copied as the planner is told to: the
 * row's palette by role, its Arabic or Latin pair, its sections and variants.
 *
 * A shade the plan palette cannot resolve is left out and derived by the
 * validator: earlier on 2026-09-28 the wedding row's accentInk yellow-800
 * and the auto row's red-400 were missing from PAGE_PLAN_PALETTE_HEX (added
 * since by the page-plan owner). Such a refusal is the validator's and costs
 * T1 a repair round — the door never sees it — so this pin stays on what the
 * door does.
 */
function fromRow(
  row: DirectionDeckRow,
  lang: 'ar' | 'en',
  intent: PagePlanIntent,
  index: number,
): PagePlanCandidate {
  const ar = lang === 'ar';
  const [display, body] = ar ? row.arabic : row.latin;
  const appending = intent === 'append';
  const face = ({ family, weights }: { family: string; weights: readonly number[] }) =>
    weights.length === 0 ? { family } : { family, weights: [...weights] };
  const sections: Record<string, unknown>[] = [];
  if (!appending) {
    sections.push({
      key: 'header',
      role: 'header',
      title: ar ? 'الترويسة' : 'Header',
      anchorId: 'top',
      purpose: ar ? 'الشعار والتنقل.' : 'Brand and navigation.',
    });
  }
  row.sections.forEach(([name, variant], position) => {
    const hero = !appending && position === 0;
    const key = `${appending ? 'more-' : ''}${slug(name)}`;
    const subject = row.photos[0];
    sections.push({
      key,
      role: hero ? 'hero' : 'band',
      title: ar ? `القسم ${String(position + 1)}` : name,
      anchorId: key,
      purpose: ar ? 'ما يقوله هذا القسم بجملة.' : 'What this section says, in a sentence.',
      mustSay: hero ? [ar ? 'منذ ٢٠١٠' : 'Since 2010'] : [],
      variant,
      ...(hero && subject !== undefined
        ? { images: [{ subject, aspect: '16:9', alt: ar ? 'صورة المكان' : 'The place' }] }
        : {}),
    });
  });
  // An appended plan's anchors are its own: the page it lands on already has a "closing".
  const closing = appending ? 'more-closing' : 'closing';
  sections.push({
    key: closing,
    role: 'cta',
    title: ar ? 'احجز الآن' : 'Book today',
    anchorId: closing,
    purpose: ar ? 'طريقة واحدة للحجز.' : 'One clear way to book.',
  });
  if (!appending) {
    sections.push({
      key: 'footer',
      role: 'footer',
      title: ar ? 'التذييل' : 'Footer',
      anchorId: 'footer',
      purpose: ar ? 'العنوان والساعات.' : 'Address and hours.',
      mustSay: [ar ? 'عمّان — شارع الرينبو' : '12 King St, Leeds'],
    });
  }
  const palette = row.palette;
  const bands = sections.filter(({ role }) => role === 'band').slice(0, 4);
  return {
    intent,
    locale: { lang },
    title: ar ? `علامة ${row.id} | شعار قصير` : `Brand ${row.id} | A short tagline`,
    description: ar ? 'وصف قصير للصفحة.' : 'A short description of the page.',
    tokens: {
      bg: palette.ground,
      surface: palette.card,
      ink: palette.ink,
      muted: palette.muted,
      accent: palette.accent,
      onAccent: palette.onAccent,
      ...(palette.accentInk in PAGE_PLAN_PALETTE_HEX ? { accentInk: palette.accentInk } : {}),
      border: '#e7e5e4',
      fontDisplay: face(display),
      fontBody: face(body),
      radius: (['none', 'md', 'xl', 'full'] as const)[index % 4],
      signature: row.signature,
      deckRowId: row.id,
    },
    primaryCta: { label: ar ? 'احجز الآن' : 'Book now', href: `#${closing}` },
    nav: appending
      ? []
      : bands.map(({ title, anchorId }) => ({ label: String(title), anchorId: String(anchorId) })),
    sections,
    facts: appending
      ? []
      : [
          { key: 'phone', sample: ar ? '+٩٦٢ ٧ ٩٠٠٠ ٠٠٠٠' : '+44 113 000 0000', section: 'footer' },
          { key: 'email', sample: 'hello@example.com', section: 'footer' },
        ],
  };
}

/**
 * One automatic build of one plan. The budget is spent before the first writer
 * starts, so the build stops at its sections: what is pinned is the skeleton.
 */
async function laid(
  live: BuilderKernel,
  candidate: PagePlanCandidate,
  target: PagePlanIntent,
): Promise<{ readonly fellBack?: AiBuildPlanFallback; readonly skeleton: boolean }> {
  const script = scripted({ pagePlan: () => candidate });
  const before = live.transactions().length;
  const result = await runAiBuild({
    ...baseOptions(live, script.provider),
    target,
    buildBudgetMs: 0,
  });
  return {
    ...(result.planFallback === undefined ? {} : { fellBack: result.planFallback }),
    skeleton:
      result.pagePlan !== undefined &&
      script.scaffolds.length === 0 &&
      live
        .transactions()
        .slice(before)
        .some(({ command }) => command === PAGE_SKELETON_LABEL),
  };
}

describe('the door accepts the code skeleton of every deck row, Arabic and English, under every intent', () => {
  it.each(['ar', 'en'] as const)(
    '%s: new-page on an empty page, replace over a page with content, append to a page a plan built',
    async (lang) => {
      const refused: string[] = [];
      for (const [index, row] of DIRECTION_DECK_ROWS.entries()) {
        const fresh = await laid(kernel(), fromRow(row, lang, 'new-page', index), 'new-page');
        const over = await laid(
          kernel(
            page([
              ['Old hero', 'Welcome'],
              ['Old band', 'Our story'],
            ]),
          ),
          fromRow(row, lang, 'replace', index),
          'replace',
        );
        // An append lands on a page an earlier plan built: before its footer, keeping its CSS.
        const built = kernel();
        await laid(built, fromRow(row, lang, 'replace', index + 1), 'replace');
        const appended = await laid(built, fromRow(row, lang, 'append', index), 'append');
        for (const [intent, outcome] of [
          ['new-page', fresh],
          ['replace', over],
          ['append', appended],
        ] as const) {
          if (!outcome.skeleton) {
            refused.push(`${row.id}/${intent}: ${outcome.fellBack?.issues.join(' ') ?? 'no plan'}`);
          }
        }
      }
      expect(refused).toEqual([]);
    },
    // 22 rows × 4 builds through the door's dry run and the kernel: ~6–10 s on this machine.
    120_000,
  );
});

// ── What writers are told ─────────────────────────────────────────────────────

function fillFor(script: Scripted, position: number, total: number): Call | undefined {
  return script.fills.find(({ request }) =>
    request.includes(`SECTION ${String(position)} OF ${String(total)}`),
  );
}

/**
 * The plan without its variants, so no section is kit-backed (2026-09-30): the
 * markup writer's contract is what these tests hold, and a kit writer answers
 * one tool step with none of it (run-build.kit-seo.test.ts).
 */
function markupOnly(): Record<string, unknown> {
  const plan = roastery();
  const sections = (plan['sections'] as Record<string, unknown>[]).map((section) => {
    const copy = { ...section };
    delete copy['variant'];
    return copy;
  });
  return { ...plan, sections };
}

describe('the section contract — colour, design code and the person’s own photos', () => {
  it('colours through the kit and var(--ck-…), accent text through accent ink — never an arbitrary class', async () => {
    const script = scripted({ pagePlan: () => markupOnly() });
    await runAiBuild({ ...baseOptions(kernel(), script.provider), target: 'replace' });

    const hero = fillFor(script, 1, 4)?.request ?? '';
    for (const { name } of PAGE_KIT_CLASSES) expect(hero).toContain(name);
    // emerald-800 is the plan's accent, and reads as text on stone-50 and white: its own ink.
    expect(hero).toContain('ck-accent-ink (#065f46)');
    expect(hero).toContain('SLOTS — ');
    expect(hero).toContain('text-{accent-ink} → ck-accent-ink');
    expect(hero).toMatch(/COLOUR — only through the kit[^\n]*Never a hex/u);
    // The stale advice the static vocabulary refused (skeleton-checker F9) is gone.
    expect(hero).not.toContain('or arbitrary classes such as');
  });

  it('hands every markup writer region css as a first-class tool, inside the door’s refusal list', async () => {
    const script = scripted({ pagePlan: () => markupOnly() });
    await runAiBuild({ ...baseOptions(kernel(), script.provider), target: 'replace' });

    for (const fill of script.fills) {
      const line = /^DESIGN CODE — [^\n]*$/mu.exec(fill.request)?.[0] ?? '';
      expect(line).toContain('first-class tool');
      expect(line).toContain('var(--ck-…)');
      expect(line).toContain('@import');
    }
  });

  it('hands the hero the person’s extension-less photo addresses — never a page link', async () => {
    const unsplash = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1200';
    const pexels =
      'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=1600';
    const said = 'https://example.com/assets/shop-front';
    const script = scripted();

    await runAiBuild({
      ...baseOptions(kernel(), script.provider),
      request: `${REQUEST}. صورة المحل: ${said} — and for the hero ${unsplash}، or ${pexels}. Order on https://wa.me/962790000000, see https://instagram.com/northlight and https://example.com/menu`,
      target: 'replace',
    });

    const ownLine = /^THEIR OWN PHOTOS[^\n]*$/mu.exec(fillFor(script, 1, 4)?.request ?? '')?.[0];
    expect(ownLine).toBeDefined();
    const given = (ownLine ?? '').slice((ownLine ?? '').indexOf(':') + 2).split(' · ');
    // Exactly as typed — the Arabic comma and the full stop after them are not theirs.
    expect(given).toEqual([said, unsplash, pexels]);
  });

  it('shows the person’s photo in a hero the plan made type-led — and in no type-led band', async () => {
    const unsplash = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1200';
    const plan = roastery();
    const [hero, ...rest] = plan['sections'] as Record<string, unknown>[];
    const typeLedHero = { ...hero };
    delete typeLedHero['images'];
    const script = scripted({ pagePlan: () => ({ ...plan, sections: [typeLedHero, ...rest] }) });

    await runAiBuild({
      ...baseOptions(kernel(), script.provider),
      request: `${REQUEST}. Our photo: ${unsplash}`,
      target: 'replace',
    });

    const heroRequest = fillFor(script, 1, 4)?.request ?? '';
    expect(heroRequest).toContain('IMAGES: the person’s own');
    expect(heroRequest).toContain(
      `THEIR OWN PHOTOS (the person gave these addresses; use them exactly as written): ${unsplash}`,
    );
    const menu = fillFor(script, 2, 4)?.request ?? '';
    expect(menu).toContain('IMAGES: none');
    expect(menu).not.toContain(unsplash);
  });
});

// ── Each step names its own intent ────────────────────────────────────────────

describe('each build step names its own intent for the skill gate', () => {
  /*
    Generation now routes a request against the page it is about. The
    scaffold carries the person's BRIEF, and on a page with content a bare
    subject routes as an edit there — so the build names the scaffold's
    intent itself, or the trade's page skill would be gated out of the one
    step that decides the page.
  */
  it('keeps the trade’s page skill on the model skeleton of a page that has content', async () => {
    const brief = 'حلويات شرقية وكنافة';
    const live = kernel(
      page([
        ['من نحن', 'مخبز عائلي منذ ١٩٩٠'],
        ['تواصل', 'عمّان'],
      ]),
    );
    const registry = createCraftkitAiSkillRegistry();
    // The premise: routed on this page, the brief alone is an edit, and loads no page skill.
    const asEdit = prepareAiSkillsForGeneration({
      kernel: live,
      provider: scripted().provider,
      request: brief,
      validationPorts: ports(),
      skillRegistry: registry,
    });
    expect((asEdit?.activations ?? []).map(({ id }) => id)).not.toContain('craftkit.menu-page');

    const events: AiBuildEvent[] = [];
    const script = scripted({ noPagePlan: true });
    await runAiBuild({
      ...baseOptions(live, script.provider, events),
      request: brief,
      skillRegistry: registry,
    });

    // Matched on the skeleton step: active, or left out only for the token budget — never gated out.
    const resolved = events.find(
      (event) => event.runId === 'plan-path/scaffold' && event.type === 'skills.resolved',
    );
    if (resolved?.type !== 'skills.resolved') throw new Error('the scaffold resolved no skills');
    const matched = [
      ...resolved.activations.map(({ id }) => id),
      ...resolved.omitted.filter(({ code }) => code === 'token-budget').map(({ id }) => id),
    ];
    expect(matched).toContain('craftkit.menu-page');
  });
});
