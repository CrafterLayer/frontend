/**
 * The playground's real wiring for a zero-token PART edit on the real landing page
 * (block-parts): «غيّر لون العنوان في الهيرو …» goes through the controller, the route
 * it picks, `runAiAgent` and its direct tool — and never reaches a model.
 *
 * - a theme colour (blue → the accent role) lands as ONE transaction on the hero
 *   heading's part style, named after the hero, with Undo;
 * - red has no theme role, so the agent ASKS (convert the section to editable) — for
 *   zero tokens and zero writes.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createPlaygroundKernel } from '../../preview/create-playground-kernel';
import type { AgentController, TurnView } from '../model/view-types';
import { memoryStorage, refusingProvider } from '../testing/scripted-engine';
import { useAgentController } from './use-agent-controller';

const WAIT = { timeout: 20_000 } as const;

function mount() {
  const kernel = createPlaygroundKernel({ fixture: 'landing' });
  const provider = refusingProvider();
  const hook = renderHook(() =>
    useAgentController({ kernel, provider, locale: 'ar', storage: memoryStorage(), enhancer: null }),
  );
  const c = (): AgentController => hook.result.current;
  const ask = (text: string) => {
    act(() => {
      c().setDraft(text);
    });
    act(() => {
      c().send();
    });
  };
  const settled = async () => {
    await waitFor(() => {
      expect(c().state.run).toBeNull();
    }, WAIT);
  };
  const turns = (kind: TurnView['kind']) => c().state.turns.filter((turn) => turn.kind === kind);
  const heroHeadingStyle = () =>
    (kernel.getDocument().nodes['hero']?.props['partStyles'] as Record<string, { className?: string }> | undefined)?.[
      'heading'
    ]?.className;
  return { kernel, provider, c, ask, settled, turns, heroHeadingStyle };
}

describe('useAgentController: part edits on the real landing page (zero tokens)', () => {
  it('«…للأزرق» colours the hero heading through its part style: one transaction, no model', async () => {
    const h = mount();
    h.ask('غيّر لون العنوان في الهيرو للأزرق');
    await h.settled();

    expect(h.provider.calls()).toBe(0);
    expect(h.kernel.transactions()).toHaveLength(1);
    expect(h.heroHeadingStyle()).toBe('text-accent');
    const edit = h.turns('edit')[0]?.view as { phase?: string; undo?: { kind: string } } | undefined;
    expect(edit).toMatchObject({ phase: 'done', undo: { kind: 'undo' } });
  }, 30_000);

  it('«…إلى أحمر» asks before converting the hero, writes nothing, and calls no model', async () => {
    const h = mount();
    h.ask('غيّر لون العنوان في الهيرو إلى أحمر');
    await h.settled();

    expect(h.provider.calls()).toBe(0);
    expect(h.kernel.transactions()).toHaveLength(0);
    expect(h.heroHeadingStyle()).toBeUndefined();
    expect(JSON.stringify(h.c().state.turns)).toContain('حوّل إلى قابل للتعديل');
  }, 30_000);
});
