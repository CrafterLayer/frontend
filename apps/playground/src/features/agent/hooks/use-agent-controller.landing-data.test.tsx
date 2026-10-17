/**
 * Pasted rows through the playground's real wiring (2026-10-12): an instruction line over a CSV
 * goes through the controller, its route and `runAiAgent`'s direct tool (`data.show`) and lands a
 * real Chart on the real landing page — one transaction, no model — and the change reads in the
 * panel's language, named after the block («مخطط بياني»), never after its fallback wording.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createPlaygroundKernel } from '../../preview/create-playground-kernel';
import { dropLabels } from '../copy/drop-labels';
import type { AgentController } from '../model/view-types';
import type { Locale } from '../model/view-types';
import { memoryStorage, refusingProvider } from '../testing/scripted-engine';
import { dataDraft } from './use-data-drop';
import { useAgentController } from './use-agent-controller';

const WAIT = { timeout: 20_000 } as const;
const ROWS = 'Month,Bookings\nJan,120\nFeb,135\nMar,160';

function mount(locale: Locale) {
  const kernel = createPlaygroundKernel({
    fixture: 'landing',
    dir: locale === 'ar' ? 'rtl' : 'ltr',
  });
  const provider = refusingProvider();
  const hook = renderHook(() =>
    useAgentController({ kernel, provider, locale, storage: memoryStorage(), enhancer: null }),
  );
  const c = (): AgentController => hook.result.current;
  const send = async (text: string) => {
    act(() => {
      c().setDraft(text);
    });
    act(() => {
      c().send();
    });
    await waitFor(() => {
      expect(c().state.run).toBeNull();
    }, WAIT);
  };
  const charts = () =>
    Object.values(kernel.getDocument().nodes).filter((node) => node.type === 'chart');
  return { kernel, provider, c, send, charts };
}

describe('useAgentController: pasted rows on the real landing page (zero tokens)', () => {
  it('inserts a line chart in one transaction and names it in Arabic', async () => {
    const h = mount('ar');
    await h.send(dataDraft('', ROWS, dropLabels('ar').instruction));

    expect(h.provider.calls()).toBe(0);
    expect(h.kernel.transactions()).toHaveLength(1);
    expect(h.charts()).toHaveLength(1);
    expect(h.charts()[0]?.props).toMatchObject({
      chartType: 'line',
      categories: ['Jan', 'Feb', 'Mar'],
    });
    const turns = JSON.stringify(h.c().state.turns);
    expect(turns).toContain('مخطط بياني');
    expect(turns).not.toContain('«Other»');
  }, 30_000);

  it('names it "Chart" in English', async () => {
    const h = mount('en');
    await h.send(dataDraft('', ROWS, dropLabels('en').instruction));

    expect(h.provider.calls()).toBe(0);
    expect(h.charts()).toHaveLength(1);
    const turns = JSON.stringify(h.c().state.turns);
    expect(turns).toContain('Chart');
    expect(turns).not.toContain('Other');
  }, 30_000);
});
