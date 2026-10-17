import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PageActionsMenu } from './PageActionsMenu';
import { PAGE_ACTIONS_MENU_LABELS_AR } from './PageActionsMenu.labels';

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

  it('reads in Arabic with the Arabic labels, the link count agreeing in number', async () => {
    const onDelete = vi.fn();
    render(
      <PageActionsMenu
        page={{ id: 'home', title: 'Home', address: '/' }}
        pageCount={3}
        inboundLinkCount={2}
        replacementHomePageId="about"
        replacementHomeTitle="About"
        onAction={vi.fn()}
        onDelete={onDelete}
        labels={PAGE_ACTIONS_MENU_LABELS_AR}
      />,
    );
    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: 'إجراءات Home' });
    expect(trigger).toHaveAttribute('title', 'إجراءات الصفحة');
    await user.click(trigger);
    const menu = screen.getByRole('menu', { name: 'قائمة إجراءات Home' });
    for (const name of [
      'فتح الصفحة',
      'إعادة التسمية',
      'تغيير المسار',
      'تكرار',
      'نقل لأعلى',
      'نقل لأسفل',
      'الإعدادات والظهور في البحث',
      'تفريغ الصفحة',
    ]) {
      expect(within(menu).getByRole('menuitem', { name })).toBeInTheDocument();
    }
    expect(within(menu).getByRole('menuitem', { name: 'الصفحة الرئيسية الحالية' })).toBeDisabled();
    await user.click(within(menu).getByRole('menuitem', { name: 'حذف الصفحة' }));
    const dialog = screen.getByRole('alertdialog', { name: 'حذف «Home»؟' });
    expect(dialog).toHaveTextContent(
      'ستنتقل الصفحة الرئيسية إلى «About». سيُزال رابطان داخليان في التغيير نفسه.',
    );
    expect(within(dialog).getByRole('button', { name: 'إلغاء' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'حذف الصفحة وإزالة الروابط' }));
    expect(onDelete).toHaveBeenCalledWith({
      pageId: 'home',
      unlinkInboundLinks: true,
      replacementHomePageId: 'about',
    });

    expect(PAGE_ACTIONS_MENU_LABELS_AR.unlinks(1)).toBe('سيُزال رابط داخلي واحد في التغيير نفسه.');
    expect(PAGE_ACTIONS_MENU_LABELS_AR.unlinks(3)).toBe('سيُزال 3 روابط داخلية في التغيير نفسه.');
    expect(PAGE_ACTIONS_MENU_LABELS_AR.unlinks(11)).toBe(
      'سيُزال 11 رابطًا داخليًا في التغيير نفسه.',
    );
  });

  it('says in Arabic why the final page cannot be deleted', async () => {
    render(
      <PageActionsMenu
        page={{ id: 'home', title: 'Home', address: '/' }}
        pageCount={1}
        onAction={vi.fn()}
        onDelete={vi.fn()}
        labels={PAGE_ACTIONS_MENU_LABELS_AR}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'إجراءات Home' }));
    expect(screen.getByRole('menuitem', { name: 'حذف الصفحة' })).toBeDisabled();
    expect(screen.getByText('يمكن تفريغ الصفحة الأخيرة، لكن لا يمكن حذفها.')).toBeInTheDocument();
  });
});
