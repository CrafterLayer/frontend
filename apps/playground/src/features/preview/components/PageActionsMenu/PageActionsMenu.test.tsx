import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PageActionsMenu } from './PageActionsMenu';

const page = { id: 'about', title: 'About', address: '/about' } as const;

describe('PageActionsMenu', () => {
  it('names its scope and sends the exact page command', async () => {
    const onAction = vi.fn();
    render(<PageActionsMenu page={page} pageCount={3} onAction={onAction} onDelete={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Actions for About' }));
    const menu = screen.getByRole('menu', { name: 'About actions' });
    expect(within(menu).getByText('/about')).toBeInTheDocument();
    await user.click(within(menu).getByRole('menuitem', { name: 'Duplicate' }));
    expect(onAction).toHaveBeenCalledWith('duplicate', 'about');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('keeps the final page and offers clear instead', async () => {
    const onAction = vi.fn();
    const onDelete = vi.fn();
    render(
      <PageActionsMenu
        page={{ id: 'home', title: 'Home', address: '/' }}
        pageCount={1}
        onAction={onAction}
        onDelete={onDelete}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Actions for Home' }));
    expect(screen.getByRole('menuitem', { name: 'Delete page' })).toBeDisabled();
    expect(screen.getByText(/final page can be cleared/i)).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Clear page' }));
    expect(onAction).toHaveBeenCalledWith('clear', 'home');
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('discloses linked-delete impact and returns one unlink request', async () => {
    const onDelete = vi.fn();
    render(
      <PageActionsMenu
        page={page}
        pageCount={3}
        inboundLinkCount={2}
        onAction={vi.fn()}
        onDelete={onDelete}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Actions for About' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete page' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('2 internal links');
    await user.click(within(dialog).getByRole('button', { name: 'Delete and unlink' }));
    expect(onDelete).toHaveBeenCalledWith({
      pageId: 'about',
      unlinkInboundLinks: true,
    });
  });

  it('requires an explicit replacement before deleting the home page', async () => {
    render(
      <PageActionsMenu
        page={{ id: 'home', title: 'Home', address: '/' }}
        pageCount={3}
        onAction={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Home' }));
    expect(screen.getByRole('menuitem', { name: 'Delete page' })).toBeDisabled();
    expect(screen.getByText(/choose a new home/i)).toBeInTheDocument();
  });

  it('names the replacement and includes it in a home-page delete request', async () => {
    const onDelete = vi.fn();
    render(
      <PageActionsMenu
        page={{ id: 'home', title: 'Home', address: '/' }}
        pageCount={3}
        replacementHomePageId="about"
        replacementHomeTitle="About"
        onAction={vi.fn()}
        onDelete={onDelete}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Actions for Home' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete page' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Home will move to About');
    await user.click(within(dialog).getByRole('button', { name: 'Delete page' }));
    expect(onDelete).toHaveBeenCalledWith({
      pageId: 'home',
      unlinkInboundLinks: false,
      replacementHomePageId: 'about',
    });
  });

  it('supports menu arrow keys and returns focus on Escape in RTL', async () => {
    render(
      <div dir="rtl">
        <PageActionsMenu page={page} pageCount={3} onAction={vi.fn()} onDelete={vi.fn()} />
      </div>,
    );
    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: 'Actions for About' });
    await user.click(trigger);
    const first = screen.getByRole('menuitem', { name: 'Open page' });
    first.focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
