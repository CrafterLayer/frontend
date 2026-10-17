/**
 * TurnView (SPEC §7.2 #50): every v2 turn kind drawn by its own record or card, and the
 * `[⋯]` menu run for its record without ever posting text as the person's turn.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { t } from '../../copy';
import {
  TURN_KINDS,
  type RecordMenuItem,
  type TurnKind,
  type TurnView as TurnViewData,
} from '../../model/view-types';
import {
  createFakeController,
  fakeViewState,
  type FakeScenario,
} from '../../testing/fake-controller';
import { AgentTooltipProvider } from '../IconButton';

import { runMenuItem } from './run-menu-item';
import { TurnView } from './TurnView';

/* Radix measures its menus before positioning them; jsdom has no ResizeObserver. */
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

/** A scenario whose newest turn is of each kind, and the class its component draws. */
const BY_KIND: Readonly<Record<TurnKind, { scenario: FakeScenario; className: string }>> = {
  user: { scenario: 'built', className: 'ck-agent-message' },
  build: { scenario: 'built', className: 'ck-agent-build' },
  edit: { scenario: 'editDone', className: 'ck-agent-edit' },
  answer: { scenario: 'answer', className: 'ck-agent-answer' },
  'page-plan': { scenario: 'planReady', className: 'ck-agent-plan' },
  'step-plan': { scenario: 'stepPlan', className: 'ck-agent-steps' },
  proposal: { scenario: 'proposal', className: 'ck-agent-proposal' },
  error: { scenario: 'error', className: 'ck-agent-error' },
  end: { scenario: 'proposalDiscarded', className: 'ck-agent-end' },
};

function turnOf(kind: TurnKind): TurnViewData {
  const state = fakeViewState(BY_KIND[kind].scenario, 'en');
  const turn = state.turns.find((candidate) => candidate.kind === kind);
  if (turn === undefined) throw new Error(`${BY_KIND[kind].scenario} has no ${kind} turn`);
  return turn;
}

describe('TurnView', () => {
  it.each(TURN_KINDS)('draws a %s turn with its own component', (kind) => {
    const controller = createFakeController(fakeViewState(BY_KIND[kind].scenario, 'en'));
    const { container } = render(
      <AgentTooltipProvider delayDuration={0}>
        <TurnView locale="en" turn={turnOf(kind)} actions={controller} />
      </AgentTooltipProvider>,
    );
    expect(container.querySelector(`.${BY_KIND[kind].className}`)).not.toBeNull();
  });

  it('Reuse request calls the controller and sends focus to the composer', async () => {
    const user = userEvent.setup();
    const controller = createFakeController(fakeViewState('built', 'en'));
    const build = turnOf('build');
    render(
      <AgentTooltipProvider delayDuration={0}>
        <TurnView
          locale="en"
          turn={build}
          actions={controller}
          composer={() => screen.getByRole('textbox', { name: 'Composer' })}
        />
        <textarea aria-label="Composer" />
      </AgentTooltipProvider>,
    );

    await user.click(screen.getByRole('button', { name: t('en', 'menu.label') }));
    await user.click(await screen.findByRole('menuitem', { name: t('en', 'menu.reuse') }));

    expect(controller.calls).toContainEqual({ action: 'reuse', args: [build.view.turnId] });
    expect(controller.calls.map((call) => call.action)).not.toContain('send');
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Composer' })).toHaveFocus();
    });
  });

  it('Restore page opens its dialog over the record, and restoring goes to the controller', async () => {
    const user = userEvent.setup();
    const state = fakeViewState('built', 'en');
    const built = turnOf('build');
    if (built.kind !== 'build') throw new Error('not a build');
    const turn: TurnViewData = { kind: 'build', view: { ...built.view, menu: ['restore', 'reuse'] } };
    const controller = createFakeController(state, { capabilities: { restore: true } });
    render(
      <AgentTooltipProvider delayDuration={0}>
        <TurnView locale="en" turn={turn} actions={controller} />
      </AgentTooltipProvider>,
    );

    await user.click(screen.getByRole('button', { name: t('en', 'menu.label') }));
    await user.click(await screen.findByRole('menuitem', { name: t('en', 'menu.restore') }));
    expect(
      await screen.findByRole('dialog', { name: t('en', 'restore.title') }),
    ).toBeInTheDocument();
    // Nothing is restored until the dialog's own confirm is pressed.
    expect(controller.calls.map((call) => call.action)).not.toContain('restore');
  });
});

describe('runMenuItem', () => {
  const CASES: readonly (readonly [RecordMenuItem, string, readonly unknown[]])[] = [
    ['reuse', 'reuse', ['turn-2']],
    ['copySummary', 'copy', ['turn-2', 'summary']],
    ['copyAnswer', 'copy', ['turn-2', 'answer']],
    ['copyError', 'copy', ['turn-2', 'error']],
    ['viewAsCode', 'viewAsCode', ['turn-2']],
    ['technical', 'showTechnicalDetails', ['turn-2']],
  ];

  it.each(CASES)('%s runs %s for its record', (item, action, args) => {
    const controller = createFakeController(fakeViewState('built', 'en'));
    const openRestore = vi.fn();
    runMenuItem(item, 'turn-2', controller, openRestore);
    expect(controller.calls).toEqual([{ action, args }]);
    expect(openRestore).not.toHaveBeenCalled();
  });

  it('restore only opens the dialog: the controller hears nothing yet', () => {
    const controller = createFakeController(fakeViewState('built', 'en'));
    const openRestore = vi.fn();
    runMenuItem('restore', 'turn-2', controller, openRestore);
    expect(openRestore).toHaveBeenCalledTimes(1);
    expect(controller.calls).toEqual([]);
  });
});
