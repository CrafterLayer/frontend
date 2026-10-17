import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createScriptedAiPlanProvider } from '@craftkit/builder/testing';
import type { AiBuildOwnEvent } from '@craftkit/builder';

import { AssistantPanel } from './AssistantPanel';
import { createAssistantKernel, renderPanel, requestPlan } from './AssistantPanel.test-helpers';
import {
  BUILD_DIRECTION,
  BUILD_REQUEST,
  TEN,
  THREE,
  buildEventTypes,
  createBuildKernel,
  historyLabels,
  regionId,
  regionList,
  regionsOf,
  scriptBuild,
  send,
} from './AssistantPanel.split-build.test-helpers';

describe('AssistantPanel — split build', () => {
  it('splits a ten-section page into a skeleton and one run per section, advancing the list', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, TEN, { hold: ['Benefits'] });
    const events: AiBuildOwnEvent[] = [];
    const { container, user } = renderPanel({
      kernel,
      planProvider: script.provider,
      onBuildEvent: (event) => events.push(event),
    });

    await user.click(screen.getByRole('radio', { name: 'Auto' }));
    await send(user, BUILD_REQUEST);

    // The skeleton lands FIRST, as one transaction, before a word is written.
    await waitFor(
      () => {
        expect(Object.keys(regionsOf(kernel))).toHaveLength(10);
      },
      { timeout: 15_000 },
    );

    const list = await screen.findByRole('list', { name: 'Sections' }, { timeout: 15_000 });
    // The section rows are the list's OWN children: the open one nests the
    // whole GenerationProgress card, list items and all.
    const sectionRows = () => [...list.querySelectorAll<HTMLElement>(':scope > li.pg-chat__task')];
    expect(sectionRows()).toHaveLength(10);
    expect(sectionRows().map((row) => row.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('Hero')]),
    );

    /*
      Two sections landed, the third held open — and nothing after it LANDS.
      REWRITTEN 2026-09-28: this pinned the tenth row `waiting`, which was the
      landing-gated window (agent-audit P1-8): a writer could not start a section
      more than `fillConcurrency` ahead of the one landing, so a slow hero held
      idle writers back. Writers are now bounded by concurrency alone; sections
      after the held one are written but still land in page order, after it.
    */
    await waitFor(
      () => {
        expect(container.querySelector('.pg-chat__tasks-count')).toHaveTextContent('2/10');
      },
      { timeout: 15_000 },
    );
    const rows = sectionRows();
    expect(rows[0]).toHaveAttribute('data-status', 'applied');
    expect(rows[1]).toHaveAttribute('data-status', 'applied');
    expect(rows[2]).toHaveAttribute('data-status', 'running');
    expect(rows.slice(3).some((row) => row.getAttribute('data-status') === 'applied')).toBe(false);
    expect(regionsOf(kernel)['Benefits']).toBe('');
    expect(regionsOf(kernel)['Footer']).toBe('');

    act(() => {
      script.gates.get('Benefits')?.resolve({
        rationale: 'Fill Benefits.',
        commands: [
          {
            command: 'setProp',
            args: {
              id: Object.keys(kernel.getDocument().nodes).find(
                (id) => kernel.getDocument().nodes[id]?.props['label'] === 'Benefits',
              ),
              key: 'tree',
              value: 'Body for Benefits.',
            },
          },
        ],
      });
    });

    await waitFor(
      () => {
        expect(screen.getByText(/10\/10 built in/)).toBeInTheDocument();
      },
      { timeout: 20_000 },
    );
    expect(Object.values(regionsOf(kernel)).every((body) => body !== '')).toBe(true);
    expect(kernel.transactions().map(({ command }) => command)).toEqual([
      'Assistant: page skeleton',
      ...TEN.map((title, index) => `Assistant: ${String(index + 1)}/10 — ${title}`),
    ]);
    expect(buildEventTypes(events).slice(0, 3)).toEqual([
      'build.scaffolding',
      'build.planned',
      'task.started',
    ]);
  }, 60_000);

  it('leaves a single-section request on the ordinary path, byte for byte', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE);
    const events: AiBuildOwnEvent[] = [];
    const { user } = renderPanel({
      kernel,
      planProvider: script.provider,
      onBuildEvent: (event) => events.push(event),
    });

    await send(user, 'add one testimonial to the page');

    await screen.findByRole('button', { name: 'Apply' }, { timeout: 15_000 });
    expect(buildEventTypes(events)).toEqual([]);
    expect(script.calls()).toBe(1);
    expect(screen.queryByRole('list', { name: 'Sections' })).not.toBeInTheDocument();
  }, 30_000);

  it('enters the build path in Plan mode and stops at the skeleton', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE);
    const events: AiBuildOwnEvent[] = [];
    const { container, user } = renderPanel({
      kernel,
      planProvider: script.provider,
      onBuildEvent: (event) => events.push(event),
    });

    await user.click(screen.getByRole('radio', { name: 'Plan' }));
    await send(user, BUILD_REQUEST);

    await waitFor(
      () => {
        expect(container.querySelector('.pg-chat__outline')?.textContent ?? '').not.toBe('');
      },
      { timeout: 15_000 },
    );
    /*
      One outline, and nothing to apply anywhere. This used to look for a Plan
      CARD with a Preview button; a plan run now produces no proposal at all, so
      neither button exists rather than being hidden.
    */
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Preview' })).not.toBeInTheDocument();
    /*
      The build path IS entered now, and stops after the skeleton. It used to be
      excluded outright, which left the one request the build exists for as the
      one Plan could say least about. `build.scaffolding` and nothing after it
      is the whole contract: the skeleton was proposed, never applied, and no
      section was ever started.
    */
    expect(buildEventTypes(events)).toEqual(['build.scaffolding']);
    expect(script.calls()).toBe(1);
    expect(regionsOf(kernel)).toEqual({});
    expect(kernel.transactions()).toHaveLength(0);
  }, 30_000);

  /*
    REWRITTEN 2026-09-28: this test used to pin the skeleton ON THE PAGE while
    the question was open ("The skeleton is already on the page"). That was the
    defect (agent-audit P0-4): Ask mode wrote 3-12 empty bands before asking.
    The engine now asks before its first write, so the list comes from the
    question itself and the page is untouched until Build.
  */
  it('asks once, on the list, and writes NOTHING until Build is pressed', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE);
    const { user } = renderPanel({ kernel, planProvider: script.provider });

    await send(user, BUILD_REQUEST);

    const approval = await screen.findByRole(
      'group',
      { name: 'Build this page' },
      { timeout: 15_000 },
    );
    expect(within(approval).getByText(BUILD_DIRECTION)).toBeInTheDocument();
    expect(
      within(approval)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual([...THREE]);
    expect(within(approval).queryByText(/already on the page/)).toBeNull();

    // Not the skeleton, not a section: the page is exactly as it was.
    expect(regionsOf(kernel)).toEqual({});
    expect(kernel.transactions()).toHaveLength(0);
    expect(script.calls()).toBe(1);

    await user.click(within(approval).getByRole('button', { name: 'Build' }));

    await waitFor(
      () => {
        expect(screen.getByText(/3\/3 built in/)).toBeInTheDocument();
      },
      { timeout: 20_000 },
    );
    expect(regionsOf(kernel)).toEqual({
      Hero: 'Body for Hero.',
      Proof: 'Body for Proof.',
      Pricing: 'Body for Pricing.',
    });
    expect(historyLabels(kernel)).toEqual([
      'Assistant: page skeleton',
      'Assistant: 1/3 — Hero',
      'Assistant: 2/3 — Proof',
      'Assistant: 3/3 — Pricing',
    ]);
  }, 40_000);

  /*
    REWRITTEN 2026-09-28: it was "leaves only the skeleton when the build is
    stopped before it is approved" and expected three empty bands left behind
    and an undoable "0/3" build report. Nothing is written before approval now,
    so a refusal is a plain stop with nothing on the page and nothing to undo.
  */
  it('writes nothing, and offers nothing to undo, when the build is refused at the question', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE);
    const { container, user } = renderPanel({ kernel, planProvider: script.provider });

    await send(user, BUILD_REQUEST);
    const approval = await screen.findByRole(
      'group',
      { name: 'Build this page' },
      { timeout: 15_000 },
    );
    await user.click(within(approval).getByRole('button', { name: 'Stop build' }));

    await waitFor(
      () => {
        expect(screen.getByText('Stopped.')).toBeInTheDocument();
      },
      { timeout: 20_000 },
    );
    expect(regionsOf(kernel)).toEqual({});
    expect(kernel.transactions()).toHaveLength(0);
    // A plain stop: no build report, so no section row and no Undo to press.
    expect(container.querySelector('[data-state="build-stopped"]')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Undo/ })).toBeNull();
    expect(screen.queryByText(/built in/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  }, 40_000);

  it('answers the question with Stop in the composer too, and writes nothing', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE);
    const { user } = renderPanel({ kernel, planProvider: script.provider });

    await send(user, BUILD_REQUEST);
    await screen.findByRole('group', { name: 'Build this page' }, { timeout: 15_000 });
    await user.click(screen.getByRole('button', { name: 'Stop' }));

    await waitFor(
      () => {
        expect(screen.getByText('Stopped.')).toBeInTheDocument();
      },
      { timeout: 20_000 },
    );
    expect(kernel.transactions()).toHaveLength(0);
    expect(screen.queryByRole('group', { name: 'Build this page' })).toBeNull();
  }, 40_000);

  it('proposes the one-call fallback in Ask — nothing written, and the card offers Apply', async () => {
    /*
      A skeleton of ONE section cannot split, so the build falls back to one
      ordinary run. In Ask that run is PROPOSED (it used to apply at once and be
      drawn as an applied plan), and its card's Apply is the question Ask owes.
    */
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, ['Hero']);
    const { user } = renderPanel({ kernel, planProvider: script.provider });

    await send(user, BUILD_REQUEST);

    await screen.findByRole('button', { name: 'Apply' }, { timeout: 20_000 });
    expect(kernel.transactions()).toHaveLength(0);
    expect(screen.queryByRole('group', { name: 'Build this page' })).toBeNull();
  }, 40_000);

  it('records a skipped section with its reason and still runs the next one', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE, { refuse: ['Proof'] });
    const { user } = renderPanel({ kernel, planProvider: script.provider });

    await user.click(screen.getByRole('radio', { name: 'Auto' }));
    await send(user, BUILD_REQUEST);

    await waitFor(
      () => {
        expect(screen.getByText(/2\/3 built in/)).toBeInTheDocument();
      },
      { timeout: 20_000 },
    );
    expect(screen.getByText(/The model would not write "Proof"\./)).toBeInTheDocument();
    expect(regionsOf(kernel)).toEqual({
      Hero: 'Body for Hero.',
      Proof: '',
      Pricing: 'Body for Pricing.',
    });
    expect(screen.getByRole('button', { name: 'Retry skipped' })).toBeInTheDocument();
  }, 40_000);

  it('undoes one section from the report, leaving the rest of the page alone', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE);
    const { user } = renderPanel({ kernel, planProvider: script.provider });

    await user.click(screen.getByRole('radio', { name: 'Auto' }));
    await send(user, BUILD_REQUEST);
    await waitFor(
      () => {
        expect(screen.getByText(/3\/3 built in/)).toBeInTheDocument();
      },
      { timeout: 20_000 },
    );

    await user.click(screen.getByRole('button', { name: 'Undo Pricing' }));

    expect(regionsOf(kernel)).toEqual({
      Hero: 'Body for Hero.',
      Proof: 'Body for Proof.',
      Pricing: '',
    });
    expect(screen.getByRole('button', { name: 'Undo Pricing' })).toBeDisabled();
    // FORWARD: one new transaction, and the history before it is untouched.
    expect(historyLabels(kernel).slice(-2)).toEqual([
      'Assistant: 3/3 — Pricing',
      'Assistant: revert 3/3 — Pricing',
    ]);
    // Every other section can still be put back on its own.
    expect(screen.getByRole('button', { name: 'Undo Hero' })).toBeEnabled();
  }, 40_000);

  /*
    agent-audit P1-9 (a), measured 2026-09-28: Undo found the section's
    transaction by label and looped kernel.undo() over everything recorded
    after it — the person's own later edits included.
  */
  it('puts a section back without touching the person’s later edit to another one', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE);
    const { user } = renderPanel({ kernel, planProvider: script.provider });

    await user.click(screen.getByRole('radio', { name: 'Auto' }));
    await send(user, BUILD_REQUEST);
    await waitFor(
      () => {
        expect(screen.getByText(/3\/3 built in/)).toBeInTheDocument();
      },
      { timeout: 20_000 },
    );
    act(() => {
      kernel.dispatch('setProp', {
        id: regionId(kernel, 'Hero'),
        key: 'tree',
        value: 'Written by hand.',
      });
    });

    await user.click(screen.getByRole('button', { name: 'Undo Proof' }));

    expect(regionsOf(kernel)).toEqual({
      Hero: 'Written by hand.',
      Proof: '',
      Pricing: 'Body for Pricing.',
    });
  }, 40_000);

  it('refuses to put back a section the person changed, says why, and writes nothing', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE);
    const { user } = renderPanel({ kernel, planProvider: script.provider, locale: 'en' });

    await user.click(screen.getByRole('radio', { name: 'Auto' }));
    await send(user, BUILD_REQUEST);
    await waitFor(
      () => {
        expect(screen.getByText(/3\/3 built in/)).toBeInTheDocument();
      },
      { timeout: 20_000 },
    );
    act(() => {
      kernel.dispatch('setProp', {
        id: regionId(kernel, 'Proof'),
        key: 'tree',
        value: 'My own proof.',
      });
    });
    const before = kernel.transactions().length;

    await user.click(screen.getByRole('button', { name: 'Undo Proof' }));

    expect(screen.getByText(/You changed this section after it was built/)).toBeVisible();
    expect(regionsOf(kernel)['Proof']).toBe('My own proof.');
    expect(kernel.transactions()).toHaveLength(before);
  }, 40_000);

  /*
    agent-audit P1-9 (b): two builds in one session both write
    "Assistant: 3/3 — Pricing", and the label match reached the NEWER build
    from the older card.
  */
  it('puts back the OLDER build’s section from the older card, never the newer build’s', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE);
    const { user } = renderPanel({ kernel, planProvider: script.provider });

    await user.click(screen.getByRole('radio', { name: 'Auto' }));
    await send(user, BUILD_REQUEST);
    await waitFor(
      () => {
        expect(screen.getByText(/3\/3 built in/)).toBeInTheDocument();
      },
      { timeout: 20_000 },
    );
    await send(user, BUILD_REQUEST);
    await waitFor(
      () => {
        expect(screen.getAllByText(/3\/3 built in/)).toHaveLength(2);
      },
      { timeout: 20_000 },
    );

    const [olderUndo] = screen.getAllByRole('button', { name: 'Undo Pricing' });
    if (olderUndo === undefined) throw new Error('The older card must offer Undo Pricing.');
    await user.click(olderUndo);

    expect(regionList(kernel)).toEqual([
      ['Hero', 'Body for Hero.'],
      ['Proof', 'Body for Proof.'],
      ['Pricing', ''],
      ['Hero', 'Body for Hero.'],
      ['Proof', 'Body for Proof.'],
      ['Pricing', 'Body for Pricing.'],
    ]);
  }, 60_000);

  it('offers to remove the empty sections a stopped build left, as ONE change', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE, { hold: ['Proof'] });
    const { user } = renderPanel({ kernel, planProvider: script.provider, locale: 'en' });

    await user.click(screen.getByRole('radio', { name: 'Auto' }));
    await send(user, BUILD_REQUEST);
    await waitFor(
      () => {
        expect(regionsOf(kernel)['Hero']).toBe('Body for Hero.');
      },
      { timeout: 20_000 },
    );
    await user.click(screen.getByRole('button', { name: 'Stop' }));

    const remove = await screen.findByRole(
      'button',
      { name: 'Remove the 2 empty sections' },
      { timeout: 20_000 },
    );
    const before = kernel.transactions().length;
    await user.click(remove);

    expect(regionList(kernel)).toEqual([['Hero', 'Body for Hero.']]);
    expect(kernel.transactions()).toHaveLength(before + 1);
    expect(historyLabels(kernel).at(-1)).toBe('Assistant: remove unfilled sections');
    expect(screen.getByText(/Removed 2 empty sections in one change/)).toBeVisible();
    expect(screen.queryByRole('button', { name: /empty section/ })).toBeNull();

    // One Undo is the whole way back.
    act(() => {
      kernel.undo();
    });
    expect(regionList(kernel).map(([label]) => label)).toEqual([...THREE]);
  }, 40_000);

  /*
    Wave-2 verifier, 2026-09-28: a door refusal of the removal was swallowed in
    a catch that only returned — the button stayed, and pressing it did nothing
    anyone could see. Undo says its refusals; this says its one too.
  */
  it('says so when the page refuses the removal, removes nothing, and lets it be asked again', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE, { hold: ['Proof'] });
    const { user } = renderPanel({ kernel, planProvider: script.provider, locale: 'en' });

    await user.click(screen.getByRole('radio', { name: 'Auto' }));
    await send(user, BUILD_REQUEST);
    await waitFor(
      () => {
        expect(regionsOf(kernel)['Hero']).toBe('Body for Hero.');
      },
      { timeout: 20_000 },
    );
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    const remove = await screen.findByRole(
      'button',
      { name: 'Remove the 2 empty sections' },
      { timeout: 20_000 },
    );
    const before = kernel.transactions().length;
    // The door itself refuses — the one write the removal makes, made whole or not at all.
    const refuse = vi.spyOn(kernel, 'dispatchGroup').mockImplementationOnce(() => {
      throw new Error('The page is locked.');
    });

    await user.click(remove);

    expect(screen.getByText('The page refused the removal; nothing was removed.')).toBeVisible();
    expect(regionList(kernel).map(([label]) => label)).toEqual([...THREE]);
    expect(kernel.transactions()).toHaveLength(before);
    refuse.mockRestore();

    // Nothing changed, so the offer is still an honest one — and it works now.
    await user.click(screen.getByRole('button', { name: 'Remove the 2 empty sections' }));
    expect(regionList(kernel)).toEqual([['Hero', 'Body for Hero.']]);
    expect(screen.queryByText(/refused the removal/)).toBeNull();
    expect(screen.getByText(/Removed 2 empty sections in one change/)).toBeVisible();
  }, 40_000);

  it('revives a build interrupted by a reload as a stopped build with its receipt', async () => {
    const persistKey = 'assistant-build-revive';
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE, { hold: ['Proof'] });
    const first = renderPanel({ kernel, planProvider: script.provider, persistKey });

    await first.user.click(screen.getByRole('radio', { name: 'Auto' }));
    await send(first.user, BUILD_REQUEST);
    await waitFor(
      () => {
        // The build's own counter, not the running step's stage count.
        expect(first.container.querySelector('.pg-chat__tasks-count')).toHaveTextContent('1/3');
      },
      { timeout: 20_000 },
    );
    first.unmount();

    const second = renderPanel({ kernel: createBuildKernel(), persistKey });
    expect(screen.getByText(/1\/3 built in/)).toBeInTheDocument();
    expect(screen.getByText('Stopped')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Undo Hero' })).not.toBeInTheDocument();
    second.unmount();
    window.localStorage.removeItem(persistKey);
  }, 40_000);
  it('follows the newest turn when the panel comes BACK into view, not only when one arrives', async () => {
    const kernel = createAssistantKernel();
    const planProvider = createScriptedAiPlanProvider({
      rationale: 'Add a hero.',
      commands: [{ command: 'insertNode', args: { type: 'hero', parentId: 'root' } }],
    });
    const user = userEvent.setup();
    // `visible={false}` is the App's Layers/Blocks tab: the panel stays MOUNTED
    // (its run must survive the visit) inside a `hidden` wrapper.
    const { rerender } = render(
      <AssistantPanel kernel={kernel} planProvider={planProvider} visible={false} />,
    );
    await requestPlan(user, 'add a hero');

    /*
      A hidden element measures zero, so the scroll-to-newest effect wrote
      `scrollTop = 0` and — with `turns` unchanged on the way back — never ran
      again. Measured in Chromium: returning to the assistant after five replies
      landed the reader ~360px above the newest one. jsdom lays nothing out, so
      the two properties are stated here and the WRITES are the assertion.
    */
    const thread = screen.getByRole('log', { name: 'Conversation' });
    const writes: number[] = [];
    Object.defineProperty(thread, 'scrollHeight', { configurable: true, get: () => 1200 });
    Object.defineProperty(thread, 'scrollTop', {
      configurable: true,
      get: () => writes.at(-1) ?? 0,
      set: (value: number) => {
        writes.push(value);
      },
    });

    rerender(<AssistantPanel kernel={kernel} planProvider={planProvider} visible />);
    await waitFor(() => {
      expect(writes.at(-1)).toBe(1200);
    });
  });
});
