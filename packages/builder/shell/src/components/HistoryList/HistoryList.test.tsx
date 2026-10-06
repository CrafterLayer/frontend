import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, fixtureBlocks, landingFixture, seededIds } from '@craftkit/builder-core/testing';

import { HistoryList } from './HistoryList';
import { HISTORY_LIST_LABELS_AR } from './HistoryList.labels';
import { relativeTime } from './history-format';

const makeKernel = () =>
  createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    // 2 minutes between steps — never merged as a typing burst.
    ports: { clock: fixedClock(0, 120_000), ids: seededIds('hl') },
  });

const entryButtons = () => screen.getAllByRole('button');

describe('HistoryList', () => {
  it('says so when nothing has happened yet', () => {
    render(<HistoryList kernel={makeKernel()} refreshMs={0} />);
    expect(screen.getByText(/No edits yet/u)).toBeInTheDocument();
  });

  it('lists labelled steps with author and relative time, the current one marked', () => {
    const kernel = makeKernel();
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'A' });
    kernel.dispatchGroup([{ command: 'setProp', args: { id: 'hero1', key: 'heading', value: 'B' } }], {
      author: 'ai',
      label: 'Heading · Hero',
    });
    render(<HistoryList kernel={kernel} now={() => 240_000} refreshMs={0} />);
    const [start, first, second] = entryButtons();
    expect(start).toHaveTextContent('Opened');
    expect(first).toHaveTextContent('Edit');
    expect(first).toHaveTextContent(/minutes? ago/u);
    expect(screen.getByRole('img', { name: 'You' })).toBeInTheDocument();
    expect(second).toHaveTextContent('Heading · Hero');
    expect(screen.getByRole('img', { name: 'Assistant' })).toBeInTheDocument();
    expect(second).toHaveAttribute('aria-current', 'step');
    expect(first).not.toHaveAttribute('aria-current');
  });

  it('clicking a step jumps there by undo/redo — no new transaction — and redo stays listed', async () => {
    const kernel = makeKernel();
    const user = userEvent.setup();
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'One' });
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'Two' });
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'Three' });
    render(<HistoryList kernel={kernel} now={() => 600_000} refreshMs={0} />);
    const logged = kernel.transactions().length;

    await user.click(entryButtons()[1]!);
    expect(kernel.getDocument().nodes['p1']?.props['content']).toBe('One');
    expect(entryButtons()[1]).toHaveAttribute('aria-current', 'step');
    expect(entryButtons()[3]).toHaveClass('bldr-history-list__entry--undone');
    expect(screen.getByRole('status')).toHaveTextContent('Now at: Edit');

    await user.click(entryButtons()[3]!);
    expect(kernel.getDocument().nodes['p1']?.props['content']).toBe('Three');
    await user.click(entryButtons()[0]!);
    expect(kernel.getDocument()).toEqual(landingFixture());
    expect(kernel.transactions()).toHaveLength(logged);
  });

  it('follows the kernel live, and speaks Arabic', () => {
    const kernel = makeKernel();
    render(<HistoryList kernel={kernel} labels={HISTORY_LIST_LABELS_AR} now={() => 0} refreshMs={0} />);
    act(() => {
      kernel.dispatch('removeNode', { id: 'p1' });
    });
    expect(screen.getByRole('button', { name: /حذف/u })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('img', { name: 'أنت' })).toBeInTheDocument();
  });
});

describe('history times in Arabic (arabic-editor)', () => {
  it('writes the numbers of a relative time in Latin digits', () => {
    const text = relativeTime(0, 5 * 60_000, HISTORY_LIST_LABELS_AR.locale);
    expect(text).toMatch(/5/u);
    expect(text).not.toMatch(/[٠-٩]/u);
  });
});
