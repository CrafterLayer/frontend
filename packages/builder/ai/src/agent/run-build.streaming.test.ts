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
  type CustomCodeRoot,
  type JsonValue,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { createCraftkitAiSkillRegistry } from '../skills';
import type {
  AiPagePlanAttempt,
  AiPagePlanDraftEvent,
  AiPlan,
  AiPlanProvider,
  PagePlanCandidate,
} from '../types';
import { PAGE_SKELETON_FINISH_LABEL } from './page-plan/skeleton-from-plan';
import { PAGE_SKELETON_LABEL, runAiBuild, type AiBuildEvent, type AiBuildOwnEvent } from './index';

/*
  The streamed build (fast-build DESIGN §6.3, 2026-10-05). The planner's
  answer arrives as text while the model writes it; the build lays a
  provisional skeleton when the outline closes, starts each section's writer
  when its brief closes, and lands nothing a writer wrote before the final
  plan is validated and reconciled. Measured before (baseline 2026-09-30):
  every writer waited for the whole plan — skeleton at 37 s, first section at
  44 s, page at 65 s.

  The fake planner streams through `live.onDraft` and resolves only when released; assertions "before
  the plan is in" is made while it is genuinely not in.
*/

const NullRender: BlockRenderComponent = () => null;

/** A page root shaped like the product's (editor/src/components/Page/schema.ts). */
function manifest(): TrustedExtensionManifest {
  return {
    tier: 1,
    name: 'streamed-build-fixture',
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
    ports: { clock: { now: () => 1 }, ids: seededIds('stream-build') },
  });
}

type Json = Record<string, unknown>;

/** DESIGN §3's compact example `pagePlan`, verbatim. */
function example(): Json {
  return {
    intent: 'new-page',
    locale: { lang: 'en', dir: 'ltr' },
    title: 'Cardamom Roasters — specialty coffee in Amman',
    description: 'Small-batch coffee roasted every morning in Amman, delivered fresh.',
    tokens: { deckRowId: 'cafe', signature: 'The brand name at text-8xl, faint behind the menu.' },
    primaryCta: { label: 'Order beans', href: '#order' },
    sections: [
      { key: 'header', role: 'header', title: 'Header' },
      { key: 'hero', role: 'hero', title: 'Roasted this morning', variant: 'split' },
      { key: 'menu', role: 'band', title: 'Menu', variant: 'menu', nav: 'Menu' },
      { key: 'order', role: 'cta', title: 'Order', variant: 'cta-split', nav: 'Order' },
      { key: 'footer', role: 'footer', title: 'Footer', variant: 'footer' },
    ],
    briefs: [
      {
        key: 'hero',
        purpose: 'Say what the roastery is and invite the first order.',
        mustSay: ['Roasted daily in Amman'],
        images: [{ subject: 'cafe', aspect: 'landscape', alt: 'Freshly roasted coffee beans' }],
      },
      {
        key: 'menu',
        purpose: 'The drinks and beans, with prices.',
        mustNotRepeat: ['Roasted daily in Amman'],
        facts: [{ key: 'price-espresso', sample: 'JOD 1.50' }],
      },
      {
        key: 'order',
        purpose: 'One clear way to order.',
        slots: {
          title: 'Fresh beans, delivered in Amman',
          cta: { label: 'Order beans', href: '#order' },
        },
      },
      {
        key: 'footer',
        purpose: 'Address, hours and contact.',
        facts: [{ key: 'phone', sample: '+962 6 461 2750' }],
      },
    ],
    seo: {
      keyword: 'specialty coffee Amman',
      pageKind: 'home',
      businessType: 'CafeOrCoffeeShop',
      slug: 'specialty-coffee-amman',
    },
  };
}

/** An Arabic grill restaurant, the baseline request's page, in the compact shape. */
function arabicRestaurant(): Json {
  return {
    intent: 'new-page',
    locale: { lang: 'ar', dir: 'rtl' },
    title: 'مشاوي الدوار — مطعم مشاوي أردني في عمّان',
    description: 'مشاوي على الفحم كل يوم في عمّان، اطلب عبر واتساب.',
    tokens: { deckRowId: 'cafe', signature: 'اسم المطعم كبيرًا وباهتًا خلف المنيو.' },
    primaryCta: { label: 'اطلب عبر واتساب', href: '#order' },
    sections: [
      { key: 'header', role: 'header', title: 'الترويسة' },
      { key: 'hero', role: 'hero', title: 'مشاوي على الفحم', variant: 'split' },
      { key: 'menu', role: 'band', title: 'المنيو', variant: 'menu', nav: 'المنيو' },
      { key: 'order', role: 'cta', title: 'اطلب الآن', nav: 'اطلب' },
      { key: 'footer', role: 'footer', title: 'التذييل', variant: 'footer' },
    ],
    briefs: [
      {
        key: 'hero',
        purpose: 'قل ما هو المطعم وادعُ إلى أول طلب.',
        mustSay: ['مشاوي أردنية على الفحم'],
      },
      {
        key: 'menu',
        purpose: 'الأطباق وأسعارها.',
        facts: [{ key: 'price-mixed-grill', sample: '8.50 د.أ' }],
      },
      { key: 'order', purpose: 'طريقة واحدة واضحة للطلب عبر واتساب.' },
      {
        key: 'footer',
        purpose: 'العنوان وساعات العمل والهاتف.',
        facts: [{ key: 'phone', sample: '+962 6 461 2750' }],
      },
    ],
    seo: { keyword: 'مطعم مشاوي عمان', pageKind: 'home', businessType: 'Restaurant' },
  };
}

/** The same page appended to a page with content: bands and a closing call only. */
function appended(): Json {
  return {
    intent: 'append',
    locale: { lang: 'en', dir: 'ltr' },
    title: 'Cardamom Roasters — specialty coffee in Amman',
    description: 'Small-batch coffee roasted every morning in Amman, delivered fresh.',
    tokens: { deckRowId: 'cafe', signature: 'The brand name at text-8xl, faint behind the menu.' },
    primaryCta: { label: 'Order beans', href: '#order' },
    sections: [
      { key: 'menu', role: 'band', title: 'Menu', variant: 'menu' },
      { key: 'order', role: 'cta', title: 'Order' },
    ],
    briefs: [
      { key: 'menu', purpose: 'The drinks and beans, with prices.' },
      { key: 'order', purpose: 'One clear way to order.' },
    ],
  };
}

/** `plan` with one more band, and its brief: a different OUTLINE. */
function withFaq(plan: Json): Json {
  const sections = [...(plan['sections'] as Json[])];
  const footer = sections.findIndex(({ role }) => role === 'footer');
  const faq = { key: 'faq', role: 'band', title: 'FAQ', variant: 'faq' };
  if (footer === -1) sections.push(faq);
  else sections.splice(footer, 0, faq);
  return {
    ...plan,
    sections,
    briefs: [...(plan['briefs'] as Json[]), { key: 'faq', purpose: 'The questions people ask.' }],
  };
}

/** `plan` with the menu's brief saying something else: the same outline, one contract changed. */
function withMenuPurpose(plan: Json, purpose: string): Json {
  return {
    ...plan,
    briefs: (plan['briefs'] as Json[]).map((brief) =>
      brief['key'] === 'menu' ? { ...brief, purpose } : brief,
    ),
  };
}

const RATIONALE = 'A warm, type-led roastery page: burnt orange on pale lime, Fraunces headings.';

/** The model's whole answer as the server streams it. */
function answerText(pagePlan: Json): string {
  return JSON.stringify({ version: 1, rationale: RATIONALE, pagePlan });
}

function chunks(text: string, size = 41): readonly string[] {
  const out: string[] = [];
  for (let at = 0; at < text.length; at += size) out.push(text.slice(at, at + size));
  return out;
}

function streamWhole(onDraft: (event: AiPagePlanDraftEvent) => void, pagePlan: Json): void {
  onDraft({ kind: 'start' });
  for (const text of chunks(answerText(pagePlan))) onDraft({ kind: 'text', text });
}

interface FillCall {
  readonly request: string;
  readonly anchor: string;
  readonly signal: AbortSignal | undefined;
  answered: boolean;
}

function regionIdOf(request: string): string {
  return /REGION ID: (\S+)/u.exec(request)?.[1] ?? 'missing';
}

function anchorOf(request: string): string {
  return /ANCHOR:[^\n]*id="([^"]+)"/u.exec(request)?.[1] ?? 'missing';
}

/** What an honest writer writes, with a marker saying which write of its section this is. */
function written(request: string, write: number): CustomCodeRoot {
  const anchor = anchorOf(request);
  const title = /SECTION \d+ OF \d+: ([^\n]+)/u.exec(request)?.[1] ?? 'Section';
  const hero = request.includes('ROLE: HERO');
  const action = /PRIMARY ACTION: "([^"]+)" → (\S+)/u.exec(request);
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
          { kind: 'element', tag: 'p', text: `write ${String(write)} of ${anchor}`, children: [] },
          ...(action === null
            ? []
            : [
                {
                  kind: 'element' as const,
                  tag: 'a' as const,
                  className: 'ck-btn',
                  attributes: { href: action[2] ?? '#' },
                  text: action[1] ?? '',
                  children: [],
                },
              ]),
        ],
      },
    ],
  };
}

interface Streaming {
  readonly provider: AiPlanProvider;
  readonly planCalls: (AiPagePlanAttempt | undefined)[];
  readonly fills: FillCall[];
  /** Ordered: `plan:resolved`, `fill:<anchor>` (a writer reached the provider). */
  readonly log: string[];
  /** Let the planner's call resolve. */
  readonly releasePlan: () => void;
  planResolved: boolean;
}

function streaming(
  options: {
    /** What is streamed; default the §3 example. */
    readonly streamed?: () => Json;
    /** What the call resolves with; default what was streamed. */
    readonly final?: (attempt: AiPagePlanAttempt | undefined) => PagePlanCandidate;
    /** Emit the drafts yourself; default `start` and the whole answer in chunks. */
    readonly stream?: (
      onDraft: (event: AiPagePlanDraftEvent) => void,
      attempt: AiPagePlanAttempt | undefined,
    ) => void;
    /** A provider that sends no drafts at all. */
    readonly drafts?: boolean;
    /** Hold the call open until `releasePlan()`; default true. */
    readonly hold?: boolean;
    readonly fill?: (call: FillCall) => Promise<AiPlan> | AiPlan;
  } = {},
): Streaming {
  const streamed = options.streamed ?? example;
  const planCalls: (AiPagePlanAttempt | undefined)[] = [];
  const fills: FillCall[] = [];
  const log: string[] = [];
  const writes = new Map<string, number>();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const script: Streaming = {
    provider: {
      async propose(request, _context, live) {
        const call: FillCall = {
          request,
          anchor: anchorOf(request),
          signal: live?.signal,
          answered: false,
        };
        fills.push(call);
        log.push(`fill:${call.anchor}`);
        try {
          if (options.fill !== undefined) return await options.fill(call);
          const write = (writes.get(call.anchor) ?? 0) + 1;
          writes.set(call.anchor, write);
          return {
            rationale: 'filled',
            commands: [
              {
                command: 'setProp',
                args: { id: regionIdOf(request), key: 'tree', value: written(request, write) },
              },
            ],
          };
        } finally {
          call.answered = true;
        }
      },
      async proposePagePlan(_request, _context, live) {
        const attempt = live?.attempt;
        planCalls.push(attempt);
        if (options.drafts !== false && live?.onDraft !== undefined) {
          if (options.stream === undefined) streamWhole(live.onDraft, streamed());
          else options.stream(live.onDraft, attempt);
        }
        if (options.hold !== false) {
          const signal = live?.signal;
          await new Promise<void>((resolve, reject) => {
            const abort = (): void => {
              const error = new Error('aborted');
              error.name = 'AbortError';
              reject(error);
            };
            if (signal?.aborted === true) abort();
            signal?.addEventListener('abort', abort, { once: true });
            void gate.then(resolve);
          });
        }
        script.planResolved = true;
        log.push('plan:resolved');
        return {
          pagePlan: options.final?.(attempt) ?? streamed(),
          rationale: RATIONALE,
        };
      },
    },
    planCalls,
    fills,
    log,
    releasePlan: () => {
      release();
    },
    planResolved: false,
  };
  return script;
}

/** Wait, a macrotask at a time, for something the build does asynchronously. */
async function until(condition: () => boolean, what: string): Promise<void> {
  for (let turn = 0; turn < 400; turn += 1) {
    if (condition()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`Timed out waiting for ${what}.`);
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

/** The region's tree as text, to look for what was written into it. */
function treeText(live: BuilderKernel, label: string): string {
  const document = live.getDocument();
  const id = (document.nodes[document.rootId]?.slots?.['default'] ?? []).find(
    (child) => document.nodes[child]?.props['label'] === label,
  );
  return JSON.stringify(id === undefined ? null : document.nodes[id]?.props['tree']);
}

/** The positions of the section transactions (`Assistant: 2/5 — …`), in the order they landed. */
function sectionPositions(live: BuilderKernel): readonly number[] {
  return labels(live).flatMap((label) => {
    const match = /^Assistant: (\d+)\/\d+ — /u.exec(label);
    return match === null ? [] : [Number(match[1])];
  });
}

function own(events: readonly AiBuildEvent[]): AiBuildOwnEvent[] {
  return events.filter(
    (event): event is AiBuildOwnEvent =>
      event.type.startsWith('build.') || event.type.startsWith('task.'),
  );
}

function baseOptions(live: BuilderKernel, provider: AiPlanProvider, events?: AiBuildEvent[]) {
  return {
    runId: 'stream-build',
    clock: { now: () => 1 },
    kernel: live,
    provider,
    request:
      'Build a landing page for Cardamom Roasters, a specialty coffee roastery in Amman using existing templates',
    validationPorts: { clock: { now: () => 1 }, ids: seededIds('stream-build-door') },
    skillRegistry: createCraftkitAiSkillRegistry(),
    ...(events === undefined ? {} : { onEvent: (event: AiBuildEvent) => events.push(event) }),
  };
}

/*
  A whole build per test: under a full parallel run these outlive vitest's 5s
  default (they pass in ~10s per file alone). The budget only bounds a hang.
*/
vi.setConfig({ testTimeout: 20_000 });

describe('the streamed build — the skeleton at the outline, writers at their briefs', () => {
  it('lands the skeleton, starts the writers and lands each written section while the plan is still being written', async () => {
    const live = kernel();
    const events: AiBuildEvent[] = [];
    const script = streaming();

    const building = runAiBuild(baseOptions(live, script.provider, events));

    // The hero's and the menu's briefs closed: their writers are at the provider…
    await until(
      () => script.fills.length >= 2 && script.fills.every(({ answered }) => answered),
      'the hero and menu writers to answer',
    );
    // …give their answers time to reach the lander.
    for (let turn = 0; turn < 20; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0));

    expect(script.planResolved).toBe(false);
    /*
      The canvas shows the page's shape — ONE skeleton transaction, every region laid — and,
      before the final plan is even in, each section whose writer finished (EARLY LANDING):
      one transaction each, through the same door.
    */
    expect(labels(live)[0]).toBe(PAGE_SKELETON_LABEL);
    expect(labels(live)).toHaveLength(3);
    expect([...sectionPositions(live)].sort()).toEqual([2, 3]);
    expect(treeText(live, 'Roasted this morning')).toContain('write 1 of hero');
    expect(treeText(live, 'Menu')).toContain('write 1 of menu');
    // The checklist: the header (written whole by the skeleton) and both written sections are done.
    expect(
      own(events)
        .filter(({ type }) => type === 'task.completed')
        .map((event) => (event.type === 'task.completed' ? event.position : 0))
        .sort(),
    ).toEqual([1, 2, 3]);
    expect(childLabels(live)).toEqual([
      'Header',
      'Roasted this morning',
      'Menu',
      'Order',
      'Footer',
    ]);
    // The footer and the planner-filled closing section are code jobs: no writer before the plan.
    expect(script.fills.map(({ anchor }) => anchor).sort()).toEqual(['hero', 'menu']);
    const planned = own(events).filter(({ type }) => type === 'build.planned');
    expect(planned).toHaveLength(1);

    script.releasePlan();
    const result = await building;

    expect(result.outcome).toBe('completed');
    expect(script.planCalls).toEqual([undefined]);
    const transactions = labels(live);
    expect(transactions[0]).toBe(PAGE_SKELETON_LABEL);
    expect(transactions.filter((label) => label === PAGE_SKELETON_LABEL)).toHaveLength(1);
    // The finish came with the final plan, after the sections that landed early.
    expect(transactions.filter((label) => label === PAGE_SKELETON_FINISH_LABEL)).toHaveLength(1);
    expect(transactions.indexOf(PAGE_SKELETON_FINISH_LABEL)).toBe(3);
    // The finish wrote the footer from the final plan's facts.
    expect(treeText(live, 'Footer')).toContain('461 2750');
    const footer = result.tasks.find(({ sectionKey }) => sectionKey === 'footer');
    expect(footer?.status).toBe('applied');
    expect(footer?.landing?.label).toBe(PAGE_SKELETON_FINISH_LABEL);
    // An early landing is not landed again: one transaction per section.
    const positions = sectionPositions(live);
    expect([...positions].sort()).toEqual([2, 3]);
    // Each speculative writer ran once: their contracts did not change.
    expect(script.fills.filter(({ anchor }) => anchor === 'hero')).toHaveLength(1);
    expect(script.fills.filter(({ anchor }) => anchor === 'menu')).toHaveLength(1);
    expect(treeText(live, 'Roasted this morning')).toContain('write 1 of hero');
    expect(result.pagePlan?.sections.map(({ key }) => key)).toEqual([
      'header',
      'hero',
      'menu',
      'order',
      'footer',
    ]);
    // The report's facts are the final plan's.
    expect(result.tasks.find(({ sectionKey }) => sectionKey === 'menu')?.facts).toEqual([
      { key: 'price-espresso', sample: 'JOD 1.50' },
    ]);
    expect(result.tasks.every(({ status }) => status === 'applied')).toBe(true);
  });

  it('lands a ready lower section after the final-plan gate while the hero is still pending', async () => {
    const live = kernel();
    let releaseHero!: () => void;
    const heroGate = new Promise<void>((resolve) => {
      releaseHero = resolve;
    });
    const script = streaming({
      hold: false,
      fill: async (call) => {
        if (call.anchor === 'hero') await heroGate;
        return {
          rationale: 'filled',
          commands: [
            {
              command: 'setProp',
              args: { id: regionIdOf(call.request), key: 'tree', value: written(call.request, 1) },
            },
          ],
        };
      },
    });

    const building = runAiBuild(baseOptions(live, script.provider));
    await until(
      () => script.fills.some(({ anchor, answered }) => anchor === 'menu' && answered),
      'the menu to be written',
    );
    for (let turn = 0; turn < 20; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0));
    // The final plan is validated: the ready menu is visible before the slow hero.
    expect(sectionPositions(live)).toEqual([3]);
    releaseHero();
    await building;

    const positions = sectionPositions(live);
    expect(positions.slice(0, 2)).toEqual([3, 2]);
    expect(new Set(positions).size).toBe(positions.length);
  });

  it('rewrites exactly the section whose brief changed in the final plan, once — and lands it again over its early landing', async () => {
    const live = kernel();
    const changed = 'Every coffee and bean we roast, with its price in dinars.';
    const script = streaming({ final: () => withMenuPurpose(example(), changed) });
    // The menu's placeholder, as the skeleton laid it.
    let placeholder: string | undefined;

    const building = runAiBuild({
      ...baseOptions(live, script.provider),
      onEvent: (event: AiBuildEvent) => {
        if (event.type === 'build.planned') placeholder = treeText(live, 'Menu');
      },
    });
    // The menu lands early from its provisional brief, before the plan (and its change) is in.
    await until(() => sectionPositions(live).includes(3), 'the menu to land early');
    expect(script.planResolved).toBe(false);
    expect(treeText(live, 'Menu')).toContain('write 1 of menu');
    script.releasePlan();
    const result = await building;

    expect(result.outcome).toBe('completed');
    const menu = script.fills.filter(({ anchor }) => anchor === 'menu');
    expect(menu).toHaveLength(2);
    expect(menu[1]?.request).toContain(changed);
    expect(script.fills.filter(({ anchor }) => anchor === 'hero')).toHaveLength(1);
    // What landed last is the rewrite, from the final contract — in its own transaction.
    expect(treeText(live, 'Menu')).toContain('write 2 of menu');
    expect(treeText(live, 'Roasted this morning')).toContain('write 1 of hero');
    expect(sectionPositions(live).filter((position) => position === 3)).toHaveLength(2);
    // A rerun is not a second attempt.
    const report = result.tasks.find(({ sectionKey }) => sectionKey === 'menu');
    expect(report?.attempts).toBe(1);
    // Its Undo puts the PLACEHOLDER back, never the provisional write that landed first.
    expect(placeholder).toBeDefined();
    expect(JSON.stringify(report?.landing?.before.tree)).toBe(placeholder);
    expect(JSON.stringify(report?.landing?.after.tree)).toContain('write 2 of menu');
    const menuLandings = live
      .transactions()
      .filter(({ command }) => command.startsWith('Assistant: 3/5 — '));
    expect(report?.landing?.transactionId).toBe(menuLandings.at(-1)?.id ?? 'missing');
  });

  it('falls back to the plain path, with no duplicate region, when the final outline differs (replace)', async () => {
    const live = kernel();
    const script = streaming({ final: () => withFaq(example()) });

    const building = runAiBuild(baseOptions(live, script.provider));
    await until(() => script.fills.length >= 2, 'the speculative writers');
    script.releasePlan();
    const result = await building;

    expect(result.outcome).toBe('completed');
    expect(childLabels(live)).toEqual([
      'Header',
      'Roasted this morning',
      'Menu',
      'Order',
      'FAQ',
      'Footer',
    ]);
    const transactions = labels(live);
    // The plain path's skeleton replaced the provisional one; no finish was written for it.
    expect(transactions.filter((label) => label === PAGE_SKELETON_LABEL)).toHaveLength(2);
    expect(transactions).not.toContain(PAGE_SKELETON_FINISH_LABEL);
    expect(result.pagePlan?.sections).toHaveLength(6);
    // The speculative writers were aborted; the plain path wrote every section again.
    expect(treeText(live, 'FAQ')).toContain('write 1 of faq');
  });

  it('takes the provisional regions back before appending a changed outline', async () => {
    const live = kernel(page(['old-a', 'old-b']));
    const script = streaming({ streamed: appended, final: () => withFaq(appended()) });

    const building = runAiBuild({ ...baseOptions(live, script.provider), target: 'append' });
    // A section landed early into its provisional region…
    await until(() => sectionPositions(live).length >= 1, 'an early landing');
    expect(childLabels(live)).toEqual(['Old old-a', 'Old old-b', 'Menu', 'Order']);
    script.releasePlan();
    const result = await building;

    // …and went with its region in the one transaction that takes the speculation back.
    expect(result.outcome).toBe('completed');
    const transactions = labels(live);
    const withdrawn = transactions.indexOf('Assistant: page skeleton (withdrawn)');
    expect(withdrawn).toBeGreaterThan(
      transactions.findIndex((label) => /^Assistant: \d/u.test(label)),
    );
    expect(
      transactions.filter((label) => label === 'Assistant: page skeleton (withdrawn)'),
    ).toHaveLength(1);
    expect(childLabels(live)).toEqual(['Old old-a', 'Old old-b', 'Menu', 'Order', 'FAQ']);
    // The page holds the plain path's sections only: the reports are the final plan's.
    expect(result.pagePlan?.sections.map(({ key }) => key)).toEqual(['menu', 'order', 'faq']);
    expect(result.tasks.every(({ status }) => status === 'applied')).toBe(true);
  });

  it('builds the streamed draft when the plan is refused twice — no scaffold (fix pass 2026-10-05)', async () => {
    const live = kernel();
    // The final answers can never pass (one section); the streamed outline and briefs did.
    const refused = (): Json => ({
      ...example(),
      sections: [(example()['sections'] as Json[])[1]],
      briefs: [],
    });
    const script = streaming({ hold: false, final: () => refused() });

    const result = await runAiBuild(baseOptions(live, script.provider));

    expect(script.planCalls).toHaveLength(2);
    expect(result.planFallback).toBeUndefined();
    expect(result.pagePlan?.sections.map(({ key }) => key)).toEqual([
      'header',
      'hero',
      'menu',
      'order',
      'footer',
    ]);
    expect(labels(live)[0]).toBe(PAGE_SKELETON_LABEL);
    expect(labels(live)).not.toContain('Assistant: page skeleton (withdrawn)');
    expect(result.tasks.every(({ status }) => status === 'applied')).toBe(true);
    // No model-written scaffold was asked for: every fill call was a section writer's.
    expect(script.fills.every((call) => call.request.includes('REGION ID: '))).toBe(true);
  });

  it('falls back to the scaffold build when neither the answers nor the draft make a plan', async () => {
    const live = kernel();
    const titles = ['Hero', 'Menu'];
    // A plan that can never pass (one section), streamed and answered alike.
    const refused = (): Json => ({
      ...example(),
      sections: [(example()['sections'] as Json[])[1]],
      briefs: [],
    });
    const script = streaming({
      hold: false,
      streamed: () => refused(),
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
    expect(result.planFallback?.stage).toBe('plan');
    // Nothing was speculated: the one skeleton is the scaffold's, and none was withdrawn.
    expect(labels(live).filter((label) => label === PAGE_SKELETON_LABEL)).toHaveLength(1);
    expect(labels(live)).not.toContain('Assistant: page skeleton (withdrawn)');
    expect(childLabels(live)).toEqual(['Hero', 'Menu']);
    expect(result.tasks.map(({ title, status }) => [title, status])).toEqual([
      ['Hero', 'applied'],
      ['Menu', 'applied'],
    ]);
  });

  it('speculates from the repair answer when the first answer’s outline was refused', async () => {
    const live = kernel();
    const refused = (): Json => ({
      ...example(),
      sections: [(example()['sections'] as Json[])[1]],
      briefs: [],
    });
    let skeletonBeforePlan = false;
    const script = streaming({
      hold: false,
      final: (attempt) => (attempt === undefined ? refused() : example()),
      stream: (onDraft, attempt) => {
        streamWhole(onDraft, attempt === undefined ? refused() : example());
        // The repair answer's outline laid the skeleton while the call was still open.
        if (attempt !== undefined) skeletonBeforePlan = labels(live).includes(PAGE_SKELETON_LABEL);
      },
    });

    const result = await runAiBuild(baseOptions(live, script.provider));

    expect(script.planCalls).toHaveLength(2);
    expect(skeletonBeforePlan).toBe(true);
    expect(result.planFallback).toBeUndefined();
    expect(labels(live)[0]).toBe(PAGE_SKELETON_LABEL);
    expect(result.tasks.every(({ status }) => status === 'applied')).toBe(true);
  });

  it('aborts the speculative writers on Stop, and lands nothing after it', async () => {
    const live = kernel();
    const controller = new AbortController();
    const script = streaming({
      fill: (call) =>
        new Promise<AiPlan>((_resolve, reject) => {
          const abort = (): void => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          };
          if (call.signal?.aborted === true) abort();
          call.signal?.addEventListener('abort', abort, { once: true });
        }),
    });

    const building = runAiBuild({
      ...baseOptions(live, script.provider),
      signal: controller.signal,
    });
    await until(() => script.fills.length >= 2, 'the speculative writers');
    controller.abort();

    await expect(building).rejects.toThrow();
    expect(script.fills.every(({ signal }) => signal?.aborted === true)).toBe(true);
    expect(labels(live)).toEqual([PAGE_SKELETON_LABEL]);
  });

  it('starts no new writer once a second response begins; the rest wait for the final plan', async () => {
    const live = kernel();
    const text = answerText(example());
    const cut = text.indexOf('{"key":"menu","purpose"');
    const script = streaming({
      stream: (onDraft) => {
        onDraft({ kind: 'start' });
        for (const piece of chunks(text.slice(0, cut))) onDraft({ kind: 'text', text: piece });
        // A transport retry: the answer starts over.
        onDraft({ kind: 'start' });
        for (const piece of chunks(text)) onDraft({ kind: 'text', text: piece });
      },
    });

    const building = runAiBuild(baseOptions(live, script.provider));
    await until(() => script.fills.length >= 1, 'the hero writer');
    for (let turn = 0; turn < 20; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0));
    // Its brief closed in the answer that started over: written, but not landed before the plan.
    expect(script.fills.every(({ answered }) => answered)).toBe(true);
    expect(labels(live)).toEqual([PAGE_SKELETON_LABEL]);
    expect(script.fills.map(({ anchor }) => anchor)).toEqual(['hero']);
    script.releasePlan();
    const result = await building;

    expect(result.outcome).toBe('completed');
    expect(script.fills.filter(({ anchor }) => anchor === 'hero')).toHaveLength(1);
    expect(script.fills.filter(({ anchor }) => anchor === 'menu')).toHaveLength(1);
    expect(labels(live).filter((label) => label === PAGE_SKELETON_LABEL)).toHaveLength(1);
  });

  it('keeps an early landing when its rerun from the final contract does not land', async () => {
    const live = kernel();
    const events: AiBuildEvent[] = [];
    let menuWrites = 0;
    const script = streaming({
      final: () => withMenuPurpose(example(), 'Every coffee we roast, priced.'),
      fill: (call) => {
        if (call.anchor === 'menu') {
          menuWrites += 1;
          if (menuWrites > 1) throw new Error('The writer answered nothing usable.');
        }
        return {
          rationale: 'filled',
          commands: [
            {
              command: 'setProp',
              args: { id: regionIdOf(call.request), key: 'tree', value: written(call.request, 1) },
            },
          ],
        };
      },
    });

    const building = runAiBuild(baseOptions(live, script.provider, events));
    await until(() => sectionPositions(live).includes(3), 'the menu to land early');
    script.releasePlan();
    const result = await building;

    expect(menuWrites).toBeGreaterThan(1);
    // The rerun failed: the section stays as it landed, and its report says it is on the page.
    expect(treeText(live, 'Menu')).toContain('write 1 of menu');
    expect(sectionPositions(live).filter((position) => position === 3)).toHaveLength(1);
    const report = result.tasks.find(({ sectionKey }) => sectionKey === 'menu');
    expect(report?.status).toBe('applied');
    expect(report?.landing?.transactionId).toBe(
      live.transactions().find(({ command }) => command.startsWith('Assistant: 3/5 — '))?.id,
    );
    // The row the rerun reopened reads landed again.
    const menuRow = own(events).filter(
      (event) =>
        (event.type === 'task.started' ||
          event.type === 'task.completed' ||
          event.type === 'task.skipped') &&
        event.position === 3,
    );
    expect(menuRow.at(-1)?.type).toBe('task.completed');
    expect(result.applied).toBe(result.tasks.length);
  });

  it('names each section as its outline entry closes, before the skeleton can land', async () => {
    const live = kernel();
    const events: AiBuildEvent[] = [];
    const outlines = () =>
      own(events).flatMap((event) =>
        event.type === 'build.outline' ? [event.sections.map(({ key }) => key)] : [],
      );
    const text = answerText(example());
    const cut = text.indexOf('{"key":"menu","role"');
    let midOutline:
      { readonly named: readonly (readonly string[])[]; readonly transactions: number } | undefined;
    const script = streaming({
      stream: (onDraft) => {
        onDraft({ kind: 'start' });
        for (const piece of chunks(text.slice(0, cut))) onDraft({ kind: 'text', text: piece });
        // Half the outline is written: what the person sees at this moment.
        midOutline = { named: outlines(), transactions: labels(live).length };
        for (const piece of chunks(text.slice(cut))) onDraft({ kind: 'text', text: piece });
      },
    });

    const building = runAiBuild(baseOptions(live, script.provider, events));
    await until(() => midOutline !== undefined, 'the outline to be half written');
    // No page shape can land yet — the outline is not closed — but the sections are named.
    expect(midOutline?.transactions).toBe(0);
    expect(midOutline?.named).toEqual([['header'], ['header', 'hero']]);
    script.releasePlan();
    await building;

    const ownEvents = own(events);
    const plannedAt = ownEvents.findIndex(({ type }) => type === 'build.planned');
    const told = ownEvents.flatMap((event, index) =>
      event.type === 'build.outline'
        ? [
            {
              index,
              keys: event.sections.map(({ key }) => key),
              briefed: event.sections.filter(({ briefed }) => briefed).map(({ key }) => key),
            },
          ]
        : [],
    );
    // The whole outline was named before `build.planned` brought the regions…
    expect(told.filter(({ index }) => index < plannedAt).at(-1)?.keys).toEqual([
      'header',
      'hero',
      'menu',
      'order',
      'footer',
    ]);
    // …and each brief was told as it closed.
    expect(told.at(-1)?.briefed).toEqual(['hero', 'menu', 'order', 'footer']);
  });

  it('lands a written section before the final plan is in, let alone validated (timing)', async () => {
    const live = kernel();
    const script = streaming();

    const building = runAiBuild({
      ...baseOptions(live, script.provider),
      onEvent: (event: AiBuildEvent) => {
        if (event.type === 'build.planned') script.log.push('skeleton');
        if (event.type === 'task.completed') script.log.push(`landed:${String(event.position)}`);
      },
    });
    await until(
      () => script.log.includes('landed:2') && script.log.includes('landed:3'),
      'the early landings',
    );
    expect(script.planResolved).toBe(false);
    script.releasePlan();
    await building;

    const at = (entry: string): number => script.log.indexOf(entry);
    /*
      Baseline 2026-09-30: skeleton at 37 s, first section at 44 s — after the whole plan.
      Now: skeleton, then each written section as it is ready, then the plan; only what the
      FINAL plan writes in code (the footer, from its facts) lands after it.
    */
    expect(at('skeleton')).toBeLessThan(at('landed:1'));
    expect(at('landed:1')).toBeLessThan(at('landed:2'));
    expect(at('landed:2')).toBeLessThan(at('plan:resolved'));
    expect(at('landed:3')).toBeLessThan(at('plan:resolved'));
    expect(at('landed:5')).toBeGreaterThan(at('plan:resolved'));
  });

  it('lays an Arabic plan right to left from the outline on', async () => {
    const live = kernel();
    const script = streaming({ streamed: arabicRestaurant });

    const building = runAiBuild({
      ...baseOptions(live, script.provider),
      request: 'صفحة لمطعم مشاوي أردني في عمّان: منيو، وطلب عبر واتساب، استخدم القوالب',
    });
    await until(() => labels(live).length >= 1, 'the provisional skeleton');

    expect(script.planResolved).toBe(false);
    const document = live.getDocument();
    expect(document.dir).toBe('rtl');
    expect(document.nodes[document.rootId]?.props['lang']).toBe('ar');
    expect(childLabels(live)).toEqual([
      'الترويسة',
      'مشاوي على الفحم',
      'المنيو',
      'اطلب الآن',
      'التذييل',
    ]);

    script.releasePlan();
    const result = await building;
    expect(result.outcome).toBe('completed');
    expect(live.getDocument().dir).toBe('rtl');
    expect(treeText(live, 'التذييل')).toContain('461 2750');
  });
});

describe('the plain build stays the plain build', () => {
  it('waits for the whole plan with streamPlan: false, whatever the provider streams', async () => {
    const live = kernel();
    const script = streaming({ hold: false });

    const result = await runAiBuild({ ...baseOptions(live, script.provider), streamPlan: false });

    expect(result.outcome).toBe('completed');
    expect(script.log[0]).toBe('plan:resolved');
    const transactions = labels(live);
    expect(transactions[0]).toBe(PAGE_SKELETON_LABEL);
    expect(transactions).not.toContain(PAGE_SKELETON_FINISH_LABEL);
    expect(transactions.filter((label) => label === PAGE_SKELETON_LABEL)).toHaveLength(1);
  });

  it('builds exactly as before for a provider that sends no drafts', async () => {
    const live = kernel();
    const script = streaming({ hold: false, drafts: false });

    const result = await runAiBuild(baseOptions(live, script.provider));

    expect(result.outcome).toBe('completed');
    expect(script.log[0]).toBe('plan:resolved');
    expect(labels(live)).not.toContain(PAGE_SKELETON_FINISH_LABEL);
    expect(treeText(live, 'Footer')).toContain('461 2750');
  });
});
