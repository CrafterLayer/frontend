import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AgentDockHeader, type AgentDockHeaderProps } from './AgentDockHeader';

const FACE: AgentDockHeaderProps['face'] = {
  mood: 'idle',
  line: { key: 'idle' },
  typing: false,
  since: 0,
};

function renderHeader(overrides: Partial<AgentDockHeaderProps> = {}) {
  const props: AgentDockHeaderProps = {
    face: FACE,
    conversations: [{ id: 'chat-1', title: 'Landing page', turnCount: 2 }],
    activeId: 'chat-1',
    onSelectConversation: vi.fn(),
    onNewChat: vi.fn(),
    ...overrides,
  };
  render(<AgentDockHeader {...props} />);
  return props;
}

describe('AgentDockHeader', () => {
  it('keeps one compact heading and exposes the current Agent status', () => {
    renderHeader();
    expect(screen.getByRole('heading', { name: 'Agent', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('starts a new conversation from the single header action', async () => {
    const props = renderHeader();
    await userEvent.click(screen.getByRole('button', { name: 'New chat' }));
    expect(props.onNewChat).toHaveBeenCalledOnce();
  });

  it('keeps history in a menu only when history exists', async () => {
    const onSelectConversation = vi.fn();
    renderHeader({
      onSelectConversation,
      conversations: [
        { id: 'chat-1', title: 'Landing page', turnCount: 2 },
        { id: 'chat-2', title: 'Pricing', turnCount: 1 },
      ],
    });
    await userEvent.click(screen.getByRole('button', { name: 'Conversation' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: /Pricing/ }));
    expect(onSelectConversation).toHaveBeenCalledWith('chat-2');
  });
});
