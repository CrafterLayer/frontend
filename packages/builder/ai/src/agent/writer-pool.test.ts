import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  defineBlockSchema,
  emptyCustomCodeTree,
  type BlockRenderComponent,
  type CustomCodeRoot,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { createCraftkitAiSkillRegistry } from '../skills';
import type { AiPlan, AiPlanProvider } from '../types';
import { runAiBuild } from './run-build';
import { createAiWriterPool, withWriterPermit, type AiWriterPermit } from './writer-pool';

vi.setConfig({ testTimeout: 20_000 });

/* ── The pool ────────────────────────────────────────────────────────────── */

/** Lets every settled promise run its callbacks. */
async function settle(): Promise<void> {
  for (let tick = 0; tick < 5; tick += 1) await Promise.resolve();
}

describe('createAiWriterPool', () => {
  it('grants up to its limit at once and makes the rest wait', async () => {
    const pool = createAiWriterPool(2);
    const first = await pool.acquire();
    const second = await pool.acquire();
    let third: AiWriterPermit | undefined;
    void pool.acquire().then((permit) => {
      third = permit;
    });
    await settle();
    expect(pool.active).toBe(2);
    expect(pool.waiting).toBe(1);
    expect(third).toBeUndefined();
    first.release();
    await settle();
    expect(third).toBeDefined();
    expect(pool.active).toBe(2);
    expect(pool.waiting).toBe(0);
    second.release();
    third?.release();
    expect(pool.active).toBe(0);
  });

  it('admits waiters first come, first served', async () => {
    const pool = createAiWriterPool(1);
    const holder = await pool.acquire();
    const order: string[] = [];
    const names = ['a', 'b', 'c'];
    const permits = names.map((name) =>
      pool.acquire().then((permit) => {
        order.push(name);
        return permit;
      }),
    );
    holder.release();
    for (const next of permits) (await next).release();
    expect(order).toEqual(names);
  });

  it('lets a waiter whose signal aborts leave the line, never admitted', async () => {
    const pool = createAiWriterPool(1);
    const holder = await pool.acquire();
    const leaving = new AbortController();
    const left = pool.acquire(leaving.signal);
    let admitted = false;
    const staying = pool.acquire().then((permit) => {
      admitted = true;
      return permit;
    });
    expect(pool.waiting).toBe(2);
    leaving.abort();
    await expect(left).rejects.toMatchObject({ name: 'AbortError' });
    expect(pool.waiting).toBe(1);
    holder.release();
    (await staying).release();
    expect(admitted).toBe(true);
    expect(pool.active).toBe(0);
    // Already aborted: refused at once, and nothing waits.
    await expect(pool.acquire(leaving.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(pool.waiting).toBe(0);
  });

  it('releases a permit once however often it is released', async () => {
    const pool = createAiWriterPool(1);
    const permit = await pool.acquire();
    const waiting = pool.acquire();
    permit.release();
    permit.release();
    const next = await waiting;
    expect(pool.active).toBe(1);
    permit.release();
    expect(pool.active).toBe(1);
    next.release();
    expect(pool.active).toBe(0);
  });

  it('refuses a limit that is not a whole number of at least one', () => {
    expect(() => createAiWriterPool(0)).toThrow(RangeError);
    expect(() => createAiWriterPool(1.5)).toThrow(RangeError);
  });

  it('runs work at once without a pool, and skips work stopped while it waited', async () => {
    const free = new AbortController();
    await expect(withWriterPermit({}, free.signal, () => Promise.resolve(7))).resolves.toBe(7);
    const pool = createAiWriterPool(1);
    const holder = await pool.acquire();
    const stop = new AbortController();
    const work = vi.fn(() => Promise.resolve(1));
    const skipped = withWriterPermit({ writerPool: pool, signal: stop.signal }, free.signal, work);
    stop.abort();
    await expect(skipped).resolves.toBeUndefined();
    expect(work).not.toHaveBeenCalled();
    holder.release();
    expect(pool.active).toBe(0);
  });
});

/* ── Two builds, one pool ────────────────────────────────────────────────── */

const NullRender: BlockRenderComponent = () => null;

const BLOCKS: TrustedExtensionManifest = {
  tier: 1,
  name: 'writer-pool-fixture',
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

function page(seed: string): BuilderKernel {
  return createBuilder({
    document: {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: 'root',
      nodes: { root: { id: 'root', type: 'page', props: { title: seed }, slots: { default: [] } } },
    },
    extensions: [BLOCKS],
    ports: { clock: fixedClock(1), ids: seededIds(seed) },
  });
}

function region(title: string, body?: string): CustomCodeRoot {
  return {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        children: [
          { kind: 'element', tag: 'h2', text: title, children: [] },
          ...(body === undefined ? [] : [{ kind: 'element', tag: 'p', text: body, children: [] }]),
        ],
      },
    ],
  } as CustomCodeRoot;
}

const TITLES = ['Hero', 'Proof', 'Pricing', 'Contact'] as const;

/** Section writers in flight right now, across every build, and the most there ever were. */
interface Gauge {
  now: number;
  most: number;
}

/** A scaffold of four regions, then fills that take a few milliseconds each, measured. */
function measuredProvider(kernel: BuilderKernel, gauge: Gauge): AiPlanProvider {
  return {
    async propose(_request, context) {
      const id = context.selection.ids[0];
      if (id === undefined) {
        return {
          rationale: 'A calm page. Palette bg-white text-slate-900. Faces Inter and Inter.',
          commands: TITLES.map((title, index) => ({
            command: 'insertNode',
            args: {
              type: 'customCode',
              parentId: 'root',
              index,
              props: { label: title, tree: region(title) },
            },
          })),
        };
      }
      gauge.now += 1;
      gauge.most = Math.max(gauge.most, gauge.now);
      await new Promise((resolve) => setTimeout(resolve, 5));
      gauge.now -= 1;
      const label = kernel.getDocument().nodes[id]?.props['label'];
      const title = typeof label === 'string' ? label : 'Section';
      return {
        rationale: `Fill ${title}.`,
        commands: [
          {
            command: 'setProp',
            args: { id, key: 'tree', value: region(title, `About ${title}.`) },
          },
        ],
      } satisfies AiPlan;
    },
  };
}

function build(seed: string, gauge: Gauge, writerPool?: ReturnType<typeof createAiWriterPool>) {
  const kernel = page(seed);
  return runAiBuild({
    runId: `site/${seed}`,
    clock: fixedClock(1000),
    kernel,
    provider: measuredProvider(kernel, gauge),
    request: `The ${seed} page of a two-page site`,
    validationPorts: { clock: fixedClock(1), ids: seededIds(`${seed}-gates`) },
    skillRegistry: createCraftkitAiSkillRegistry(),
    fillConcurrency: 3,
    ...(writerPool === undefined ? {} : { writerPool }),
  });
}

describe('runAiBuild with a shared writerPool', () => {
  it('never runs more writers across two builds than the pool allows', async () => {
    const gauge: Gauge = { now: 0, most: 0 };
    const pool = createAiWriterPool(2);
    const [home, about] = await Promise.all([
      build('home', gauge, pool),
      build('about', gauge, pool),
    ]);
    expect(gauge.most).toBe(2);
    for (const result of [home, about]) {
      expect(result.outcome).toBe('completed');
      expect(result.applied).toBe(TITLES.length);
    }
    expect(pool.active).toBe(0);
    expect(pool.waiting).toBe(0);
  });

  it('without a pool, each build keeps only its own cap', async () => {
    const gauge: Gauge = { now: 0, most: 0 };
    await Promise.all([build('home', gauge), build('about', gauge)]);
    expect(gauge.most).toBe(6);
  });

  it('a stopped build leaves nobody waiting in the shared line', async () => {
    const gauge: Gauge = { now: 0, most: 0 };
    const pool = createAiWriterPool(1);
    const stop = new AbortController();
    const kernel = page('stopped');
    const stopped = runAiBuild({
      runId: 'site/stopped',
      clock: fixedClock(1000),
      kernel,
      provider: measuredProvider(kernel, gauge),
      request: 'The stopped page of a two-page site',
      validationPorts: { clock: fixedClock(1), ids: seededIds('stopped-gates') },
      skillRegistry: createCraftkitAiSkillRegistry(),
      fillConcurrency: 3,
      writerPool: pool,
      signal: stop.signal,
      onEvent: (event) => {
        if (event.type === 'task.started') stop.abort();
      },
    });
    const result = await stopped;
    expect(result.outcome).toBe('signal');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(pool.waiting).toBe(0);
    expect(pool.active).toBe(0);
  });
});
