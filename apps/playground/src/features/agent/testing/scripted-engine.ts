/**
 * A scripted engine for controller tests (SPEC §8 WP-16: "tests with a scripted provider
 * and a headless kernel"): real kernels through the real door, real `runAiBuild` /
 * `runAiAgent` / `planAiPage`, and providers that answer from a script, never a network.
 *
 * Ported from the v1 panel's own fixtures (`AssistantPanel.test.tsx` "split build",
 * "a page-plan build", "routing"), so the v2 controller is held to the same scenarios the
 * v1 panel was: a skeleton plus one writer per region found by the selection the build
 * scoped it to, fills held open on a gate, a refusal for a named section, a provider that
 * plans a page, and an Ask proposal.
 *
 * Test-only: it imports `@craftkit/builder/testing`, which stories never load.
 */
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
  type PagePlanCandidate,
  type TrustedExtensionManifest,
} from '@craftkit/builder';
import { fixedClock, seededIds } from '@craftkit/builder/testing';
import { z } from 'zod';

import type { EnhanceInput, EnhanceResult, PromptEnhancer } from '../model/enhance';
import type { AgentStorage } from '../model/migrate-sessions';

/* ── Vocabulary ──────────────────────────────────────────────────────────────── */

const Null = () => null;

const page = defineBlockSchema({
  type: 'page',
  description: 'The page root.',
  props: z.object({}),
  slots: { default: { allow: ['hero', 'pricing'], max: 4 } },
  examples: [],
});

const hero = defineBlockSchema({
  type: 'hero',
  description: 'An opening section with a heading.',
  props: z.object({ heading: z.string().min(1).default('Your headline') }),
  examples: [{ prompt: 'add a hero', node: { type: 'hero', props: { heading: 'Hello' } } }],
});

const pricing = defineBlockSchema({
  type: 'pricing',
  description: 'A pricing section.',
  props: z.object({ heading: z.string().min(1).default('Pricing') }),
  examples: [{ prompt: 'add a pricing section', node: { type: 'pricing', props: {} } }],
});

/*
  The region's content prop is `tree`: a section writer may write only its OWN region's
  `tree` and `css` (the engine's target guard), so a fixture writing anything else would
  have every section dropped, which is the guard working.
*/
const region = defineBlockSchema({
  type: 'region',
  description: 'A freely composed page section.',
  props: z.object({
    label: z.string().default('Section'),
    tree: z.string().default(''),
  }),
  examples: [],
});

const buildRoot = defineBlockSchema({
  type: 'buildPage',
  description: 'The page root a build scaffolds into.',
  props: z.object({}),
  slots: { default: { allow: ['region'] } },
  examples: [],
});

const planRoot = defineBlockSchema({
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

const EDIT_VOCABULARY: TrustedExtensionManifest = {
  tier: 1,
  name: 'agent-controller.edit-vocabulary',
  version: '0.0.0',
  contributes: {
    blocks: [
      { schema: page, render: Null },
      { schema: hero, render: Null },
      { schema: pricing, render: Null },
    ],
  },
};

const BUILD_VOCABULARY: TrustedExtensionManifest = {
  tier: 1,
  name: 'agent-controller.build-vocabulary',
  version: '0.0.0',
  contributes: {
    blocks: [
      { schema: buildRoot, render: Null },
      { schema: region, render: Null },
    ],
  },
};

const PLAN_VOCABULARY: TrustedExtensionManifest = {
  tier: 1,
  name: 'agent-controller.plan-vocabulary',
  version: '0.0.0',
  contributes: {
    blocks: [
      { schema: planRoot, render: Null },
      { schema: customCodeSchema, render: Null },
    ],
  },
};

/* ── Kernels ─────────────────────────────────────────────────────────────────── */

/** A page with one hero (`selected-hero`), for edits, proposals and questions. */
export function createEditKernel(): BuilderKernel {
  return createBuilder({
    document: {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: 'root',
      nodes: {
        root: { id: 'root', type: 'page', props: {}, slots: { default: ['selected-hero'] } },
        'selected-hero': {
          id: 'selected-hero',
          type: 'hero',
          props: { heading: 'Existing section' },
        },
      },
    },
    extensions: [EDIT_VOCABULARY],
    ports: { clock: fixedClock(0), ids: seededIds('agent-edit') },
  });
}

/** An empty page a scaffold build lays regions into. */
export function createBuildKernel(): BuilderKernel {
  return createBuilder({
    document: {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: 'root',
      nodes: { root: { id: 'root', type: 'buildPage', props: {}, slots: { default: [] } } },
    },
    extensions: [BUILD_VOCABULARY],
    ports: { clock: fixedClock(0), ids: seededIds('agent-build') },
  });
}

/** A page a page-plan build lays `customCode` regions into, optionally with content. */
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
    extensions: [PLAN_VOCABULARY],
    ports: { clock: fixedClock(0), ids: seededIds('agent-plan') },
  });
}

/** A region a person wrote: a heading and a paragraph, so it is content, not a placeholder. */
function writtenTree(heading: string): JsonValue {
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

/* ── Reading the page ────────────────────────────────────────────────────────── */

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Every region on the page, in reading order, as `[label, tree]`. */
export function regionList(kernel: BuilderKernel): (readonly [string, string])[] {
  const document = kernel.getDocument();
  return (document.nodes[document.rootId]?.slots?.['default'] ?? []).map((id) => {
    const node = document.nodes[id];
    return [text(node?.props['label']), text(node?.props['tree'])] as const;
  });
}

/** Every region on the page, as `label → tree`. */
export function regionsOf(kernel: BuilderKernel): Record<string, string> {
  return Object.fromEntries(regionList(kernel));
}

/** The id of the (first) region with this label. */
export function regionId(kernel: BuilderKernel, label: string): string {
  const document = kernel.getDocument();
  const id = Object.keys(document.nodes).find((key) => document.nodes[key]?.props['label'] === label);
  if (id === undefined) throw new Error(`No region is labelled "${label}".`);
  return id;
}

/** The kernel's history labels, oldest first. */
export function historyLabels(kernel: BuilderKernel): string[] {
  return kernel.transactions().map(({ command }) => command);
}

/* ── Deferred ────────────────────────────────────────────────────────────────── */

export interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(cause: unknown): void;
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((settle, fail) => {
    resolve = settle;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/* ── Providers ───────────────────────────────────────────────────────────────── */

export const BUILD_REQUEST = 'build me a landing page for my ceramics studio';
export const BUILD_DIRECTION =
  'A calm studio page for ceramicists. Palette bg-white text-slate-900. Faces Inter and Inter.';

export interface BuildScript {
  readonly provider: AiPlanProvider;
  /** How many times the provider was asked: one scaffold plus one per fill. */
  calls(): number;
  /** Fills held open, by section title. */
  readonly gates: Map<string, Deferred<AiPlan>>;
  /** The titles each fill was asked for, in the order they were asked. */
  readonly fills: string[];
  /** The titles the provider refuses now; a test deletes one to let a retry succeed. */
  readonly refused: Set<string>;
}

export interface BuildScriptOptions {
  /** Fills held open until the test resolves their gate. */
  readonly hold?: readonly string[] | undefined;
  /** Fills the provider refuses. */
  readonly refuse?: readonly string[] | undefined;
  /** Fills refused on their first ask only (a retry then succeeds). */
  readonly refuseOnce?: readonly string[] | undefined;
}

/**
 * A scripted build: one scaffold naming every section, then one fill per region, found by
 * the selection the orchestrator scoped that run to (a scaffold is the run with nothing
 * selected). Never a network, never a guess about which region a fill was handed.
 */
export function scriptBuild(
  kernel: BuilderKernel,
  titles: readonly string[],
  options: BuildScriptOptions = {},
): BuildScript {
  const gates = new Map<string, Deferred<AiPlan>>();
  const fills: string[] = [];
  const refused = new Set(options.refuse ?? []);
  const refusedOnce = new Set<string>();
  let calls = 0;
  const provider: AiPlanProvider = {
    propose(_request, context) {
      calls += 1;
      if (context.selection.ids.length === 0) {
        return Promise.resolve<AiPlan>({
          rationale: BUILD_DIRECTION,
          commands: titles.map((title) => ({
            command: 'insertNode',
            args: { type: 'region', parentId: 'root', props: { label: title, tree: '' } },
          })),
        });
      }
      const id = context.selection.ids[0];
      if (id === undefined) throw new Error('A fill reached the provider with no region selected.');
      const title = text(kernel.getDocument().nodes[id]?.props['label']);
      fills.push(title);
      const once = options.refuseOnce?.includes(title) === true && !refusedOnce.has(title);
      if (once) refusedOnce.add(title);
      if (refused.has(title) || once) {
        return Promise.reject(
          new AiProviderError(`The model would not write "${title}".`, {
            code: 'refusal',
            retryable: false,
          }),
        );
      }
      const plan: AiPlan = {
        rationale: `Fill ${title}.`,
        commands: [{ command: 'setProp', args: { id, key: 'tree', value: `Body for ${title}.` } }],
      };
      if (options.hold?.includes(title) === true) {
        const gate = gates.get(title) ?? deferred<AiPlan>();
        gates.set(title, gate);
        return gate.promise;
      }
      return Promise.resolve(plan);
    },
  };
  return { provider, calls: () => calls, gates, fills, refused };
}

/** The fill a held gate answers with: the section's body, into its own region. */
export function fillFor(kernel: BuilderKernel, title: string): AiPlan {
  return {
    rationale: `Fill ${title}.`,
    commands: [
      { command: 'setProp', args: { id: regionId(kernel, title), key: 'tree', value: `Body for ${title}.` } },
    ],
  };
}

/** An edit provider: every request is answered with `commands` on the page as it is. */
export function editProvider(commands: AiPlan['commands'], rationale = 'Edit the page.'): AiPlanProvider {
  let calls = 0;
  const provider: AiPlanProvider & { calls?: () => number } = {
    propose() {
      calls += 1;
      return Promise.resolve({ rationale, commands });
    },
  };
  provider.calls = () => calls;
  return provider;
}

/** A provider that answers in words only (a question, or Plan mode's change plan). */
export function wordsProvider(rationale: string): AiPlanProvider & { calls: () => number } {
  let calls = 0;
  return {
    propose() {
      calls += 1;
      return Promise.resolve({ rationale, commands: [] });
    },
    calls: () => calls,
  };
}

export const PLAN_TITLES = ['Roasted this morning', 'Our coffees', 'Order today', 'Footer'];

/** A plan the engine's validator accepts (the v1 panel's COFFEE_PLAN, verbatim). */
export function coffeePlan(): PagePlanCandidate {
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
  } as PagePlanCandidate;
}

/**
 * A fill that keeps its section's contract, read off the brief the way a writer would:
 * its anchor, its heading level, what it must say, its action.
 */
function contractTree(request: string): JsonValue {
  const anchor = /ANCHOR:[^\n]*id="([^"]+)"/u.exec(request)?.[1] ?? 'section';
  const title = /SECTION \d+ OF \d+: ([^\n]+)/u.exec(request)?.[1] ?? 'Section';
  const isHero = request.includes('ROLE: HERO');
  const mustSay = [...(/MUST SAY: ([^\n]+)/u.exec(request)?.[1] ?? '').matchAll(/"([^"]+)"/gu)].map(
    (match) => match[1] ?? '',
  );
  const action = /PRIMARY ACTION: "([^"]+)" → (\S+)/u.exec(request);
  const cta = isHero || request.includes('ROLE: CTA');
  return {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        attributes: { id: anchor },
        children: [
          { kind: 'element', tag: isHero ? 'h1' : 'h2', text: title, children: [] },
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

/** A provider that plans the page (Plan mode's `planAiPage`) and fills each region. */
export function planningProvider(): AiPlanProvider & { planCalls: () => number } {
  let planCalls = 0;
  return {
    propose(request, context) {
      const id = context.selection.ids[0] ?? /REGION ID: (\S+)/u.exec(request)?.[1];
      if (id === undefined) {
        return Promise.resolve<AiPlan>({ rationale: 'No scaffold here.', commands: [] });
      }
      return Promise.resolve<AiPlan>({
        rationale: 'Filled.',
        commands: [{ command: 'setProp', args: { id, key: 'tree', value: contractTree(request) } }],
      });
    },
    proposePagePlan() {
      planCalls += 1;
      return Promise.resolve({ pagePlan: coffeePlan(), rationale: 'A warm roastery page.' });
    },
    planCalls: () => planCalls,
  };
}

/* ── Storage and the enhancer ────────────────────────────────────────────────── */

export interface MemoryStorage extends AgentStorage {
  readonly data: Map<string, string>;
  /** Every write, in order: `[key, value]`. */
  readonly writes: (readonly [string, string])[];
}

export function memoryStorage(seed: Readonly<Record<string, string>> = {}): MemoryStorage {
  const data = new Map(Object.entries(seed));
  const writes: (readonly [string, string])[] = [];
  return {
    data,
    writes,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      writes.push([key, value]);
      data.set(key, value);
    },
  };
}

export interface ScriptedEnhancer extends PromptEnhancer {
  readonly calls: EnhanceInput[];
}

/**
 * An enhancer answering from a script: `answer(input)` decides, so a test can return
 * questions on the first call and a rewrite once the answers arrive.
 */
export function scriptedEnhancer(
  answer: (input: EnhanceInput) => Partial<EnhanceResult> | Error,
): ScriptedEnhancer {
  const calls: EnhanceInput[] = [];
  return {
    calls,
    enhance: (input) => {
      calls.push(input);
      const result = answer(input);
      if (result instanceof Error) return Promise.reject(result);
      return Promise.resolve({
        enhanced: result.enhanced ?? '',
        understood: result.understood ?? '',
        changes: result.changes ?? [],
        questions: result.questions ?? [],
      });
    },
  };
}
