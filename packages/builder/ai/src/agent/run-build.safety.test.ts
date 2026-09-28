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
  type CustomCodeRoot,
  type JsonValue,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import {
  CRAFTKIT_AI_SKILL_DEFINITIONS,
  createAiSkillRegistry,
  createCraftkitAiSkillRegistry,
  type AiSkillDefinitionV1,
  type AiSkillRegistry,
} from '../skills';
import type { AiPlan, AiPlanProvider, AssembledAiContext } from '../types';
import { runAiBuild, type AiBuildEvent, type AiBuildOwnEvent } from './index';

/*
  Wave A of the 2026-09-28 engine audit (agent-audit.md §2 P0-2, P0-3, P0-4,
  P1-8, P1-12), each written as the audit's own reproduction script turned into
  a test: scope.mjs, stop.mjs, hol.mjs and measure-live.mjs. Every one of these
  failed against the build as it stood that morning.
*/

const NullRender: BlockRenderComponent = () => null;

/** A page root shaped like the product's: a title, a language and page CSS. */
const PAGE = z.object({
  title: z.string().default(''),
  lang: z.string().max(12).default(''),
  pageCss: customCss(20_000),
});

function buildBlocks(pageProps: z.ZodObject = PAGE): TrustedExtensionManifest {
  return {
    tier: 1,
    name: 'build-safety-fixture',
    version: '0.0.0',
    contributes: {
      blocks: [
        {
          schema: defineBlockSchema({
            type: 'page',
            description: 'The page root.',
            props: pageProps,
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
              label: z.string().default('Custom section'),
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

function page(props: Record<string, string> = {}, children: readonly string[] = []) {
  const nodes: BuilderDocument['nodes'] = {
    root: {
      id: 'root',
      type: 'page',
      props: { title: 'Home', ...props },
      slots: { default: [...children] },
    },
  };
  for (const child of children) {
    // A stored tree is plain JSON; the typed helper only builds it.
    const tree = JSON.parse(JSON.stringify(region('Existing content'))) as JsonValue;
    nodes[child] = { id: child, type: 'customCode', props: { label: `Existing ${child}`, tree } };
  }
  const document: BuilderDocument = {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes,
  };
  return document;
}

function kernel(
  manifest: TrustedExtensionManifest = buildBlocks(),
  document: BuilderDocument = page(),
): BuilderKernel {
  return createBuilder({
    document,
    extensions: [manifest],
    ports: { clock: fixedClock(1), ids: seededIds('build') },
  });
}

function ports(seed: string) {
  return { clock: fixedClock(1), ids: seededIds(seed) };
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

const DIRECTION =
  'SaaS analytics for operators. Palette slate-950, sky-400. Faces Inter and Inter. Signature a hairline grid. 1 Hero · 2 Features · 3 Pricing · 4 Footer.';
const FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@800');";

function scaffoldPlan(titles: readonly string[], rationale = DIRECTION): AiPlan {
  return {
    rationale,
    commands: [
      ...titles.map((title) => ({
        command: 'insertNode',
        args: {
          type: 'customCode',
          parentId: 'root',
          props: { label: title, tree: region(title) },
        },
      })),
      { command: 'setProp', args: { id: 'root', key: 'pageCss', value: FONT_IMPORT } },
    ],
  };
}

function write(id: string, text: string): AiPlan['commands'][number] {
  return { command: 'setProp', args: { id, key: 'tree', value: region(text) } };
}

interface ProviderCall {
  request: string;
  context: AssembledAiContext;
  signal: AbortSignal | undefined;
}

function recordingProvider(handle: (call: ProviderCall, index: number) => Promise<AiPlan>) {
  const calls: ProviderCall[] = [];
  const provider: AiPlanProvider = {
    propose(request, context, live) {
      const call: ProviderCall = { request, context, signal: live?.signal };
      calls.push(call);
      return handle(call, calls.length - 1);
    },
  };
  return { provider, calls };
}

/** Only a fill is scoped to a region; the skeleton and a fallback arrive unscoped. */
function regionOf(call: ProviderCall): string | undefined {
  return call.context.selection.ids[0];
}

function sectionOf(call: ProviderCall): number {
  return Number(/SECTION (\d+) OF/u.exec(call.request)?.[1] ?? '0');
}

function abortError(): Error {
  const error = new Error('The provider was aborted.');
  error.name = 'AbortError';
  return error;
}

/** Resolves after `ms` unless its own signal aborts first — an honest provider. */
function after<T>(ms: number, signal: AbortSignal | undefined, value: () => T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      resolve(value());
    }, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(abortError());
      },
      { once: true },
    );
  });
}

function own(events: readonly AiBuildEvent[]): AiBuildOwnEvent[] {
  return events.filter(
    (event): event is AiBuildOwnEvent =>
      event.type.startsWith('build.') || event.type.startsWith('task.'),
  );
}

function treeText(live: BuilderKernel, id: string): string {
  return JSON.stringify(live.getDocument().nodes[id]?.props['tree']);
}

/** Let every pending microtask and zero-delay timer run, a bounded number of times. */
async function settle(until: () => boolean, rounds = 400): Promise<void> {
  for (let round = 0; round < rounds && !until(); round += 1) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

const FOUR = ['Hero', 'Features', 'Pricing', 'Footer'] as const;
const EIGHT = ['Hero', 'Proof', 'Features', 'How', 'Pricing', 'FAQ', 'CTA', 'Footer'] as const;

describe('P0-2 — a section writer may only write its own region', () => {
  it('drops a fill’s writes outside its region before landing, and reports them (scope.mjs)', async () => {
    const live = kernel();
    let heroId = '';
    const { provider } = recordingProvider((call) => {
      const id = regionOf(call);
      if (id === undefined) return Promise.resolve(scaffoldPlan(FOUR));
      const section = sectionOf(call);
      if (section === 1) heroId = id;
      const commands = [write(id, `written ${String(section)}`)];
      // Measured on 2026-09-28: fill 3 replaced the page CSS (the skeleton's
      // font import went with it) and fill 4 overwrote the hero.
      if (section === 3) {
        commands.push({
          command: 'setProp',
          args: { id: 'root', key: 'pageCss', value: '@keyframes ck-fade{from{opacity:0}}' },
        });
      }
      if (section === 4) commands.push(write(heroId, 'FOOTER OVERWROTE HERO'));
      // Its own region, but not a key a fill owns.
      if (section === 2) {
        commands.push({ command: 'setProp', args: { id, key: 'label', value: 'Renamed' } });
      }
      return Promise.resolve({ rationale: 'ok', commands });
    });

    const result = await runAiBuild({
      runId: 'scope',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'Create a landing page for a SaaS analytics tool',
      validationPorts: ports('scope'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      composition: { catalogMode: 'none' },
      fillConcurrency: 1,
    });

    const document = live.getDocument();
    expect(document.nodes['root']?.props['pageCss']).toBe(FONT_IMPORT);
    expect(treeText(live, heroId)).toContain('written 1');
    expect(treeText(live, heroId)).not.toContain('OVERWROTE');
    expect(result.tasks.map(({ status }) => status)).toEqual([
      'applied',
      'applied',
      'applied',
      'applied',
    ]);
    // Each section still landed its own tree…
    for (const task of result.tasks) {
      expect(treeText(live, task.id)).toMatch(/written \d/u);
    }
    expect(document.nodes[result.tasks[1]?.id ?? '']?.props['label']).toBe('Features');
    // …and every dropped step is on the report, not silently "applied".
    expect(result.tasks[0]?.outOfScope).toBeUndefined();
    expect(result.tasks[1]?.outOfScope).toMatchObject([
      { command: 'setProp', id: result.tasks[1]?.id, key: 'label' },
    ]);
    expect(result.tasks[2]?.outOfScope).toMatchObject([
      { command: 'setProp', id: 'root', key: 'pageCss' },
    ]);
    expect(result.tasks[3]?.outOfScope).toMatchObject([
      { command: 'setProp', id: heroId, key: 'tree' },
    ]);
    expect(result.tasks[3]?.outOfScope?.[0]?.reason).toMatch(/own region/u);
  });

  it('lets a fill write its own region css beside its tree', async () => {
    const live = kernel();
    const { provider } = recordingProvider((call) => {
      const id = regionOf(call);
      if (id === undefined) return Promise.resolve(scaffoldPlan(['Hero', 'Proof']));
      return Promise.resolve({
        rationale: 'ok',
        commands: [
          write(id, 'styled'),
          { command: 'setProp', args: { id, key: 'css', value: '.ck-card{border-radius:1rem}' } },
        ],
      });
    });

    const result = await runAiBuild({
      runId: 'scope-css',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'A two-section page',
      validationPorts: ports('scope-css'),
      skillRegistry: createCraftkitAiSkillRegistry(),
    });

    expect(result.applied).toBe(2);
    for (const task of result.tasks) {
      expect(task.outOfScope).toBeUndefined();
      expect(live.getDocument().nodes[task.id]?.props['css']).toContain('ck-card');
    }
  });

  it('treats a fill that wrote nothing inside its region as a failed attempt, never as applied', async () => {
    const live = kernel();
    const { provider, calls } = recordingProvider((call) => {
      const id = regionOf(call);
      if (id === undefined) return Promise.resolve(scaffoldPlan(['Hero', 'Proof', 'Pricing']));
      if (sectionOf(call) === 2) {
        return Promise.resolve({
          rationale: 'I will set the page title instead.',
          commands: [{ command: 'setProp', args: { id: 'root', key: 'title', value: 'Mine' } }],
        });
      }
      return Promise.resolve({ rationale: 'ok', commands: [write(id, 'fine')] });
    });

    const result = await runAiBuild({
      runId: 'scope-none',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'A studio page',
      validationPorts: ports('scope-none'),
      skillRegistry: createCraftkitAiSkillRegistry(),
    });

    expect(live.getDocument().nodes['root']?.props['title']).toBe('Home');
    expect(result.tasks[1]).toMatchObject({ title: 'Proof', status: 'skipped', attempts: 2 });
    expect(result.tasks[1]?.reason).toMatch(/own region/u);
    expect(result.tasks[1]?.outOfScope).toMatchObject([{ id: 'root', key: 'title' }]);
    // The retry was really made: Proof reached the provider twice.
    expect(calls.filter((call) => sectionOf(call) === 2)).toHaveLength(2);
    expect(result.applied).toBe(2);
  });
});

describe('P0-3 — Stop stops', () => {
  it('lands nothing after Stop, aborts every in-flight writer and retries none (stop.mjs)', async () => {
    const live = kernel();
    const controller = new AbortController();
    const events: AiBuildEvent[] = [];
    let inFlight = 0;
    let stoppedAt = -1;
    const { provider, calls } = recordingProvider((call) => {
      const id = regionOf(call);
      if (id === undefined) return Promise.resolve(scaffoldPlan(EIGHT));
      inFlight += 1;
      // The person presses Stop once the whole first wave is being written.
      if (inFlight === 5) {
        setTimeout(() => {
          stoppedAt = calls.length;
          controller.abort();
        }, 0);
      }
      /*
        A write far slower than the test (the audit's were 1.5 s against a Stop
        at 0.3 s): only an abort that really reaches the provider ends it, so a
        build that did not forward Stop would time this test out.
      */
      return after(60_000, call.signal, () => ({
        rationale: 'ok',
        commands: [write(id, 'done')],
      }));
    });

    const result = await runAiBuild({
      runId: 'stop',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'Create a landing page for a SaaS analytics tool',
      validationPorts: ports('stop'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      signal: controller.signal,
      onEvent: (event) => {
        events.push(event);
      },
    });

    expect(stoppedAt).toBe(6);
    // No provider call started after Stop: no new section, and no retry.
    expect(calls).toHaveLength(stoppedAt);
    // Every in-flight writer was told: the person's Stop reached the network.
    expect(calls.slice(1).every((call) => call.signal?.aborted === true)).toBe(true);
    // Nothing landed: the log is the skeleton alone.
    expect(live.transactions().map(({ command }) => command)).toEqual(['Assistant: page skeleton']);
    expect(result.outcome).toBe('signal');
    expect(result.applied).toBe(0);
    expect(result.tasks.map(({ status }) => status)).toEqual(EIGHT.map(() => 'not-started'));
    // The five that were being written say so, and how far they got.
    expect(result.tasks.slice(0, 5).every(({ attempts }) => attempts === 1)).toBe(true);
    expect(result.tasks[0]?.reason).toMatch(/stopped while this section was being written/u);
    expect(result.tasks.slice(5).every(({ attempts }) => attempts === 0)).toBe(true);
    // Which sections never landed, by id, with the placeholder they still hold.
    expect(result.unfilled?.map(({ title }) => title)).toEqual([...EIGHT]);
    expect(own(events).some((event) => event.type === 'task.completed')).toBe(false);
    expect(own(events).filter((event) => event.type === 'build.stopped')).toHaveLength(1);
  });

  it('says nothing more once the build has reported its end', async () => {
    const live = kernel();
    const controller = new AbortController();
    const events: AiBuildEvent[] = [];
    let release!: () => void;
    const late = new Promise<void>((resolve) => (release = resolve));
    const { provider } = recordingProvider(async (call) => {
      const id = regionOf(call);
      if (id === undefined) return scaffoldPlan(['Hero', 'Proof']);
      controller.abort();
      // A provider that ignores its signal and answers late anyway.
      await late;
      return { rationale: 'ok', commands: [write(id, 'late')] };
    });

    const result = await runAiBuild({
      runId: 'stop-late',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'A studio page',
      validationPorts: ports('stop-late'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      signal: controller.signal,
      onEvent: (event) => {
        events.push(event);
      },
    });
    const seen = events.length;
    release();
    await settle(() => false, 20);

    // The build returned without waiting on a writer that ignored Stop…
    expect(result.outcome).toBe('signal');
    // …and the late answer neither landed nor spoke.
    expect(live.transactions()).toHaveLength(1);
    expect(events).toHaveLength(seen);
    expect(events.at(-1)?.type).toBe('build.completed');
  });
});

describe('P0-4 — Ask never writes before approval', () => {
  it('asks with the planned sections before anything is written, then lands skeleton and fills on "build"', async () => {
    const live = kernel();
    const before = structuredClone(live.getDocument());
    const asked: { titles: string[]; transactions: number; unchanged: boolean }[] = [];
    const { provider } = recordingProvider((call) => {
      const id = regionOf(call);
      if (id === undefined) return Promise.resolve(scaffoldPlan(FOUR));
      return Promise.resolve({ rationale: 'ok', commands: [write(id, 'filled')] });
    });

    const result = await runAiBuild({
      runId: 'ask-go',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'A landing page',
      validationPorts: ports('ask-go'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      onPlanned: (planned, direction) => {
        expect(direction).toBe(DIRECTION);
        asked.push({
          titles: planned.map(({ title }) => title),
          transactions: live.transactions().length,
          unchanged: JSON.stringify(live.getDocument()) === JSON.stringify(before),
        });
        return 'build';
      },
    });

    expect(asked).toEqual([{ titles: [...FOUR], transactions: 0, unchanged: true }]);
    expect(result.outcome).toBe('completed');
    expect(result.scaffold?.status).toBe('applied');
    expect(live.transactions().map(({ command }) => command)).toEqual([
      'Assistant: page skeleton',
      ...FOUR.map((title, index) => `Assistant: ${String(index + 1)}/4 — ${title}`),
    ]);
    expect(live.getDocument().nodes['root']?.props['pageCss']).toBe(FONT_IMPORT);
  });

  it('writes nothing at all when the answer is "stop"', async () => {
    const live = kernel();
    const before = structuredClone(live.getDocument());
    const events: AiBuildEvent[] = [];
    const { provider, calls } = recordingProvider(() => Promise.resolve(scaffoldPlan(FOUR)));

    const result = await runAiBuild({
      runId: 'ask-stop',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'A landing page',
      validationPorts: ports('ask-stop'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      onPlanned: () => 'stop',
      onEvent: (event) => {
        events.push(event);
      },
    });

    expect(calls).toHaveLength(1);
    expect(live.transactions()).toHaveLength(0);
    expect(live.getDocument()).toEqual(before);
    expect(result.outcome).toBe('signal');
    expect(result.applied).toBe(0);
    expect(result.tasks).toEqual([]);
    expect(result.plannedTasks).toEqual(FOUR.map((title) => ({ title })));
    expect(result.scaffold?.status).toBe('proposed');
    expect(own(events).map(({ type }) => type)).toEqual([
      'build.scaffolding',
      'build.stopped',
      'build.completed',
    ]);
  });

  it('writes nothing when Stop is pressed while the question is open, whatever the answer', async () => {
    const live = kernel();
    const controller = new AbortController();
    const { provider, calls } = recordingProvider(() => Promise.resolve(scaffoldPlan(FOUR)));

    const result = await runAiBuild({
      runId: 'ask-abort',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'A landing page',
      validationPorts: ports('ask-abort'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      signal: controller.signal,
      onPlanned: () => {
        controller.abort();
        return 'build';
      },
    });

    expect(calls).toHaveLength(1);
    expect(live.transactions()).toHaveLength(0);
    expect(result.outcome).toBe('signal');
  });

  it('proposes the fallback run instead of applying it when a build that asks cannot split', async () => {
    const live = kernel();
    let asked = 0;
    const { provider, calls } = recordingProvider((_call, index) =>
      Promise.resolve(
        index === 0
          ? scaffoldPlan(['Hero'])
          : {
              rationale: 'A single hero, written whole.',
              commands: [
                {
                  command: 'insertNode',
                  args: {
                    type: 'customCode',
                    parentId: 'root',
                    props: { label: 'Hero', tree: region('Hero') },
                  },
                },
              ],
            },
      ),
    );

    const result = await runAiBuild({
      runId: 'ask-fallback',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'A hero',
      validationPorts: ports('ask-fallback'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      onPlanned: () => {
        asked += 1;
        return 'build';
      },
    });

    expect(calls).toHaveLength(2);
    expect(result.outcome).toBe('fallback');
    expect(result.fallback?.status).toBe('proposed');
    expect(live.transactions()).toHaveLength(0);
    // Nothing to approve on a list: the fallback's own card is the question.
    expect(asked).toBe(0);
  });
});

describe('P1-8 — a slow first section does not hold back the writers behind it', () => {
  it('writes every section while the hero is still being written, and lands in page order (hol.mjs)', async () => {
    const live = kernel();
    let inFlight = 0;
    let peak = 0;
    const arrived: number[] = [];
    let releaseHero!: () => void;
    const heroGate = new Promise<void>((resolve) => (releaseHero = resolve));
    const { provider } = recordingProvider(async (call) => {
      const id = regionOf(call);
      if (id === undefined) return scaffoldPlan(EIGHT);
      const section = sectionOf(call);
      arrived.push(section);
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      if (section === 1) await heroGate;
      else await new Promise<void>((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return { rationale: 'ok', commands: [write(id, `written ${String(section)}`)] };
    });

    const building = runAiBuild({
      runId: 'hol',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'Create a landing page for a SaaS analytics tool',
      validationPorts: ports('hol'),
      skillRegistry: createCraftkitAiSkillRegistry(),
    });

    await settle(() => arrived.length === EIGHT.length);
    // Every section reached a writer while the hero was still out…
    expect([...arrived].sort((left, right) => left - right)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    // …with the pool still bounded (auto concurrency for eight sections is five)…
    expect(peak).toBeLessThanOrEqual(5);
    // …and nothing landed out of order: section 2 waits for the hero to land.
    expect(live.transactions()).toHaveLength(1);

    releaseHero();
    const result = await building;
    expect(result.applied).toBe(EIGHT.length);
    expect(live.transactions().map(({ command }) => command)).toEqual([
      'Assistant: page skeleton',
      ...EIGHT.map((title, index) => `Assistant: ${String(index + 1)}/8 — ${title}`),
    ]);
  });
});

describe('P1-12 — section writers run with an explicit skill set', () => {
  const LATER_IDS = [
    'craftkit.section-variants',
    'craftkit.photo-direction',
    'craftkit.direction-deck',
  ] as const;

  /** A stand-in for the skills another workstream is adding under these ids. */
  function stub(id: string): AiSkillDefinitionV1 {
    return {
      schemaVersion: 1,
      id,
      name: `Stub ${id}`,
      description: `Stand-in for ${id}.`,
      version: '0.0.1',
      source: 'host',
      trust: 'reviewed',
      activation: { mode: 'explicit' },
      instructions: `Stub instructions for ${id}.`,
    };
  }

  /** The built-ins WITHOUT the later ids, whether or not they have landed yet. */
  const withoutLater = (): AiSkillDefinitionV1[] =>
    CRAFTKIT_AI_SKILL_DEFINITIONS.filter(
      ({ id }) => !(LATER_IDS as readonly string[]).includes(id),
    );

  function registryWithout(): AiSkillRegistry {
    return createAiSkillRegistry(withoutLater());
  }

  function registryWith(): AiSkillRegistry {
    return createAiSkillRegistry([...withoutLater(), ...LATER_IDS.map(stub)]);
  }

  function skillsOf(call: ProviderCall | undefined): string[] {
    return (call?.context.fragments ?? [])
      .filter((fragment) => fragment.kind === 'instruction')
      .map((fragment) => fragment.source)
      .sort();
  }

  async function build(request: string, registry: AiSkillRegistry, titles = FOUR) {
    const live = kernel();
    const recorded = recordingProvider((call) => {
      const id = regionOf(call);
      if (id === undefined) return Promise.resolve(scaffoldPlan(titles, DIRECTION));
      return Promise.resolve({ rationale: 'ok', commands: [write(id, 'x')] });
    });
    const result = await runAiBuild({
      runId: 'skills',
      clock: fixedClock(1000),
      kernel: live,
      provider: recorded.provider,
      request,
      validationPorts: ports('skills'),
      skillRegistry: registry,
      composition: { catalogMode: 'none' },
    });
    return { result, calls: recorded.calls };
  }

  it('gives an English fill only the fill skills, however many page skills the request matched', async () => {
    const { calls, result } = await build(
      'Create a landing page for a SaaS analytics tool with pricing, testimonials and FAQ',
      registryWithout(),
    );
    expect(result.applied).toBe(FOUR.length);
    // The scaffold still gets the page-level expertise its request matched.
    expect(skillsOf(calls[0])).toContain('craftkit.page-composition');
    for (const call of calls.slice(1)) {
      expect(skillsOf(call)).toEqual([
        'craftkit.build-fill',
        'craftkit.copywriting',
        'craftkit.craft-manual',
      ]);
    }
  });

  it('adds the Arabic skill to every fill of an Arabic page', async () => {
    const { calls } = await build(
      'اعمل صفحة هبوط لمقهى مختص في عمّان مع قائمة الأسعار وآراء العملاء',
      registryWithout(),
    );
    for (const call of calls.slice(1)) {
      expect(skillsOf(call)).toEqual([
        'craftkit.arabic-rtl',
        'craftkit.build-fill',
        'craftkit.copywriting',
        'craftkit.craft-manual',
      ]);
    }
  });

  it('adds section variants and photo direction to fills, and the direction deck to the scaffold, once they exist', async () => {
    const { calls } = await build('Create a landing page for a bakery', registryWith());
    expect(skillsOf(calls[0])).toContain('craftkit.direction-deck');
    expect(skillsOf(calls[0])).toContain('craftkit.build-scaffold');
    for (const call of calls.slice(1)) {
      expect(skillsOf(call)).toEqual([
        'craftkit.build-fill',
        'craftkit.copywriting',
        'craftkit.craft-manual',
        'craftkit.photo-direction',
        'craftkit.section-variants',
      ]);
    }
  });
});

describe('the page language — never over one the person chose', () => {
  const ARABIC = ['الرئيسية', 'قائمة المشروبات'] as const;

  async function arabicBuild(live: BuilderKernel) {
    const { provider } = recordingProvider((call) => {
      const id = regionOf(call);
      if (id === undefined) return Promise.resolve(scaffoldPlan(ARABIC, 'مقهى في عمّان.'));
      return Promise.resolve({ rationale: 'ok', commands: [write(id, 'قسم')] });
    });
    return runAiBuild({
      runId: 'lang',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'صفحة هبوط لمقهى',
      validationPorts: ports('lang'),
      skillRegistry: createCraftkitAiSkillRegistry(),
    });
  }

  it('turns the page right to left but keeps an explicit English lang', async () => {
    const live = kernel(buildBlocks(), page({ lang: 'en' }));
    const result = await arabicBuild(live);
    expect(result.applied).toBe(ARABIC.length);
    expect(live.getDocument().dir).toBe('rtl');
    expect(live.getDocument().nodes['root']?.props['lang']).toBe('en');
  });

  it('fills the language of an untouched page whose lang is still the block default', async () => {
    const withEnglishDefault = PAGE.extend({ lang: z.string().max(12).default('en') });
    const live = kernel(buildBlocks(withEnglishDefault), page({ lang: 'en' }));
    await arabicBuild(live);
    expect(live.getDocument().nodes['root']?.props['lang']).toBe('ar');
  });

  it('keeps the default-valued lang of a page that already held content', async () => {
    const withEnglishDefault = PAGE.extend({ lang: z.string().max(12).default('en') });
    const live = kernel(buildBlocks(withEnglishDefault), page({ lang: 'en' }, ['existing']));
    await arabicBuild(live);
    expect(live.getDocument().dir).toBe('rtl');
    expect(live.getDocument().nodes['root']?.props['lang']).toBe('en');
  });
});
