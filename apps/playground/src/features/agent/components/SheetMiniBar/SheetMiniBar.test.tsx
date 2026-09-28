/**
 * SheetMiniBar (SPEC §4.19, §3.16, §3.17): the phone's mini-detent row.
 *
 * `miniBarView` decides; the component renders. So the view is table-tested moment by
 * moment (the status and the one action each moment calls for, the count that only
 * landed sections move), and the component is tested for what it does with a view:
 * names, the controller call behind each action, Stop while stopping, the Undo build
 * confirm, `[⤒]`, a silent spine, no live region, and where focus goes when the moment
 * changes under it (Apply → Undo, SPEC §6.3), always asserted by name.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { beforeAll, describe, expect, it, vi, type Mock } from 'vitest';

import { t } from '../../copy';
import type { Locale, RowState } from '../../model/view-types';
import {
  buildRecord,
  clinicRows,
  MINI_MOMENTS,
  miniState,
  type MiniMoment,
} from '../../testing/wp-15-history-phone-fixtures';

import { miniBarView, type MiniBarAction, type MiniBarView } from './mini-bar-view';
import { SheetMiniBar, type MiniBarCommands } from './SheetMiniBar';

beforeAll(() => {
  // Radix measures tooltips; jsdom has no ResizeObserver. These tests never read positions.
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

const TOKENS = new Set(
  [
    ...readFileSync(
      join(process.cwd(), '..', '..', 'packages', 'builder', 'theme', 'src', 'css', 'chrome.css'),
      'utf8',
    ).matchAll(/(--bldr-[\w-]+)\s*:/gu),
  ].map(([, name = '']) => name),
);

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'SheetMiniBar', 'SheetMiniBar.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

type CommandSpies = { readonly [K in keyof MiniBarCommands]: Mock<MiniBarCommands[K]> };

function commands(): CommandSpies {
  return {
    stop: vi.fn<MiniBarCommands['stop']>(),
    undoBuild: vi.fn<MiniBarCommands['undoBuild']>(),
    redoBuild: vi.fn<MiniBarCommands['redoBuild']>(),
    finishRest: vi.fn<MiniBarCommands['finishRest']>(),
    retrySections: vi.fn<MiniBarCommands['retrySections']>(),
    undoEdit: vi.fn<MiniBarCommands['undoEdit']>(),
    redoEdit: vi.fn<MiniBarCommands['redoEdit']>(),
    apply: vi.fn<MiniBarCommands['apply']>(),
    discard: vi.fn<MiniBarCommands['discard']>(),
    tryAgain: vi.fn<MiniBarCommands['tryAgain']>(),
  };
}

function viewOf(which: MiniMoment, locale: Locale = 'en'): MiniBarView {
  return miniBarView(miniState(which, locale));
}

function statusOf(container: HTMLElement): HTMLElement {
  const status = container.querySelector<HTMLElement>('.ck-agent-mini-bar__status');
  if (status === null) throw new Error('no status line');
  return status;
}

function kinds(view: MiniBarView): MiniBarAction['kind'][] {
  return view.actions.map((action) => action.kind);
}

function renderBar(view: MiniBarView, locale: Locale = 'en') {
  const spy = commands();
  const onBackToChat = vi.fn();
  const backToChatRef = createRef<HTMLButtonElement>();
  const utils = render(
    <SheetMiniBar
      locale={locale}
      view={view}
      commands={spy}
      onBackToChat={onBackToChat}
      backToChatRef={backToChatRef}
    />,
  );
  const rerender = (next: MiniBarView): void => {
    utils.rerender(
      <SheetMiniBar
        locale={locale}
        view={next}
        commands={spy}
        onBackToChat={onBackToChat}
        backToChatRef={backToChatRef}
      />,
    );
  };
  return { ...utils, spy, onBackToChat, backToChatRef, rerender };
}

/* ── The view: one answer per moment ─────────────────────────────────────── */

describe('miniBarView', () => {
  const TABLE: readonly (readonly [MiniMoment, string, readonly MiniBarAction['kind'][]])[] = [
    ['skeleton', 'Laying out the page…', ['stop']],
    ['building', '1 of 8 on the page', ['stop']],
    ['stopping', 'Stopping…', ['stop']],
    ['editRunning', 'Checking the change…', ['stop']],
    ['built', 'Page built: 8 sections', ['undoBuild']],
    ['partial', t('en', 'build.title.partial', { n: 1 }), ['retryFailed']],
    ['stopped', 'Build stopped', ['finishRest']],
    ['undone', 'Build undone', ['redoBuild']],
    ['edited', t('en', 'edit.title.done', { target: 'Hero' }), ['undoEdit']],
    ['proposal', t('en', 'proposal.title', { target: 'Hero' }), ['apply', 'discard']],
    ['failed', "Couldn't reach the model", ['tryAgain']],
    ['answer', 'Answer', []],
    ['idle', 'Abu Ghadab', []],
  ];

  it('has an answer for every moment the stories show', () => {
    expect(TABLE.map(([which]) => which).sort()).toEqual([...MINI_MOMENTS].sort());
  });

  it.each(TABLE)('%s: says «%s» and offers %j', (which, status, actions) => {
    const view = viewOf(which);
    expect(t('en', view.status.key, view.status.params)).toBe(status);
    expect(kinds(view)).toEqual(actions);
  });

  it('counts only landed sections while building: a finished draft is not ink', () => {
    const rows = clinicRows('en', [
      'landed',
      'landed',
      'drafted',
      'drafted',
      'writing',
    ] as RowState[]);
    const view = miniBarView({
      turns: [{ kind: 'build', view: buildRecord('building', rows) }],
      run: {
        turnId: 'turn-build',
        activity: 'build',
        statusKey: 'build.writing',
        params: { n: 1 },
        startedAt: 0,
        stopping: false,
      },
    });
    expect(view.status).toEqual({ key: 'mini.progress', params: { done: 2, total: 5 } });
    expect(view.spine).toEqual({ kind: 'rows', rows, live: true });
  });

  it('shows one indeterminate track during the skeleton pass, and no spine for an edit', () => {
    expect(viewOf('skeleton').spine).toEqual({ kind: 'indeterminate' });
    expect(viewOf('editRunning').spine).toBeNull();
    expect(viewOf('edited').spine).toBeNull();
  });

  it('retries only the failed sections that can be retried', () => {
    const [action] = viewOf('partial').actions;
    expect(action).toEqual({ kind: 'retryFailed', turnId: 'turn-build', keys: ['section-5'] });
  });

  it('says how many sections Finish the rest will write', () => {
    expect(viewOf('stopped').actions).toEqual([
      { kind: 'finishRest', turnId: 'turn-build', count: 5 },
    ]);
  });

  it('prefers the live run over the newest record', () => {
    const view = viewOf('stopping');
    expect(view.actions).toEqual([{ kind: 'stop', stopping: true }]);
  });
});

/* ── The component ───────────────────────────────────────────────────────── */

describe('SheetMiniBar', () => {
  it('reads glyph, status, the moment’s action, then Back to the chat', () => {
    const { container } = renderBar(viewOf('building'));
    expect(statusOf(container)).toHaveTextContent(/^1 of 8 on the page$/u);
    const [stop, back, ...rest] = screen.getAllByRole('button');
    expect(stop).toHaveAccessibleName('Stop');
    expect(back).toHaveAccessibleName('Back to the chat');
    expect(rest).toEqual([]);
  });

  it('keeps the spine silent and the status out of the live region', () => {
    const { container } = renderBar(viewOf('building'));
    expect(container.querySelector('.ck-agent-mini-spine')).toHaveAttribute('aria-hidden', 'true');
    expect(
      container.querySelectorAll('[aria-live], [role="status"], [role="log"], [role="alert"]'),
    ).toHaveLength(0);
  });

  it('describes each action by the status it acts on', () => {
    renderBar(viewOf('proposal'));
    const apply = screen.getByRole('button', { name: 'Apply' });
    expect(apply).toHaveAccessibleDescription(t('en', 'proposal.title', { target: 'Hero' }));
  });

  it('stops the run, and while stopping keeps Stop focused, labelled and inert', async () => {
    const user = userEvent.setup();
    const { spy, rerender } = renderBar(viewOf('building'));
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(spy.stop).toHaveBeenCalledTimes(1);

    rerender(viewOf('stopping'));
    const stopping = screen.getByRole('button', { name: 'Stopping…' });
    expect(stopping).toHaveFocus();
    expect(stopping).toHaveAttribute('aria-disabled', 'true');
    expect(stopping).toHaveTextContent('Stop');
    await user.click(stopping);
    expect(spy.stop).toHaveBeenCalledTimes(1);
  });

  it('when Stop goes with its moment, focus lands on the next moment’s action', async () => {
    const user = userEvent.setup();
    const { rerender } = renderBar(viewOf('building'));
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    rerender(viewOf('stopped'));
    expect(screen.getByRole('button', { name: 'Finish the rest (5)' })).toHaveFocus();
  });

  it('after Apply, focus lands on the resulting Undo (SPEC §6.3)', async () => {
    const user = userEvent.setup();
    const { spy, rerender } = renderBar(viewOf('proposal'));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(spy.apply).toHaveBeenCalledWith('turn-proposal');
    rerender(viewOf('edited'));
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus();
  });

  it('with no action left, focus lands on Back to the chat, never on the page', async () => {
    const user = userEvent.setup();
    const { rerender, backToChatRef } = renderBar(viewOf('failed'));
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    rerender(viewOf('answer'));
    expect(backToChatRef.current).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Back to the chat' })).toHaveFocus();
  });

  it('leaves focus alone when it was never in the row', () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    const { rerender } = renderBar(viewOf('building'));
    rerender(viewOf('built'));
    expect(outside).toHaveFocus();
    outside.remove();
  });

  it('asks before Undo build, in the row, and undoes the build it names', async () => {
    const user = userEvent.setup();
    const { spy } = renderBar(viewOf('built'));
    await user.click(screen.getByRole('button', { name: 'Undo build' }));
    const group = screen.getByRole('group', { name: t('en', 'confirm.undoBuild') });
    expect(within(group).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Undo build' })).toHaveFocus();
    expect(spy.undoBuild).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Undo build' }));
    await user.click(screen.getByRole('button', { name: t('en', 'confirm.undo') }));
    expect(spy.undoBuild).toHaveBeenCalledWith('turn-build');
  });

  it.each([
    ['partial', 'Retry', 'retrySections', ['turn-build', ['section-5']]],
    ['stopped', 'Finish the rest (5)', 'finishRest', ['turn-build']],
    ['undone', 'Redo build', 'redoBuild', ['turn-build']],
    ['edited', 'Undo', 'undoEdit', ['turn-edit']],
    ['failed', 'Try again', 'tryAgain', ['turn-error']],
  ] as const)('%s: %s calls %s for its own turn', async (which, name, command, args) => {
    const user = userEvent.setup();
    const { spy } = renderBar(viewOf(which));
    await user.click(screen.getByRole('button', { name }));
    expect(spy[command]).toHaveBeenCalledWith(...args);
  });

  it('discards a proposal', async () => {
    const user = userEvent.setup();
    const { spy } = renderBar(viewOf('proposal'));
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(spy.discard).toHaveBeenCalledWith('turn-proposal');
  });

  it('goes back to the chat, and hands its button to the sheet', async () => {
    const user = userEvent.setup();
    const { onBackToChat, backToChatRef } = renderBar(viewOf('idle'));
    const back = screen.getByRole('button', { name: 'Back to the chat' });
    expect(backToChatRef.current).toBe(back);
    await user.click(back);
    expect(onBackToChat).toHaveBeenCalledTimes(1);
  });

  it('speaks Arabic in Arabic, with the count in Latin digits', () => {
    const { container } = renderBar(viewOf('building', 'ar'), 'ar');
    expect(statusOf(container)).toHaveTextContent(t('ar', 'mini.progress', { done: 1, total: 8 }));
    // The counts are isolated, so «1» and «8» keep their order inside the Arabic line.
    expect([...statusOf(container).querySelectorAll('bdi')].map((bdi) => bdi.textContent)).toEqual([
      '1',
      '8',
    ]);
    expect(screen.getByRole('button', { name: t('ar', 'stop') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('ar', 'sheet.backToChat') })).toBeInTheDocument();
  });

  it('never shows token counts, costs or internal ids, in any moment', () => {
    for (const which of MINI_MOMENTS) {
      for (const locale of ['en', 'ar'] as const) {
        const { container, unmount } = renderBar(viewOf(which, locale), locale);
        expect(container.textContent).not.toMatch(/token|~\s*\d|\$\s*\d|turn-|tx-|section-\d/iu);
        unmount();
      }
    }
  });

  it('keeps focus on the row it moved within', async () => {
    const user = userEvent.setup();
    const { rerender } = renderBar(viewOf('proposal'));
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    await user.tab();
    const back = screen.getByRole('button', { name: 'Back to the chat' });
    expect(back).toHaveFocus();
    act(() => {
      rerender(viewOf('proposal'));
    });
    expect(back).toHaveFocus();
  });
});

describe('SheetMiniBar.css', () => {
  it('sizes every target at 44px, 8px apart, the row itself 44px', () => {
    expect(CSS).toMatch(/\.ck-agent-mini-bar__row\s*\{[^}]*column-gap:\s*var\(--bldr-space-md\)/u);
    expect(CSS).toMatch(
      /\.ck-agent-mini-bar__row\s*\{[^}]*min-block-size:\s*var\(--bldr-hit-target-min\)/u,
    );
    expect(CSS).toMatch(
      /\.ck-agent-mini-bar__action\[data-bldr-chrome-button\]\[data-variant\]\[data-size\]\s*\{[^}]*block-size:\s*var\(--bldr-hit-target-min\)/u,
    );
    expect(CSS).toMatch(/__back[^{]*\{[^}]*inline-size:\s*var\(--bldr-hit-target-min\)/u);
  });

  it('keeps the gutter: 16px at the start, 8px at the end, a 4px spine lane always there', () => {
    expect(CSS).toMatch(
      /\.ck-agent-mini-bar\s*\{[^}]*padding-inline:\s*var\(--bldr-space-3xl\) var\(--bldr-space-md\)/u,
    );
    expect(CSS).toMatch(
      /\.ck-agent-mini-bar__spine\s*\{[^}]*block-size:\s*var\(--bldr-space-xs\)/u,
    );
  });

  it('sets the status in Meta 500, one line', () => {
    expect(CSS).toMatch(
      /\.ck-agent-mini-bar__status\s*\{[^}]*font-size:\s*var\(--bldr-font-size-meta\)[^}]*font-weight:\s*var\(--bldr-font-weight-medium\)[^}]*white-space:\s*nowrap/u,
    );
  });

  it('never paints a hover in Indigo', () => {
    const hovers = [...CSS.matchAll(/([^{}]*:hover[^{}]*)\{([^}]*)\}/gu)];
    for (const [, selector = '', body = ''] of hovers) {
      if (selector.includes("data-emphasis='primary'")) continue;
      expect(body).not.toMatch(/--bldr-accent/u);
    }
  });

  it('reads only tokens the chrome contract defines, through logical properties', () => {
    const used = [...CSS.matchAll(/var\((--bldr-[\w-]+)/gu)].map(([, name = '']) => name);
    expect(used.filter((name) => !TOKENS.has(name))).toEqual([]);
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|top|bottom|(?:margin|padding|border)-(?:left|right|top|bottom)|(?:min-|max-)?(?:width|height))\s*:/mu,
    );
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/iu);
  });
});
