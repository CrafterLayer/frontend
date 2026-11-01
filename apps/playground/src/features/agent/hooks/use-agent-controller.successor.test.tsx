/**
 * Successor runs ("Retry", "Write the failed sections again", "Finish the rest") show work
 * as it is done and pick up where a build stopped (owner, 2026-11-01):
 * - P3: each section lands as soon as its write settles, never behind a slower one above it;
 * - P4: with free code on, a retried scene lands with its code;
 * - P5: after a reload onto another page, the build's own page is written, and when that
 *   page cannot be found the thread says so instead of doing nothing.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import type { AiPlan, AiPlanProvider, BuilderKernel } from '@craftkit/builder';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { forgetAgentSite, rememberAgentSite } from '../model/script-site';
import { SESSIONS_KEY } from '../model/turns';
import type { AgentController, BuildRecordView, TurnView } from '../model/view-types';
import {
  BUILD_REQUEST,
  createBuildKernel,
  createBuildSite,
  fillFor,
  historyLabels,
  memoryStorage,
  regionId,
  regionsOf,
  scriptBuild,
} from '../testing/scripted-engine';
import { useAgentController, type UseAgentControllerOptions } from './use-agent-controller';

// A jsdom suite: the scene probe needs a browser, and these tests are about landing.
vi.mock('./agent-controller/scene-probe-options', () => ({ sceneProbeOptions: () => ({}) }));

const THREE = ['Hero', 'Proof', 'Pricing'] as const;
const WAIT = { timeout: 20_000 } as const;

type Options = Partial<UseAgentControllerOptions> & { readonly kernel: BuilderKernel };

function mount(options: Options) {
  const hook = renderHook((props: UseAgentControllerOptions) => useAgentController(props), {
    initialProps: { locale: 'en', storage: memoryStorage(), enhancer: null, ...options },
  });
  const c = (): AgentController => hook.result.current;
  return { ...hook, c };
}

function ask(c: () => AgentController, text: string): void {
  act(() => {
    c().setDraft(text);
  });
  act(() => {
    c().send();
  });
}

function build(c: () => AgentController): BuildRecordView {
  const turn = c().state.turns.findLast((entry) => entry.kind === 'build');
  if (turn?.kind !== 'build') throw new Error('No build record on screen.');
  return turn.view;
}

const states = (view: BuildRecordView): string[] => view.rows.map((row) => row.state);

async function settled(c: () => AgentController): Promise<void> {
  await waitFor(() => {
    expect(c().state.run).toBeNull();
  }, WAIT);
}

afterEach(() => {
  forgetAgentSite();
});

describe('successor runs land each section as soon as it is written (P3)', () => {
  it('lands a quick section while a slower one above it is still being written', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE, { hold: ['Hero', 'Proof'] });
    const { c } = mount({ kernel, provider: script.provider });

    ask(c, BUILD_REQUEST);
    await waitFor(() => {
      expect(states(build(c))).toEqual(['writing', 'writing', 'landed']);
    }, WAIT);
    act(() => {
      c().stop();
    });
    act(() => {
      script.gates.get('Hero')?.resolve(fillFor(kernel, 'Hero'));
      script.gates.get('Proof')?.resolve(fillFor(kernel, 'Proof'));
    });
    await settled(c);
    expect(states(build(c))).toEqual(['notWritten', 'notWritten', 'landed']);
    // The successor's writers get gates of their own.
    script.gates.clear();

    act(() => {
      c().finishRest(build(c).turnId);
    });
    await waitFor(() => {
      expect(script.gates.has('Hero') && script.gates.has('Proof')).toBe(true);
    }, WAIT);
    // Proof is written first: it reaches the page while Hero, above it, is still writing.
    act(() => {
      script.gates.get('Proof')?.resolve(fillFor(kernel, 'Proof'));
    });
    await waitFor(() => {
      expect(states(build(c))).toEqual(['writing', 'landed', 'landed']);
    }, WAIT);
    expect(regionsOf(kernel)).toMatchObject({ Hero: '', Proof: 'Body for Proof.' });

    act(() => {
      script.gates.get('Hero')?.resolve(fillFor(kernel, 'Hero'));
    });
    await settled(c);
    expect(build(c).phase).toBe('done');
    // The rows keep page order; the history keeps the order they landed in.
    expect(build(c).rows.map((row) => row.title)).toEqual(THREE);
    expect(historyLabels(kernel).slice(-2)).toEqual([
      'Assistant: 2/3 — Proof',
      'Assistant: 1/3 — Hero',
    ]);
  }, 60_000);
});

describe('a retried scene keeps its code with free code on (P4)', () => {
  it('lands the region’s js beside its tree', async () => {
    const SCENE = 'const s = await ck.scene({ libs: ["mural"] }); const actors = ["fox"];';
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE, { refuse: ['Proof'] });
    const provider: AiPlanProvider = {
      async propose(request, context, options) {
        const plan: AiPlan = await script.provider.propose(request, context, options);
        const id = context.selection.ids[0];
        if (id === undefined || kernel.getDocument().nodes[id]?.props['label'] !== 'Proof') {
          return plan;
        }
        return {
          ...plan,
          commands: [
            ...plan.commands,
            { command: 'setProp', args: { id, key: 'js', value: SCENE } },
          ],
        };
      },
    };
    const { c } = mount({ kernel, provider, freeCode: true });

    ask(c, BUILD_REQUEST);
    await settled(c);
    const failed = build(c).rows.find((row) => row.state === 'failed');
    expect(failed?.title).toBe('Proof');

    script.refused.delete('Proof');
    act(() => {
      c().retrySections(build(c).turnId, [failed?.key ?? '']);
    });
    await waitFor(() => {
      expect(build(c).phase).toBe('done');
    }, WAIT);
    const proof = kernel.getDocument().nodes[regionId(kernel, 'Proof')];
    expect(proof?.props['tree']).toBe('Body for Proof.');
    expect(proof?.props['js']).toBe(SCENE);
  }, 60_000);
});

describe('"Finish the rest" after a reload writes the build’s own page (P5)', () => {
  /** A stopped build on the site's home page, its conversation saved in `storage`. */
  async function stoppedOnHome() {
    const site = createBuildSite();
    rememberAgentSite(site);
    const home = site.page('home');
    const script = scriptBuild(home, THREE, { hold: ['Proof'] });
    const storage = memoryStorage();
    const first = mount({ kernel: home, provider: script.provider, storage });
    ask(first.c, BUILD_REQUEST);
    await waitFor(() => {
      expect(build(first.c).landed).toBe(2);
    }, WAIT);
    act(() => {
      first.c().stop();
    });
    act(() => {
      script.gates.get('Proof')?.resolve(fillFor(home, 'Proof'));
    });
    await settled(first.c);
    expect(build(first.c).actions.finishRest).toBe(1);
    first.unmount();
    return { site, home, script, storage };
  }

  it('finishes the sections on the page they were built on, not the page open now', async () => {
    const { site, home, script, storage } = await stoppedOnHome();
    // The reload opens another page of the site.
    site.setCurrentPage('about');
    const about = site.page('about');
    const { c } = mount({ kernel: about, provider: script.provider, storage });

    act(() => {
      c().finishRest(build(c).turnId);
    });
    await waitFor(() => {
      expect(build(c).phase).toBe('done');
    }, WAIT);
    expect(regionsOf(home)).toEqual({
      Hero: 'Body for Hero.',
      Proof: 'Body for Proof.',
      Pricing: 'Body for Pricing.',
    });
    expect(regionsOf(about)).toEqual({});
  }, 60_000);

  it('says which page to open when an older record does not know its page', async () => {
    const { site, script, storage } = await stoppedOnHome();
    // A conversation saved before builds recorded their page.
    const saved = JSON.parse(storage.getItem(SESSIONS_KEY) ?? '{}') as {
      sessions: { turns: Record<string, unknown>[] }[];
    };
    for (const session of saved.sessions) {
      for (const turn of session.turns) delete turn['pageId'];
    }
    storage.setItem(SESSIONS_KEY, JSON.stringify(saved));
    site.setCurrentPage('about');
    const { c } = mount({ kernel: site.page('about'), provider: script.provider, storage });
    const turns = c().state.turns.length;

    act(() => {
      c().finishRest(build(c).turnId);
    });
    await waitFor(() => {
      expect(c().state.turns).toHaveLength(turns + 1);
    }, WAIT);
    const note: TurnView | undefined = c().state.turns.at(-1);
    expect(note).toMatchObject({ kind: 'end', view: { key: 'buildPageNotOpen' } });
    expect(build(c).phase).toBe('stopped');
  }, 60_000);
});
