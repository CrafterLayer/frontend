/** Local browser QA bootstrap only. Not imported by the product or its production entry. */
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

import { AgentPanel } from '../components/AgentPanel';
import type { AgentViewState, BuildWorkerCount, EffortLevel, Locale } from '../model/view-types';
import { createFakeController, fakeViewState, type FakeScenario } from './fake-controller';

export interface AgentBrowserFixtureOptions {
  readonly width: number;
  readonly height: number;
  readonly locale: Locale;
  readonly theme: 'light' | 'dark';
  readonly scenario: FakeScenario;
  readonly fullControls?: boolean;
}

/** Mount existing real components over deterministic state in a disposable browser context. */
export function mountAgentBrowserFixture(options: AgentBrowserFixtureOptions) {
  const host = document.createElement('div');
  host.className = 'bldr-root';
  host.dataset['agentBrowserFixture'] = '';
  host.dataset['bldrTheme'] = options.theme;
  Object.assign(host.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '9999',
    padding: '12px',
    background: 'var(--bldr-ground)',
    overflow: 'hidden',
  });
  document.body.append(host);
  const root = createRoot(host);
  let state: AgentViewState = {
    ...fakeViewState(options.scenario, options.locale, { now: Date.now() }),
    workers: 3,
  };
  if (options.scenario === 'long') {
    const past = state.turns.slice(0, 4);
    const history = Array.from({ length: 4 }, (_, group) =>
      past.map(
        (turn, index) =>
          ({
            ...turn,
            view: { ...turn.view, turnId: `history-${String(group)}-${String(index)}` },
          }) as typeof turn,
      ),
    ).flat();
    state = { ...state, turns: [...history, ...state.turns] };
  }
  if (options.scenario === 'building') {
    state = {
      ...state,
      workers: 6,
      turns: state.turns.map((turn) =>
        turn.kind === 'build' ? { ...turn, view: { ...turn.view, writers: 6 } } : turn,
      ),
    };
  }
  if (options.fullControls === true) {
    state = {
      ...state,
      effort: { selected: 'high', options: ['low', 'medium', 'high'] },
      freeCode: { enabled: true },
      model:
        state.model === null
          ? null
          : {
              ...state.model,
              selected: {
                ...state.model.selected,
                product: 'Professional design and code model 550B',
              },
              options: [
                { ...state.model.selected, product: 'Professional design and code model 550B' },
                { ...state.model.selected, id: 'qa-other-model', product: 'Other model' },
              ],
            },
    };
  }
  let visible = true;
  const frame = { width: options.width, height: options.height };
  const update = (patch: Partial<AgentViewState>) => {
    state = { ...state, ...patch };
    draw();
  };
  const draw = () => {
    const controller = {
      ...createFakeController(state),
      setDraft: (draft: string) => {
        update({ draft });
      },
      setWorkers: (workers: BuildWorkerCount) => {
        update({ workers });
      },
      ...(options.fullControls === true
        ? {
            setEffort: (level: EffortLevel) => {
              if (state.effort != null) update({ effort: { ...state.effort, selected: level } });
            },
            setFreeCode: (enabled: boolean) => {
              update({ freeCode: { enabled } });
            },
          }
        : {}),
    };
    root.render(
      createElement(
        'div',
        {
          style: { width: frame.width, height: frame.height, display: 'grid', minHeight: 0 },
        },
        createElement(AgentPanel, {
          controller,
          visible,
          width: frame.width,
          presentation: 'dock',
        }),
      ),
    );
  };
  draw();
  return {
    update,
    append: () => {
      const last = state.turns.at(-1);
      if (last === undefined) return;
      const appended = {
        ...last,
        view: { ...last.view, turnId: `qa-${String(state.turns.length)}` },
      } as typeof last;
      update({ turns: [...state.turns, appended] });
    },
    resize: (height: number) => {
      frame.height = height;
      draw();
    },
    show: (shown: boolean) => {
      visible = shown;
      draw();
    },
    dispose: () => {
      root.unmount();
      host.remove();
    },
  };
}
