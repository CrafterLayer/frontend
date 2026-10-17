import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConversationMenu } from './ConversationMenu';

const conversations = [
  { id: 'c1', title: 'صفحة هبوط', turnCount: 6 },
  { id: 'c2', title: 'قسم الأسعار', turnCount: 2 },
  { id: 'c3', title: 'New chat', turnCount: 0 },
];

function renderMenu(activeId = 'c2') {
  const onSelect = vi.fn();
  render(
    <ConversationMenu conversations={conversations} activeId={activeId} onSelect={onSelect} />,
  );
  return onSelect;
}

const openMenu = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Conversation' }));
};

describe('ConversationMenu', () => {
  it('names the conversation you are in, and how many there are', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'Conversation' });
    expect(trigger).toHaveTextContent('قسم الأسعار');
    expect(trigger).toHaveTextContent('3');
  });

  it('starts closed, and says so', () => {
    renderMenu();
    expect(screen.getByRole('button', { name: 'Conversation' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens a menu of radio items, one of them checked', async () => {
    renderMenu();
    await openMenu();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    const items = screen.getAllByRole('menuitemradio');
    expect(items).toHaveLength(3);
    expect(items.filter((item) => item.getAttribute('aria-checked') === 'true')).toHaveLength(1);
  });

  it('points the trigger at the list it controls, only while it is open', async () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'Conversation' });
    expect(trigger).not.toHaveAttribute('aria-controls');
    await openMenu();
    expect(trigger.getAttribute('aria-controls')).toBe(screen.getByRole('menu').id);
  });

  it('counts an empty conversation as Empty, not as 0 messages', async () => {
    renderMenu();
    await openMenu();
    expect(screen.getByRole('menuitemradio', { name: /New chat/ })).toHaveTextContent('Empty');
    expect(screen.getByRole('menuitemradio', { name: /صفحة هبوط/ })).toHaveTextContent(
      '6 messages',
    );
  });

  it('enters focus on the chat you are IN, not the top of the list', async () => {
    renderMenu();
    await openMenu();
    expect(screen.getByRole('menuitemradio', { name: /قسم الأسعار/ })).toHaveFocus();
  });

  it('answers the arrow keys role="menu" promises', async () => {
    renderMenu('c1');
    await openMenu();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemradio', { name: /قسم الأسعار/ })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('menuitemradio', { name: /New chat/ })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemradio', { name: /صفحة هبوط/ })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('menuitemradio', { name: /صفحة هبوط/ })).toHaveFocus();
  });

  it('chooses a conversation and closes', async () => {
    const onSelect = renderMenu();
    await openMenu();
    await userEvent.click(screen.getByRole('menuitemradio', { name: /صفحة هبوط/ }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('c1');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('dismisses on a press outside it', async () => {
    renderMenu();
    await openMenu();
    await userEvent.click(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('returns focus to the trigger on Escape — a menu must not close into nowhere', async () => {
    renderMenu();
    await openMenu();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('button', { name: 'Conversation' })).toHaveFocus();
  });

  it('falls back to New chat when the active id names nothing', () => {
    renderMenu('gone');
    expect(screen.getByRole('button', { name: 'Conversation' })).toHaveTextContent('New chat');
  });
});
