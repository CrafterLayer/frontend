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
  type ClockPort,
  type CustomCodeRoot,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { PHOTO_CATALOG_FRAGMENT_TITLE } from '../context';
import { AiProviderError } from '../provider/errors';
import { createCraftkitAiSkillRegistry } from '../skills';
import type { AiPlan, AiPlanProvider, AssembledAiContext } from '../types';
import {
  fillConcurrencyFor,
  runAiBuild,
  type AiBuildEvent,
  type AiBuildOwnEvent,
  type AiBuildSkipReasonCode,
} from './index';

/*
  Wave 2 of the 2026-09-28 engine work, on the SCAFFOLD build (a provider with
  no page plan — every provider written before it): the gaps wave 1 left
  between its own parts, each found by wave 1's verifier or named by another
  owner as theirs to close here.
*/

const NullRender: BlockRenderComponent = () => null;

const PAGE = z.object({
  title: z.string().default(''),
  lang: z.string().max(12).default(''),
  pageCss: customCss(20_000),
});

function manifest(): TrustedExtensionManifest {
  return {
    tier: 1,
    name: 'build-integration-fixture',
    version: '0.0.0',
    contributes: {
      blocks: [
        {
          schema: defineBlockSchema({
            type: 'page',
            description: 'The page root.',
            props: PAGE,
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
    ports: { clock: fixedClock(1), ids: seededIds('integration') },
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

function scaffoldPlan(titles: readonly string[], rationale: string): AiPlan {
  return {
    rationale,
    commands: titles.map((title) => ({
      command: 'insertNode',
      args: { type: 'customCode', parentId: 'root', props: { label: title, tree: region(title) } },
    })),
  };
}

function write(id: string, text: string): AiPlan['commands'][number] {
  return { command: 'setProp', args: { id, key: 'tree', value: region(text) } };
}

interface Call {
  readonly request: string;
  readonly context: AssembledAiContext;
  readonly signal: AbortSignal | undefined;
}

function recording(handle: (call: Call, index: number) => Promise<AiPlan>) {
  const calls: Call[] = [];
  const provider: AiPlanProvider = {
    propose(request, context, live) {
      const call = { request, context, signal: live?.signal };
      calls.push(call);
      return handle(call, calls.length - 1);
    },
  };
  return { provider, calls };
}

function regionOf(call: Call): string | undefined {
  return call.context.selection.ids[0];
}

function sectionOf(call: Call): number {
  return Number(/SECTION (\d+) OF/u.exec(call.request)?.[1] ?? '0');
}

function own(events: readonly AiBuildEvent[]): AiBuildOwnEvent[] {
  return events.filter(
    (event): event is AiBuildOwnEvent =>
      event.type.startsWith('build.') || event.type.startsWith('task.'),
  );
}

function photosOf(call: Call | undefined): { subject: string }[] | undefined {
  const fragment = call?.context.fragments.find(
    ({ title }) => title === PHOTO_CATALOG_FRAGMENT_TITLE,
  );
  return fragment === undefined
    ? undefined
    : (JSON.parse(fragment.body) as { photos: { subject: string }[] }).photos;
}

const FOUR = ['Hero', 'Menu', 'Gallery', 'Footer'] as const;
const DIRECTION =
  'A roastery in Amman. Palette stone-50, emerald-800. 1 Hero · 2 Menu · 3 Gallery · 4 Footer';

describe('A(1) — the photo list reaches the skeleton and every section writer', () => {
  it('briefs the scaffold with the request and each writer with the request and its own title', async () => {
    const live = kernel();
    const { provider, calls } = recording((call) => {
      const id = regionOf(call);
      if (id === undefined) return Promise.resolve(scaffoldPlan(FOUR, DIRECTION));
      return Promise.resolve({ rationale: 'ok', commands: [write(id, 'written')] });
    });

    const result = await runAiBuild({
      runId: 'photos',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'Build a landing page for my specialty coffee roastery',
      validationPorts: ports('photos'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      composition: { catalogMode: 'none' },
    });

    expect(result.applied).toBe(FOUR.length);
    // The scaffold and all four writers each got one list, filtered by their brief.
    expect(calls).toHaveLength(1 + FOUR.length);
    for (const call of calls) {
      const photos = photosOf(call);
      expect(photos).toBeDefined();
      expect(photos?.length).toBeGreaterThan(0);
      expect(photos?.some(({ subject }) => subject === 'cafe')).toBe(true);
    }
  });
});

describe('A(3) — "try another look" reaches the direction deck as VARIANT: B', () => {
  async function scaffoldRequest(request: string): Promise<string> {
    const live = kernel();
    const { provider, calls } = recording((call) => {
      const id = regionOf(call);
      if (id === undefined) return Promise.resolve(scaffoldPlan(FOUR, DIRECTION));
      return Promise.resolve({ rationale: 'ok', commands: [write(id, 'x')] });
    });
    await runAiBuild({
      runId: 'look',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request,
      validationPorts: ports('look'),
      skillRegistry: createCraftkitAiSkillRegistry(),
    });
    return calls[0]?.request ?? '';
  }

  it('adds the line to the skeleton request when the person asks for another look', async () => {
    expect(await scaffoldRequest('Try another look for my roastery page')).toMatch(
      /\nVARIANT: B$/u,
    );
    expect(await scaffoldRequest('جرّب شكل ثاني لصفحة المحمصة')).toMatch(/\nVARIANT: B$/u);
  });

  it('leaves an ordinary request exactly as the person wrote it', async () => {
    expect(await scaffoldRequest('Build a page for my roastery')).toBe(
      'Build a page for my roastery',
    );
  });
});

describe('A(4) — nothing lands after Stop, the right-to-left turn included', () => {
  it('does not turn the page when Stop is pressed from inside build.planned (wave-1 verifier repro)', async () => {
    const live = kernel();
    const controller = new AbortController();
    const { provider } = recording((call) => {
      const id = regionOf(call);
      if (id === undefined) {
        return Promise.resolve(scaffoldPlan(['الرئيسية', 'القائمة'], 'مقهى في عمّان.'));
      }
      return Promise.resolve({ rationale: 'ok', commands: [write(id, 'قسم')] });
    });

    const result = await runAiBuild({
      runId: 'rtl-stop',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'صفحة هبوط لمقهى',
      validationPorts: ports('rtl-stop'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      signal: controller.signal,
      onEvent: (event) => {
        if (event.type === 'build.planned') controller.abort();
      },
    });

    expect(live.getDocument().dir).toBe('ltr');
    expect(live.transactions().map(({ command }) => command)).toEqual(['Assistant: page skeleton']);
    expect(result.applied).toBe(0);
  });
});

describe('E1 — the build says how many writers work at once', () => {
  it('puts the writer count on build.planned', async () => {
    const live = kernel();
    const events: AiBuildEvent[] = [];
    const { provider } = recording((call) => {
      const id = regionOf(call);
      if (id === undefined) return Promise.resolve(scaffoldPlan(FOUR, DIRECTION));
      return Promise.resolve({ rationale: 'ok', commands: [write(id, 'x')] });
    });

    await runAiBuild({
      runId: 'writers',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'Build a page',
      validationPorts: ports('writers'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      onEvent: (event) => events.push(event),
    });

    const planned = own(events).find(({ type }) => type === 'build.planned');
    if (planned?.type !== 'build.planned') throw new Error('no build.planned');
    expect(planned.writers).toBe(fillConcurrencyFor(FOUR.length, undefined));
    expect(planned.writers).toBe(4);
  });
});

describe('E2 — the approval wait is not charged to the build budget', () => {
  it('fills every section after a person spent longer than the budget on the list', async () => {
    const live = kernel();
    let now = 1_000;
    const clock: ClockPort = { now: () => now };
    const { provider } = recording((call) => {
      const id = regionOf(call);
      if (id === undefined) return Promise.resolve(scaffoldPlan(FOUR, DIRECTION));
      return Promise.resolve({ rationale: 'ok', commands: [write(id, 'x')] });
    });

    const result = await runAiBuild({
      runId: 'wait',
      clock,
      kernel: live,
      provider,
      request: 'Build a page',
      validationPorts: ports('wait'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      buildBudgetMs: 60_000,
      onPlanned: () => {
        now += 600_000;
        return 'build';
      },
    });

    expect(result.outcome).toBe('completed');
    expect(result.applied).toBe(FOUR.length);
    expect(result.elapsedMs).toBe(0);
  });

  it('still charges the work itself: a budget spent writing stops the next section', async () => {
    const live = kernel();
    let now = 1_000;
    const clock: ClockPort = { now: () => now };
    const { provider } = recording((call) => {
      const id = regionOf(call);
      if (id === undefined) return Promise.resolve(scaffoldPlan(FOUR, DIRECTION));
      now += 40_000;
      return Promise.resolve({ rationale: 'ok', commands: [write(id, 'x')] });
    });

    const result = await runAiBuild({
      runId: 'work',
      clock,
      kernel: live,
      provider,
      request: 'Build a page',
      validationPorts: ports('work'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      buildBudgetMs: 60_000,
      fillConcurrency: 1,
    });

    expect(result.outcome).toBe('budget');
    expect(result.tasks.at(-1)?.reasonCode).toBe('budget');
  });
});

describe('E5 — every skipped or unstarted section says why, as data', () => {
  async function codes(
    fill: (call: Call) => Promise<AiPlan>,
    extra: Partial<Parameters<typeof runAiBuild>[0]> = {},
  ): Promise<{ codes: (AiBuildSkipReasonCode | undefined)[]; events: AiBuildEvent[] }> {
    const live = kernel();
    const events: AiBuildEvent[] = [];
    const { provider } = recording((call) => {
      if (regionOf(call) === undefined)
        return Promise.resolve(scaffoldPlan(['Hero', 'Menu'], DIRECTION));
      return fill(call);
    });
    const result = await runAiBuild({
      runId: 'codes',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'Build a page',
      validationPorts: ports('codes'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      fillConcurrency: 1,
      onEvent: (event) => events.push(event),
      ...extra,
    });
    return { codes: result.tasks.map(({ reasonCode }) => reasonCode), events };
  }

  it('names a writer that only wrote outside its region "out-of-scope"', async () => {
    const { codes: found, events } = await codes((call) =>
      Promise.resolve({
        rationale: 'ok',
        commands:
          sectionOf(call) === 1
            ? [{ command: 'setProp', args: { id: 'root', key: 'title', value: 'Hijacked' } }]
            : [write(regionOf(call) ?? '', 'x')],
      }),
    );
    expect(found).toEqual(['out-of-scope', undefined]);
    const skipped = own(events).find(({ type }) => type === 'task.skipped');
    expect(skipped?.type === 'task.skipped' ? skipped.reasonCode : undefined).toBe('out-of-scope');
  });

  it('names a door refusal "invalid" and an unreachable provider "unreachable"', async () => {
    const { codes: found } = await codes((call) =>
      sectionOf(call) === 1
        ? Promise.resolve({
            rationale: 'ok',
            commands: [
              { command: 'setProp', args: { id: regionOf(call), key: 'tree', value: 42 } },
            ],
          })
        : Promise.reject(
            new AiProviderError('The service could not be reached.', {
              code: 'network',
              retryable: true,
            }),
          ),
    );
    expect(found).toEqual(['invalid', 'unreachable']);
  });

  it('names a section that ran out of its own time "timeout"', async () => {
    const { codes: found } = await codes(
      (call) =>
        sectionOf(call) === 1
          ? new Promise<AiPlan>((_resolve, reject) => {
              call.signal?.addEventListener('abort', () => {
                const error = new Error('aborted');
                error.name = 'AbortError';
                reject(error);
              });
            })
          : Promise.resolve({ rationale: 'ok', commands: [write(regionOf(call) ?? '', 'x')] }),
      { taskTimeoutMs: 5 },
    );
    expect(found).toEqual(['timeout', undefined]);
  });

  it('names sections cut off by Stop "stopped"', async () => {
    const controller = new AbortController();
    const { codes: found } = await codes(
      (call) => {
        controller.abort();
        return new Promise<AiPlan>((_resolve, reject) => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          if (call.signal?.aborted === true) reject(error);
          call.signal?.addEventListener('abort', () => {
            reject(error);
          });
        });
      },
      { signal: controller.signal },
    );
    expect(found).toEqual(['stopped', 'stopped']);
  });

  it('names a section refused on landing because its region was removed "page-changed"', async () => {
    const live = kernel();
    const { provider } = recording((call) => {
      const id = regionOf(call);
      if (id === undefined) return Promise.resolve(scaffoldPlan(['Hero', 'Menu'], DIRECTION));
      // The hero is slow, so the menu is WRITTEN before the hero lands — and waits.
      const delay = sectionOf(call) === 1 ? 20 : 0;
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ rationale: 'ok', commands: [write(id, 'x')] });
        }, delay);
      });
    });
    const result = await runAiBuild({
      runId: 'moved',
      clock: fixedClock(1000),
      kernel: live,
      provider,
      request: 'Build a page',
      validationPorts: ports('moved'),
      skillRegistry: createCraftkitAiSkillRegistry(),
      fillConcurrency: 2,
      onEvent: (event) => {
        // The person deletes the menu region after it was written, before it lands.
        if (event.runId === 'moved/fill-2' && event.type === 'run.completed') {
          const menu = Object.values(live.getDocument().nodes).find(
            (node) => node.props['label'] === 'Menu',
          );
          if (menu !== undefined) live.dispatch('removeNode', { id: menu.id }, 'user');
        }
      },
    });
    expect(result.tasks.map(({ reasonCode }) => reasonCode)).toEqual([undefined, 'page-changed']);
  });
});
