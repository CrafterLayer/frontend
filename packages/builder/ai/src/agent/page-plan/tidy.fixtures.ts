import type { JsonValue } from '@craftkit/builder-schema';

import type { AiPlan } from '../../types';
import { validatePagePlan } from './validate-page-plan';
import type { PagePlan, SectionContract } from './types';

/*
  Test-only plans and builders for the code repairs (tidy-*.test.ts and the
  measurement): the builder page whose accent does not read as text
  (yellow-400 on white, 1.53:1) and the café whose accent does, as the
  checker's own tests use them.
*/

function accepted(value: unknown): PagePlan {
  const result = validatePagePlan(value);
  if (!result.ok) throw new Error(result.issues.map((i) => `${i.path}: ${i.message}`).join('\n'));
  return result.plan;
}

export const BUILDER_PLAN = accepted({
  intent: 'new-page',
  locale: { lang: 'en' },
  title: 'Hadid Build',
  description: 'Residential construction in Amman.',
  tokens: {
    bg: 'white',
    surface: 'zinc-100',
    ink: 'zinc-900',
    muted: 'zinc-600',
    accent: 'yellow-400',
    onAccent: 'zinc-900',
    border: 'zinc-300',
    fontDisplay: { family: 'Archivo Black' },
    fontBody: { family: 'Archivo', weights: [400, 600] },
    radius: 'none',
    signature: 'a yellow rule under every heading',
  },
  primaryCta: { label: 'Get a quote', href: '#quote' },
  nav: [{ label: 'Projects', anchorId: 'projects' }],
  sections: [
    { key: 'hero', role: 'hero', title: 'Built to outlast', anchorId: 'hero', purpose: 'Pitch.' },
    {
      key: 'projects',
      role: 'band',
      title: 'Projects',
      anchorId: 'projects',
      purpose: 'Proof.',
      mustSay: ['120 homes delivered'],
    },
    { key: 'quote', role: 'cta', title: 'Quote', anchorId: 'quote', purpose: 'Convert.' },
  ],
  facts: [],
});

export const CAFE_PLAN = accepted({
  intent: 'new-page',
  locale: { lang: 'ar' },
  title: 'محمصة الهيل',
  description: 'قهوة مختصة محمصة في عمّان.',
  tokens: {
    bg: 'lime-50',
    surface: 'white',
    ink: 'emerald-950',
    muted: 'emerald-800',
    accent: 'orange-700',
    onAccent: 'white',
    border: '#E7E5E4',
    fontDisplay: { family: 'Lalezar' },
    fontBody: { family: 'Almarai', weights: [400, 700] },
    radius: 'xl',
    signature: 'the brand name, faint behind the menu',
  },
  primaryCta: { label: 'اطلب الآن', href: '#order' },
  nav: [{ label: 'القائمة', anchorId: 'menu' }],
  sections: [
    {
      key: 'hero',
      role: 'hero',
      title: 'قهوة تُحمّص كل صباح',
      anchorId: 'hero',
      purpose: 'Pitch.',
    },
    { key: 'menu', role: 'band', title: 'القائمة', anchorId: 'menu', purpose: 'The drinks.' },
    { key: 'order', role: 'cta', title: 'اطلب', anchorId: 'order', purpose: 'Order.' },
  ],
  facts: [],
});

export function contractOf(plan: PagePlan, key: string): SectionContract {
  const found = plan.sections.find((section) => section.key === key);
  if (found === undefined) throw new Error(`no section ${key}`);
  return found;
}

export type FixtureNode = Record<string, JsonValue>;

/** An element: `h('p', 'ck-muted', 'text')` or `h('div', '', [children], { id })`. */
export function h(
  tag: string,
  className: string,
  content: string | FixtureNode[] = [],
  attributes?: Record<string, string>,
): FixtureNode {
  return {
    kind: 'element',
    tag,
    ...(className === '' ? {} : { className }),
    ...(typeof content === 'string' ? { text: content } : { children: content }),
    ...(attributes === undefined ? {} : { attributes }),
  };
}

export function tree(...children: FixtureNode[]): JsonValue {
  return { kind: 'root', children };
}

/** A writer's steps for region `r-1`: the tree, then css and js when given. */
export function writerSteps(
  value: JsonValue,
  extra: { readonly css?: string; readonly js?: string; readonly jsParams?: JsonValue } = {},
): AiPlan['commands'] {
  const step = (key: string, stepValue: JsonValue) => ({
    command: 'setProp',
    args: { id: 'r-1', key, value: stepValue },
  });
  return [
    step('tree', value),
    ...(extra.css === undefined ? [] : [step('css', extra.css)]),
    ...(extra.js === undefined ? [] : [step('js', extra.js)]),
    ...(extra.jsParams === undefined ? [] : [step('jsParams', extra.jsParams)]),
  ];
}

/** The value the last step of `key` writes. */
export function written(commands: AiPlan['commands'], key: string): unknown {
  const step = [...commands]
    .reverse()
    .find((entry) => (entry.args as { key?: unknown } | undefined)?.key === key);
  return (step?.args as { value?: unknown } | undefined)?.value;
}

/** A builder hero that honours its contract, with `inner` added after its action. */
export function builderHero(inner: FixtureNode[] = [], outer = 'ck-ground py-24'): JsonValue {
  return tree(
    h(
      'section',
      outer,
      [
        h('h1', 'text-6xl', 'Built to outlast'),
        h('p', 'ck-muted', 'Licensed since 2004 — family-run, on site every day.'),
        h('a', 'ck-btn', 'Get a quote', { href: '#quote' }),
        ...inner,
      ],
      { id: 'hero' },
    ),
  );
}

/** A builder projects band that honours its contract, with `inner` added. */
export function builderBand(
  inner: FixtureNode[] = [],
  attributes: Record<string, string> = { id: 'projects' },
): JsonValue {
  return tree(
    h(
      'section',
      'ck-surface py-24',
      [
        h('h2', 'text-4xl', 'Projects'),
        h('p', 'ck-muted', '120 homes delivered since 2004.'),
        ...inner,
      ],
      attributes,
    ),
  );
}
