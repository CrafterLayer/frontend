import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { AssistantHeaderProps } from './AssistantHeader';
import { AssistantHeader } from './AssistantHeader';

const face: AssistantHeaderProps['face'] = {
  mood: 'idle',
  line: { key: 'idle' },
  typing: false,
  since: 0,
};

function renderHeader(overrides: Partial<AssistantHeaderProps> = {}) {
  const props: AssistantHeaderProps = {
    locale: 'ar',
    face,
    sees: 'the whole page',
    conversations: [{ id: 'c1', title: 'صفحة هبوط', turnCount: 4 }],
    activeId: 'c1',
    onSelectConversation: vi.fn(),
    onNewChat: vi.fn(),
    watchZone: null,
    holdSeat: null,
    ...overrides,
  };
  render(<AssistantHeader {...props} />);
  return props;
}

describe('AssistantHeader', () => {
  it('names him in Arabic, tagged as Arabic and read right to left', () => {
    renderHeader();
    const name = screen.getByRole('heading', { level: 2 });
    expect(name).toHaveTextContent('أبو غضب');
    expect(name.querySelector('.pg-chat__name')).toHaveAttribute('lang', 'ar');
    expect(name.querySelector('.pg-chat__name')).toHaveAttribute('dir', 'rtl');
  });

  it('names him in English when the locale is English — never both at once', () => {
    renderHeader({ locale: 'en' });
    const name = screen.getByRole('heading', { level: 2 });
    expect(name).toHaveTextContent('Abu Ghadab');
    expect(name).not.toHaveTextContent('أبو غضب');
    expect(name.querySelector('.pg-chat__name')).toHaveAttribute('dir', 'ltr');
  });

  it('states what he can see rather than leaving it to be guessed at', () => {
    renderHeader({ sees: 'hero · selected' });
    expect(screen.getByText('Sees: hero · selected')).toBeInTheDocument();
  });

  it('starts a new chat', async () => {
    const props = renderHeader();
    await userEvent.click(screen.getByRole('button', { name: 'New chat' }));
    expect(props.onNewChat).toHaveBeenCalledOnce();
  });

  it('shows no conversation picker while there is only one conversation', () => {
    renderHeader();
    expect(screen.queryByRole('button', { name: 'Conversation' })).toBeNull();
  });

  it('shows the picker once a second conversation exists', async () => {
    const props = renderHeader({
      conversations: [
        { id: 'c1', title: 'صفحة هبوط', turnCount: 4 },
        { id: 'c2', title: 'الأسعار', turnCount: 1 },
      ],
    });
    await userEvent.click(screen.getByRole('button', { name: 'Conversation' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: /الأسعار/ }));
    expect(props.onSelectConversation).toHaveBeenCalledExactlyOnceWith('c2');
  });

  it('hides the face from screen readers — the voice is what they hear', () => {
    const { container } = render(
      <AssistantHeader
        locale="ar"
        face={face}
        sees="the whole page"
        conversations={[]}
        activeId=""
        onSelectConversation={() => undefined}
        onNewChat={() => undefined}
        watchZone={null}
        holdSeat={null}
      />,
    );
    expect(container.querySelector('.pg-chat__brand-mark')).toHaveAttribute('aria-hidden', 'true');
  });
});
