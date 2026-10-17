import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CanvasEmptyState } from './CanvasEmptyState';
import { CANVAS_EMPTY_STATE_LABELS_AR } from './CanvasEmptyState.labels';

describe('CanvasEmptyState', () => {
  it('names the empty page and offers the two ways in', async () => {
    const user = userEvent.setup();
    const onAddBlock = vi.fn();
    const onUseTemplate = vi.fn();
    render(<CanvasEmptyState onAddBlock={onAddBlock} onUseTemplate={onUseTemplate} />);

    expect(screen.getByRole('region', { name: 'This page is empty' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add a block' }));
    expect(onAddBlock).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Start from a template' }));
    expect(onUseTemplate).toHaveBeenCalledOnce();
  });

  it('speaks the editor language and follows its direction', () => {
    render(
      <CanvasEmptyState
        onAddBlock={() => undefined}
        onUseTemplate={() => undefined}
        labels={CANVAS_EMPTY_STATE_LABELS_AR}
        dir="rtl"
      />,
    );

    const region = screen.getByRole('region', { name: 'هذه الصفحة فارغة' });
    expect(region).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('button', { name: 'أضف كتلة' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ابدأ من قالب' })).toBeInTheDocument();
  });

  it('is reachable from the keyboard in reading order', async () => {
    const user = userEvent.setup();
    render(<CanvasEmptyState onAddBlock={() => undefined} onUseTemplate={() => undefined} />);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Add a block' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Start from a template' })).toHaveFocus();
  });
});
