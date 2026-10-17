/**
 * The context meter and the honest scope chip, through the controller's real wiring
 * (2026-10-12): a request the engine focuses on one section sends `context.ready` with its
 * size and that focus; the composer's state then carries a meter for the conversation, and
 * its scope chip names the section instead of "Whole page" until the next request is
 * being written.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createPlaygroundKernel } from '../../preview/create-playground-kernel';
import type { AgentController } from '../model/view-types';
import { memoryStorage, wordsProvider } from '../testing/scripted-engine';
import { useAgentController } from './use-agent-controller';

const WAIT = { timeout: 20_000 } as const;

function mount() {
  const kernel = createPlaygroundKernel({ fixture: 'landing' });
  const provider = wordsProvider('Warmer how: the colours, or the words?');
  const hook = renderHook(() =>
    useAgentController({
      kernel,
      provider,
      locale: 'en',
      storage: memoryStorage(),
      enhancer: null,
    }),
  );
  const c = (): AgentController => hook.result.current;
  return { provider, c };
}

describe('useAgentController: the context meter and the focused scope chip', () => {
  it('measures a focused edit, names its section on the chip, and lets go once a new draft starts', async () => {
    const h = mount();
    expect(h.c().state.contextMeter).toBeNull();
    expect(h.c().state.chips).toEqual([{ kind: 'page', id: 'page' }]);

    act(() => {
      h.c().setDraft('make the pricing section warmer');
    });
    act(() => {
      h.c().send();
    });
    await waitFor(() => {
      expect(h.c().state.run).toBeNull();
    }, WAIT);

    expect(h.provider.calls()).toBe(1);
    const meter = h.c().state.contextMeter;
    // The run's own budget: the offline provider's is wider than the remote default.
    expect(meter).toMatchObject({ level: 'normal', trimmed: false });
    expect(meter?.used).toBeGreaterThan(0);
    expect(meter?.used).toBeLessThan(meter?.max ?? 0);
    expect(h.c().state.chips).toEqual([
      { kind: 'page', id: 'page', focus: { names: ['Pricing'], outlined: true } },
    ]);

    act(() => {
      h.c().setDraft('make the whole page blue');
    });
    expect(h.c().state.chips).toEqual([{ kind: 'page', id: 'page' }]);
    // The meter stays: it is the latest request's size, a guide to the next one.
    expect(h.c().state.contextMeter).toEqual(meter);
  }, 30_000);
});
