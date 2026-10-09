import { describe, expect, it, vi } from 'vitest';
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
  type ClockPort,
  type CustomCodeRoot,
  type JsonValue,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { PHOTO_CATALOG_FRAGMENT_TITLE } from '../context';
import { createCraftkitAiSkillRegistry } from '../skills';
import type {
  AiChatTurn,
  AiPagePlanAttempt,
  AiPlan,
  AiPlanProvider,
  AiPlanValidationIssue,
  AssembledAiContext,
  PagePlanCandidate,
} from '../types';
import {
  PAGE_SKELETON_LABEL,
  fillConcurrencyFor,
  runAiBuild,
  validatePagePlan,
  type AiBuildEvent,
  type AiBuildOwnEvent,
  type PagePlan,
} from './index';
// From its module: the barrel's page-plan/plan-ai-page.ts is still another owner's stub.
import { planAiPage } from './plan-page';

/*
  The page build from a structured plan (agent-audit §3.1, 2026-09-28):
  T1 one model call answers with a PagePlan, T2 code lays the skeleton from
  it, each writer gets its SECTION CONTRACT instead of the whole request and
  conversation, and every section is checked before it lands. Measured before
  this: the model-written skeleton wrote ~25k characters and was the slowest
  step of every build; each writer's prompt carried the whole request, the
  history and ~10.7k characters of page-level skills it was told to ignore.
*/

const NullRender: BlockRenderComponent = () => null;

/** A page root shaped like the product's (editor/src/components/Page/schema.ts). */
function manifest(): TrustedExtensionManifest {
  return {
    tier: 1,
    name: 'page-plan-build-fixture',
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
              pageCss: customCss(20_000),
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

function region(text: string): CustomCodeRoot {
  return {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        children: [{ kind: 'element', tag: 'h2', text, children: [] }],
      },
    ],
  };
}

function page(children: readonly string[] = []): BuilderDocument {
  const nodes: BuilderDocument['nodes'] = {
    root: { id: 'root', type: 'page', props: { title: 'Home' }, slots: { default: [...children] } },
  };
  for (const id of children) {
    const tree = JSON.parse(JSON.stringify(region(`Old ${id}`))) as JsonValue;
    nodes[id] = { id, type: 'customCode', props: { label: `Old ${id}`, tree } };
  }
  return { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes };
}

function kernel(document: BuilderDocument = page()): BuilderKernel {
  return createBuilder({
    document,
    extensions: [manifest()],
    ports: { clock: { now: () => 1 }, ids: seededIds('plan-build') },
  });
}

function ports() {
  return { clock: { now: () => 1 }, ids: seededIds('plan-build-door') };
}

/** A clock the test moves: the budget is read from it. */
function movableClock(): ClockPort & { advance: (ms: number) => void } {
  let now = 1_000;
  return {
    now: () => now,
    advance: (ms) => {
      now += ms;
    },
  };
}

const REQUEST = 'Build a landing page for my specialty coffee roastery in Amman, Northlight Coffee';
const HISTORY: readonly AiChatTurn[] = [
  { role: 'user', text: 'hello there, I run a roastery' },
  { role: 'assistant', text: 'Happy to help.' },
];

/** An English roastery page: hero, menu, order, footer — the kind of plan T1 answers with. */
function roastery(): Record<string, unknown> {
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
      { key: 'header', role: 'header', title: 'Header', anchorId: 'top', purpose: 'Brand and menu.' },
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
        mustNotRepeat: ['Roasted in Amman'],
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
    facts: [
      { key: 'price-espresso', sample: '1.5 JOD', section: 'menu' },
      { key: 'phone', sample: '+962 7 9646 1275', section: 'footer' },
    ],
  };
}

function validated(candidate: PagePlanCandidate): PagePlan {
  const result = validatePagePlan(candidate);
  if (!result.ok) throw new Error(result.issues.map(({ message }) => message).join('\n'));
  return result.plan;
}

interface FillCall {
  readonly request: string;
  readonly context: AssembledAiContext;
  readonly history: readonly AiChatTurn[] | undefined;
  readonly signal: AbortSignal | undefined;
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
  // The hero and the closing call both carry the page's one action, in its exact words.
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

interface Scripted {
  readonly provider: AiPlanProvider;
  readonly planCalls: {
    request: string;
    context: AssembledAiContext;
    attempt?: AiPagePlanAttempt;
  }[];
  readonly fills: FillCall[];
  readonly repairs: { request: string; issues: readonly AiPlanValidationIssue[] }[];
}

function scripted(
  options: {
    readonly pagePlan?: (attempt: AiPagePlanAttempt | undefined) => PagePlanCandidate;
    readonly fill?: (call: FillCall) => Promise<AiPlan> | AiPlan;
    readonly repair?: (request: string, plan: AiPlan) => AiPlan;
    readonly noPagePlan?: boolean;
  } = {},
): Scripted {
  const planCalls: Scripted['planCalls'] = [];
  const fills: FillCall[] = [];
  const repairs: Scripted['repairs'] = [];
  const provider: AiPlanProvider = {
    async propose(request, context, live) {
      const call: FillCall = { request, context, history: live?.history, signal: live?.signal };
      fills.push(call);
      if (options.fill !== undefined) return options.fill(call);
      return {
        rationale: 'filled',
        commands: [
          {
            command: 'setProp',
            args: { id: regionIdOf(request), key: 'tree', value: honestSection(request) },
          },
        ],
      };
    },
    ...(options.repair === undefined
      ? {}
      : {
          repair: (
            request: string,
            _context: AssembledAiContext,
            plan: AiPlan,
            issues: readonly AiPlanValidationIssue[],
          ) => {
            repairs.push({ request, issues });
            return Promise.resolve(options.repair?.(request, plan) ?? plan);
          },
        }),
    ...(options.noPagePlan === true
      ? {}
      : {
          proposePagePlan(
            request: string,
            context: AssembledAiContext,
            live?: { attempt?: AiPagePlanAttempt },
          ) {
            planCalls.push({
              request,
              context,
              ...(live?.attempt === undefined ? {} : { attempt: live.attempt }),
            });
            return Promise.resolve({
              pagePlan: options.pagePlan?.(live?.attempt) ?? roastery(),
              rationale: 'A warm, bean-forward roastery page.',
            });
          },
        }),
  };
  return { provider, planCalls, fills, repairs };
}

function labels(live: BuilderKernel): readonly string[] {
  return live.transactions().map((transaction) => transaction.command);
}

function childLabels(live: BuilderKernel): readonly unknown[] {
  const document = live.getDocument();
  return (document.nodes[document.rootId]?.slots?.['default'] ?? []).map(
    (id) => document.nodes[id]?.props['label'],
  );
}

function own(events: readonly AiBuildEvent[]): AiBuildOwnEvent[] {
  return events.filter(
    (event): event is AiBuildOwnEvent =>
      event.type.startsWith('build.') || event.type.startsWith('task.'),
  );
}

function baseOptions(live: BuilderKernel, provider: AiPlanProvider, events?: AiBuildEvent[]) {
  return {
    runId: 'plan-build',
    clock: { now: () => 1 },
    kernel: live,
    provider,
    request: REQUEST,
    history: HISTORY,
    validationPorts: ports(),
    skillRegistry: createCraftkitAiSkillRegistry(),
    ...(events === undefined ? {} : { onEvent: (event: AiBuildEvent) => events.push(event) }),
  };
}

/*
  A whole build per test: under a full parallel run these outlive vitest's 5s
  default (they pass in ~10s per file alone). The budget only bounds a hang.
*/
vi.setConfig({ testTimeout: 20_000 });

describe('runAiBuild from a page plan — T1 plans, code lays the skeleton, writers fill contracts', () => {
  it('asks the model once for the plan, never for a skeleton, and lands the code skeleton as one labelled transaction', async () => {
    const live = kernel();
    const script = scripted();

    const result = await runAiBuild({ ...baseOptions(live, script.provider), target: 'replace' });

    expect(script.planCalls).toHaveLength(1);
    // No model call writes the skeleton: every propose is a section writer's.
    expect(script.fills.every(({ request }) => request.includes('REGION ID: '))).toBe(true);
    expect(labels(live)[0]).toBe(PAGE_SKELETON_LABEL);
    expect(childLabels(live)).toEqual([
      'Header',
      'Roasted this morning',
      'Our coffees',
      'Order today',
      'Footer',
    ]);
    expect(result.outcome).toBe('completed');
    expect(result.scaffold).toBeUndefined();
    expect(result.pagePlan?.sections.map(({ key }) => key)).toEqual([
      'header',
      'hero',
      'menu',
      'order',
      'footer',
    ]);
    // Every section is accounted for, applied, in page order.
    expect(result.tasks.map(({ title, status }) => [title, status])).toEqual([
      ['Header', 'applied'],
      ['Roasted this morning', 'applied'],
      ['Our coffees', 'applied'],
      ['Order today', 'applied'],
      ['Footer', 'applied'],
    ]);
    // Each written section landed in its own labelled transaction; a region the skeleton
    // wrote in full (a footer from the plan) needs no writer at all.
    const written = result.tasks.filter(({ attempts }) => attempts > 0);
    expect(script.fills).toHaveLength(written.length);
    for (const task of written) {
      expect(labels(live)).toContain(task.landing?.label);
      expect(task.landing?.label).toMatch(/^Assistant: \d\/5 — /u);
    }
    expect(result.unfilled).toEqual([]);
    // A writer that honours its contract passes the checker as written: no repair round.
    for (const task of written) expect(task.check).toEqual({ issues: [], repaired: false });
  });

  it('hands each writer its CONTRACT and the page tokens — not the request, not the conversation', async () => {
    const live = kernel();
    const script = scripted();
    await runAiBuild({ ...baseOptions(live, script.provider), target: 'replace' });

    const hero = script.fills.find(({ request }) => request.includes('SECTION 2 OF 5'));
    const menu = script.fills.find(({ request }) => request.includes('SECTION 3 OF 5'));
    if (hero === undefined || menu === undefined) throw new Error('missing fills');

    expect(hero.request).toContain('PURPOSE: Say what the roastery is and invite the first order.');
    expect(hero.request).toContain('MUST SAY: "Roasted in Amman"');
    expect(hero.request).toContain('id="hero"');
    // 2026-09-30: a section with a variant is kit-backed — its default kit, one tool step.
    expect(hero.request).toContain('"kit":"hero-split"');
    expect(hero.request).toContain('ROLE: HERO');
    expect(hero.request).toContain('PRIMARY ACTION: "Order beans" → #order');
    // A markup writer (no variant, so no kit) still gets the page's tokens.
    const order = script.fills.find(({ request }) => request.includes('SECTION 4 OF 5'));
    expect(order?.request).toContain('--ck-accent #065f46');
    expect(menu.request).toContain('MUST NOT REPEAT');
    expect(menu.request).toContain('"Roasted in Amman"');
    // The facts ledger reaches the section that shows them.
    expect(menu.request).toContain('price-espresso: 1.5 JOD');

    for (const fill of script.fills) {
      // The whole request is not repeated to every writer (P1-10, P2-20)...
      expect(fill.request).not.toContain(REQUEST);
      // ...nor the conversation.
      expect(fill.history).toBeUndefined();
      // Explicit skills only: page-level archetypes stay with the planner.
      const skills = (fill.context.skills ?? []).map(({ id }) => id);
      expect(skills).toContain('craftkit.build-fill');
      expect(skills).not.toContain('craftkit.page-composition');
    }
  });

  it('gives the photo list to a section whose contract names images, and no photos to a type-led one', async () => {
    const live = kernel();
    const script = scripted();
    await runAiBuild({ ...baseOptions(live, script.provider), target: 'replace' });

    const photosOf = (call: FillCall | undefined) =>
      call?.context.fragments.filter(({ title }) => title === PHOTO_CATALOG_FRAGMENT_TITLE) ?? [];
    const hero = script.fills.find(({ request }) => request.includes('SECTION 2 OF 5'));
    const menu = script.fills.find(({ request }) => request.includes('SECTION 3 OF 5'));

    expect(photosOf(hero)).toHaveLength(1);
    const offered = JSON.parse(photosOf(hero)[0]?.body ?? '{}') as {
      photos: { subject: string }[];
    };
    expect(offered.photos.length).toBeGreaterThan(0);
    expect(offered.photos.every(({ subject }) => subject === 'cafe')).toBe(true);
    expect(photosOf(menu)).toHaveLength(0);
    expect(menu?.request).toContain('IMAGES: none');
  });

  it('carries the plan’s facts onto each section’s report, and returns the plan it built', async () => {
    const live = kernel();
    const script = scripted();
    const result = await runAiBuild({ ...baseOptions(live, script.provider), target: 'replace' });

    const menu = result.tasks.find(({ sectionKey }) => sectionKey === 'menu');
    const footer = result.tasks.find(({ sectionKey }) => sectionKey === 'footer');
    expect(menu?.facts).toEqual([{ key: 'price-espresso', sample: '1.5 JOD' }]);
    expect(footer?.facts).toEqual([{ key: 'phone', sample: '+962 7 9646 1275' }]);
    expect(result.tasks.find(({ sectionKey }) => sectionKey === 'hero')?.facts).toBeUndefined();
  });

  it('says how many writers run at once in build.planned (E1)', async () => {
    const live = kernel();
    const events: AiBuildEvent[] = [];
    const script = scripted();
    await runAiBuild({ ...baseOptions(live, script.provider, events), target: 'replace' });

    const planned = own(events).find((event) => event.type === 'build.planned');
    if (planned?.type !== 'build.planned') throw new Error('no build.planned');
    expect(planned.writers).toBe(fillConcurrencyFor(script.fills.length, undefined));
    expect(planned.tasks.map(({ title }) => title)).toEqual([
      'Header',
      'Roasted this morning',
      'Our coffees',
      'Order today',
      'Footer',
    ]);
  });

  it('reports the direction as plain prose, with the tokens as data on build.planned (§4.0)', async () => {
    const live = kernel();
    const events: AiBuildEvent[] = [];
    const script = scripted();
    const result = await runAiBuild({
      ...baseOptions(live, script.provider, events),
      target: 'replace',
    });

    const planned = own(events).find((event) => event.type === 'build.planned');
    if (planned?.type !== 'build.planned') throw new Error('no build.planned');
    expect(planned.direction).toBe('A warm, bean-forward roastery page.');
    expect(result.direction).toBe('A warm, bean-forward roastery page.');
    // No faces, no numbered sections, no variant tags, no middle dots.
    expect(planned.direction).not.toMatch(/ — |·|\[/u);
    expect(planned.tokens?.signature).toBe('one oversized origin name per section');
    expect(planned.tokens?.fontDisplay.family).toBe(result.pagePlan?.tokens.fontDisplay.family);
  });

  it('describes a GIVEN plan by its own description, never the internal signature', async () => {
    const live = kernel();
    const script = scripted();
    const given = validated({ ...roastery(), intent: 'new-page' });

    const result = await runAiBuild({ ...baseOptions(live, script.provider), pagePlan: given });

    expect(result.direction).toBe('Specialty coffee roasted in Amman every morning.');
  });

  it('replaces the page’s content in the SAME transaction as the skeleton, so one undo restores it', async () => {
    const live = kernel(page(['old-hero', 'old-band']));
    const script = scripted();
    const result = await runAiBuild({ ...baseOptions(live, script.provider), target: 'replace' });

    expect(childLabels(live)).toEqual([
      'Header',
      'Roasted this morning',
      'Our coffees',
      'Order today',
      'Footer',
    ]);
    // Undo the SEO pass (2026-09-30), every section, then the skeleton: the old page comes back whole.
    expect(labels(live).at(-1)).toBe('Assistant: SEO');
    live.undo();
    const sections = result.tasks.filter(({ attempts }) => attempts > 0).length;
    for (let undo = 0; undo < sections; undo += 1) live.undo();
    live.undo();
    expect(childLabels(live)).toEqual(['Old old-hero', 'Old old-band']);
  });

  it('builds the plan it is GIVEN verbatim — no planning call', async () => {
    const live = kernel();
    const script = scripted();
    const given = validated({ ...roastery(), intent: 'new-page' });

    const result = await runAiBuild({ ...baseOptions(live, script.provider), pagePlan: given });

    expect(script.planCalls).toHaveLength(0);
    expect(result.pagePlan).toEqual(given);
    expect(childLabels(live)).toEqual([
      'Header',
      'Roasted this morning',
      'Our coffees',
      'Order today',
      'Footer',
    ]);
  });

  it('falls back to the skeleton run when the plan is refused twice — and still builds', async () => {
    const live = kernel();
    const titles = ['Hero', 'Menu'];
    const script = scripted({
      // A plan that can never pass: one section.
      pagePlan: () => ({ ...roastery(), sections: [(roastery()['sections'] as unknown[])[0]] }),
      fill: (call) => {
        if (call.request.includes('REGION ID: ')) {
          return {
            rationale: 'filled',
            commands: [
              {
                command: 'setProp',
                args: { id: regionIdOf(call.request), key: 'tree', value: region('written') },
              },
            ],
          };
        }
        return {
          rationale: 'A roastery. 1 Hero · 2 Menu',
          commands: titles.map((title) => ({
            command: 'insertNode',
            args: {
              type: 'customCode',
              parentId: 'root',
              props: { label: title, tree: region(title) },
            },
          })),
        };
      },
    });

    const result = await runAiBuild(baseOptions(live, script.provider));

    expect(script.planCalls).toHaveLength(2);
    expect(result.pagePlan).toBeUndefined();
    expect(result.scaffold?.status).toBe('applied');
    expect(result.tasks.map(({ title, status }) => [title, status])).toEqual([
      ['Hero', 'applied'],
      ['Menu', 'applied'],
    ]);
  });
});

describe('the one approval, on a page plan', () => {
  it('shows the plan before anything is written, then builds it on "build"', async () => {
    const live = kernel();
    const script = scripted();
    const seen: { titles: string[]; plan: PagePlan | undefined; written: number }[] = [];

    const result = await runAiBuild({
      ...baseOptions(live, script.provider),
      target: 'replace',
      onPlanned: (planned, direction, plan) => {
        seen.push({
          titles: planned.map(({ title }) => title),
          plan,
          written: live.transactions().length,
        });
        expect(direction.length).toBeGreaterThan(0);
        return 'build';
      },
    });

    expect(seen).toHaveLength(1);
    expect(seen[0]?.written).toBe(0);
    expect(seen[0]?.titles).toEqual([
      'Header',
      'Roasted this morning',
      'Our coffees',
      'Order today',
      'Footer',
    ]);
    expect(seen[0]?.plan?.primaryCta.label).toBe('Order beans');
    expect(result.outcome).toBe('completed');
  });

  it('builds the EDITED plan the person answered with, validated again first', async () => {
    const live = kernel();
    const script = scripted();

    const result = await runAiBuild({
      ...baseOptions(live, script.provider),
      target: 'replace',
      onPlanned: (_planned, _direction, plan) => {
        if (plan === undefined) throw new Error('no plan');
        return {
          build: {
            ...plan,
            sections: plan.sections.filter(({ key }) => key !== 'menu'),
            facts: plan.facts.filter(({ section }) => section !== 'menu'),
            nav: [],
          },
        };
      },
    });

    expect(childLabels(live)).toEqual(['Header', 'Roasted this morning', 'Order today', 'Footer']);
    expect(result.pagePlan?.sections.map(({ key }) => key)).toEqual(['header', 'hero', 'order', 'footer']);
    // The direction is prose; the sections of the plan that was BUILT are data.
    expect(result.direction).toBe('A warm, bean-forward roastery page.');
  });

  it('writes nothing, and says why, when the edited plan fails validation', async () => {
    const live = kernel();
    const script = scripted();

    await expect(
      runAiBuild({
        ...baseOptions(live, script.provider),
        target: 'replace',
        onPlanned: (_planned, _direction, plan) => {
          if (plan === undefined) throw new Error('no plan');
          // Every section removed: a plan of none can never be built.
          return { build: { ...plan, sections: [], facts: [], nav: [] } };
        },
      }),
    ).rejects.toThrow(/section/iu);
    expect(live.transactions()).toHaveLength(0);
  });

  it('writes nothing on "stop", and hands the refused plan back', async () => {
    const live = kernel();
    const script = scripted();

    const result = await runAiBuild({
      ...baseOptions(live, script.provider),
      target: 'replace',
      onPlanned: () => 'stop',
    });

    expect(live.transactions()).toHaveLength(0);
    expect(result.outcome).toBe('signal');
    expect(result.tasks).toEqual([]);
    expect(result.plannedTasks?.map(({ title }) => title)).toHaveLength(5);
    expect(result.pagePlan?.title).toBe('Northlight Coffee | Amman roastery');
    expect(script.fills).toHaveLength(0);
  });

  it('does not charge the time a person spends reading the plan to the build budget (E2)', async () => {
    const live = kernel();
    const script = scripted();
    const clock = movableClock();

    const result = await runAiBuild({
      ...baseOptions(live, script.provider),
      clock,
      target: 'replace',
      buildBudgetMs: 60_000,
      onPlanned: () => {
        // Ten minutes on the plan card, far past the whole build's budget.
        clock.advance(600_000);
        return 'build';
      },
    });

    expect(result.outcome).toBe('completed');
    expect(result.tasks.every(({ status }) => status === 'applied')).toBe(true);
    expect(result.elapsedMs).toBeLessThan(60_000);
  });

  it('plans without writing under apply: never, and returns the plan to show', async () => {
    const live = kernel();
    const script = scripted();

    const result = await runAiBuild({
      ...baseOptions(live, script.provider),
      apply: 'never',
      target: 'replace',
    });

    expect(result.outcome).toBe('planned');
    expect(live.transactions()).toHaveLength(0);
    expect(script.fills).toHaveLength(0);
    expect(result.plannedTasks?.map(({ title }) => title)).toEqual([
      'Header',
      'Roasted this morning',
      'Our coffees',
      'Order today',
      'Footer',
    ]);
    expect(result.pagePlan?.sections).toHaveLength(5);
  });
});

describe('where a page-plan build lands, and how it stops', () => {
  /** A page that already holds a hero and a footer region, as a person would have built it. */
  function builtPage(): BuilderDocument {
    const footer: CustomCodeRoot = {
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'footer',
          children: [{ kind: 'element', tag: 'p', text: '© Northlight', children: [] }],
        },
      ],
    };
    const document = page(['old-hero', 'old-footer']);
    const node = document.nodes['old-footer'];
    if (node !== undefined) {
      node.props = { label: 'Old footer', tree: JSON.parse(JSON.stringify(footer)) as JsonValue };
    }
    return document;
  }

  function bands(): Record<string, unknown> {
    const plan = roastery();
    const sections = plan['sections'] as Record<string, unknown>[];
    return {
      ...plan,
      intent: 'append',
      primaryCta: { label: 'Order beans', href: '#order' },
      nav: [],
      sections: sections.filter(({ role }) => role === 'band' || role === 'cta'),
      facts: [{ key: 'price-espresso', sample: '1.5 JOD', section: 'menu' }],
    };
  }

  it('appends sections BEFORE the page’s footer, removing nothing, when told to append', async () => {
    const live = kernel(builtPage());
    const script = scripted({ pagePlan: () => bands() });

    const result = await runAiBuild({ ...baseOptions(live, script.provider), target: 'append' });

    expect(script.planCalls[0]?.request).toContain('INTENT: append');
    expect(result.outcome).toBe('completed');
    expect(childLabels(live)).toEqual(['Old old-hero', 'Our coffees', 'Order today', 'Old footer']);
  });

  it('replaces an EMPTY page when the host names no target, and appends to a page with content', async () => {
    const empty = scripted();
    await runAiBuild(baseOptions(kernel(), empty.provider));
    expect(empty.planCalls[0]?.request).toContain('INTENT: replace');

    const full = scripted({ pagePlan: () => bands() });
    const live = kernel(builtPage());
    await runAiBuild(baseOptions(live, full.provider));
    expect(full.planCalls[0]?.request).toContain('INTENT: append');
    expect(childLabels(live)[0]).toBe('Old old-hero');
  });

  /*
    A plan card edits WHAT is built, never WHERE it lands. The edited plan was
    once re-validated against its own intent, so an edit that said 'replace'
    on a page the host held to 'append' deleted the page (wave-1 verifier, v2
    scenario 6: seven regions replaced, 2026-09-28). It is held to the target
    the plan was made under.
  */
  it('holds an edited plan to the target it was planned under — an edit cannot turn append into replace', async () => {
    const live = kernel(builtPage());
    const script = scripted({ pagePlan: () => bands() });

    const result = await runAiBuild({
      ...baseOptions(live, script.provider),
      target: 'append',
      onPlanned: (_planned, _direction, plan) => {
        if (plan === undefined) throw new Error('no plan');
        return { build: { ...plan, intent: 'replace' } };
      },
    });

    expect(result.pagePlan?.intent).toBe('append');
    expect(childLabels(live)).toEqual(['Old old-hero', 'Our coffees', 'Order today', 'Old footer']);
  });

  it('refuses, writing nothing, an edit that brings a whole page to a page it only appends to', async () => {
    const live = kernel(builtPage());
    const script = scripted({ pagePlan: () => bands() });

    await expect(
      runAiBuild({
        ...baseOptions(live, script.provider),
        target: 'append',
        // The card's "start over" answered with a hero-and-footer page, marked 'replace'.
        onPlanned: () => ({ build: validated(roastery()) }),
      }),
    ).rejects.toThrow(/hero|footer|header/iu);
    expect(live.transactions()).toHaveLength(0);
    expect(childLabels(live)).toEqual(['Old old-hero', 'Old footer']);
  });

  it('builds a Plan-mode plan with no target onto a page with content by APPENDING — as a direct Build would', async () => {
    const live = kernel(builtPage());
    // The model says 'replace'; the page has a person's content.
    const script = scripted({ pagePlan: () => ({ ...bands(), intent: 'replace' }) });

    const planned = await planAiPage(REQUEST, {
      runId: 'plan-mode',
      clock: { now: () => 1 },
      kernel: live,
      provider: script.provider,
      skillRegistry: createCraftkitAiSkillRegistry(),
    });
    if (!('plan' in planned)) throw new Error(planned.error.message);
    const result = await runAiBuild({
      ...baseOptions(live, script.provider),
      pagePlan: planned.plan,
    });

    expect(script.planCalls[0]?.request).toContain('INTENT: append');
    expect(result.pagePlan?.intent).toBe('append');
    expect(childLabels(live)).toEqual(['Old old-hero', 'Our coffees', 'Order today', 'Old footer']);
  });

  it('lands no written section after Stop; what the skeleton wrote in full stays', async () => {
    const live = kernel();
    const controller = new AbortController();
    const script = scripted({
      fill: (call) => {
        controller.abort();
        return new Promise<AiPlan>((_resolve, reject) => {
          const abort = new Error('aborted');
          abort.name = 'AbortError';
          if (call.signal?.aborted === true) reject(abort);
          call.signal?.addEventListener('abort', () => {
            reject(abort);
          });
        });
      },
    });

    const result = await runAiBuild({
      ...baseOptions(live, script.provider),
      target: 'replace',
      signal: controller.signal,
    });

    expect(result.outcome).toBe('signal');
    expect(labels(live)).toEqual([PAGE_SKELETON_LABEL]);
    const statuses = result.tasks.map(({ sectionKey, status }) => [sectionKey, status]);
    expect(statuses).toEqual([
      ['header', 'applied'],
      ['hero', 'not-started'],
      ['menu', 'not-started'],
      ['order', 'not-started'],
      ['footer', 'applied'],
    ]);
    expect(
      result.tasks
        .filter(({ status }) => status !== 'applied')
        .every(({ reasonCode }) => reasonCode === 'stopped'),
    ).toBe(true);
    expect(result.unfilled?.map(({ title }) => title)).toEqual([
      'Roasted this morning',
      'Our coffees',
      'Order today',
    ]);
  });
});

describe('every section is checked BEFORE it lands, and repaired once', () => {
  it('sends the checker’s issues back in one repair call, and lands the repaired section once', async () => {
    const live = kernel();
    const script = scripted({
      fill: (call) => {
        const tree = honestSection(call.request);
        if (call.request.includes('SECTION 3 OF 5')) {
          // A bracketed placeholder is exactly what a published page must never show.
          const section = tree.children[0];
          if (section?.kind === 'element') {
            section.children = [
              ...(section.children ?? []),
              { kind: 'element', tag: 'p', text: 'Espresso [price]', children: [] },
            ];
          }
        }
        return {
          rationale: 'filled',
          commands: [
            {
              command: 'setProp',
              args: { id: regionIdOf(call.request), key: 'tree', value: tree },
            },
          ],
        };
      },
      repair: (request) => ({
        rationale: 'repaired',
        commands: [
          {
            command: 'setProp',
            args: { id: regionIdOf(request), key: 'tree', value: honestSection(request) },
          },
        ],
      }),
    });

    const result = await runAiBuild({ ...baseOptions(live, script.provider), target: 'replace' });

    expect(script.repairs).toHaveLength(1);
    expect(script.repairs[0]?.request).toContain('SECTION 3 OF 5');
    expect(
      script.repairs[0]?.issues.some(({ message }) => /placeholder|\[price\]/iu.test(message)),
    ).toBe(true);
    const menu = result.tasks.find(({ sectionKey }) => sectionKey === 'menu');
    expect(menu?.status).toBe('applied');
    expect(menu?.check).toEqual({ issues: [], repaired: true });
    // Landed ONCE: one transaction carries this section's label.
    expect(labels(live).filter((label) => label === menu?.landing?.label)).toHaveLength(1);
    expect(JSON.stringify(live.getDocument().nodes[menu?.id ?? '']?.props['tree'])).not.toContain(
      '[price]',
    );
  });

  /*
    The person's own photo is theirs to use. The checker was once handed no
    request, so an address the person typed read as one a model invented: in
    the wave-1 verifier's v5-own-photo run the hero using the shop's own photo
    drew a foreign-image issue and a repair call telling the writer to swap in
    a catalog photo (2026-09-28).
  */
  it('keeps an image address the person gave — in the request or an earlier turn — with no repair', async () => {
    const shopFront = 'https://example.com/our-shop-front.jpg';
    const counter = 'https://example.com/our-counter.jpg';
    const invented = 'https://example.com/remembered-latte.jpg';
    const withPhoto = (call: FillCall, src: string): AiPlan => {
      const tree = honestSection(call.request);
      const section = tree.children[0];
      if (section?.kind === 'element') {
        section.children = [
          ...(section.children ?? []),
          {
            kind: 'element',
            tag: 'img',
            attributes: { src, alt: 'Northlight Coffee' },
            children: [],
          },
        ];
      }
      return {
        rationale: 'filled',
        commands: [
          { command: 'setProp', args: { id: regionIdOf(call.request), key: 'tree', value: tree } },
        ],
      };
    };
    const script = scripted({
      fill: (call) => {
        if (call.request.includes('SECTION 2 OF 5')) return withPhoto(call, shopFront);
        if (call.request.includes('SECTION 3 OF 5')) return withPhoto(call, counter);
        if (call.request.includes('SECTION 4 OF 5')) return withPhoto(call, invented);
        return withPhoto(call, shopFront);
      },
      repair: (request) => ({
        rationale: 'repaired',
        commands: [
          {
            command: 'setProp',
            args: { id: regionIdOf(request), key: 'tree', value: honestSection(request) },
          },
        ],
      }),
    });
    const live = kernel();

    const result = await runAiBuild({
      ...baseOptions(live, script.provider),
      request: `${REQUEST}. Use our shop front: ${shopFront}`,
      history: [
        { role: 'user', text: `Here is our counter: ${counter}` },
        // A URL the ASSISTANT wrote is not the person's: it proves nothing.
        { role: 'assistant', text: `I could use ${invented} for the order band.` },
      ],
      target: 'replace',
    });

    const report = (key: string) => result.tasks.find(({ sectionKey }) => sectionKey === key);
    expect(report('hero')?.check).toEqual({ issues: [], repaired: false });
    expect(report('menu')?.check).toEqual({ issues: [], repaired: false });
    expect(
      JSON.stringify(live.getDocument().nodes[report('hero')?.id ?? '']?.props['tree']),
    ).toContain(shopFront);
    // The one address nobody gave is still sent back, in exactly one repair call.
    expect(script.repairs.map(({ request }) => /SECTION (\d) OF/u.exec(request)?.[1])).toEqual([
      '4',
    ]);
    expect(script.repairs[0]?.issues.some(({ message }) => message.includes(invented))).toBe(true);
  });

  /*
    A writer sees its contract, not the request (P1-10), so a photo address
    the person gave reached no writer at all: the checker could only stop the
    swap, never make the page use it. It rides on the contract of each section
    that takes a photo, and only there.
  */
  it('hands the person’s own photo addresses to each section that takes a photo — and to no other', async () => {
    const shopFront = 'https://example.com/our-shop-front.jpg';
    const counter = 'https://example.com/our-counter.webp?w=1600';
    const script = scripted();

    await runAiBuild({
      ...baseOptions(kernel(), script.provider),
      request: `${REQUEST}. Use our shop front: ${shopFront}, and link to https://example.com/menu`,
      history: [
        { role: 'user', text: `Here is our counter: ${counter}` },
        { role: 'assistant', text: 'I could use https://example.com/remembered-latte.jpg' },
      ],
      target: 'replace',
    });

    const hero = script.fills.find(({ request }) => request.includes('SECTION 2 OF 5'));
    const menu = script.fills.find(({ request }) => request.includes('SECTION 3 OF 5'));
    const ownLine = /^THEIR OWN PHOTOS[^\n]*$/mu.exec(hero?.request ?? '')?.[0] ?? '';
    expect(ownLine).toContain(shopFront);
    expect(ownLine).toContain(counter);
    // A link is not a photo, and a URL the assistant wrote is not theirs.
    expect(ownLine).not.toContain('https://example.com/menu');
    expect(ownLine).not.toContain('remembered-latte');
    expect(hero?.request).not.toContain(REQUEST);
    // A type-led section is told no photo, and is not handed one.
    expect(menu?.request).not.toContain('THEIR OWN PHOTOS');
    expect(menu?.request).not.toContain(shopFront);
  });

  it('lands the section as written, with its issues on the report, when the provider cannot repair', async () => {
    const live = kernel();
    const script = scripted({
      fill: (call) => {
        const tree = honestSection(call.request);
        const section = tree.children[0];
        if (call.request.includes('SECTION 3 OF 5') && section?.kind === 'element') {
          section.children = [
            ...(section.children ?? []),
            { kind: 'element', tag: 'p', text: 'Espresso [price]', children: [] },
          ];
        }
        return {
          rationale: 'filled',
          commands: [
            {
              command: 'setProp',
              args: { id: regionIdOf(call.request), key: 'tree', value: tree },
            },
          ],
        };
      },
    });

    const result = await runAiBuild({ ...baseOptions(live, script.provider), target: 'replace' });

    const menu = result.tasks.find(({ sectionKey }) => sectionKey === 'menu');
    expect(menu?.status).toBe('applied');
    expect(menu?.check?.repaired).toBe(false);
    expect(menu?.check?.issues.length).toBeGreaterThan(0);
  });
});
