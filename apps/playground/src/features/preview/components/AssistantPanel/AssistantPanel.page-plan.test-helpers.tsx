/* Shared fixtures for the page-plan and routing suites (split from AssistantPanel.test.tsx, 2026-10-13). */

import { fixedClock, seededIds } from '@craftkit/builder/testing';
import {
  AiProviderError,
  createBuilder,
  customCodeSchema,
  defineBlockSchema,
  type AiPlan,
  type AiPlanProvider,
  type BuilderDocument,
  type BuilderKernel,
  type JsonValue,
  type TrustedExtensionManifest,
} from '@craftkit/builder';
import { z } from 'zod';
import { nullRender as Null } from './AssistantPanel.test-helpers';
import { regionList } from './AssistantPanel.split-build.test-helpers';

/*
  A PAGE-PLAN build (agent-audit §3.1): the provider answers the page as a
  structured plan, code lays the skeleton from it — writing some regions IN
  FULL (the footer, from the plan's facts) — and one writer fills each of the
  rest against its contract. It needs the product's region block
  (`customCode`) and a provider with `proposePagePlan`; the scaffold fixtures
  above have neither, which is why they always took the scaffold path.
*/
export const planRoot = defineBlockSchema({
  type: 'planPage',
  description: 'The page root a page plan is laid into.',
  props: z.object({
    title: z.string().max(120).default(''),
    description: z.string().max(200).default(''),
    lang: z.string().max(12).default(''),
  }),
  slots: { default: { allow: ['customCode'] } },
  examples: [],
});
export const planVocabulary: TrustedExtensionManifest = {
  tier: 1,
  name: 'assistant-panel.plan-vocabulary',
  version: '0.0.0',
  contributes: {
    blocks: [
      { schema: planRoot, render: Null },
      { schema: customCodeSchema, render: Null },
    ],
  },
};

/** A region a person wrote: a heading AND a paragraph, so it is content, not a placeholder. */
export function writtenTree(heading: string): JsonValue {
  return {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        children: [
          { kind: 'element', tag: 'h2', text: heading, children: [] },
          { kind: 'element', tag: 'p', text: 'Written by hand.', children: [] },
        ],
      },
    ],
  };
}

export function createPlanKernel(existing: readonly string[] = []): BuilderKernel {
  const nodes: BuilderDocument['nodes'] = {
    root: {
      id: 'root',
      type: 'planPage',
      props: {},
      slots: { default: existing.map((_, index) => `mine-${String(index)}`) },
    },
  };
  existing.forEach((label, index) => {
    const id = `mine-${String(index)}`;
    nodes[id] = { id, type: 'customCode', props: { label, tree: writtenTree(label) } };
  });
  return createBuilder({
    document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes },
    extensions: [planVocabulary],
    ports: { clock: fixedClock(0), ids: seededIds('assistant-plan') },
  });
}

/** The region labels on the page, in reading order. */
export function planLabels(kernel: BuilderKernel): string[] {
  return regionList(kernel).map(([label]) => label);
}

export const START_OVER_REQUEST = 'start over and build me a landing page for my ceramics studio';
export const PLAN_REQUEST =
  'Build a landing page for my specialty coffee roastery in Amman, Northlight Coffee';
/*
  'Header' first: every full page has one (page-completion.ts `withPageChrome`,
  2026-10-05), so the plan states it rather than having the engine add it.
*/
export const PLAN_TITLES = [
  'Header',
  'Roasted this morning',
  'Our coffees',
  'Order today',
  'Footer',
];

/** A plan the engine's validator accepts (the wave-2 verifier's pageplan-revert.mjs, verbatim). */
export const COFFEE_PLAN = {
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
      key: 'header',
      role: 'header',
      title: 'Header',
      anchorId: 'header',
      purpose: 'The brand, the menu and the page’s one action.',
    },
    {
      key: 'hero',
      role: 'hero',
      title: 'Roasted this morning',
      anchorId: 'hero',
      purpose: 'Say what the roastery is and invite the first order.',
      mustSay: ['Roasted in Amman'],
      variant: 'split',
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
};

/**
 * A fill that keeps its section's contract, read off the brief the way a
 * writer would: its anchor, its heading level, what it must say, its action.
 */
export function contractTree(request: string): JsonValue {
  const anchor = /ANCHOR:[^\n]*id="([^"]+)"/u.exec(request)?.[1] ?? 'section';
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
        children: [
          { kind: 'element', tag: hero ? 'h1' : 'h2', text: title, children: [] },
          ...mustSay.map((line) => ({ kind: 'element', tag: 'p', text: line, children: [] })),
          ...(cta && action !== null
            ? [
                {
                  kind: 'element',
                  tag: 'a',
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

/**
 * A provider that plans the page (or, with `planFails`, cannot — and then the
 * engine lays a scaffold with it instead), and fills each region it is handed.
 */
export function planningProvider(options: { readonly planFails?: boolean } = {}): AiPlanProvider {
  return {
    propose(request, context) {
      const id = context.selection.ids[0] ?? /REGION ID: (\S+)/u.exec(request)?.[1];
      if (id === undefined) {
        // The scaffold, reached only when the plan failed: one region per title.
        return Promise.resolve<AiPlan>({
          rationale: 'A warm roastery page.',
          commands: PLAN_TITLES.map((title) => ({
            command: 'insertNode',
            args: {
              type: 'customCode',
              parentId: 'root',
              props: {
                label: title,
                tree: {
                  kind: 'root',
                  children: [
                    {
                      kind: 'element',
                      tag: 'section',
                      children: [{ kind: 'element', tag: 'h2', text: title, children: [] }],
                    },
                  ],
                },
              },
            },
          })),
        });
      }
      return Promise.resolve<AiPlan>({
        rationale: 'Filled.',
        commands: [{ command: 'setProp', args: { id, key: 'tree', value: contractTree(request) } }],
      });
    },
    proposePagePlan() {
      return options.planFails === true
        ? Promise.reject(
            new AiProviderError('No page plan today.', { code: 'refusal', retryable: false }),
          )
        : Promise.resolve({ pagePlan: COFFEE_PLAN, rationale: 'A warm roastery page.' });
    },
  };
}
