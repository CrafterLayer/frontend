/**
 * A site build (T230): "Build a 4-page website: home, about, services, contact" opens the
 * pages it needs through the host, builds every page under ONE run with the person's
 * writers shared across the site, and Stop ends every page. A host that cannot open pages
 * still gets one page and the `siteAsOnePage` note.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import type { AiBuildOwnEvent, AiPlan, AiPlanProvider, BuilderKernel } from '@craftkit/builder';
import { describe, expect, it } from 'vitest';

import type { AgentController, BuildRecordView, TurnView } from '../model/view-types';
import {
  createBuildKernel,
  deferred,
  type Deferred,
  memoryStorage,
  regionList,
} from '../testing/scripted-engine';
import { useAgentController, type UseAgentControllerOptions } from './use-agent-controller';

const SECTIONS = ['Hero', 'Story', 'Contact form'] as const;
const SITE_REQUEST = 'Build a 4-page website: home, about, services, contact';
const WAIT = { timeout: 20_000 } as const;

/** Every page kernel of the site, the one on screen first, and the pages the host opened. */
interface Site {
  readonly kernels: BuilderKernel[];
  readonly opened: { readonly title: string; readonly current: boolean }[];
  readonly addPage: NonNullable<UseAgentControllerOptions['addPage']>;
}

function site(home: BuilderKernel): Site {
  const kernels = [home];
  const opened: Site['opened'] = [];
  return {
    kernels,
    opened,
    addPage: (title, open) => {
      opened.push({ title, current: open?.current !== false });
      const kernel = createBuildKernel(`site-page-${String(kernels.length + 1)}`);
      kernels.push(kernel);
      return Promise.resolve({ kernel });
    },
  };
}

/** A provider for every page of the site, measuring how many section writers run at once. */
interface SiteScript {
  readonly provider: AiPlanProvider;
  readonly writing: { now: number; most: number };
  readonly gates: Deferred<AiPlan>[];
}

function scriptSite(kernels: readonly BuilderKernel[], hold = false): SiteScript {
  const writing = { now: 0, most: 0 };
  const gates: Deferred<AiPlan>[] = [];
  const provider: AiPlanProvider = {
    async propose(_request, context) {
      const id = context.selection.ids[0];
      if (id === undefined) {
        return {
          rationale: 'A calm studio site. Palette bg-white text-slate-900. Faces Inter and Inter.',
          commands: SECTIONS.map((title) => ({
            command: 'insertNode',
            args: { type: 'region', parentId: 'root', props: { label: title, tree: '' } },
          })),
        };
      }
      const page = kernels.find((kernel) => kernel.getDocument().nodes[id] !== undefined);
      const read = page?.getDocument().nodes[id]?.props['label'];
      const label = typeof read === 'string' ? read : 'Section';
      const plan: AiPlan = {
        rationale: 'Fill.',
        commands: [{ command: 'setProp', args: { id, key: 'tree', value: `Body for ${label}.` } }],
      };
      writing.now += 1;
      writing.most = Math.max(writing.most, writing.now);
      try {
        if (hold) {
          const gate = deferred<AiPlan>();
          gates.push(gate);
          return await gate.promise;
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
        return plan;
      } finally {
        writing.now -= 1;
      }
    },
  };
  return { provider, writing, gates };
}

function mount(options: Partial<UseAgentControllerOptions> & { readonly kernel: BuilderKernel }) {
  const events: AiBuildOwnEvent[] = [];
  const hook = renderHook((props: UseAgentControllerOptions) => useAgentController(props), {
    initialProps: {
      locale: 'en',
      storage: memoryStorage(),
      enhancer: null,
      onBuildEvent: (event) => events.push(event),
      ...options,
    },
  });
  const c = (): AgentController => hook.result.current;
  return { ...hook, c, events };
}

function ask(c: () => AgentController, text: string): void {
  act(() => {
    c().setDraft(text);
  });
  act(() => {
    c().send();
  });
}

function builds(c: () => AgentController): BuildRecordView[] {
  return c().state.turns.flatMap((turn: TurnView) => (turn.kind === 'build' ? [turn.view] : []));
}

function answers(c: () => AgentController): string[] {
  return c().state.turns.flatMap((turn: TurnView) =>
    turn.kind === 'answer' ? [turn.view.text] : [],
  );
}

const LIVE = new Set(['skeleton', 'building', 'stopping']);

/** The run has started, written its records, and given its lease back. */
async function settled(c: () => AgentController): Promise<void> {
  await waitFor(() => {
    expect(c().state.turns.length).toBeGreaterThan(1);
    expect(c().state.turns.at(-1)?.kind).not.toBe('user');
    expect(builds(c).some((view) => LIVE.has(view.phase))).toBe(false);
    expect(c().state.run).toBeNull();
  }, WAIT);
}

describe('useAgentController: a site build', () => {
  it('opens the pages it needs, builds every page under one run, writers shared across the site', async () => {
    const home = createBuildKernel('site-page-1');
    const host = site(home);
    const script = scriptSite(host.kernels);
    const { c, events } = mount({ kernel: home, provider: script.provider, addPage: host.addPage });

    ask(c, SITE_REQUEST);
    await waitFor(() => {
      expect(builds(c)).toHaveLength(4);
    }, WAIT);
    await settled(c);

    // The home page is built where the person is: the empty page on screen; the rest open beside it.
    expect(host.opened).toEqual([
      { title: 'About', current: false },
      { title: 'Services', current: false },
      { title: 'Contact', current: false },
    ]);
    expect(builds(c).map((view) => [view.page, view.phase])).toEqual([
      ['Home', 'done'],
      ['About', 'done'],
      ['Services', 'done'],
      ['Contact', 'done'],
    ]);
    for (const kernel of host.kernels) {
      expect(regionList(kernel)).toEqual(SECTIONS.map((title) => [title, `Body for ${title}.`]));
    }
    // ONE run: every page's events answer to the run that holds the lease.
    const leases = new Set(events.map((event) => event.runId.split('/')[0]));
    expect(leases.size).toBe(1);
    expect(new Set(events.map((event) => event.runId)).size).toBe(4);
    // The person's three writers, never more, across all four pages at once.
    expect(script.writing.most).toBe(3);
    expect(c().state.turns.map((turn) => turn.kind)).toEqual([
      'user',
      'answer',
      'build',
      'build',
      'build',
      'build',
      'answer',
    ]);
    expect(answers(c)).toEqual([
      'Building a 4-page site: Home, About, Services, and Contact.',
      'Built all 4 pages: Home, About, Services, and Contact.',
    ]);
    expect(c().state.turns.some((turn) => turn.kind === 'end')).toBe(false);
  }, 60_000);

  it('builds the home page on a new page when the page on screen is the person’s', async () => {
    const home = createBuildKernel('site-page-1');
    home.dispatch('insertNode', {
      type: 'region',
      parentId: 'root',
      props: { label: 'Mine', tree: 'Written by hand.' },
    });
    const host = site(home);
    const script = scriptSite(host.kernels);
    const { c } = mount({ kernel: home, provider: script.provider, addPage: host.addPage });

    ask(c, SITE_REQUEST);
    await settled(c);

    expect(host.opened.map(({ title, current }) => [title, current])).toEqual([
      ['Home', true],
      ['About', false],
      ['Services', false],
      ['Contact', false],
    ]);
    expect(regionList(home)).toEqual([['Mine', 'Written by hand.']]);
    expect(builds(c).every((view) => view.phase === 'done')).toBe(true);
  }, 60_000);

  it('Stop ends every page of the site, and the run gives its lease back once', async () => {
    const home = createBuildKernel('site-page-1');
    const host = site(home);
    const script = scriptSite(host.kernels, true);
    const { c } = mount({ kernel: home, provider: script.provider, addPage: host.addPage });

    ask(c, SITE_REQUEST);
    await waitFor(() => {
      expect(script.gates).toHaveLength(3);
    }, WAIT);
    expect(builds(c)).toHaveLength(4);
    act(() => {
      c().stop();
    });
    await settled(c);

    // No fourth writer ever started, and no page is still building.
    expect(script.gates).toHaveLength(3);
    expect(builds(c).map((view) => view.phase)).toEqual([
      'stopped',
      'stopped',
      'stopped',
      'stopped',
    ]);
    expect(c().state.turns.filter((turn) => turn.kind === 'answer')).toHaveLength(1);
    // Late answers change nothing: every region is still the skeleton's.
    act(() => {
      for (const gate of script.gates) gate.resolve({ rationale: 'late', commands: [] });
    });
    for (const kernel of host.kernels) {
      expect(regionList(kernel).every(([, tree]) => tree === '')).toBe(true);
    }
  }, 60_000);

  it('Ask: every page holds at its own plan card, and each Build builds its page', async () => {
    const home = createBuildKernel('site-page-1');
    const host = site(home);
    const script = scriptSite(host.kernels);
    const { c } = mount({ kernel: home, provider: script.provider, addPage: host.addPage });
    act(() => {
      c().setMode('ask');
    });

    ask(c, SITE_REQUEST);
    const cards = (): string[] =>
      c().state.turns.flatMap((turn) =>
        turn.kind === 'page-plan' && turn.view.status === 'ready' ? [turn.view.turnId] : [],
      );
    await waitFor(() => {
      expect(cards()).toHaveLength(4);
    }, WAIT);
    // Nothing is written before Build, on any page; the cards are the decision, not a RunBar.
    expect(host.kernels.every((kernel) => regionList(kernel).length === 0)).toBe(true);
    expect(c().state.run).toBeNull();

    for (const turnId of cards()) {
      act(() => {
        c().build(turnId);
      });
    }
    await settled(c);

    expect(builds(c).map((view) => [view.page, view.phase])).toEqual([
      ['Home', 'done'],
      ['About', 'done'],
      ['Services', 'done'],
      ['Contact', 'done'],
    ]);
    expect(answers(c).at(-1)).toBe('Built all 4 pages: Home, About, Services, and Contact.');
  }, 60_000);

  it('without a host that opens pages, builds one page and says so (siteAsOnePage)', async () => {
    const home = createBuildKernel('site-page-1');
    const script = scriptSite([home]);
    const { c } = mount({ kernel: home, provider: script.provider });

    ask(c, SITE_REQUEST);
    await settled(c);

    expect(c().state.turns.map((turn) => turn.kind)).toEqual(['user', 'build', 'end']);
    expect(builds(c)[0]?.page).toBeUndefined();
    const end = c().state.turns.find((turn) => turn.kind === 'end');
    expect(end?.kind === 'end' ? end.view.key : null).toBe('siteAsOnePage');
  }, 60_000);
});
