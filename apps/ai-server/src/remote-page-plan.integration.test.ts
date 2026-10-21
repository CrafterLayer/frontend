import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';

import {
  createBuilder,
  createRemoteAiPlanProvider,
  defineBlockSchema,
  headlessBlockManifest,
  pageSchema,
  runAiBuild,
  type AiPlanProvider,
  type BuilderKernel,
  type IdPort,
  type RunAiBuildOptions,
} from '@craftkit/builder/headless';
import type { AiPlanWireRequest } from '@craftkit/builder/wire';

import { createHandler } from './handler';
import { PAGE_PLAN_ANSWER_SCHEMA, PAGE_PLAN_EXAMPLE } from './plan-shape';

/*
  REACHABILITY, end to end and in process (2026-09-28): the real remote
  provider, whose fetch calls this server's real handler, whose backend is a
  fake that answers the wire's documented page plan — and `runAiBuild` on a
  headless kernel must take step T1 (one page-plan call, the code-written
  skeleton, contract writers) and never ask a model for a scaffold.

  Why this exists: the PagePlan pipeline shipped with its unit tests green
  and was unreachable from the product — the remote provider had no
  `proposePagePlan`, so every real build silently paid for the ~25k-character
  model-written scaffold it was built to replace (engine wave-2 verifier).
  Every hop of that chain is here except the browser; packages may not import
  apps, so the test lives on the server's side of the wire.

  Two stand-ins, both for what the headless door does not carry:
  - The custom-code block (its pack depends on the renderer, which needs a
    DOM): the region is registered from the Page root's own field types — the
    label is the title's string, the css the pageCss stylesheet (so the colour
    law exempts it, as the real one), the tree a loose object. The door's
    tree-vocabulary law is therefore not exercised here;
    run-build.page-plan.test.ts covers it with the real tree schema.
  - The skill registry: run-build names each step's own skill (the writers'
    craftkit.build-fill, the scaffold's) even when the host has no registry,
    and generation then refuses with "selectedSkillIds requires a
    skillRegistry." — measured here 2026-09-28: every writer skipped and the
    scaffold never ran. A registry that knows no skills is what a skill-less
    headless host means.

  2026-10-05 (speed DESIGN §3): the documented answer is now the COMPACT plan
  — tokens by deck row, an outline, one brief per section with its facts —
  so the fake backend answers what T1 is asked for, and the build must read
  it through the client's expansion (validatePagePlan) into the full plan:
  the row's palette and faces, anchors from keys, the menu from the nav
  labels, each brief merged into its section, the facts ledger from the
  briefs. The fake streams no text, so no draft frames: the classic flow.
*/

const TOKEN = 'integration-secret';
const ENDPOINT = 'https://assistant.example.test/plan';
const REQUEST = 'Build a landing page for my specialty coffee roastery in Amman';

type BuildEvent = Parameters<NonNullable<RunAiBuildOptions['onEvent']>>[0];
type SkillRegistry = NonNullable<RunAiBuildOptions['skillRegistry']>;

/** A registry with no skills in it: every step runs with none. */
const NO_SKILLS: SkillRegistry = {
  list: () => [],
  get: () => undefined,
  readSkill: () => '',
  listReferences: () => [],
  readReference: () => '',
  prepare: () => ({ catalog: [], active: [], activations: [], omitted: [], totalTokens: 0 }),
};

function countingIds(seed: string): IdPort {
  let counter = 0;
  return {
    newId() {
      counter += 1;
      return `${seed}-${counter.toString(36).padStart(4, '0')}`;
    },
  };
}

const regionSchema = defineBlockSchema({
  type: 'customCode',
  description: 'A freely composed region (headless stand-in for the custom-code block).',
  props: pageSchema.props.pick({}).extend({
    label: pageSchema.props.shape.title,
    tree: pageSchema.props.pick({}).loose(),
    css: pageSchema.props.shape.pageCss,
  }),
  examples: [],
});

function kernel(seed: string): BuilderKernel {
  return createBuilder({
    document: {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: 'root',
      nodes: {
        root: { id: 'root', type: 'page', props: { title: 'Home' }, slots: { default: [] } },
      },
    },
    extensions: [headlessBlockManifest('integration-blocks', '0.0.0', [pageSchema, regionSchema])],
    ports: { clock: { now: () => 1 }, ids: countingIds(seed) },
  });
}

/** What a writer that honours its contract writes, read back from the brief it was given. */
function honestSection(brief: string): unknown {
  const anchor = /ANCHOR:[^\n]*id="([^"]+)"/u.exec(brief)?.[1];
  const title = /SECTION \d+ OF \d+: ([^\n]+)/u.exec(brief)?.[1] ?? 'Section';
  const hero = brief.includes('ROLE: HERO');
  const mustSay = [...(/MUST SAY: ([^\n]+)/u.exec(brief)?.[1] ?? '').matchAll(/"([^"]+)"/gu)].map(
    (match) => match[1] ?? '',
  );
  const action = /PRIMARY ACTION: "([^"]+)" → (\S+)/u.exec(brief);
  const cta = hero || brief.includes('ROLE: CTA');
  return {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        ...(anchor === undefined ? {} : { attributes: { id: anchor } }),
        className: 'py-16',
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

interface BackendCall {
  readonly schema: 'page-plan' | 'plan';
  readonly request: string;
}

/**
 * The model, faked at the SDK seam every backend goes through
 * (`messages.stream`): the documented page plan for a page-plan call; for a
 * plan call, a writer's fill when the brief names a region, else a scaffold
 * of two regions — the answer an old server gives to ANY request.
 */
function fakeBackend(calls: BackendCall[]): Anthropic {
  return {
    messages: {
      stream: (params: {
        readonly output_config?: { readonly format?: { readonly schema?: unknown } };
        readonly messages?: readonly { readonly content: unknown }[];
      }) => {
        const pagePlan = params.output_config?.format?.schema === PAGE_PLAN_ANSWER_SCHEMA;
        const said = (params.messages ?? [])
          .map(({ content }) => (typeof content === 'string' ? content : JSON.stringify(content)))
          .join('\n');
        const marker = '# The request\n';
        const request = said.includes(marker)
          ? said.slice(said.lastIndexOf(marker) + marker.length)
          : said;
        calls.push({ schema: pagePlan ? 'page-plan' : 'plan', request });
        const region = /REGION ID: (\S+)/u.exec(request)?.[1];
        const answer = pagePlan
          ? PAGE_PLAN_EXAMPLE
          : region !== undefined
            ? {
                rationale: 'filled',
                commands: [
                  {
                    command: 'setProp',
                    args: { id: region, key: 'tree', value: honestSection(request) },
                  },
                ],
              }
            : {
                rationale: 'A roastery. 1 Hero · 2 Menu',
                commands: ['Hero', 'Menu'].map((label) => ({
                  command: 'insertNode',
                  args: {
                    type: 'customCode',
                    parentId: 'root',
                    props: { label, tree: honestSection(`SECTION 1 OF 2: ${label}`) },
                  },
                })),
              };
        return {
          on: () => undefined,
          finalMessage: () =>
            Promise.resolve({
              stop_reason: 'end_turn',
              stop_details: null,
              content: [{ type: 'text', text: JSON.stringify(answer) }],
              usage: { input_tokens: 10, output_tokens: 10 },
            }),
        };
      },
    },
  } as unknown as Anthropic;
}

interface WireCall {
  readonly url: string;
  readonly authorization: string | null;
  readonly body: AiPlanWireRequest;
}

/**
 * The real remote provider, its fetch calling the real handler in process.
 * `olderServer` strips the fields a server before 2026-09-28 never read, so
 * the handler answers a page-plan request as the plan request it then was.
 */
function remoteOverHandler(options: { readonly olderServer?: boolean } = {}) {
  const backend: BackendCall[] = [];
  const wire: WireCall[] = [];
  const handle = createHandler({ client: fakeBackend(backend), authToken: TOKEN });
  const provider: AiPlanProvider = createRemoteAiPlanProvider({
    endpoint: ENDPOINT,
    headers: { authorization: `Bearer ${TOKEN}` },
    timeoutMs: 60_000,
    fetch: (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (typeof init?.body !== 'string') throw new Error('Expected a JSON request body.');
      const body = JSON.parse(init.body) as AiPlanWireRequest;
      wire.push({ url, authorization: new Headers(init.headers).get('authorization'), body });
      const sent =
        options.olderServer === true
          ? Object.fromEntries(
              Object.entries(body).filter(([key]) => key !== 'task' && key !== 'pagePlanAttempt'),
            )
          : body;
      return handle(new Request(url, { ...init, body: JSON.stringify(sent) }));
    },
  });
  return { provider, backend, wire };
}

function build(provider: AiPlanProvider, live: BuilderKernel, runId: string, events: BuildEvent[]) {
  return runAiBuild({
    runId,
    clock: { now: () => 1 },
    kernel: live,
    provider,
    request: REQUEST,
    validationPorts: { clock: { now: () => 1 }, ids: countingIds(`${runId}-door`) },
    skillRegistry: NO_SKILLS,
    onEvent: (event) => events.push(event),
  });
}

describe('the page-plan path is reachable through the real remote provider and handler', () => {
  it('plans with ONE page-plan call, lays the code skeleton, and never asks for a scaffold', async () => {
    const { provider, backend, wire } = remoteOverHandler();
    const live = kernel('reachable');
    const events: BuildEvent[] = [];

    const result = await build(provider, live, 'build-t1', events);

    // The wire: the page-plan task first, with the same bearer as every plan call.
    expect(wire[0]?.body.task).toBe('page-plan');
    expect(wire.every(({ authorization }) => authorization === `Bearer ${TOKEN}`)).toBe(true);
    expect(wire.filter(({ body }) => body.task === 'page-plan')).toHaveLength(1);
    // The model: one planning call; every other call is a section writer — no scaffold.
    expect(backend.filter(({ schema }) => schema === 'page-plan')).toHaveLength(1);
    const plans = backend.filter(({ schema }) => schema === 'plan');
    expect(plans.length).toBeGreaterThan(0);
    expect(plans.every(({ request }) => request.includes('REGION ID: '))).toBe(true);
    // The build: from the documented plan, its skeleton the first transaction.
    expect(result.scaffold).toBeUndefined();
    expect(result.pagePlan?.title).toBe(PAGE_PLAN_EXAMPLE.pagePlan.title);
    expect(result.pagePlan?.sections.map(({ key }) => key)).toEqual([
      'header',
      'hero',
      'menu',
      'order',
      'footer',
    ]);
    // The compact answer, expanded by the client into the full contract.
    expect(PAGE_PLAN_EXAMPLE.pagePlan).toHaveProperty('briefs');
    expect(PAGE_PLAN_EXAMPLE.pagePlan.tokens).not.toHaveProperty('bg');
    const plan = result.pagePlan;
    expect(plan?.tokens.deckRowId).toBe('cafe');
    expect(plan?.tokens.bg).toMatch(/^#[0-9a-f]{6}$/u);
    expect(plan?.tokens.fontDisplay.family).toBe('Fraunces');
    expect(plan?.nav).toEqual([
      { label: 'Menu', anchorId: 'menu' },
      { label: 'Order', anchorId: 'order' },
    ]);
    expect(plan?.sections.map(({ anchorId }) => anchorId)).toEqual([
      'header',
      'hero',
      'menu',
      'order',
      'footer',
    ]);
    const hero = plan?.sections.find(({ key }) => key === 'hero');
    expect(hero?.purpose).toBe('Say what the roastery is and invite the first order.');
    expect(hero?.mustSay).toEqual(['Roasted daily in Amman']);
    expect(hero?.images?.[0]?.subject).toBe('cafe');
    // Fresh generation adopts bespoke composition even when an older provider answers with kits.
    expect(plan?.design?.composition).toBe('bespoke');
    const order = plan?.sections.find(({ key }) => key === 'order');
    expect(order?.kit).toBeUndefined();
    expect(order?.slots).toBeUndefined();
    expect(plan?.facts).toEqual(
      expect.arrayContaining([
        { key: 'price-espresso', sample: 'JOD 1.50', section: 'menu' },
        { key: 'phone', sample: '+962 6 461 2750', section: 'footer' },
      ]),
    );
    expect(plan).not.toHaveProperty('briefs');
    expect(live.transactions()[0]?.command).toMatch(/skeleton/iu);
    expect(result.outcome).toBe('completed');
    expect(result.tasks.every(({ status }) => status === 'applied')).toBe(true);
    // T1 reported as a step of the build: proposed, not failed.
    const step = events.filter(({ runId }) => runId === 'build-t1/page-plan');
    expect(step.map(({ type }) => type)).toContain('run.completed');
    expect(step.map(({ type }) => type)).not.toContain('run.failed');
  });

  it('falls back to the scaffold — and says why — when the server predates page plans; asks it once', async () => {
    const { provider, backend, wire } = remoteOverHandler({ olderServer: true });
    const events: BuildEvent[] = [];

    const result = await build(provider, kernel('older'), 'build-old', events);

    expect(wire[0]?.body.task).toBe('page-plan');
    const failed = events.find(
      (event) => event.runId === 'build-old/page-plan' && event.type === 'run.failed',
    );
    expect(failed).toMatchObject({
      error: { source: 'provider', message: expect.stringMatching(/page plans/u) as unknown },
    });
    expect(result.pagePlan).toBeUndefined();
    expect(result.scaffold?.status).toBe('applied');
    expect(result.tasks.map(({ title }) => title)).toEqual(['Hero', 'Menu']);

    // The same provider does not pay for the misread answer twice.
    const before = backend.length;
    await build(provider, kernel('older-again'), 'build-old-2', []);
    expect(wire.filter(({ body }) => body.task === 'page-plan')).toHaveLength(1);
    expect(backend.length).toBeGreaterThan(before);
  });
});
