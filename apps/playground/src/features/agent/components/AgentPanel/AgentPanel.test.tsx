/**
 * AgentPanel (SPEC §4.1, §7.2 #51, §8 WP-20): the composition root.
 *
 * Held here, over the fake controller: one region named by the header, in the UI's
 * language, with the `agent` container and exactly one live region; every turn drawn by
 * TurnView; the separator's keys and limits; hidden keeps the panel mounted and speaks
 * through the pill in the host's status bar; Ctrl+. stops; a suggestion fills and never
 * sends; the phone sheet.
 *
 * And once end to end, over the REAL controller (`LiveAgentPanel`): a scripted provider
 * and a headless kernel, one page build typed and sent through the composer until every
 * section is on the page, and one zero-token direct edit with its Undo.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createSiteBuilder } from '@craftkit/builder';
import { fivePageSite, fixedClock, seededIds } from '@craftkit/builder/testing';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { t } from '../../copy';
import type { AgentViewState, BuildRecordView } from '../../model/view-types';
import {
  createFakeController,
  fakeViewState,
  useFakeController,
  type FakeCall,
} from '../../testing/fake-controller';
import {
  BUILD_REQUEST,
  createBuildKernel,
  createPlanKernel,
  memoryStorage,
  refusingProvider,
  regionsOf,
  scriptBuild,
} from '../../testing/scripted-engine';

import { AgentPanel } from './AgentPanel';
import { LiveAgentPanel } from './LiveAgentPanel';
import { widthAfterDrag, widthAfterKey } from './panel-width';

/* Radix measures, and the thread follows its content: jsdom has no ResizeObserver.
   Geometry belongs to the Chromium stories. */
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'AgentPanel', 'AgentPanel.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

const LIVE = '[aria-live], [role="status"], [role="log"], [role="alert"]';
const WAIT = { timeout: 20_000 } as const;

function buildOf(state: AgentViewState): BuildRecordView {
  const turn = state.turns.find((candidate) => candidate.kind === 'build');
  if (turn?.kind !== 'build') throw new Error('no build turn');
  return turn.view;
}

describe('AgentPanel: the shell', () => {
  it('is one region named by its header, in the UI language, with one live region', () => {
    const controller = createFakeController(fakeViewState('building', 'ar'));
    const { container } = render(<AgentPanel controller={controller} tooltipDelay={0} />);

    const region = screen.getByRole('region', { name: 'أبو غضب' });
    expect(region).toHaveClass('ck-agent');
    expect(region).toHaveAttribute('dir', 'rtl');
    expect(region).toHaveAttribute('lang', 'ar');
    // One name, in one language: never the English beside it (SPEC §4.2).
    expect(within(region).queryByText('Abu Ghadab')).toBeNull();
    expect(container.querySelectorAll(LIVE)).toHaveLength(1);
    expect(container.querySelector('.ck-agent-panel')).toHaveAttribute('data-state', 'running');
  });

  it('draws every turn through TurnView: the request and its record', () => {
    const controller = createFakeController(fakeViewState('built', 'en'));
    const { container } = render(<AgentPanel controller={controller} tooltipDelay={0} />);
    const turns = container.querySelectorAll('.ck-agent-thread__turn');
    expect(turns).toHaveLength(2);
    expect(turns[0]?.querySelector('.ck-agent-message')).not.toBeNull();
    expect(turns[1]?.querySelector('.ck-agent-build')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 3, name: t('en', 'build.title.done') })).toBeVisible();
  });

  it('says what it is waiting for: a ready plan is a decision', () => {
    const controller = createFakeController(fakeViewState('planReady', 'en'));
    const { container } = render(<AgentPanel controller={controller} tooltipDelay={0} />);
    expect(container.querySelector('.ck-agent-panel')).toHaveAttribute(
      'data-state',
      'awaiting-decision',
    );
  });

  /*
    Fix pass (final test, defect "45s of nothing"): the clarify check runs with no run and
    no questions yet, the words still in the box. The panel read `idle` and Send stayed
    Indigo for as long as the check took. It now says it is reading the request.
  */
  it('says it is reading a sent request while the check runs, and only then', async () => {
    const user = userEvent.setup();
    const ready: AgentViewState = {
      ...fakeViewState('empty', 'en'),
      draft: 'A specialty coffee roastery in Irbid',
      send: 'idle-ready',
      enhancement: { status: 'idle' },
    };
    let setView: (next: AgentViewState) => void = () => undefined;
    function Harness() {
      const [view, set] = useState(ready);
      setView = set;
      const controller = createFakeController(view, {
        onCall: (call) => {
          // Both the check and ✨ Improve run under `enhancing`: only a Send is a check.
          if (call.action === 'send' || call.action === 'enhanceDraft') {
            set({ ...view, enhancement: { status: 'enhancing' } });
          }
        },
      });
      return <AgentPanel controller={controller} tooltipDelay={0} />;
    }
    const { container } = render(<Harness />);
    const panel = container.querySelector('.ck-agent-panel');
    const reading = t('en', 'run.understanding');

    // ✨ Improve is not a check: no line, the panel stays idle.
    await user.click(screen.getByRole('button', { name: t('en', 'enhance.button') }));
    expect(screen.queryByText(reading)).toBeNull();
    expect(panel).toHaveAttribute('data-state', 'idle');
    act(() => {
      setView(ready);
    });

    await user.click(screen.getByRole('button', { name: t('en', 'send') }));
    expect(screen.getByText(reading)).toBeVisible();
    expect(panel).toHaveAttribute('data-state', 'checking');
    expect(container.querySelector('.ck-agent-panel__dock')).toHaveAttribute('aria-busy', 'true');
    const queued = screen.getByRole('button', { name: t('en', 'queued') });
    expect(queued).toHaveAttribute('aria-disabled', 'true');
    // Still one live region: the line is drawn, LiveStatus speaks.
    expect(container.querySelectorAll(LIVE)).toHaveLength(1);

    // The check answered: the line goes, and does not come back for a later Improve.
    act(() => {
      setView({ ...ready, draft: '', send: 'idle-empty' });
    });
    expect(screen.queryByText(reading)).toBeNull();
    expect(panel).toHaveAttribute('data-state', 'idle');
    expect(container.querySelector('.ck-agent-panel__dock')).not.toHaveAttribute('aria-busy');
    act(() => {
      setView({ ...ready, enhancement: { status: 'enhancing' } });
    });
    expect(screen.queryByText(reading)).toBeNull();
  });

  it('resizes 16px a step, 48px with Shift, stops at 288 and 480', () => {
    const onWidthChange = vi.fn<(width: number) => void>();
    const controller = createFakeController(fakeViewState('empty', 'en'));
    const { rerender } = render(
      <AgentPanel controller={controller} width={320} onWidthChange={onWidthChange} />,
    );
    const separator = screen.getByRole('separator', { name: t('en', 'panel.resize') });
    expect(separator).toHaveAttribute('aria-orientation', 'vertical');
    expect(separator).toHaveAttribute('aria-valuemin', '288');
    expect(separator).toHaveAttribute('aria-valuemax', '480');
    expect(separator).toHaveAttribute('aria-valuenow', '320');

    fireEvent.keyDown(separator, { key: 'ArrowRight' });
    fireEvent.keyDown(separator, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(separator, { key: 'ArrowLeft' });
    expect(onWidthChange.mock.calls.map(([width]) => width)).toEqual([336, 368, 304]);

    rerender(<AgentPanel controller={controller} width={288} onWidthChange={onWidthChange} />);
    onWidthChange.mockClear();
    fireEvent.keyDown(separator, { key: 'ArrowLeft' });
    expect(onWidthChange).not.toHaveBeenCalled();
    fireEvent.keyDown(separator, { key: 'End' });
    expect(onWidthChange).toHaveBeenLastCalledWith(480);
  });

  it('moves the separator in visual direction: → narrows a panel docked in an RTL editor', () => {
    expect(widthAfterKey(320, 'ArrowRight', false, false)).toBe(336);
    expect(widthAfterKey(320, 'ArrowRight', false, true)).toBe(304);
    expect(widthAfterKey(320, 'ArrowLeft', true, true)).toBe(368);
    expect(widthAfterKey(320, 'Tab', false, false)).toBeNull();
    expect(widthAfterDrag(320, 40, false)).toBe(360);
    expect(widthAfterDrag(320, 40, true)).toBe(288);
    expect(widthAfterDrag(320, 1000, false)).toBe(480);
  });

  it('hidden: stays mounted, and the pill speaks for it in the host’s status bar', async () => {
    const user = userEvent.setup();
    const state = fakeViewState('building', 'en');
    const controller = createFakeController(state);
    const bar = document.createElement('div');
    document.body.append(bar);
    const onOpen = vi.fn();
    const { container, rerender } = render(
      <AgentPanel controller={controller} visible={false} pillContainer={bar} onOpen={onOpen} />,
    );

    const panel = container.querySelector('.ck-agent-panel');
    expect(panel).toHaveAttribute('hidden');
    expect(panel).toHaveAttribute('data-state', 'hidden');
    // Mounted: the conversation is still there, only not shown.
    expect(container.querySelectorAll('.ck-agent-thread__turn')).toHaveLength(2);

    const build = buildOf(state);
    const pill = within(bar).getByRole('button', {
      name: t('en', 'pill.building', { done: build.landed, total: build.total }),
    });
    await user.click(pill);
    expect(onOpen).toHaveBeenCalledTimes(1);
    await user.click(within(bar).getByRole('button', { name: t('en', 'stop') }));
    expect(controller.calls.map((call) => call.action)).toContain('stop');

    // Shown again: the pill goes, the panel is back.
    rerender(
      <AgentPanel controller={controller} visible pillContainer={bar} onOpen={onOpen} />,
    );
    expect(bar).toBeEmptyDOMElement();
    expect(panel).not.toHaveAttribute('hidden');
    bar.remove();
  });

  it('Ctrl+. anywhere in the panel stops the live run', () => {
    const controller = createFakeController(fakeViewState('building', 'en'));
    render(<AgentPanel controller={controller} tooltipDelay={0} />);
    fireEvent.keyDown(screen.getByRole('heading', { level: 2 }), { key: '.', ctrlKey: true });
    expect(controller.calls.filter((call) => call.action === 'stop')).toHaveLength(1);
  });

  it('a suggestion fills the composer with the caret at its end, and never sends', async () => {
    const user = userEvent.setup();
    const calls: FakeCall[] = [];
    function Harness() {
      const controller = useFakeController('empty', {
        locale: 'en',
        onCall: (call) => calls.push(call),
      });
      return <AgentPanel controller={controller} tooltipDelay={0} />;
    }
    render(<Harness />);
    const starter = fakeViewState('empty', 'en').suggestions[0];
    if (starter === undefined) throw new Error('no starter');

    await user.click(screen.getByRole('button', { name: starter.text }));

    const input = screen.getByRole('combobox', { name: t('en', 'input.aria') });
    await waitFor(() => {
      expect(input).toHaveValue(starter.text);
    });
    expect(input).toHaveFocus();
    expect((input as HTMLTextAreaElement).selectionStart).toBe(starter.text.length);
    expect(calls.map((call) => call.action)).not.toContain('send');
  });

  it('opens Conversations under [◷]', async () => {
    const user = userEvent.setup();
    const controller = createFakeController(fakeViewState('conversations', 'en'));
    render(<AgentPanel controller={controller} tooltipDelay={0} />);
    const button = screen.getByRole('button', { name: t('en', 'header.conversations') });
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('writes its CSS in logical properties and re-declares the font where `lang` changes', () => {
    expect(CSS).toMatch(/\.ck-agent,\s*\.ck-agent \[lang\]\s*\{[^}]*font-family:\s*var\(--bldr-font\)/);
    expect(CSS).toMatch(/container:\s*agent \/ inline-size/);
    expect(CSS).not.toMatch(
      /(^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:|text-align:\s*(left|right)|translateX/,
    );
  });
});

describe('AgentPanel on a phone', () => {
  it('is the sheet: Close and Show the page in its header, and Close asks the host to hide', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const controller = createFakeController(fakeViewState('built', 'en'));
    render(
      <AgentPanel controller={controller} presentation="sheet" onClose={onClose} tooltipDelay={0} />,
    );
    const sheet = await screen.findByRole('dialog', { name: t('en', 'header.name') });
    expect(within(sheet).getByRole('button', { name: t('en', 'sheet.showPage') })).toBeVisible();
    // The live region rides in the sheet, still exactly one.
    expect(document.querySelectorAll(`.ck-agent-sheet :is(${LIVE})`)).toHaveLength(1);

    await user.click(within(sheet).getByRole('button', { name: t('en', 'sheet.close') }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('LiveAgentPanel: the real controller, end to end', () => {
  it('mounts over a site page lens, the kernel the app hands it, and settles', async () => {
    // A lens builds a new state object on every read: a snapshot taken straight from it
    // re-rendered the panel until React gave up (the app crashed on mount).
    const site = createSiteBuilder({
      site: fivePageSite(),
      ports: { clock: fixedClock(), ids: seededIds('panel-lens') },
    });
    const kernel = site.page(site.currentPage());
    render(
      <LiveAgentPanel
        kernel={kernel}
        locale="en"
        storage={memoryStorage()}
        enhancer={null}
        tooltipDelay={0}
      />,
    );
    expect(screen.getByRole('region', { name: t('en', 'header.name') })).toBeInTheDocument();
    const input = screen.getByRole('combobox', { name: t('en', 'input.aria') });
    await userEvent.setup({ delay: null }).type(input, 'hello');
    expect(input).toHaveValue('hello');
  });

  it('builds a page typed into the composer: every section lands, in order', async () => {
    const user = userEvent.setup({ delay: null });
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, ['Hero', 'Proof', 'Pricing']);
    render(
      <LiveAgentPanel
        kernel={kernel}
        locale="en"
        provider={script.provider}
        storage={memoryStorage()}
        enhancer={null}
        tooltipDelay={0}
      />,
    );

    const input = screen.getByRole('combobox', { name: t('en', 'input.aria') });
    await user.type(input, BUILD_REQUEST);
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 3, name: t('en', 'build.title.done') }),
      ).toBeInTheDocument();
    }, WAIT);
    expect(regionsOf(kernel)).toEqual({
      Hero: 'Body for Hero.',
      Proof: 'Body for Proof.',
      Pricing: 'Body for Pricing.',
    });
    // The request is the person's turn; the build is its record, not a second message.
    expect(screen.getByText(BUILD_REQUEST)).toBeInTheDocument();
    expect(input).toHaveValue('');
  }, 30_000);

  it('makes a small edit with no model call, and its Undo takes it back', async () => {
    const user = userEvent.setup({ delay: null });
    const kernel = createPlanKernel(['التعليم والشهادات', 'الخبرات']);
    const provider = refusingProvider();
    render(
      <LiveAgentPanel
        kernel={kernel}
        locale="ar"
        provider={provider}
        storage={memoryStorage()}
        enhancer={null}
        tooltipDelay={0}
      />,
    );
    const tree = (): string => JSON.stringify(kernel.getDocument().nodes['mine-0']?.props['tree']);

    const input = screen.getByRole('combobox', { name: t('ar', 'input.aria') });
    await user.type(input, 'تغيير عنوان قسم التعليم والشهادات إلى مرحبا');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(tree()).toContain('مرحبا');
    }, WAIT);
    expect(provider.calls()).toBe(0);
    // The zero-token edit names its section, so its Undo is labelled with it (directTarget).
    const undo = await screen.findByRole(
      'button',
      { name: t('ar', 'row.undo.aria', { title: 'التعليم والشهادات' }) },
      WAIT,
    );
    expect(undo).toHaveTextContent(t('ar', 'edit.undo'));
    await user.click(undo);
    await waitFor(() => {
      expect(tree()).not.toContain('مرحبا');
    });
  }, 30_000);
});
