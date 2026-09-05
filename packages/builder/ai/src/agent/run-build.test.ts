import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  defineBlockSchema,
  emptyCustomCodeTree,
  type BlockRenderComponent,
  type BuilderDocument,
  type ClockPort,
  type CustomCodeRoot,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { createCraftkitAiSkillRegistry } from '../skills';
import type { AiPlan, AiPlanProvider, AssembledAiContext } from '../types';
import { runAiBuild, type AiBuildEvent, type AiBuildOwnEvent } from './index';
import { fillConcurrencyFor, MAX_AI_BUILD_AUTO_FILL_CONCURRENCY } from './run-build';

const NullRender: BlockRenderComponent = () => null;

/** Page root plus the one freely composed region type a build ever inserts. */
const buildBlocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'build-fixture',
  version: '0.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'The page root.',
          props: z.object({ title: z.string().default('') }),
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
          }),
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

function emptyPage(): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'page', props: { title: 'Home' }, slots: { default: [] } },
    },
  } as unknown as BuilderDocument;
}

function kernel(): BuilderKernel {
  return createBuilder({
    document: emptyPage(),
    extensions: [buildBlocks],
    ports: { clock: fixedClock(1), ids: seededIds('build') },
  });
}

function ports(seed: string) {
  return { clock: fixedClock(1), ids: seededIds(seed) };
}

/** A placeholder region: what the scaffold inserts, before any fill. */
function placeholder(title: string): CustomCodeRoot {
  return {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        children: [{ kind: 'element', tag: 'h2', text: title, children: [] }],
      },
    ],
  };
}

/** A finished region: what a fill writes over the placeholder. */
function filled(title: string): CustomCodeRoot {
  return {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        children: [
          { kind: 'element', tag: 'h2', text: title, children: [] },
          { kind: 'element', tag: 'p', text: `Body copy for ${title}.`, children: [] },
        ],
      },
    ],
  };
}

const DIRECTION =
  'A calm studio page for solo founders. Palette bg-white text-slate-900 border-slate-200. Faces Inter and Inter. Signature a hairline rule. 1 Hero · 2 Proof · 3 Pricing.';

const DIRECTION_FIRST_SENTENCE = 'A calm studio page for solo founders.';

interface Section {
  title: string;
  /** Insertion index, so patch order and document order can be made to differ. */
  index: number;
}

function scaffoldPlan(sections: readonly Section[], rationale = DIRECTION): AiPlan {
  return {
    rationale,
    commands: sections.map((section) => ({
      command: 'insertNode',
      args: {
        type: 'customCode',
        parentId: 'root',
        index: section.index,
        props: { label: section.title, tree: placeholder(section.title) },
      },
    })),
  };
}

function fillPlan(regionId: string, title: string): AiPlan {
  return {
    rationale: `Fill ${title}.`,
    commands: [{ command: 'setProp', args: { id: regionId, key: 'tree', value: filled(title) } }],
  };
}

interface ProviderCall {
  request: string;
  context: AssembledAiContext;
  signal: AbortSignal | undefined;
}

interface Recorded {
  provider: AiPlanProvider;
  calls: ProviderCall[];
}

/** A scripted provider that records every call, so context and request are assertable. */
function recordingProvider(
  handle: (call: ProviderCall, index: number) => Promise<AiPlan>,
): Recorded {
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

/** The region id a fill run was scoped to — the only one it may write. */
function scopedRegionId(call: ProviderCall): string {
  const [id] = call.context.selection.ids;
  if (id === undefined) throw new Error('A fill run reached the provider with no selection.');
  return id;
}

/** A provider that never resolves until its run's own signal aborts. */
function hangs(signal: AbortSignal | undefined): Promise<AiPlan> {
  return new Promise<AiPlan>((_resolve, reject) => {
    if (signal === undefined) return;
    signal.addEventListener('abort', () => {
      const error = new Error('The provider was aborted.');
      error.name = 'AbortError';
      reject(error);
    });
  });
}

function buildEvents(events: readonly AiBuildEvent[]): AiBuildOwnEvent[] {
  return events.filter(
    (event): event is AiBuildOwnEvent =>
      event.type.startsWith('build.') || event.type.startsWith('task.'),
  );
}

const THREE = [
  // Deliberately NOT document order: the scaffold's patches arrive Pricing,
  // Hero, Proof while the page reads Hero, Proof, Pricing.
  { title: 'Pricing', index: 0 },
  { title: 'Hero', index: 0 },
  { title: 'Proof', index: 1 },
] as const;

const FOUR = [
  { title: 'Hero', index: 0 },
  { title: 'Proof', index: 1 },
  { title: 'Pricing', index: 2 },
  { title: 'Contact', index: 3 },
] as const;

const TWELVE = Array.from({ length: 12 }, (_, index) => ({
  title: `Section ${String(index + 1)}`,
  index,
}));

const DOCUMENT_ORDER = ['Hero', 'Proof', 'Pricing'] as const;

describe('runAiBuild', () => {
  it('splits a three-section page into one scaffold and three labelled fills, in document order', async () => {
    const live = kernel();
    const events: AiBuildEvent[] = [];
    const { provider, calls } = recordingProvider((call, index) =>
      Promise.resolve(
        index === 0
          ? scaffoldPlan(THREE)
          : fillPlan(scopedRegionId(call), DOCUMENT_ORDER[index - 1] ?? '?'),
      ),
    );

    const result = await runAiBuild({
      runId: 'build-run',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'A studio page for solo founders',
      validationPorts: ports('build-gates'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      onEvent: (event) => {
        events.push(event);
      },
    });

    expect(calls).toHaveLength(4);
    expect(result.outcome).toBe('completed');
    expect(result.direction).toBe(DIRECTION);
    expect(result.applied).toBe(3);
    expect(result.skipped).toBe(0);
    expect(result.tasks.map(({ title }) => title)).toEqual([...DOCUMENT_ORDER]);
    expect(result.tasks.map(({ status }) => status)).toEqual(['applied', 'applied', 'applied']);
    expect(result.scaffold?.status).toBe('applied');

    // One transaction per step, each with its own human label.
    expect(live.transactions().map(({ command }) => command)).toEqual([
      'Assistant: page skeleton',
      'Assistant: 1/3 — Hero',
      'Assistant: 2/3 — Proof',
      'Assistant: 3/3 — Pricing',
    ]);
    expect(live.transactions().map(({ author }) => author)).toEqual(['ai', 'ai', 'ai', 'ai']);

    /*
      Three sections are WRITTEN at once and LAND in order, so the starts come
      together and the completions follow in page order. The assertion above —
      the transaction labels 1/3, 2/3, 3/3 in that sequence — is the invariant
      that matters, and it is what keeps "undo Pricing" meaning one section.
    */
    expect(buildEvents(events).map(({ type }) => type)).toEqual([
      'build.scaffolding',
      'build.planned',
      'task.started',
      'task.started',
      'task.started',
      'task.completed',
      'task.completed',
      'task.completed',
      'build.completed',
    ]);
    expect(
      buildEvents(events).flatMap((event) =>
        event.type === 'task.completed' ? [event.position] : [],
      ),
    ).toEqual([1, 2, 3]);
    expect(events.every((event) => Object.isFrozen(event))).toBe(true);
  });

  it('discovers region ids by label, never by patch order', async () => {
    const live = kernel();
    const { provider } = recordingProvider((call, index) =>
      Promise.resolve(
        index === 0
          ? scaffoldPlan(THREE)
          : fillPlan(scopedRegionId(call), DOCUMENT_ORDER[index - 1] ?? '?'),
      ),
    );

    const result = await runAiBuild({
      runId: 'build-labels',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'A studio page',
      validationPorts: ports('labels'),
      skillRegistry: createCraftkitAiSkillRegistry(),
    });

    // Insertion order was Pricing, Hero, Proof — ids follow that.
    const document = live.getDocument();
    expect(document.nodes['build-0001']?.props['label']).toBe('Pricing');
    expect(document.nodes['build-0002']?.props['label']).toBe('Hero');
    expect(document.nodes['build-0003']?.props['label']).toBe('Proof');
    // The task list follows the PAGE, and each title stays glued to its own id.
    expect(result.tasks.map(({ id, title }) => `${id}:${title}`)).toEqual([
      'build-0002:Hero',
      'build-0003:Proof',
      'build-0001:Pricing',
    ]);
    expect(document.nodes['root']?.slots?.['default']).toEqual([
      'build-0002',
      'build-0003',
      'build-0001',
    ]);
  });

  it('scopes every fill to its own region and trims the other regions from its context', async () => {
    const live = kernel();
    const { provider, calls } = recordingProvider((call, index) =>
      Promise.resolve(
        index === 0
          ? scaffoldPlan(THREE)
          : fillPlan(scopedRegionId(call), DOCUMENT_ORDER[index - 1] ?? '?'),
      ),
    );

    await runAiBuild({
      runId: 'build-scope',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'A studio page',
      validationPorts: ports('scope'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      composition: { catalogMode: 'none' },
    });

    const [, first, second, third] = calls;
    expect(first?.context.selection.ids).toEqual(['build-0002']);
    expect(second?.context.selection.ids).toEqual(['build-0003']);
    expect(third?.context.selection.ids).toEqual(['build-0001']);

    // `documentTreeMode: 'scoped'`: the region in hand is quoted whole, the
    // rest arrive as a shape summary rather than their body copy.
    const nodes = third?.context.document.nodes ?? [];
    const inHand = nodes.find((node) => node.id === 'build-0001');
    const others = nodes.filter((node) => node.type === 'customCode' && node.id !== 'build-0001');
    expect(typeof inHand?.props['tree']).toBe('object');
    expect(others).toHaveLength(2);
    expect(others.every((node) => typeof node.props['tree'] === 'string')).toBe(true);
    expect(JSON.stringify(others)).not.toContain('Body copy');

    // Every fill run asked for the fill skill only, and every request carried
    // the one direction the scaffold decided.
    for (const call of [first, second, third]) {
      expect(call?.request).toContain('THE DIRECTION');
      expect(call?.request).toContain(DIRECTION);
    }
    expect(first?.request).toContain('build-0002');
    expect(first?.request).toContain('Hero');
  });

  it('retries a failed fill once with a shortened brief and counts the recovery as applied', async () => {
    const live = kernel();
    const events: AiBuildEvent[] = [];
    let heroAttempts = 0;
    const { provider, calls } = recordingProvider((call, index) => {
      if (index === 0) return Promise.resolve(scaffoldPlan(THREE));
      const region = scopedRegionId(call);
      if (region === 'build-0002') {
        heroAttempts += 1;
        if (heroAttempts === 1) return Promise.reject(new Error('The model lost its nerve.'));
        return Promise.resolve(fillPlan(region, 'Hero'));
      }
      return Promise.resolve(fillPlan(region, region === 'build-0003' ? 'Proof' : 'Pricing'));
    });

    const result = await runAiBuild({
      runId: 'build-retry',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'A studio page',
      validationPorts: ports('retry'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      onEvent: (event) => {
        events.push(event);
      },
    });

    expect(result.applied).toBe(3);
    expect(result.skipped).toBe(0);
    expect(result.tasks[0]).toMatchObject({ title: 'Hero', status: 'applied', attempts: 2 });
    expect(live.transactions().map(({ command }) => command)).toEqual([
      'Assistant: page skeleton',
      'Assistant: 1/3 — Hero',
      'Assistant: 2/3 — Proof',
      'Assistant: 3/3 — Pricing',
    ]);

    /*
      The second attempt is a SHORTER brief: one sentence of direction, the
      title. Selected by REGION, not by position — sections are written
      concurrently, so Hero's retry is not the call after Hero's first try.
    */
    const [firstTry, secondTry] = calls.filter(
      (call) => call.context.selection.ids[0] === 'build-0002',
    );
    expect(firstTry?.request).toContain(DIRECTION);
    expect(secondTry?.request).toContain(DIRECTION_FIRST_SENTENCE);
    expect(secondTry?.request).not.toContain(DIRECTION);
    expect(secondTry?.request).toContain('Hero');
    expect((secondTry?.request.length ?? 0) < (firstTry?.request.length ?? 0)).toBe(true);

    // Four starts for three sections: Hero is started twice. Completions still
    // come in page order.
    expect(buildEvents(events).map(({ type }) => type)).toEqual([
      'build.scaffolding',
      'build.planned',
      'task.started',
      'task.started',
      'task.started',
      'task.started',
      'task.completed',
      'task.completed',
      'task.completed',
      'build.completed',
    ]);
    expect(
      buildEvents(events).flatMap((event) =>
        event.type === 'task.completed' ? [event.position] : [],
      ),
    ).toEqual([1, 2, 3]);
  });

  it('skips a fill that fails twice, keeps earlier work, and still runs the next section', async () => {
    const live = kernel();
    const events: AiBuildEvent[] = [];
    const { provider } = recordingProvider((call, index) => {
      if (index === 0) return Promise.resolve(scaffoldPlan(THREE));
      const region = scopedRegionId(call);
      if (region === 'build-0003') return Promise.reject(new Error('Proof is beyond me.'));
      return Promise.resolve(fillPlan(region, region === 'build-0002' ? 'Hero' : 'Pricing'));
    });

    const result = await runAiBuild({
      runId: 'build-skip',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'A studio page',
      validationPorts: ports('skip'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      onEvent: (event) => {
        events.push(event);
      },
    });

    expect(result.applied).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.outcome).toBe('completed');
    expect(result.tasks[1]).toMatchObject({
      title: 'Proof',
      status: 'skipped',
      attempts: 2,
    });
    expect(result.tasks[1]?.reason).toContain('Proof is beyond me.');

    // Hero survived; Pricing still ran; only Proof is still a placeholder.
    const document = live.getDocument();
    expect(JSON.stringify(document.nodes['build-0002']?.props['tree'])).toContain('Body copy');
    expect(JSON.stringify(document.nodes['build-0001']?.props['tree'])).toContain('Body copy');
    expect(JSON.stringify(document.nodes['build-0003']?.props['tree'])).not.toContain('Body copy');
    expect(live.transactions().map(({ command }) => command)).toEqual([
      'Assistant: page skeleton',
      'Assistant: 1/3 — Hero',
      'Assistant: 3/3 — Pricing',
    ]);

    const own = buildEvents(events);
    /*
      Four starts for three sections (Proof is tried twice), then the three
      endings IN PAGE ORDER: applied, skipped, applied. A section that gives
      up does not hold up the ones behind it, and does not jump the queue
      either — its neighbours still land where they belong.
    */
    expect(own.map(({ type }) => type)).toEqual([
      'build.scaffolding',
      'build.planned',
      'task.started',
      'task.started',
      'task.started',
      'task.started',
      'task.completed',
      'task.skipped',
      'task.completed',
      'build.completed',
    ]);
    // Never a question: no event ever asks the caller for a decision.
    expect(own.some((event) => event.type === 'build.stopped')).toBe(false);
  });

  it('aborts only the timed-out section and carries on with the next one', async () => {
    const live = kernel();
    const { provider } = recordingProvider((call, index) => {
      if (index === 0) return Promise.resolve(scaffoldPlan(THREE));
      const region = scopedRegionId(call);
      if (region === 'build-0002') return hangs(call.signal);
      return Promise.resolve(fillPlan(region, region === 'build-0003' ? 'Proof' : 'Pricing'));
    });

    const result = await runAiBuild({
      runId: 'build-timeout',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'A studio page',
      validationPorts: ports('timeout'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      taskTimeoutMs: 15,
    });

    expect(result.tasks[0]).toMatchObject({ title: 'Hero', status: 'skipped', attempts: 2 });
    expect(result.tasks[1]).toMatchObject({ title: 'Proof', status: 'applied' });
    expect(result.tasks[2]).toMatchObject({ title: 'Pricing', status: 'applied' });
    expect(result.applied).toBe(2);
    expect(live.transactions().map(({ command }) => command)).toEqual([
      'Assistant: page skeleton',
      'Assistant: 2/3 — Proof',
      'Assistant: 3/3 — Pricing',
    ]);
  });

  it('stops after the running section when the caller aborts, leaving applied work applied', async () => {
    const live = kernel();
    const events: AiBuildEvent[] = [];
    const controller = new AbortController();
    const { provider } = recordingProvider((call, index) => {
      if (index === 0) return Promise.resolve(scaffoldPlan(THREE));
      const region = scopedRegionId(call);
      // The caller changes their mind while the first section is being written.
      controller.abort();
      return Promise.resolve(fillPlan(region, 'Hero'));
    });

    const result = await runAiBuild({
      runId: 'build-stop',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'A studio page',
      validationPorts: ports('stop'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      signal: controller.signal,
      onEvent: (event) => {
        events.push(event);
      },
    });

    expect(result.outcome).toBe('signal');
    expect(result.applied).toBe(1);
    expect(result.tasks.map(({ status }) => status)).toEqual([
      'applied',
      'not-started',
      'not-started',
    ]);
    expect(live.transactions().map(({ command }) => command)).toEqual([
      'Assistant: page skeleton',
      'Assistant: 1/3 — Hero',
    ]);
    expect(JSON.stringify(live.getDocument().nodes['build-0002']?.props['tree'])).toContain(
      'Body copy',
    );
    const own = buildEvents(events);
    /*
      `build.stopped` lands BEFORE the section it interrupted, and that is the
      honest order: it means "no further section will be STARTED", which the
      writers learn the instant the signal trips — while the one already in
      flight is still being written. Work in flight is never thrown away, so
      its completion follows the stop.
    */
    expect(own.map(({ type }) => type)).toEqual([
      'build.scaffolding',
      'build.planned',
      'task.started',
      'build.stopped',
      'task.completed',
      'build.completed',
    ]);
    expect(own.find((event) => event.type === 'build.stopped')).toMatchObject({ reason: 'signal' });
  });

  it('writes several sections at once and still lands them in page order', async () => {
    const live = kernel();
    let inFlight = 0;
    let peak = 0;
    const arrived: string[] = [];
    /*
      A latch no single section can open. Every fill blocks until THREE are
      inside the provider at the same time, so a run that wrote its sections
      one after another would hang here rather than pass quietly — the timeout
      IS the assertion. Then they are released in reverse: the last section
      finishes writing first.
    */
    let allInside!: () => void;
    const inside = new Promise<void>((resolve) => (allInside = resolve));
    const { provider } = recordingProvider(async (call, index) => {
      if (index === 0) return scaffoldPlan(THREE);
      const region = scopedRegionId(call);
      arrived.push(region);
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      if (inFlight === THREE.length) allInside();
      await inside;
      const rank = arrived.indexOf(region);
      for (let tick = 0; tick < (THREE.length - rank) * 4; tick += 1) await Promise.resolve();
      inFlight -= 1;
      return fillPlan(region, 'Section');
    });

    const result = await runAiBuild({
      runId: 'build-concurrent',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'A studio page',
      validationPorts: ports('concurrent'),
      skillRegistry: createCraftkitAiSkillRegistry(),
    });

    expect(peak).toBe(3);
    expect(result.applied).toBe(3);
    // Finished writing LAST-first; landed FIRST-last. The page is never out of order.
    expect(live.transactions().map(({ command }) => command)).toEqual([
      'Assistant: page skeleton',
      'Assistant: 1/3 — Hero',
      'Assistant: 2/3 — Proof',
      'Assistant: 3/3 — Pricing',
    ]);
  });

  it('automatically raises the writer pool to four for a four-section build', async () => {
    const live = kernel();
    let inFlight = 0;
    let peak = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { provider } = recordingProvider(async (call, index) => {
      if (index === 0) return scaffoldPlan(FOUR);
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await gate;
      inFlight -= 1;
      return fillPlan(scopedRegionId(call), 'Section');
    });

    const building = runAiBuild({
      runId: 'build-auto-concurrency',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'A four-section studio page',
      validationPorts: ports('auto-concurrency'),
      skillRegistry: createCraftkitAiSkillRegistry(),
    });

    // Let every writer in the first wave reach the provider before opening the gate.
    for (let tick = 0; tick < 200 && peak < FOUR.length; tick += 1) await Promise.resolve();
    const firstWavePeak = peak;
    release();
    const result = await building;

    expect(firstWavePeak).toBe(4);
    expect(result.applied).toBe(4);
    expect(live.transactions().map(({ command }) => command)).toEqual([
      'Assistant: page skeleton',
      ...FOUR.map(
        ({ title }, index) => `Assistant: ${String(index + 1)}/4 — ${title}`,
      ),
    ]);
  });

  it('caps the automatic writer pool at six for a large build', async () => {
    const live = kernel();
    let inFlight = 0;
    let peak = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { provider } = recordingProvider(async (call, index) => {
      if (index === 0) return scaffoldPlan(TWELVE);
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await gate;
      inFlight -= 1;
      return fillPlan(scopedRegionId(call), 'Section');
    });

    const building = runAiBuild({
      runId: 'build-auto-concurrency-cap',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'A large studio page',
      validationPorts: ports('auto-concurrency-cap'),
      skillRegistry: createCraftkitAiSkillRegistry(),
    });

    for (let tick = 0; tick < 300 && peak < 6; tick += 1) await Promise.resolve();
    const firstWavePeak = peak;
    release();
    const result = await building;

    expect(firstWavePeak).toBe(6);
    expect(peak).toBe(6);
    expect(result.applied).toBe(12);
    expect(live.transactions().map(({ command }) => command)).toEqual([
      'Assistant: page skeleton',
      ...TWELVE.map(
        ({ title }, index) => `Assistant: ${String(index + 1)}/12 — ${title}`,
      ),
    ]);
  });

  it('writes one section at a time when the caller asks for it', async () => {
    const live = kernel();
    let inFlight = 0;
    let peak = 0;
    const { provider } = recordingProvider(async (call, index) => {
      if (index === 0) return scaffoldPlan(THREE);
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return fillPlan(scopedRegionId(call), 'Section');
    });

    const result = await runAiBuild({
      runId: 'build-serial',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'A studio page',
      validationPorts: ports('serial'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      fillConcurrency: 1,
    });

    expect(peak).toBe(1);
    expect(result.applied).toBe(3);
  });

  it('ends an exhausted budget with a report rather than an error', async () => {
    const live = kernel();
    let now = 0;
    const clock: ClockPort = { now: () => now };
    const { provider } = recordingProvider((call, index) => {
      if (index === 0) return Promise.resolve(scaffoldPlan(THREE));
      const region = scopedRegionId(call);
      now = 9_000;
      return Promise.resolve(fillPlan(region, 'Hero'));
    });

    const result = await runAiBuild({
      runId: 'build-budget',
      clock,
      kernel: live,
      provider,
      request: 'A studio page',
      validationPorts: ports('budget'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      buildBudgetMs: 5_000,
    });

    expect(result.outcome).toBe('budget');
    expect(result.applied).toBe(1);
    expect(result.elapsedMs).toBe(9_000);
    expect(result.tasks.map(({ status }) => status)).toEqual([
      'applied',
      'not-started',
      'not-started',
    ]);
    expect(result.tasks[1]?.reason).toContain('budget');
  });

  it('stops starting sections once maxTasks are done', async () => {
    const live = kernel();
    const { provider } = recordingProvider((call, index) =>
      Promise.resolve(
        index === 0 ? scaffoldPlan(THREE) : fillPlan(scopedRegionId(call), 'Section'),
      ),
    );

    const result = await runAiBuild({
      runId: 'build-max',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'A studio page',
      validationPorts: ports('max'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      maxTasks: 2,
    });

    expect(result.outcome).toBe('max-tasks');
    expect(result.applied).toBe(2);
    expect(result.tasks.map(({ status }) => status)).toEqual(['applied', 'applied', 'not-started']);
  });

  it('falls back to one ordinary run when the scaffold produced a single region', async () => {
    const live = kernel();
    const events: AiBuildEvent[] = [];
    const { provider, calls } = recordingProvider((_call, index) =>
      Promise.resolve(
        index === 0 ? scaffoldPlan([{ title: 'Hero', index: 0 }]) : fillPlan('build-0001', 'Hero'),
      ),
    );

    const result = await runAiBuild({
      runId: 'build-thin',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'A studio page',
      validationPorts: ports('thin'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      onEvent: (event) => {
        events.push(event);
      },
    });

    expect(result.outcome).toBe('fallback');
    expect(result.tasks).toEqual([]);
    expect(result.fallback?.status).toBe('applied');
    expect(calls).toHaveLength(2);
    // The ordinary run is ordinary: no build skill was forced on it.
    expect(calls[1]?.request).toBe('A studio page');
    expect(JSON.stringify(live.getDocument().nodes['build-0001']?.props['tree'])).toContain(
      'Body copy',
    );

    // `build.scaffolding` was already true when it was emitted; from the
    // decision onwards the fallback path says one thing and nothing else. No
    // plan, no task, no completion: this run never pretended to be a build.
    const own = buildEvents(events);
    expect(own.map(({ type }) => type)).toEqual(['build.scaffolding', 'build.skipped']);
    expect(own[1]).toMatchObject({ type: 'build.skipped', runId: 'build-thin' });
  });

  it('falls back when the scaffold created no regions at all', async () => {
    const live = kernel();
    const events: AiBuildEvent[] = [];
    const { provider } = recordingProvider((_call, index) =>
      Promise.resolve(
        index === 0
          ? {
              rationale: DIRECTION,
              commands: [
                { command: 'setProp', args: { id: 'root', key: 'title', value: 'Studio' } },
              ],
            }
          : {
              rationale: 'Insert a hero.',
              commands: [
                {
                  command: 'insertNode',
                  args: {
                    type: 'customCode',
                    parentId: 'root',
                    props: { label: 'Hero', tree: filled('Hero') },
                  },
                },
              ],
            },
      ),
    );

    const result = await runAiBuild({
      runId: 'build-none',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'A studio page',
      validationPorts: ports('none'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      onEvent: (event) => {
        events.push(event);
      },
    });

    expect(result.outcome).toBe('fallback');
    expect(result.applied).toBe(0);
    expect(buildEvents(events).map(({ type }) => type)).toEqual([
      'build.scaffolding',
      'build.skipped',
    ]);
  });

  it('prefixes every step run id so each inner event is attributable', async () => {
    const live = kernel();
    const events: AiBuildEvent[] = [];
    const { provider } = recordingProvider((call, index) =>
      Promise.resolve(
        index === 0
          ? scaffoldPlan(THREE)
          : fillPlan(scopedRegionId(call), DOCUMENT_ORDER[index - 1] ?? '?'),
      ),
    );

    await runAiBuild({
      runId: 'build-ids',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'A studio page',
      validationPorts: ports('ids'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      onEvent: (event) => {
        events.push(event);
      },
    });

    const runIds = [...new Set(events.map(({ runId }) => runId))];
    expect(runIds).toEqual([
      'build-ids',
      'build-ids/scaffold',
      'build-ids/fill-1',
      'build-ids/fill-2',
      'build-ids/fill-3',
    ]);
    for (const runId of runIds) expect(runId.length).toBeLessThanOrEqual(160);
    // The build's own events number themselves independently of any step's.
    expect(buildEvents(events).map(({ seq }) => seq)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('refuses a run id it could not prefix', async () => {
    await expect(
      runAiBuild({
        runId: '   ',
        clock: fixedClock(1000),
        kernel: kernel(),
        provider: recordingProvider(() => Promise.resolve(scaffoldPlan(THREE))).provider,
        request: 'A studio page',
        validationPorts: ports('bad-id'),
        skillRegistry: createCraftkitAiSkillRegistry(),
      }),
    ).rejects.toThrow(RangeError);
  });
});

describe('a scaffold that fails costs nothing', () => {
  it('falls back to one ordinary run instead of failing the whole build', async () => {
    /*
      The skeleton is an EXTRA request this path invented. The person asked for
      a page, and if the invention fails they must still get the single call
      they would have had — otherwise the split made things worse, which is the
      one thing this module may never do.
    */
    const live = kernel();
    const events: AiBuildEvent[] = [];
    const { provider } = recordingProvider((call, index) => {
      if (index === 0) return Promise.reject(new Error('the model went sideways'));
      return Promise.resolve(scaffoldPlan([{ title: 'Hero', index: 0 }], call.request));
    });

    const result = await runAiBuild({
      runId: 'build-scaffold-failure',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'A studio page for solo founders',
      validationPorts: ports('build-scaffold-failure'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      onEvent: (event) => {
        events.push(event);
      },
    });

    expect(result.outcome).toBe('fallback');
    expect(result.scaffold).toBeUndefined();
    expect(result.fallback?.status).toBe('applied');

    const own = buildEvents(events);
    const skipped = own.find((event) => event.type === 'build.skipped');
    expect(skipped?.type).toBe('build.skipped');
    expect(skipped?.type === 'build.skipped' ? skipped.reason : '').toContain('skeleton failed');
    expect(own.some((event) => event.type === 'build.planned')).toBe(false);
    expect(own.some((event) => event.type === 'task.started')).toBe(false);
    // The person still got their page: one ordinary run applied it.
    expect(live.transactions()).toHaveLength(1);
  });
});

describe('the one approval', () => {
  it('asks once, after the skeleton and before any section, and builds when told to', async () => {
    const live = kernel();
    const asked: { tasks: number; direction: string }[] = [];
    const { provider, calls } = recordingProvider((call, index) =>
      index === 0
        ? Promise.resolve(scaffoldPlan(THREE))
        : Promise.resolve(fillPlan(scopedRegionId(call), `Section ${String(index)}`)),
    );

    const result = await runAiBuild({
      runId: 'build-approved',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'A studio page',
      validationPorts: ports('build-approved'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      onPlanned: (tasks, direction) => {
        // Asked after the skeleton is already down: the person approves a list
        // they can see, not a promise.
        asked.push({ tasks: tasks.length, direction });
        expect(calls).toHaveLength(1);
        return 'build';
      },
    });

    expect(asked).toHaveLength(1);
    expect(asked[0]?.tasks).toBe(THREE.length);
    expect(asked[0]?.direction).toBe(DIRECTION);
    expect(result.applied).toBe(THREE.length);
  });

  it('stops on refusal with the skeleton kept and every section not-started', async () => {
    const live = kernel();
    const { provider, calls } = recordingProvider(() => Promise.resolve(scaffoldPlan(THREE)));

    const result = await runAiBuild({
      runId: 'build-refused',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'A studio page',
      validationPorts: ports('build-refused'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      onPlanned: () => 'stop',
    });

    // The skeleton ran; no section did.
    expect(calls).toHaveLength(1);
    expect(result.applied).toBe(0);
    expect(result.tasks.every(({ status }) => status === 'not-started')).toBe(true);
    // And the skeleton stays — it is an ordinary transaction a person can undo.
    expect(live.transactions()).toHaveLength(1);
  });

  it('runs straight through when nothing is asked', async () => {
    const live = kernel();
    const { provider } = recordingProvider((call, index) =>
      index === 0
        ? Promise.resolve(scaffoldPlan(THREE))
        : Promise.resolve(fillPlan(scopedRegionId(call), `Section ${String(index)}`)),
    );

    const result = await runAiBuild({
      runId: 'build-unattended',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'A studio page',
      validationPorts: ports('build-unattended'),
      skillRegistry: createCraftkitAiSkillRegistry(),
    });

    expect(result.applied).toBe(THREE.length);
  });
});

describe('fillConcurrencyFor — how many sections are written at once', () => {
  /*
    Pinned HERE and not in a story. A Chromium story can observe that the window
    is wider than one and narrower than the page; it cannot pin a formula
    without hard-coding a number that is only right for one page size — which is
    exactly how a story ended up asserting "exactly three" for a five-section
    build the code runs four writers on.
  */
  it('starts at the default and grows with the page', () => {
    expect(fillConcurrencyFor(1, undefined)).toBe(1);
    expect(fillConcurrencyFor(3, undefined)).toBe(3);
    /*
      Every size where the formula turns over, because "how many writers does a
      four-section page get" is a question people answer from memory and get
      wrong — I told a peer 3 for exactly this case, and it is 4.
      3 + floor((n-1)/3), capped at n and at the maximum.
    */
    expect(fillConcurrencyFor(4, undefined)).toBe(4);
    expect(fillConcurrencyFor(5, undefined)).toBe(4);
    expect(fillConcurrencyFor(6, undefined)).toBe(4);
    expect(fillConcurrencyFor(7, undefined)).toBe(5);
    expect(fillConcurrencyFor(10, undefined)).toBe(6);
  });

  it('never exceeds the page, so a two-section build does not start three writers', () => {
    expect(fillConcurrencyFor(2, undefined)).toBe(2);
    expect(fillConcurrencyFor(2, 9)).toBe(2);
  });

  it('is capped, so a twelve-section page does not become twelve model calls at once', () => {
    expect(fillConcurrencyFor(40, undefined)).toBe(MAX_AI_BUILD_AUTO_FILL_CONCURRENCY);
  });

  it('honours a caller EXACTLY, including 1 for strictly sequential work', () => {
    expect(fillConcurrencyFor(10, 1)).toBe(1);
    expect(fillConcurrencyFor(10, 2)).toBe(2);
    // A nonsense request is clamped rather than trusted.
    expect(fillConcurrencyFor(10, 0)).toBe(1);
    expect(fillConcurrencyFor(10, -5)).toBe(1);
  });
});
