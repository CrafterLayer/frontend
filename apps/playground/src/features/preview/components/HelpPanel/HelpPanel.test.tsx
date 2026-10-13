import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { HelpPanel } from './HelpPanel';
import { HELP_PANEL_LABELS_AR } from './HelpPanel.labels';

describe('HelpPanel', () => {
  it('says how a page gets made, step by step', () => {
    render(
      <HelpPanel
        onOpenShortcuts={() => undefined}
        onOpenCommands={() => undefined}
        commandsShortcut="Ctrl K"
      />,
    );

    expect(screen.getByRole('region', { name: 'Help' })).toBeInTheDocument();
    const steps = within(screen.getByRole('region', { name: 'Get started' })).getAllByRole(
      'listitem',
    );
    expect(steps).toHaveLength(4);
    expect(steps[0]).toHaveTextContent('Add blocks');
    expect(steps[3]).toHaveTextContent('Preview and publish');
  });

  it('opens the shortcuts dialog and the command palette, and names their keys', async () => {
    const user = userEvent.setup();
    const onOpenShortcuts = vi.fn();
    const onOpenCommands = vi.fn();
    render(
      <HelpPanel
        onOpenShortcuts={onOpenShortcuts}
        onOpenCommands={onOpenCommands}
        commandsShortcut="⌘ K"
      />,
    );

    const shortcuts = screen.getByRole('button', { name: 'Keyboard shortcuts' });
    expect(shortcuts).toHaveAttribute('aria-keyshortcuts', 'Shift+/');
    await user.click(shortcuts);
    expect(onOpenShortcuts).toHaveBeenCalledOnce();

    const commands = screen.getByRole('button', { name: 'Search and commands' });
    expect(commands).toHaveTextContent('⌘ K');
    await user.click(commands);
    expect(onOpenCommands).toHaveBeenCalledOnce();
  });

  it('speaks Arabic when the editor does', () => {
    render(
      <HelpPanel
        onOpenShortcuts={() => undefined}
        onOpenCommands={() => undefined}
        commandsShortcut="Ctrl K"
        labels={HELP_PANEL_LABELS_AR}
      />,
    );

    expect(screen.getByRole('region', { name: 'المساعدة' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'اختصارات لوحة المفاتيح' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'البحث والأوامر' })).toBeInTheDocument();
  });
});
