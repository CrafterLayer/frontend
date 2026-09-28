import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  customCss,
  defineBlockSchema,
  emptyCustomCodeTree,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { PHOTO_CATALOG_FRAGMENT_TITLE } from '../context';
import { AiProviderError } from '../provider/errors';
import { createCraftkitAiSkillRegistry } from '../skills';
import type {
  AiPagePlanAttempt,
  AiPlanProvider,
  AssembledAiContext,
  PagePlanCandidate,
} from '../types';
import { anotherLookRequested, planAiPage } from './plan-page';
import type { AiPagePlanEvent } from './types';

/*
  Plan mode's one model call (agent-audit §3.1 T1, 2026-09-28): a structured
  page plan, validated, repaired at most once, and NOTHING written. Before it,
  Plan mode ran a whole scaffold (or an outline over a ~49k-token catalog) and
  "Build" re-planned from scratch, so the list a person approved was not the
  list that got built (P1-7b).
*/

const NullRender: BlockRenderComponent = () => null;

/** A page root shaped like the product's (editor/src/components/Page/schema.ts). */
function manifest(): TrustedExtensionManifest {
  return {
    tier: 1,
    name: 'plan-page-fixture',
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
    ports: { clock: fixedClock(1), ids: seededIds('plan') },
  });
}

/** A plan a model plausibly writes for an Arabic café page (deck row `cafe`). */
function cafe(): Record<string, unknown> {
  return {
    intent: 'new-page',
    locale: { lang: 'ar' },
    title: 'محمصة الهيل',
    description: 'قهوة مختصة محمصة في عمّان، تصلك طازجة.',
    tokens: {
      bg: 'lime-50',
      surface: 'white',
      ink: 'emerald-950',
      muted: 'emerald-800',
      accent: 'orange-700',
      onAccent: 'white',
      border: '#e7e5e4',
      fontDisplay: { family: 'Lalezar' },
      fontBody: { family: 'Almarai', weights: [400, 700] },
      radius: 'xl',
      signature: 'the brand name at text-8xl, faint behind the menu',
      deckRowId: 'cafe',
    },
    primaryCta: { label: 'اطلب الآن', href: '#order' },
    nav: [
      { label: 'القائمة', anchorId: 'menu' },
      { label: 'اطلب', anchorId: 'order' },
    ],
    sections: [
      { key: 'header', role: 'header', title: 'الترويسة', anchorId: 'top', purpose: 'Brand.' },
      {
        key: 'hero',
        role: 'hero',
        title: 'قهوة تُحمّص كل صباح',
        anchorId: 'hero',
        purpose: 'Say what the roastery is and invite the first order.',
        mustSay: ['محمصة في عمّان'],
        variant: 'split',
        images: [{ subject: 'cafe', aspect: '16:9', alt: 'حبوب قهوة محمصة' }],
      },
      {
        key: 'menu',
        role: 'band',
        title: 'القائمة',
        anchorId: 'menu',
        purpose: 'The drinks and their prices.',
        mustNotRepeat: ['محمصة في عمّان'],
        variant: 'menu',
      },
      { key: 'order', role: 'cta', title: 'اطلب', anchorId: 'order', purpose: 'One way to order.' },
      { key: 'footer', role: 'footer', title: 'التذييل', anchorId: 'footer', purpose: 'Hours.' },
    ],
    facts: [
      { key: 'phone', sample: '+962 7 9000 0000', section: 'order' },
      { key: 'price-espresso', sample: '1.5 د.أ', section: 'menu' },
    ],
  };
}

/** The same plan with a muted colour that fails contrast on the ground. */
function unreadable(): Record<string, unknown> {
  const plan = cafe();
  return { ...plan, tokens: { ...(plan['tokens'] as object), muted: 'stone-300' } };
}

interface PlanCall {
  readonly request: string;
  readonly context: AssembledAiContext;
  readonly attempt: AiPagePlanAttempt | undefined;
  readonly signal: AbortSignal | undefined;
}

function planner(answer: (call: PlanCall, index: number) => PagePlanCandidate | Promise<never>) {
  const calls: PlanCall[] = [];
  let proposed = 0;
  const provider: AiPlanProvider = {
    propose() {
      proposed += 1;
      return Promise.reject(new Error('a page plan never asks for commands'));
    },
    async proposePagePlan(request, context, live) {
      const call = { request, context, attempt: live?.attempt, signal: live?.signal };
      calls.push(call);
      const pagePlan = await answer(call, calls.length - 1);
      return { pagePlan, rationale: 'A warm roastery page.' };
    },
  };
  return { provider, calls, proposed: () => proposed };
}

const REQUEST = 'اعمل صفحة هبوط لمحمصة قهوة مختصة في عمّان';

function options(provider: AiPlanProvider, onEvent?: (event: AiPagePlanEvent) => void) {
  const live = kernel();
  return {
    live,
    options: {
      runId: 'plan-1',
      clock: fixedClock(5),
      kernel: live,
      provider,
      skillRegistry: createCraftkitAiSkillRegistry(),
      target: 'new-page' as const,
      ...(onEvent === undefined ? {} : { onEvent }),
    },
  };
}

describe('planAiPage — step T1 alone, and nothing written', () => {
  it('returns the validated plan after one call, and leaves the document untouched', async () => {
    const { provider, calls, proposed } = planner(() => cafe());
    const { live, options: planOptions } = options(provider);
    const before = live.getDocument();

    const result = await planAiPage(REQUEST, planOptions);

    if (!('plan' in result)) throw new Error(result.error.message);
    expect(result.attempts).toBe(1);
    expect(result.rationale).toBe('A warm roastery page.');
    expect(result.plan.sections.map(({ key }) => key)).toEqual([
      'header',
      'hero',
      'menu',
      'order',
      'footer',
    ]);
    // Normalised by the validator: a palette name became its hex.
    expect(result.plan.tokens.bg).toBe('#f7fee7');
    expect(calls).toHaveLength(1);
    expect(proposed()).toBe(0);
    expect(live.getDocument()).toBe(before);
    expect(live.transactions()).toHaveLength(0);
  });

  it('forces the host’s target onto the plan’s intent', async () => {
    const { provider } = planner(() => cafe());
    const { options: planOptions } = options(provider);

    const result = await planAiPage(REQUEST, { ...planOptions, target: 'replace' });

    if (!('plan' in result)) throw new Error(result.error.message);
    expect(result.plan.intent).toBe('replace');
  });

  it('repairs once with exactly the validator’s issues, and reports two attempts', async () => {
    const { provider, calls } = planner((call) =>
      call.attempt === undefined ? unreadable() : cafe(),
    );
    const events: AiPagePlanEvent[] = [];
    const { options: planOptions } = options(provider, (event) => events.push(event));

    const result = await planAiPage(REQUEST, planOptions);

    if (!('plan' in result)) throw new Error(result.error.message);
    expect(result.attempts).toBe(2);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.attempt?.pagePlan).toEqual(unreadable());
    expect(calls[1]?.attempt?.issues.some(({ path }) => path.startsWith('tokens.muted'))).toBe(
      true,
    );
    expect(events.map(({ type }) => type)).toEqual([
      'page-plan.started',
      'page-plan.repairing',
      'page-plan.ready',
    ]);
    expect(events.every(({ runId }) => runId === 'plan-1')).toBe(true);
  });

  it('gives up after the one repair, with the issues that remain — never a third call', async () => {
    const { provider, calls } = planner(() => unreadable());
    const events: AiPagePlanEvent[] = [];
    const { options: planOptions } = options(provider, (event) => events.push(event));

    const result = await planAiPage(REQUEST, planOptions);

    if (!('error' in result)) throw new Error('expected the plan to be refused');
    expect(result.error.code).toBe('plan-rejected');
    expect(result.issues?.some(({ path }) => path.startsWith('tokens.muted'))).toBe(true);
    expect(calls).toHaveLength(2);
    expect(events.at(-1)?.type).toBe('page-plan.failed');
  });

  it('answers "unsupported" for a provider that cannot plan a page, and asks it nothing', async () => {
    let asked = 0;
    const provider: AiPlanProvider = {
      propose() {
        asked += 1;
        return Promise.reject(new Error('never'));
      },
    };
    const { options: planOptions } = options(provider);

    const result = await planAiPage(REQUEST, planOptions);

    if (!('error' in result)) throw new Error('expected an error');
    expect(result.error.code).toBe('unsupported');
    expect(asked).toBe(0);
  });

  it('turns a provider failure into data, and rejects with AbortError on the caller’s abort', async () => {
    const failing = planner(() =>
      Promise.reject(
        new AiProviderError('The service is unavailable.', {
          code: 'network',
          retryable: true,
        }),
      ),
    );
    const failed = await planAiPage(REQUEST, options(failing.provider).options);
    if (!('error' in failed)) throw new Error('expected an error');
    expect(failed.error.source).toBe('provider');

    const controller = new AbortController();
    const stopped = planner(() => {
      controller.abort();
      const abort = new Error('aborted');
      abort.name = 'AbortError';
      return Promise.reject(abort);
    });
    await expect(
      planAiPage(REQUEST, { ...options(stopped.provider).options, signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('plans with the deck, the variants, the copy rules and the Arabic rules — and nothing page-level besides', async () => {
    const { provider, calls } = planner(() => cafe());
    await planAiPage(REQUEST, options(provider).options);

    const context = calls[0]?.context;
    const skills = (context?.skills ?? []).map(({ id }) => id);
    expect(skills).toEqual(
      expect.arrayContaining([
        'craftkit.direction-deck',
        'craftkit.section-variants',
        'craftkit.copywriting',
        'craftkit.arabic-rtl',
      ]),
    );
    // Auto-matching is off: a page archetype's markup rules do not ride into a plan.
    expect(skills).not.toContain('craftkit.page-composition');
    expect(skills).not.toContain('craftkit.build-scaffold');
    // A plan writes no command and places no block: the catalog is only what the page holds.
    expect(context?.commands).toEqual([]);
    expect(context?.blocks.map(({ type }) => type)).toEqual(['page']);
    // The photos it may plan with, filtered by the request.
    const photos = context?.fragments.find(({ title }) => title === PHOTO_CATALOG_FRAGMENT_TITLE);
    expect(photos).toBeDefined();
    expect(
      (JSON.parse(photos?.body ?? '{}') as { photos: unknown[] }).photos.length,
    ).toBeGreaterThan(0);
  });

  it('leaves the Arabic rules out of an English plan', async () => {
    const { provider, calls } = planner(() => cafe());
    await planAiPage('Build a landing page for my coffee roastery', options(provider).options);

    expect((calls[0]?.context.skills ?? []).map(({ id }) => id)).not.toContain(
      'craftkit.arabic-rtl',
    );
  });

  it('asks for the row’s B look when the person asks for another look', async () => {
    const { provider, calls } = planner(() => cafe());
    await planAiPage('جرّب شكل ثاني لصفحة المحمصة', options(provider).options);
    await planAiPage('try another look for the roastery page', options(provider).options);
    await planAiPage(REQUEST, options(provider).options);

    expect(calls[0]?.request).toContain('\nVARIANT: B\n');
    expect(calls[1]?.request).toContain('\nVARIANT: B\n');
    expect(calls[2]?.request.startsWith(REQUEST)).toBe(true);
    expect(calls[2]?.request).not.toContain('VARIANT');
  });

  it('tells the planner where the page lands, so an appended plan is not refused for its hero', async () => {
    const { provider, calls } = planner(() => cafe());
    await planAiPage(REQUEST, { ...options(provider).options, target: 'append' });

    expect(calls[0]?.request).toMatch(
      /\nINTENT: append — [^\n]*no header|\nINTENT: append — [^\n]*bands/u,
    );
  });

  /*
    Plan mode, then Build: the plan card's plan is built verbatim, intent and
    all. Before this, a planAiPage with no target left the MODEL's intent
    standing — on a page with seven regions it answered 'replace' and
    runAiBuild({ pagePlan }) replaced the page, while a direct Build on the
    same page was told 'INTENT: append' (wave-1 verifier, v2 scenario 5,
    2026-09-28). No target now means the build's own rule.
  */
  it('holds a page with content to append when the host names no target, whatever the model wrote', async () => {
    const { provider, calls } = planner(() => ({ ...cafeBands(), intent: 'replace' }));
    const live = builtKernel();
    const before = live.getDocument();

    const result = await planAiPage(REQUEST, untargeted(live, provider));

    expect(calls[0]?.request).toContain('\nINTENT: append — ');
    if (!('plan' in result)) throw new Error(result.error.message);
    expect(result.plan.intent).toBe('append');
    expect(live.getDocument()).toBe(before);
  });

  it('replaces an empty page when the host names no target — the build’s rule, not the model’s', async () => {
    const { provider, calls } = planner(() => cafe());

    const result = await planAiPage(REQUEST, untargeted(kernel(), provider));

    expect(calls[0]?.request).toContain('\nINTENT: replace — ');
    if (!('plan' in result)) throw new Error(result.error.message);
    expect(result.plan.intent).toBe('replace');
  });
});

/** A page a person already made: a heading AND a paragraph is content, not a placeholder. */
function builtKernel(): BuilderKernel {
  const tree = {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        children: [
          { kind: 'element', tag: 'h2', text: 'Our story', children: [] },
          { kind: 'element', tag: 'p', text: 'Roasting since 2019.', children: [] },
        ],
      },
    ],
  };
  const document: BuilderDocument = {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'page', props: { title: 'Home' }, slots: { default: ['story'] } },
      story: { id: 'story', type: 'customCode', props: { label: 'Our story', tree } },
    },
  };
  return createBuilder({
    document,
    extensions: [manifest()],
    ports: { clock: fixedClock(1), ids: seededIds('plan-built') },
  });
}

/** The café plan as sections added to a page: its bands and its call to action only. */
function cafeBands(): Record<string, unknown> {
  const plan = cafe();
  const sections = plan['sections'] as { role: string }[];
  return {
    ...plan,
    intent: 'append',
    sections: sections.filter(({ role }) => role === 'band' || role === 'cta'),
  };
}

/** Plan-mode options with no `target`: the step reads the page. */
function untargeted(live: BuilderKernel, provider: AiPlanProvider) {
  return {
    runId: 'plan-untargeted',
    clock: fixedClock(5),
    kernel: live,
    provider,
    skillRegistry: createCraftkitAiSkillRegistry(),
  };
}

describe('anotherLookRequested — how "try another look" reaches the deck', () => {
  it.each([
    'try another look',
    'Give it a different look',
    'a new look for the hero please',
    'جرب شكل ثاني',
    'بدي شكل آخر للصفحة',
    'غيّر الشكل',
    'تصميم مختلف لو سمحت',
    'VARIANT: B',
    /*
      MSA accusative with tanween, as a person writing formally types it: after
      tashkeel is folded the noun keeps its alif ("شكلاً" → "شكلا"), and the
      wave-1 verifier found all four read as no request (2026-09-28).
    */
    'جرّب شكلاً آخر',
    'تصميماً آخر',
    'أريد مظهرًا مختلفًا',
    'شكلاً جديداً',
  ])('reads "%s" as a request for the other look', (request) => {
    expect(anotherLookRequested(request)).toBe(true);
  });

  it.each([
    'make the hero title bigger',
    'Build a landing page for my coffee roastery',
    'look at the pricing section',
    'اعمل صفحة هبوط لمحمصة',
    'غيّر لون الزر',
    // "I want a design for my restaurant's page" is a first build, not another look.
    'أريد تصميم صفحة لمطعمي',
    'أريد تصميماً لصفحة مطعمي',
  ])('leaves "%s" alone', (request) => {
    expect(anotherLookRequested(request)).toBe(false);
  });
});
