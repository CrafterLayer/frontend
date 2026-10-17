import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  SourceAgentMode,
  SourceAgentPort,
  SourceAgentSnapshot,
} from '../../source-agent-types';
import { SourceAgentPanel } from './SourceAgentPanel';

afterEach(cleanup);

function emptySnapshot(overrides: Partial<SourceAgentSnapshot> = {}): SourceAgentSnapshot {
  return {
    mode: 'ask',
    draft: '',
    busy: false,
    enabled: true,
    context: 'Page · Home',
    message: undefined,
    turns: [],
    queued: null,
    ...overrides,
  };
}

class SourceAgentPortHarness implements SourceAgentPort {
  readonly listeners = new Set<() => void>();
  readonly setMode = vi.fn((mode: SourceAgentMode) => {
    this.publish({ ...this.snapshot, mode });
  });
  readonly setDraft = vi.fn((draft: string) => {
    this.publish({ ...this.snapshot, draft });
  });
  readonly submit = vi.fn(() => undefined);
  readonly stop = vi.fn(() => undefined);
  readonly editQueued = vi.fn((prompt: string) => {
    const queued = this.snapshot.queued;
    if (queued !== null) this.publish({ ...this.snapshot, queued: { ...queued, prompt } });
  });
  readonly removeQueued = vi.fn(() => {
    this.publish({ ...this.snapshot, queued: null });
  });
  readonly newConversation = vi.fn(() => undefined);
  readonly reviewChanges = vi.fn((_turnId: string) => undefined);
  readonly undo = vi.fn((_turnId: string) => undefined);
  readonly resume = vi.fn((_turnId: string) => undefined);
  private snapshot: SourceAgentSnapshot;

  constructor(snapshot = emptySnapshot()) {
    this.snapshot = snapshot;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  private publish(snapshot: SourceAgentSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}

describe('SourceAgentPanel', () => {
  it('renders one compact header and writes empty-state suggestions into the host draft', async () => {
    const port = new SourceAgentPortHarness();
    render(<SourceAgentPanel port={port} />);

    expect(screen.getByRole('heading', { name: 'Agent' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'New conversation' }));
    expect(port.newConversation).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole('button', { name: 'Explain the selected component' }));
    expect(port.setDraft).toHaveBeenCalledWith('Explain the selected component');
    expect(screen.getByRole('textbox', { name: 'Agent request' })).toHaveValue(
      'Explain the selected component',
    );
    expect(screen.queryByLabelText('Suggested requests')).not.toBeNull();
  });

  it('exposes Ask, Plan, and Auto as a keyboard radio group with honest authority copy', async () => {
    const port = new SourceAgentPortHarness();
    render(<SourceAgentPanel port={port} />);
    const modes = screen.getByRole('radiogroup', { name: 'Agent mode' });
    const ask = within(modes).getByRole('radio', { name: 'Ask' });

    expect(ask).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Explain only. Source stays read only.')).toBeVisible();
    ask.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(port.setMode).toHaveBeenCalledWith('plan');
    expect(screen.getByText('Plan the source changes without applying them.')).toBeVisible();
    await userEvent.keyboard('{ArrowRight}');
    expect(port.setMode).toHaveBeenCalledWith('auto');
    expect(screen.getByText('Draft source, verify the preview, then commit once.')).toBeVisible();
  });

  it('keeps the composer writable during a run and enforces one editable queued request', async () => {
    const port = new SourceAgentPortHarness(
      emptySnapshot({
        mode: 'auto',
        busy: true,
        draft: '',
        queued: { prompt: 'Then tighten the mobile spacing', context: 'Instance · Hero' },
        turns: [
          {
            id: 'turn-running',
            prompt: 'Improve the hero',
            pageTitle: 'Home',
            status: 'running',
            summary: '',
            currentTask: 'Compiling preview',
            completed: 2,
            total: 4,
            files: ['pages/home/index.tsx'],
            details: ['compile_preview · running'],
            canUndo: false,
            canResume: false,
          },
        ],
      }),
    );
    render(<SourceAgentPanel port={port} />);

    const composer = screen.getByRole('textbox', { name: 'Agent request' });
    expect(composer).toBeEnabled();
    await userEvent.type(composer, 'A second queued request is refused');
    expect(port.setDraft).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Queue next' })).toBeDisabled();
    expect(screen.getAllByRole('radio').every((radio) => radio.hasAttribute('disabled'))).toBe(true);

    const queued = screen.getByRole('region', { name: 'Queued request' });
    const queuedEditor = within(queued).getByRole('textbox', { name: 'Edit queued request' });
    await userEvent.clear(queuedEditor);
    await userEvent.type(queuedEditor, 'Use a smaller gap');
    expect(port.editQueued).toHaveBeenLastCalledWith('Use a smaller gap');
    await userEvent.click(within(queued).getByRole('button', { name: 'Remove' }));
    expect(port.removeQueued).toHaveBeenCalledOnce();

    await userEvent.click(screen.getAllByRole('button', { name: 'Stop and revise' })[0]!);
    expect(port.stop).toHaveBeenCalled();
  });

  it('shows real outcome, files, collapsed details, review, undo, and resume actions per turn', async () => {
    const port = new SourceAgentPortHarness(
      emptySnapshot({
        turns: [
          {
            id: 'turn-done',
            prompt: 'Make the pricing clearer',
            pageTitle: 'Pricing',
            status: 'done',
            summary: 'Reworked the comparison and verified the preview.',
            currentTask: '',
            completed: 3,
            total: 3,
            files: ['pages/pricing/index.tsx', 'shared/PricingCard.tsx'],
            details: ['compile_preview · passed'],
            canUndo: true,
            canResume: false,
          },
          {
            id: 'turn-stopped',
            prompt: 'Continue the FAQ',
            pageTitle: 'Pricing',
            status: 'stopped',
            summary: 'One completed file remains in the saved draft.',
            currentTask: '',
            completed: 1,
            total: 2,
            files: ['pages/pricing/Faq.tsx'],
            details: [],
            canUndo: false,
            canResume: true,
          },
        ],
      }),
    );
    render(<SourceAgentPanel port={port} />);

    expect(screen.getByText('Reworked the comparison and verified the preview.')).toBeVisible();
    const details = screen.getAllByText('Tools and files')[0]!.closest('details');
    expect(details).not.toHaveAttribute('open');
    await userEvent.click(screen.getAllByText('Tools and files')[0]!);
    expect(screen.getByText('File · shared/PricingCard.tsx')).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Review changes' }));
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Resume incomplete work' }));
    expect(port.reviewChanges).toHaveBeenCalledWith('turn-done');
    expect(port.undo).toHaveBeenCalledWith('turn-done');
    expect(port.resume).toHaveBeenCalledWith('turn-stopped');
  });

  it('submits Enter, preserves Shift+Enter, and stays mounted while hidden', async () => {
    const port = new SourceAgentPortHarness(emptySnapshot({ draft: 'Explain this source' }));
    const { rerender } = render(<SourceAgentPanel port={port} />);
    const composer = screen.getByRole('textbox', { name: 'Agent request' });
    expect(composer).toHaveAttribute('rows', '2');

    composer.focus();
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    expect(port.submit).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    expect(port.submit).toHaveBeenCalledOnce();

    rerender(<SourceAgentPanel port={port} visible={false} />);
    expect(screen.getByRole('region', { hidden: true })).toHaveAttribute('data-visible', 'false');
  });

  it('announces disabled provider state and prevents submission', async () => {
    const port = new SourceAgentPortHarness(
      emptySnapshot({
        enabled: false,
        draft: 'Run this',
        message: 'Connect an AI provider to use source editing.',
      }),
    );
    render(<SourceAgentPanel port={port} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Connect an AI provider');
    expect(screen.getByRole('textbox', { name: 'Agent request' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ask agent' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Ask agent' }));
    await waitFor(() => {
      expect(port.submit).not.toHaveBeenCalled();
    });
  });
});
