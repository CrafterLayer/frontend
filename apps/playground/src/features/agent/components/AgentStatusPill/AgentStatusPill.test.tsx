/**
 * AgentStatusPill (SPEC §4.20): the agent's one line in the status bar while the panel is
 * hidden. What it says is a table (`pillView`); what it does is open the panel and Stop.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { t } from '../../copy';
import type { AgentViewState, BuildRecordView, TurnView } from '../../model/view-types';
import { fakeViewState } from '../../testing/fake-controller';

import { AgentStatusPill } from './AgentStatusPill';
import { pillView } from './pill-view';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

const CSS = readFileSync(
  join(
    process.cwd(),
    'src',
    'features',
    'agent',
    'components',
    'AgentStatusPill',
    'AgentStatusPill.css',
  ),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

function buildOf(state: AgentViewState): BuildRecordView {
  const turn = state.turns.find((candidate) => candidate.kind === 'build');
  if (turn?.kind !== 'build') throw new Error('no build turn');
  return turn.view;
}

function withBuild(state: AgentViewState, view: Partial<BuildRecordView>): AgentViewState {
  return {
    ...state,
    turns: state.turns.map(
      (turn): TurnView => (turn.kind === 'build' ? { kind: 'build', view: { ...turn.view, ...view } } : turn),
    ),
  };
}

describe('pillView', () => {
  it('a live build counts landed sections only', () => {
    const state = fakeViewState('building', 'en');
    const build = buildOf(state);
    expect(pillView(state)).toEqual({ kind: 'building', done: build.landed, total: build.total });
    expect(build.landed).toBeLessThan(build.rows.filter((row) => row.state !== 'waiting').length);
  });

  it('a live edit names its target; a page-wide edit and anything else is working', () => {
    const edit = fakeViewState('editRunning', 'en');
    expect(pillView(edit)).toMatchObject({ kind: 'editing' });
    expect(pillView(fakeViewState('planDrafting', 'en'))).toEqual({ kind: 'working' });
  });

  it('says nothing when idle, and "built" only for a whole build that ended while hidden', () => {
    const built = fakeViewState('built', 'en');
    const turnId = buildOf(built).turnId;
    expect(pillView(built)).toBeNull();
    expect(pillView(built, turnId)).toEqual({ kind: 'done', sections: buildOf(built).total });
    expect(pillView(fakeViewState('builtPartial', 'en'), turnId)).toBeNull();
    expect(pillView(withBuild(built, { phase: 'stopped' }), turnId)).toBeNull();
  });
});

describe('AgentStatusPill', () => {
  it('reads its sentence as its name, opens the panel, and stops the run', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onStop = vi.fn();
    render(
      <AgentStatusPill
        locale="en"
        view={{ kind: 'building', done: 3, total: 8 }}
        onOpen={onOpen}
        onStop={onStop}
      />,
    );
    const open = screen.getByRole('button', { name: 'Abu Ghadab is building the page, 3 of 8' });
    await user.click(open);
    expect(onOpen).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: t('en', 'stop') }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('while stopping, Stop stays focusable, says Stopping… and does nothing', async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    render(
      <AgentStatusPill
        locale="en"
        view={{ kind: 'working' }}
        onOpen={vi.fn()}
        onStop={onStop}
        stopping
      />,
    );
    const stop = screen.getByRole('button', { name: t('en', 'stopping') });
    expect(stop).toHaveAttribute('aria-disabled', 'true');
    await user.click(stop);
    expect(onStop).not.toHaveBeenCalled();
  });

  it('a finished build has nothing to stop, and speaks Arabic in its own direction', () => {
    const { container } = render(
      <AgentStatusPill locale="ar" view={{ kind: 'done', sections: 8 }} onOpen={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'بُنيت الصفحة: 8 أقسام' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    const root = container.querySelector('.ck-agent-pill');
    expect(root).toHaveAttribute('dir', 'rtl');
    expect(root).toHaveAttribute('lang', 'ar');
    // Not a live region: the panel's LiveStatus is the only one (SPEC §6.1).
    expect(container.querySelectorAll('[aria-live], [role="status"], [role="alert"]')).toHaveLength(0);
  });

  it('is 28px with Ink text on Tint, in logical properties only', () => {
    expect(CSS).toMatch(/block-size:\s*var\(--bldr-control-sm\)/);
    expect(CSS).toMatch(/background-color:\s*var\(--bldr-surface-tint\)/);
    expect(CSS).not.toMatch(/--bldr-panel-muted/);
    expect(CSS).not.toMatch(
      /(^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:|text-align:\s*(left|right)|translateX/,
    );
  });
});
