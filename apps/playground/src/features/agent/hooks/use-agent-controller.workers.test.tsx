import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { BuildWorkerCount } from '../model/view-types';
import {
  BUILD_REQUEST,
  createBuildKernel,
  fillFor,
  historyLabels,
  memoryStorage,
  scriptBuild,
} from '../testing/scripted-engine';
import { useAgentController } from './use-agent-controller';
import { telemetryTotals } from '../model/run-telemetry';

const TITLES = ['Hero', 'Proof', 'Features', 'Pricing', 'FAQ', 'Contact'] as const;
const WAIT = { timeout: 20_000 };

describe('live build worker selection', () => {
  it('retains attributed operational updates before completion and measured receipt after landing', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, TITLES, { hold: TITLES });
    const provider = {
      ...script.provider,
      propose: (...args: Parameters<typeof script.provider.propose>) => {
        args[2]?.onProgress?.('Writing the design…');
        args[2]?.onProgress?.('Private reasoning never shown');
        args[2]?.onUsage?.({
          inputTokens: 20,
          outputTokens: 8,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        });
        return script.provider.propose(...args);
      },
    };
    const hook = renderHook(() =>
      useAgentController({
        kernel,
        locale: 'en',
        provider,
        storage: memoryStorage(),
        enhancer: null,
      }),
    );
    act(() => {
      hook.result.current.setDraft(BUILD_REQUEST);
      hook.result.current.send();
    });
    await waitFor(() => {
      expect(script.gates.size).toBe(3);
    }, WAIT);
    const live = hook.result.current.state.turns.find((turn) => turn.kind === 'build');
    expect(
      live?.telemetry?.activity.some((item) => item.scope === 'Hero' && item.stage === 'writing'),
    ).toBe(true);
    expect(hook.result.current.state.run).not.toBeNull();
    for (const title of TITLES) {
      await waitFor(() => {
        expect(script.gates.has(title)).toBe(true);
      }, WAIT);
      act(() => {
        script.gates.get(title)?.resolve(fillFor(kernel, title));
      });
    }
    await waitFor(() => {
      expect(hook.result.current.state.run).toBeNull();
    }, WAIT);
    const settled = hook.result.current.state.turns.find((turn) => turn.kind === 'build');
    expect(settled?.telemetry).toBeDefined();
    if (settled?.telemetry !== undefined)
      expect(telemetryTotals(settled.telemetry)).toMatchObject({
        inputTokens: 140,
        outputTokens: 56,
      });
    hook.unmount();
  }, 60_000);
  it.each([1, 3, 6] as const)(
    'executes at most %i real workers and locks the running choice',
    async (workers) => {
      const kernel = createBuildKernel();
      const script = scriptBuild(kernel, TITLES, { hold: TITLES });
      const hook = renderHook(() =>
        useAgentController({
          kernel,
          locale: 'en',
          provider: script.provider,
          storage: memoryStorage(),
          enhancer: null,
        }),
      );
      expect(hook.result.current.state.workers).toBe(3);
      act(() => {
        hook.result.current.setWorkers?.(workers);
        hook.result.current.setDraft(BUILD_REQUEST);
      });
      act(() => {
        hook.result.current.send();
      });
      await waitFor(() => {
        expect(script.gates.size).toBe(workers);
      }, WAIT);
      const build = hook.result.current.state.turns.find((turn) => turn.kind === 'build');
      expect(build?.kind === 'build' ? build.view.writers : null).toBe(workers);
      act(() => hook.result.current.setWorkers?.(workers === 1 ? 6 : 1));
      expect(hook.result.current.state.workers).toBe(workers);

      // Resolve in reverse worker order: generated drafts still land in page order.
      for (let start = 0; start < TITLES.length; start += workers) {
        const group = TITLES.slice(start, start + workers);
        await waitFor(() => {
          expect(group.every((title) => script.gates.has(title))).toBe(true);
        }, WAIT);
        act(() => {
          for (const title of [...group].reverse())
            script.gates.get(title)?.resolve(fillFor(kernel, title));
        });
      }
      await waitFor(() => {
        expect(hook.result.current.state.run).toBeNull();
      }, WAIT);
      expect(historyLabels(kernel).slice(1)).toEqual(
        TITLES.map((title, index) => `Assistant: ${String(index + 1)}/6 — ${title}`),
      );
      hook.unmount();
    },
    60_000,
  );

  it('stops every active worker and ignores their late output', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, TITLES, { hold: TITLES });
    const hook = renderHook(() =>
      useAgentController({
        kernel,
        locale: 'en',
        provider: script.provider,
        storage: memoryStorage(),
        enhancer: null,
        fillConcurrency: 6,
      }),
    );
    act(() => {
      hook.result.current.setDraft(BUILD_REQUEST);
    });
    act(() => {
      hook.result.current.send();
    });
    await waitFor(() => {
      expect(script.gates.size).toBe(6);
    }, WAIT);
    const writes = kernel.transactions().length;
    act(() => {
      hook.result.current.stop();
    });
    act(() => {
      for (const title of TITLES) script.gates.get(title)?.resolve(fillFor(kernel, title));
    });
    await waitFor(() => {
      expect(hook.result.current.state.run).toBeNull();
    }, WAIT);
    expect(kernel.transactions()).toHaveLength(writes);
    hook.unmount();
  }, 60_000);

  it('rejects unsupported runtime values rather than starting an unbounded pool', () => {
    const hook = renderHook(() =>
      useAgentController({
        kernel: createBuildKernel(),
        locale: 'en',
        storage: memoryStorage(),
        enhancer: null,
      }),
    );
    act(() => hook.result.current.setWorkers?.(99 as BuildWorkerCount));
    expect(hook.result.current.state.workers).toBe(3);
    hook.unmount();
  });

  it('uses the chosen pool when continuing a paused queued build', async () => {
    const kernel = createBuildKernel();
    const first = scriptBuild(kernel, TITLES, { hold: TITLES });
    const nextTitles = TITLES.map((title) => `Queued ${title}`);
    const queued = scriptBuild(kernel, nextTitles, { hold: nextTitles });
    let continuing = false;
    const provider = {
      ...first.provider,
      propose: (...args: Parameters<typeof first.provider.propose>) =>
        (continuing ? queued.provider : first.provider).propose(...args),
    };
    const hook = renderHook(() =>
      useAgentController({
        kernel,
        locale: 'en',
        provider,
        storage: memoryStorage(),
        enhancer: null,
      }),
    );
    act(() => {
      hook.result.current.setDraft(BUILD_REQUEST);
      hook.result.current.send();
    });
    await waitFor(() => {
      expect(first.gates.size).toBe(3);
    }, WAIT);
    act(() => {
      hook.result.current.setDraft('build a new landing page for my photography studio');
      hook.result.current.send();
    });
    expect(hook.result.current.state.queue?.status).toBe('editable');
    act(() => {
      hook.result.current.stop();
      for (const title of TITLES) first.gates.get(title)?.resolve(fillFor(kernel, title));
    });
    await waitFor(() => {
      expect(hook.result.current.state.run).toBeNull();
    }, WAIT);
    expect(hook.result.current.state.queue?.status).toBe('paused');
    continuing = true;
    act(() => {
      hook.result.current.setWorkers?.(1);
      hook.result.current.continueQueued();
    });
    await waitFor(() => {
      expect(queued.gates.size).toBe(1);
    }, WAIT);
    const build = hook.result.current.state.turns.filter((turn) => turn.kind === 'build').at(-1);
    expect(build?.kind === 'build' ? build.view.writers : null).toBe(1);
    for (const title of nextTitles) {
      await waitFor(() => {
        expect(queued.gates.has(title)).toBe(true);
      }, WAIT);
      act(() => {
        queued.gates.get(title)?.resolve(fillFor(kernel, title));
      });
    }
    await waitFor(() => {
      expect(hook.result.current.state.run).toBeNull();
    }, WAIT);
    expect(hook.result.current.state.queue).toBeNull();
    hook.unmount();
  }, 60_000);

  it.each(['measured', 'unknown', 'cached'] as const)(
    'retains %s successor receipts while using the newly selected retry pool',
    async (mode) => {
      const kernel = createBuildKernel();
      const script = scriptBuild(kernel, TITLES, { hold: TITLES, refuse: TITLES });
      let successor = false;
      const expertise: { title: unknown; successor: boolean; ids: readonly string[] }[] = [];
      const provider = {
        ...script.provider,
        propose: (...args: Parameters<typeof script.provider.propose>) => {
          const id = args[1].selection.ids[0];
          if (id !== undefined)
            expertise.push({
              title: kernel.getDocument().nodes[id]?.props['label'],
              successor,
              ids: args[1].skills?.map((skill) => skill.id) ?? [],
            });
          args[2]?.onProgress?.('Writing the design…');
          if (!successor || mode === 'measured')
            args[2]?.onUsage?.({
              inputTokens: 20,
              outputTokens: 8,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
            });
          if (successor && mode === 'cached')
            args[2]?.onUsage?.({
              inputTokens: 0,
              outputTokens: 0,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              costUsd: 0,
              cached: true,
            });
          return script.provider.propose(...args);
        },
      };
      const hook = renderHook(() =>
        useAgentController({
          kernel,
          locale: 'en',
          provider,
          storage: memoryStorage(),
          enhancer: null,
        }),
      );
      act(() => {
        hook.result.current.setDraft('Build a website with a playable 2d game with stars');
      });
      act(() => {
        hook.result.current.send();
      });
      await waitFor(() => {
        const turn = hook.result.current.state.turns.find((entry) => entry.kind === 'build');
        expect(turn?.kind === 'build' ? turn.view.phase : null).toBe('failed');
      }, WAIT);
      await waitFor(() => {
        expect(hook.result.current.state.run).toBeNull();
      }, WAIT);
      const build = hook.result.current.state.turns.find((turn) => turn.kind === 'build');
      expect(build?.kind).toBe('build');
      if (build?.kind !== 'build') throw new Error('Missing build');
      script.refused.clear();
      successor = true;
      act(() => hook.result.current.setWorkers?.(6));
      act(() => {
        hook.result.current.retrySections(
          build.view.turnId,
          build.view.rows.map((row) => row.key),
        );
      });
      await waitFor(() => {
        expect(script.gates.size).toBe(6);
      }, WAIT);
      const retry = hook.result.current.state.turns.find((turn) => turn.kind === 'build');
      expect(retry?.kind === 'build' ? retry.view.writers : null).toBe(6);
      expect(
        retry?.telemetry?.activity.some(
          (item) => item.scope === 'Hero' && item.stage === 'writing',
        ),
      ).toBe(true);
      for (const resumed of [false, true]) {
        expect(
          expertise.find((call) => call.title === 'Hero' && call.successor === resumed)?.ids,
        ).toContain('craftkit.pixi-games');
        expect(
          expertise.find((call) => call.title === 'Proof' && call.successor === resumed)?.ids,
        ).not.toContain('craftkit.pixi-games');
      }
      act(() => {
        for (const title of [...TITLES].reverse())
          script.gates.get(title)?.resolve(fillFor(kernel, title));
      });
      await waitFor(() => {
        expect(hook.result.current.state.run).toBeNull();
      }, WAIT);
      const settled = hook.result.current.state.turns.find((turn) => turn.kind === 'build');
      if (settled?.telemetry === undefined) throw new Error('Missing combined receipt');
      expect(telemetryTotals(settled.telemetry)).toMatchObject({
        requests: 19,
        inputTokens: mode === 'unknown' ? null : mode === 'cached' ? 260 : 380,
        outputTokens: mode === 'unknown' ? null : mode === 'cached' ? 104 : 152,
        cachedReplies: mode === 'cached' ? 6 : 0,
        costUsd: null,
      });
      hook.unmount();
    },
    60_000,
  );
});
