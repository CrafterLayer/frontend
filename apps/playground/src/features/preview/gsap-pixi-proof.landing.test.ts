import { describe, expect, it, vi } from 'vitest';

import { runAiAgent, tryDirectTool, type AiPlanProvider } from '@craftkit/builder';
import { fixedClock, seededIds } from '@craftkit/builder/testing';

import { createPlaygroundKernel } from './create-playground-kernel';

/*
  gsap-pixi proof (2026-10-08, step 3): the two owner requests the diagnosis
  saw fall to the model — «ضيف انميشن GSAP للأقسام» and «خلفية متحركة بالجزيئات
  للهيرو» — read with zero tokens on the REAL playground landing (not the ai
  package's look-alike fixture): no provider call, ONE transaction each, and
  the document then carries the timeline / scene the engines play.
*/

function silentProvider() {
  const propose = vi.fn<AiPlanProvider['propose']>(() => Promise.reject(new Error('the model was called')));
  return { provider: { propose } as AiPlanProvider, propose };
}

function props(kernel: ReturnType<typeof createPlaygroundKernel>, id: string): Record<string, unknown> {
  return kernel.getDocument().nodes[id]?.props ?? {};
}

interface Step {
  readonly command: string;
  readonly args: Record<string, unknown>;
}

/** `command id key` per planned step: which block each step writes, and where. */
function steps(commands: readonly unknown[] | undefined): string[] {
  return ((commands ?? []) as readonly Step[]).map(
    ({ command, args }) => `${command} ${String(args['id'])} ${String(args['key'])}`,
  );
}

describe('gsap-pixi zero-token readings on the landing fixture', () => {
  it('«ضيف انميشن GSAP للأقسام» animates the sections in ONE transaction with no model call', async () => {
    const kernel = createPlaygroundKernel({ fixture: 'landing', dir: 'rtl' });
    const before = JSON.stringify(kernel.getDocument().nodes);
    const direct = tryDirectTool('ضيف انميشن GSAP للأقسام', kernel);
    expect(direct?.label).toBe('أُضيفت حركة للأقسام');
    expect(steps(direct?.plan.commands)).toEqual([
      // Every content section of the real landing, in page order; the announcement bar and the footer stay still.
      'setProp hero partStyles',
      'setProp carousel motion',
      'setProp logos partStyles',
      'setProp marquee motion',
      'setProp about motion',
      'setProp rich-story motion',
      'setProp bento partStyles',
      'setProp stats partStyles',
      'setProp features partStyles',
      'setProp pricing motion',
      'setProp quotes motion',
      'setProp faq partStyles',
      'setProp form partStyles',
      'setProp promo motion',
      'setProp newsletter motion',
    ]);

    const { provider, propose } = silentProvider();
    const result = await runAiAgent({
      runId: 'proof-sections',
      clock: fixedClock(1),
      kernel,
      provider,
      request: 'ضيف انميشن GSAP للأقسام',
      apply: 'auto',
      validationPorts: { clock: fixedClock(2), ids: seededIds('proof-sections') },
    });
    expect(propose).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: 'applied', source: 'direct', tokens: 0 });
    expect(kernel.transactions()).toHaveLength(1);
    expect(props(kernel, 'hero')['partStyles']).toMatchObject({ heading: { timeline: 'split-reveal' } });
    expect(JSON.stringify(kernel.getDocument().nodes)).toContain('"timeline":"stagger-in"');

    kernel.undo();
    expect(JSON.stringify(kernel.getDocument().nodes)).toBe(before);
  });

  it('«خلفية متحركة بالجزيئات للهيرو» puts particles behind the registered hero in ONE transaction with no model call', async () => {
    const kernel = createPlaygroundKernel({ fixture: 'landing', dir: 'rtl' });
    const direct = tryDirectTool('خلفية متحركة بالجزيئات للهيرو', kernel);
    expect(direct?.label).toBe('أُضيفت خلفية متحركة');
    expect(steps(direct?.plan.commands)).toEqual(['setProp hero motion']);

    const { provider, propose } = silentProvider();
    const result = await runAiAgent({
      runId: 'proof-scene',
      clock: fixedClock(1),
      kernel,
      provider,
      request: 'خلفية متحركة بالجزيئات للهيرو',
      apply: 'auto',
      validationPorts: { clock: fixedClock(2), ids: seededIds('proof-scene') },
    });
    expect(propose).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: 'applied', source: 'direct', tokens: 0 });
    expect(kernel.transactions()).toHaveLength(1);
    expect(props(kernel, 'hero')['motion']).toMatchObject({ scene: 'particles' });

    kernel.undo();
    expect((props(kernel, 'hero')['motion'] as Record<string, unknown> | undefined)?.['scene']).toBeUndefined();
  });
});
