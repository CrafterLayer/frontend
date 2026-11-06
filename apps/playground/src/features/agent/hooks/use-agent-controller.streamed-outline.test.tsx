/**
 * The streamed build in the panel (2026-11-05), through the real controller, page-build.ts
 * and the real engine: while the plan is still being written the build record already
 * lists the sections the outline has named (planned text rows — no region exists yet);
 * once the outline closes the regions' rows replace them; and a section whose writer
 * finished lands — its row inks — before the plan is in.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import type { AiPlan, AiPlanProvider, JsonValue } from '@craftkit/builder';
import { describe, expect, it } from 'vitest';

import type { AgentController, BuildRecordView } from '../model/view-types';
import { coffeePlan, createPlanKernel, memoryStorage } from '../testing/scripted-engine';
import { useAgentController } from './use-agent-controller';

const REQUEST = 'Build a landing page for my specialty coffee roastery in Amman, Northlight Coffee';
const WAIT = { timeout: 20_000 } as const;

type Json = Record<string, unknown>;

/** The fixture's plan in the streamed shape: an outline of titles, then one brief per section. */
function compactPlan(): Json {
  const plan = coffeePlan() as unknown as Json;
  const sections = plan['sections'] as Json[];
  return {
    ...plan,
    sections: sections.map(({ key, role, title, anchorId, variant }) => ({
      key,
      role,
      title,
      anchorId,
      ...(variant === undefined ? {} : { variant }),
    })),
    briefs: sections.map(({ key, purpose, mustSay }) => ({
      key,
      purpose,
      ...(mustSay === undefined ? {} : { mustSay }),
    })),
  };
}

function sectionTree(request: string): JsonValue {
  const anchor = /ANCHOR:[^\n]*id="([^"]+)"/u.exec(request)?.[1] ?? 'section';
  const title = /SECTION \d+ OF \d+: ([^\n]+)/u.exec(request)?.[1] ?? 'Section';
  const hero = request.includes('ROLE: HERO');
  const action = /PRIMARY ACTION: "([^"]+)" → (\S+)/u.exec(request);
  return {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        attributes: { id: anchor },
        children: [
          { kind: 'element', tag: hero ? 'h1' : 'h2', text: title, children: [] },
          { kind: 'element', tag: 'p', text: 'Roasted in Amman', children: [] },
          ...(action === null
            ? []
            : [
                {
                  kind: 'element',
                  tag: 'a',
                  className: 'ck-btn',
                  attributes: { href: action[2] ?? '#' },
                  text: action[1] ?? '',
                  children: [],
                },
              ]),
        ],
      },
    ],
  };
}

/** A planner that streams its answer in two pieces, each sent by the test, and answers when told. */
function streamingPlanner() {
  const text = JSON.stringify({
    version: 1,
    rationale: 'A warm roastery page.',
    pagePlan: compactPlan(),
  });
  // The first piece ends mid-outline: the header's and the hero's entries have closed.
  const cut = text.indexOf('{"key":"menu"');
  let sendRest: (() => void) | undefined;
  let answer: (() => void) | undefined;
  const provider: AiPlanProvider = {
    propose(request) {
      const id = /REGION ID: (\S+)/u.exec(request)?.[1];
      return Promise.resolve<AiPlan>({
        rationale: 'Filled.',
        commands:
          id === undefined
            ? []
            : [{ command: 'setProp', args: { id, key: 'tree', value: sectionTree(request) } }],
      });
    },
    proposePagePlan(_request, _context, live) {
      live?.onDraft?.({ kind: 'start' });
      live?.onDraft?.({ kind: 'text', text: text.slice(0, cut) });
      sendRest = () => {
        live?.onDraft?.({ kind: 'text', text: text.slice(cut) });
      };
      return new Promise((resolve, reject) => {
        answer = () => {
          resolve({ pagePlan: compactPlan(), rationale: 'A warm roastery page.' });
        };
        live?.signal?.addEventListener(
          'abort',
          () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          },
          { once: true },
        );
      });
    },
  };
  return {
    provider,
    sendRest: () => sendRest?.(),
    answer: () => answer?.(),
    started: () => sendRest !== undefined,
  };
}

function mount() {
  const kernel = createPlanKernel();
  const planner = streamingPlanner();
  const hook = renderHook(() =>
    useAgentController({
      kernel,
      provider: planner.provider,
      locale: 'en',
      storage: memoryStorage(),
      enhancer: null,
    }),
  );
  const c = (): AgentController => hook.result.current;
  const build = (): BuildRecordView | undefined => {
    const turn = c()
      .state.turns.filter((each) => each.kind === 'build')
      .at(-1);
    return turn?.kind === 'build' ? turn.view : undefined;
  };
  return { kernel, planner, c, build };
}

describe('useAgentController: the streamed outline and early landings', () => {
  it('lists the outline while the plan streams, then inks a section before the plan is in', async () => {
    const h = mount();
    act(() => {
      h.c().setDraft(REQUEST);
    });
    act(() => {
      h.c().send();
    });

    // t ≈ 0: half the outline is written — the canvas is empty, the record names two sections.
    await waitFor(() => {
      expect(h.build()?.rows.map(({ title }) => title)).toEqual(['Header', 'Roasted this morning']);
    }, WAIT);
    const named = h.build();
    expect(named?.phase).toBe('skeleton');
    expect(
      named?.rows.every(({ state, nodeId }) => state === 'planned' && nodeId === undefined),
    ).toBe(true);
    expect(h.kernel.transactions()).toHaveLength(0);

    // The outline closes, the briefs arrive: the skeleton lands, the writers write, and a
    // finished section inks while the planner has still not answered.
    act(() => {
      h.planner.sendRest();
    });
    await waitFor(() => {
      expect(h.build()?.rows.find(({ title }) => title === 'Roasted this morning')?.state).toBe(
        'landed',
      );
    }, WAIT);
    const building = h.build();
    expect(building?.rows.map(({ title }) => title)).toEqual([
      'Header',
      'Roasted this morning',
      'Our coffees',
      'Order today',
      'Footer',
    ]);
    expect(building?.rows.every(({ nodeId }) => nodeId !== undefined)).toBe(true);
    expect(building?.landed).toBeGreaterThanOrEqual(2);

    act(() => {
      h.planner.answer();
    });
    await waitFor(() => {
      expect(h.build()?.phase).toBe('done');
    }, WAIT);
    expect(h.build()?.landed).toBe(5);
  }, 60_000);
});
