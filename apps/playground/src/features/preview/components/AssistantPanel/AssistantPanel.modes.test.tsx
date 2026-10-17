import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { AiAgentEvent, AiPlanProvider } from '@craftkit/builder';

import { renderPanel, requestPlan } from './AssistantPanel.test-helpers';
import { send } from './AssistantPanel.split-build.test-helpers';

describe('AssistantPanel', () => {
  it('Auto mode applies a validated plan immediately — still one undoable change', async () => {
    const events: AiAgentEvent[] = [];
    const { kernel, user } = renderPanel({ onAgentEvent: (event) => events.push(event) });
    const before = structuredClone(kernel.getDocument());

    await user.click(screen.getByRole('radio', { name: 'Auto' }));
    const composer = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Ask the assistant',
    });
    await user.type(composer, 'add a pricing section');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(screen.getByText(/Applied as one change/)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    expect(Object.keys(kernel.getDocument().nodes).length).toBe(
      Object.keys(before.nodes).length + 1,
    );
    expect(kernel.undo()).toBe(true);
    expect(kernel.getDocument()).toEqual(before);
    expect(events[0]).toMatchObject({ type: 'run.started', apply: 'auto' });
    expect(events.map(({ type }) => type)).toContain('plan.applying');
  });

  it('Plan mode answers with a PLAN, and with nothing to apply', async () => {
    /*
      Stronger than what this used to assert. It once expected a proposal card
      with Preview but no Apply — and Preview's own dialog has no mode check, so
      "no Apply" was two clicks from an apply. A plan run now carries no
      proposal at all: there is nothing for either button to act on, which is
      the difference between hiding a door and not building one.

      The provider still returns commands (the local one always does). They are
      DROPPED, counted, and reported — a model that ignores the instruction
      costs the person a paragraph, never their page.
    */
    const { kernel, user } = renderPanel();
    const before = structuredClone(kernel.getDocument());

    await user.click(screen.getByRole('radio', { name: 'Plan' }));
    const composer = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Ask the assistant',
    });
    await user.type(composer, 'add a pricing section');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    const log = screen.getByRole('log', { name: 'Conversation' });
    await waitFor(() => {
      expect(log.querySelector('.pg-chat__outline')?.textContent ?? '').not.toBe('');
    });
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Preview' })).not.toBeInTheDocument();
    expect(kernel.getDocument()).toEqual(before);
    expect(kernel.transactions()).toEqual([]);
  });

  it('says what the plan would change, before the decision', async () => {
    /*
      Computed from `previewAiPlan` — the plan rehearsed on a scratch kernel
      through the real door — and diffed against the live document. Not a
      re-reading of the step list: the two differ exactly where it matters, and
      a person deciding whether to Apply needs the size of the change, not a
      restatement of what was asked for.
    */
    // The panel's default locale is Arabic, and so is the sentence.
    const arabic = renderPanel();
    await requestPlan(arabic.user, 'add a pricing section');
    expect(
      screen.getByRole('log', { name: 'Conversation' }).querySelector('.pg-chat__impact')
        ?.textContent,
    ).toMatch(/إضافة/);
    arabic.unmount();

    const english = renderPanel({ locale: 'en' });
    await requestPlan(english.user, 'add a pricing section');
    expect(
      screen.getByRole('log', { name: 'Conversation' }).querySelector('.pg-chat__impact')
        ?.textContent,
    ).toMatch(/block added/);
  });

  it('shows no token estimate on the card (2026-09-28: it misled on one-word edits)', async () => {
    /*
      The estimate measured the whole context this panel would send, not what a
      change cost: the owner saw "~11.3k tokens" on a one-word title change that
      the engine now applies without a model call. Cost is telemetry (SPEC §7.4).
    */
    const { user } = renderPanel();
    await requestPlan(user, 'add a pricing section');

    const log = screen.getByRole('log', { name: 'Conversation' });
    expect(log.querySelector('.pg-chat__cost')).toBeNull();
    expect(log.textContent).not.toMatch(/تقدير: ~/u);
  });

  it('says a plan changes NOTHING rather than letting a person spend an undo finding out', async () => {
    /*
      A `setProp` to the value already there is a valid command that produces an
      identical document: the step list reads like work and the page does not
      move. The step list cannot tell you that; the diff can.
    */
    const provider: AiPlanProvider = {
      propose: () =>
        Promise.resolve({
          rationale: 'Set the heading it already has.',
          commands: [
            {
              command: 'setProp',
              args: { id: 'selected-hero', key: 'heading', value: 'Existing section' },
            },
          ],
        }),
    };
    const { user } = renderPanel({ planProvider: provider });
    await send(user, 'retitle the hero');

    await waitFor(() => {
      /*
        The impact line carries the estimate beside it, so the assertion names
        the impact sentence specifically rather than the whole line.
      */
      const impact = screen
        .getByRole('log', { name: 'Conversation' })
        .querySelector('.pg-chat__impact');
      expect(impact?.textContent).toContain('لا يغيّر شيئًا على الصفحة.');
    });
  });

  it('NOTHING in the panel writes while Plan is selected', async () => {
    /*
      T291's negative, stated the way it should have been from the start.

      The first version looked for the literal word "Apply" — and passed while
      the applied card's Undo and the build report's per-section Undo both
      called `kernel.undo()` with no gate at all. A test that names one button
      cannot guard a rule about all of them.

      This one watches the two doors instead of reading labels: every write from
      this panel is a `dispatchGroup` (Apply) or an `undo` (the two Undos), so
      spying on both and pressing what remains asks the real question — does
      this panel write in Plan mode — rather than a question about wording.
    */
    const { user, container, kernel } = renderPanel();
    await requestPlan(user, 'add a pricing section');
    // Applied first, so the card that carries Undo actually exists to be found.
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    await user.click(screen.getByRole('radio', { name: 'Plan' }));

    const dispatchGroup = vi.spyOn(kernel, 'dispatchGroup');
    const undo = vi.spyOn(kernel, 'undo');
    const before = structuredClone(kernel.getDocument());

    const pressable = [...container.querySelectorAll('button')].filter(
      (button) =>
        !button.disabled &&
        // Not the mode radios: leaving Plan is exactly how a person is meant to
        // regain the ability to write, and pressing one would end the test's
        // premise rather than test it.
        button.getAttribute('role') !== 'radio' &&
        // Not "New chat" — it ends the conversation being inspected.
        button.textContent !== 'New chat',
    );
    expect(pressable.length).toBeGreaterThan(0);
    for (const button of pressable) {
      await user.click(button);
    }

    expect(dispatchGroup).not.toHaveBeenCalled();
    expect(undo).not.toHaveBeenCalled();
    expect(kernel.getDocument()).toEqual(before);
  });

  it('refuses to apply an OLD Ask proposal once Plan is selected', async () => {
    /*
      The route a BoundedRelay audit found and I had not: Plan was a label on
      new cards rather than a state of the panel. Every gate read the mode the
      turn was PROPOSED under, so an Ask proposal made a minute ago kept its
      Apply after the person switched to Plan — and its Preview dialog applied
      unconditionally. "Only plan — never apply" was one or two clicks from an
      apply, on work the panel was currently promising not to touch.

      `accept()` now fails closed against the CURRENT mode, at the single
      function every route reaches. A gate on a button is a gate somebody can
      forget to copy.
    */
    const { kernel, user } = renderPanel();
    await requestPlan(user, 'add a pricing section');
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    const before = structuredClone(kernel.getDocument());

    await user.click(screen.getByRole('radio', { name: 'Plan' }));

    // The button is gone, because the panel will not do what it would offer…
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    // …and the preview cannot get around it either.
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    expect(screen.getByText(/Planning only/)).toBeInTheDocument();
    expect(kernel.getDocument()).toEqual(before);
  });

  it('keeps outline follow-ups out of the starter area after the first turn', async () => {
    const provider: AiPlanProvider = {
      propose: () =>
        Promise.resolve({
          rationale: 'GOAL: a clinic page.',
          commands: [],
          followUp: 'ابدأ ببناء القسم الافتتاحي',
        }),
    };
    const { user } = renderPanel({ planProvider: provider });

    await user.click(screen.getByRole('radio', { name: 'Plan' }));
    await send(user, 'صفحة عيادة');

    expect(screen.queryByRole('list', { name: 'Suggestions' })).not.toBeInTheDocument();
  });

  it('remembers the mode across a reload, because Ask can write and Plan cannot', async () => {
    /*
      The mode was not persisted, so every reload returned to Ask. A person who
      deliberately put the assistant in Plan came back to a panel that would
      apply — having changed nothing, and been told nothing.
    */
    const first = renderPanel({ persistKey: 'assistant-mode-test' });
    await first.user.click(screen.getByRole('radio', { name: 'Plan' }));
    first.unmount();

    const second = renderPanel({ persistKey: 'assistant-mode-test' });

    expect(screen.getByRole('radio', { name: 'Plan' })).toHaveAttribute('aria-checked', 'true');
    second.unmount();
    window.localStorage.removeItem('assistant-mode-test');
  });

  it('starts in the host default until the person chooses, even over a saved default', async () => {
    /*
      Every panel used to save its mode on every change, so the old default
      (Ask) sat in storage looking exactly like a choice — and a host that
      moved the default to Auto never reached anyone who had opened it once.
    */
    window.localStorage.setItem(
      'assistant-default-test',
      JSON.stringify({ sessions: [], activeId: 'session-1', mode: 'ask' }),
    );
    const first = renderPanel({ persistKey: 'assistant-default-test', defaultMode: 'auto' });
    expect(screen.getByRole('radio', { name: 'Auto' })).toHaveAttribute('aria-checked', 'true');

    await first.user.click(screen.getByRole('radio', { name: 'Ask' }));
    first.unmount();
    const second = renderPanel({ persistKey: 'assistant-default-test', defaultMode: 'auto' });

    expect(screen.getByRole('radio', { name: 'Ask' })).toHaveAttribute('aria-checked', 'true');
    second.unmount();
    window.localStorage.removeItem('assistant-default-test');
  });

  it.each([
    { saved: 'plan', radio: 'Plan', host: 'auto' },
    { saved: 'auto', radio: 'Auto', host: 'ask' },
  ] as const)(
    'keeps a $saved mode saved before choices were marked, because only a person could store it',
    ({ saved, radio, host }) => {
      /*
        Data from before `modeChosen` has no marker. Then the default was Ask
        and only the radios could store Plan or Auto, so those two are choices.
        Reading them as the host default put a person who chose Plan — the
        mode that never writes — into Auto, and the next save made it final.
      */
      const persistKey = `assistant-legacy-mode-${saved}`;
      window.localStorage.setItem(
        persistKey,
        JSON.stringify({ sessions: [], activeId: 'session-1', mode: saved }),
      );
      const view = renderPanel({ persistKey, defaultMode: host });

      expect(screen.getByRole('radio', { name: radio })).toHaveAttribute('aria-checked', 'true');
      // The save on mount writes the choice back as one, so it holds from now on.
      expect(JSON.parse(window.localStorage.getItem(persistKey) ?? '{}')).toMatchObject({
        mode: saved,
        modeChosen: true,
      });
      view.unmount();
      window.localStorage.removeItem(persistKey);
    },
  );

  it('shows suggestions only on an empty conversation', async () => {
    /*
      One list, two layouts. On an empty panel there is nothing to crowd and a
      person who has said nothing yet is choosing, so the suggestions stack as
      full-width targets. The moment a conversation exists they become a
      one-row rail at a fixed height — a column of cards was eating half the
      panel and hiding the very thread it was meant to help continue.
    */
    const { user } = renderPanel();

    expect(screen.getByRole('list', { name: 'Suggestions' })).toHaveAttribute(
      'data-layout',
      'stack',
    );

    await send(user, 'add a hero');

    expect(screen.queryByRole('list', { name: 'Suggestions' })).not.toBeInTheDocument();
  });

  it('carries the whole suggestion in the accessible name, even when the chip truncates', () => {
    /*
      A rail chip is capped at one line and ellipsised. The sentence it sends is
      the whole one, so the name a screen reader announces has to be the whole
      one too — otherwise the two disagree about what pressing it does.
    */
    renderPanel();
    const strip = screen.getByRole('list', { name: 'Suggestions' });
    const chips = within(strip).getAllByRole('button');

    for (const chip of chips) {
      expect(chip.getAttribute('title')).toBe(chip.textContent);
    }
  });

  it('answers the arrows, and costs ONE tab stop — what role="radio" promises', async () => {
    /*
      Buttons with `role="radio"` do not get arrow keys for free, and three
      separate tab stops made the composer's action row cost three presses to
      cross. A person told "radio group" reaches for the arrows; if nothing
      answers, the group is a radio group only in the accessibility tree.
    */
    const user = userEvent.setup();
    renderPanel();

    const stops = screen
      .getAllByRole('radio')
      .filter((radio) => radio.getAttribute('tabindex') === '0');
    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveAttribute('aria-checked', 'true');

    screen.getByRole('radio', { name: 'Ask' }).focus();
    // The panel is Arabic by default, so ArrowLeft is FORWARD.
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Auto' })).toHaveAttribute('aria-checked', 'true');
    // Selection moves focus with it, or the single tab stop is stranded.
    expect(screen.getByRole('radio', { name: 'Auto' })).toHaveFocus();

    // And it wraps: the ends of a radio group are not walls.
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Plan' })).toHaveAttribute('aria-checked', 'true');
  });

  it('locks the mode while a run is in flight, because the run already has its authority', async () => {
    /*
      A run captures its mode when it starts and the closure keeps it: a request
      begun in Auto carries `apply: 'auto'` all the way to the door. Leaving the
      control enabled meant a person could press Auto, change their mind to
      Plan, and watch the page be written by a run they had just told to stop
      writing. Locking it is honest — this run's authority was decided when it
      started, and the way to change it is Stop.
    */
    let release: (() => void) | undefined;
    const provider: AiPlanProvider = {
      propose: () =>
        new Promise((resolve) => {
          release = () => {
            resolve({ rationale: 'A plan.', commands: [] });
          };
        }),
    };
    const { user } = renderPanel({ planProvider: provider });

    await user.click(screen.getByRole('radio', { name: 'Plan' }));
    const composer = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Ask the assistant',
    });
    await user.type(composer, 'a clinic page');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Auto' })).toBeDisabled();
    });
    expect(screen.getByRole('radio', { name: 'Ask' })).toBeDisabled();
    // Stop is still there: locked is not stranded.
    expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled();
    /*
      And the reason is on the hint line UNDER the row, not wedged among the
      buttons. The first version put a paragraph inside the radiogroup, where it
      wrapped over three lines and broke the composer's action row — the owner
      caught it from a screenshot.
    */
    expect(screen.getByText('Stop the request to change mode.')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Assistant mode' }).textContent).not.toContain(
      'Stop the request',
    );

    act(() => {
      release?.();
    });
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Auto' })).toBeEnabled();
    });
  });

  it('typing @ opens the page mention picker and the pick becomes the request context', async () => {
    let seenSelection: readonly string[] = [];
    const provider: AiPlanProvider = {
      propose: (_request, context) => {
        seenSelection = context.selection.ids;
        return Promise.resolve({
          rationale: 'Retitle the mentioned hero.',
          commands: [
            { command: 'setProp', args: { id: 'selected-hero', key: 'heading', value: 'Hi' } },
          ],
        });
      },
    };
    const { user } = renderPanel({ planProvider: provider });
    const composer = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Ask the assistant',
    });

    await user.type(composer, 'retitle @');
    const option = await screen.findByRole('option', { name: /selected-hero/ });
    await user.click(option);

    expect(composer.value).toContain('@selected-hero');

    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    });
    expect(seenSelection).toEqual(['selected-hero']);
  });

  it('shows an empty mention result and Escape closes it without changing the draft', async () => {
    const { user } = renderPanel();
    const composer = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Ask the assistant',
    });

    await user.type(composer, 'retitle @ghost');
    expect(await screen.findByText('No matching block.')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox', { name: 'Mention a block' })).not.toBeInTheDocument();
    expect(composer).toHaveValue('retitle @ghost');
  });

  it('re-keys saved turns that already share an id, once, on revival', () => {
    const persistKey = 'assistant-ids-repaired';
    window.localStorage.setItem(
      persistKey,
      JSON.stringify({
        activeId: 'session-1',
        sessions: [
          {
            id: 'session-1',
            title: 'New chat',
            turns: [
              { id: 'turn-2', from: 'you', text: 'first' },
              { id: 'turn-2', from: 'assistant', kind: 'discarded' },
              { id: 'turn-3', from: 'you', text: 'second' },
              { id: 'turn-3', from: 'assistant', kind: 'stopped' },
            ],
          },
        ],
      }),
    );
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      renderPanel({ persistKey });
      const log = screen.getByRole('log', { name: 'Conversation' });
      expect(log.querySelectorAll('.pg-chat__turn')).toHaveLength(4);
      expect(screen.getByText('first')).toBeInTheDocument();
      expect(screen.getByText('Discarded.')).toBeInTheDocument();
      expect(screen.getByText('second')).toBeInTheDocument();
      expect(screen.getByText('Stopped.')).toBeInTheDocument();
      expect(
        errors.mock.calls.some((call) =>
          String(call[0]).includes('two children with the same key'),
        ),
      ).toBe(false);
    } finally {
      errors.mockRestore();
      window.localStorage.removeItem(persistKey);
    }
  });

  it('continues its ids after a reload so a new turn never repeats a saved key', async () => {
    const persistKey = 'assistant-ids-continue';
    window.localStorage.setItem(
      persistKey,
      JSON.stringify({
        activeId: 'session-1',
        sessions: [
          {
            id: 'session-1',
            title: 'New chat',
            turns: [
              { id: 'turn-2', from: 'you', text: 'first' },
              { id: 'turn-3', from: 'assistant', kind: 'discarded' },
            ],
          },
        ],
      }),
    );
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const { user } = renderPanel({ persistKey });
      const composer = screen.getByRole('textbox', { name: 'Ask the assistant' });
      await user.type(composer, 'add a hero');
      await user.keyboard('{Enter}');
      await screen.findByRole('button', { name: 'Apply' });

      const saved = JSON.parse(window.localStorage.getItem(persistKey) ?? '{}') as {
        sessions: readonly { turns: readonly { id: string }[] }[];
      };
      const ids = saved.sessions.flatMap((session) => session.turns.map((turn) => turn.id));
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toEqual(expect.arrayContaining(['turn-2', 'turn-3']));
      expect(
        errors.mock.calls.some((call) =>
          String(call[0]).includes('two children with the same key'),
        ),
      ).toBe(false);
    } finally {
      errors.mockRestore();
      window.localStorage.removeItem(persistKey);
    }
  });
});
