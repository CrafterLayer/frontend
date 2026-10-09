import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCss,
  defineBlockSchema,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { resolveAiCompositionPolicy } from '../context/composition-policy';
import { runAiAgent } from '../agent';
import type {
  AiPagePlanProposal,
  AiPlan,
  AiPlanProvider,
  AiProposeOptions,
  AssembledAiContext,
} from '../types';
import { createCachingAiPlanProvider } from './caching-provider';
import { createRemoteAiPlanProvider } from './remote-provider';
import { estimateAiPlanWireRequestTokens, type AiPlanWireRequest } from './wire';

/**
 * Free code mode on the wire (2026-10-09). `freeCode: true` rides every plan,
 * repair and page-plan POST of a run that turned the composer switch on, and is
 * ABSENT from every other body, so a server that predates the field sees the
 * bytes it always saw.
 */

const ENDPOINT = 'https://assistant.example.test/plan';

function context(): AssembledAiContext {
  return {
    fragments: [],
    totalTokens: 0,
    blocks: [],
    document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes: [] },
    selection: { ids: [] },
  };
}

const plan: AiPlan = {
  rationale: 'Give the stage a scene.',
  commands: [{ command: 'setProp', args: { id: 'stage', key: 'js', value: 'await ck.stage();' } }],
};

interface RecordedCall {
  readonly body: AiPlanWireRequest;
}

function fakeFetch(respond: (call: RecordedCall) => unknown) {
  const calls: RecordedCall[] = [];
  const fetchImpl = (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    if (typeof init?.body !== 'string') throw new Error('The provider must POST a JSON string.');
    const call: RecordedCall = { body: JSON.parse(init.body) as AiPlanWireRequest };
    calls.push(call);
    return Promise.resolve(
      new Response(JSON.stringify(respond(call)), {
        headers: { 'content-type': 'application/json' },
      }),
    );
  };
  return { calls, fetchImpl };
}

const ON: AiProposeOptions = { freeCode: true };

describe('the remote provider body', () => {
  it('carries freeCode: true on propose, repair and the page plan — and only when it is true', async () => {
    const { calls, fetchImpl } = fakeFetch((call) =>
      call.body.task === 'page-plan' ? { version: 1, pagePlan: { title: 'x', sections: [] } } : plan,
    );
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    await provider.propose('a pixi scene', context(), ON);
    await provider.repair('a pixi scene', context(), plan, [], ON);
    await provider.proposePagePlan('a pixi page', context(), ON);
    expect(calls.map(({ body }) => body.freeCode)).toEqual([true, true, true]);

    calls.length = 0;
    await provider.propose('a pixi scene', context());
    await provider.propose('a pixi scene', context(), { freeCode: false });
    await provider.propose('a pixi scene', context(), { freeCode: 'true' } as never);
    await provider.repair('a pixi scene', context(), plan, [], { freeCode: false });
    await provider.proposePagePlan('a pixi page', context());
    expect(calls).toHaveLength(5);
    for (const { body } of calls) {
      expect(body).not.toHaveProperty('freeCode');
    }
  });

  it('rides beside the model choice without disturbing it', async () => {
    const { calls, fetchImpl } = fakeFetch(() => plan);
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    await provider.propose('edit', context(), { model: 'haiku', effort: 'low', freeCode: true } as never);

    expect(calls[0]?.body).toMatchObject({ model: 'haiku', effort: 'low', freeCode: true });
  });

  it('is a mode, not content: the token estimate of the envelope ignores it', () => {
    const base: AiPlanWireRequest = { version: 1, request: 'a pixi scene', context: context() };

    expect(estimateAiPlanWireRequestTokens({ ...base, freeCode: true })).toBe(
      estimateAiPlanWireRequestTokens(base),
    );
  });
});

describe('the caching provider', () => {
  function counting() {
    const asked: (boolean | undefined)[] = [];
    const forgotten: (boolean | undefined)[] = [];
    const inner: AiPlanProvider = {
      propose: (_request, _context, live) => {
        asked.push(live?.freeCode);
        return Promise.resolve(plan);
      },
      forget: (_request, _context, live) => {
        forgotten.push(live?.freeCode);
      },
      proposePagePlan: (_request, _context, live): Promise<AiPagePlanProposal> => {
        asked.push(live?.freeCode);
        return Promise.resolve({ pagePlan: { title: 'x', sections: [] } });
      },
    };
    return { asked, forgotten, inner };
  }

  it('never serves an answer written with the mode off to a run with it on, or the reverse', async () => {
    const { asked, inner } = counting();
    const cached = createCachingAiPlanProvider(inner);

    await cached.propose('a pixi scene', context());
    await cached.propose('a pixi scene', context());
    expect(asked).toEqual([undefined]);

    await cached.propose('a pixi scene', context(), ON);
    await cached.propose('a pixi scene', context(), ON);
    expect(asked).toEqual([undefined, true]);

    await cached.propose('a pixi scene', context());
    expect(asked).toEqual([undefined, true]);
  });

  it('forgets a rejected answer under the key it was stored by, and keeps the other one', async () => {
    const { asked, inner } = counting();
    const cached = createCachingAiPlanProvider(inner);
    await cached.propose('a pixi scene', context(), ON);
    await cached.propose('a pixi scene', context());

    cached.forget?.('a pixi scene', context(), ON);
    await cached.propose('a pixi scene', context(), ON);
    await cached.propose('a pixi scene', context());

    expect(asked).toEqual([true, undefined, true]);
  });

  it('keeps page plans apart the same way', async () => {
    const { asked, inner } = counting();
    const cached = createCachingAiPlanProvider(inner);

    await cached.proposePagePlan?.('a pixi page', context());
    await cached.proposePagePlan?.('a pixi page', context(), ON);
    await cached.proposePagePlan?.('a pixi page', context(), ON);

    expect(asked).toEqual([undefined, true]);
  });
});

describe('the composition policy', () => {
  it('resolves free code mode to false unless it is exactly true', () => {
    expect(resolveAiCompositionPolicy(undefined).freeCode).toBe(false);
    expect(resolveAiCompositionPolicy({}).freeCode).toBe(false);
    expect(resolveAiCompositionPolicy({ freeCode: false }).freeCode).toBe(false);
    expect(resolveAiCompositionPolicy({ freeCode: 'yes' as never }).freeCode).toBe(false);
    expect(resolveAiCompositionPolicy({ freeCode: true }).freeCode).toBe(true);
  });
});

// ── runAiAgent over the remote wire ──────────────────────────────────────────

const codeHost: TrustedExtensionManifest = {
  tier: 1,
  name: 'free-code-wire-host',
  version: '0.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'A page root.',
          props: z.object({ title: z.string().default('') }),
          slots: { default: { allow: ['customCode'] } },
          examples: [],
        }),
        render: () => null,
      },
      {
        schema: defineBlockSchema({
          type: 'customCode',
          description: 'A freely composed region that may carry page code.',
          props: z.object({
            label: z.string().default('region'),
            css: customCss(8_000),
            js: z.string().max(32_000).default(''),
          }),
          examples: [],
        }),
        render: () => null,
      },
    ],
  },
};

function codeKernel() {
  const document: BuilderDocument = {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'page', props: { title: 'Home' }, slots: { default: ['stage'] } },
      stage: { id: 'stage', type: 'customCode', props: { label: 'stage', css: '', js: '' } },
    },
  };
  return createBuilder({
    document,
    extensions: [codeHost],
    ports: { clock: fixedClock(10), ids: seededIds('free-code-wire-live') },
  });
}

function run(provider: AiPlanProvider, live: ReturnType<typeof codeKernel>, freeCode?: boolean) {
  return runAiAgent({
    runId: 'free-code-run',
    clock: fixedClock(100, 5),
    kernel: live,
    provider,
    request: 'a custom PixiJS scene with moving characters',
    validationPorts: { clock: fixedClock(20), ids: seededIds('free-code-wire-door') },
    apply: 'auto',
    directEdits: false,
    ...(freeCode === undefined ? {} : { freeCode }),
  });
}

describe('runAiAgent({ freeCode })', () => {
  it('sends freeCode: true on the plan POST and lands the scene the model wrote', async () => {
    const { calls, fetchImpl } = fakeFetch(() => plan);
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });
    const live = codeKernel();

    const result = await run(provider, live, true);

    expect(result.status).toBe('applied');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.body.freeCode).toBe(true);
    expect(live.getDocument().nodes['stage']?.props['js']).toBe('await ck.stage();');
  });

  it('sends no field and turns the model back at the door with the switch named when it is off', async () => {
    const closed: AiPlan = {
      rationale: 'A closed scene instead; turn on «وضع الكود الحر» for real code.',
      commands: [{ command: 'setProp', args: { id: 'stage', key: 'css', value: '.a{color:#1e3a8a}' } }],
    };
    const { calls, fetchImpl } = fakeFetch((call) => (call.body.attempt === undefined ? plan : closed));
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });
    const live = codeKernel();

    const result = await run(provider, live);

    expect(result.status).toBe('applied');
    expect(calls).toHaveLength(2);
    for (const { body } of calls) expect(body).not.toHaveProperty('freeCode');
    // The repair round carries the reason the door gave.
    expect(calls[1]?.body.attempt?.issues[0]?.message).toContain('«وضع الكود الحر»');
    expect(live.getDocument().nodes['stage']?.props['js']).toBe('');
  });

  it('puts the mode on the repair POST too when it is on and the door refuses the first answer', async () => {
    const oversized: AiPlan = {
      rationale: 'too long',
      commands: [{ command: 'setProp', args: { id: 'stage', key: 'js', value: 'x'.repeat(32_001) } }],
    };
    const { calls, fetchImpl } = fakeFetch((call) => (call.body.attempt === undefined ? oversized : plan));
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });
    const live = codeKernel();

    const result = await run(provider, live, true);

    expect(result.status).toBe('applied');
    expect(calls.map(({ body }) => body.freeCode)).toEqual([true, true]);
    expect(calls[1]?.body.attempt?.issues[0]?.message).toContain('32001');
  });

  it('is the same as naming it on the composition policy', async () => {
    const { calls, fetchImpl } = fakeFetch(() => plan);
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });
    const live = codeKernel();

    const result = await runAiAgent({
      runId: 'free-code-composition',
      clock: fixedClock(100, 5),
      kernel: live,
      provider,
      request: 'a custom PixiJS scene with moving characters',
      validationPorts: { clock: fixedClock(20), ids: seededIds('free-code-composition') },
      apply: 'auto',
      directEdits: false,
      composition: { freeCode: true },
    });

    expect(result.status).toBe('applied');
    expect(calls[0]?.body.freeCode).toBe(true);
  });
});
