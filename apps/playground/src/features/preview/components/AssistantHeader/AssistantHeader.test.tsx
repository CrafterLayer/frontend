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

  it('shows a model picker only when more than one model is offered', () => {
    renderHeader({ models: ['minimax/minimax-m3:free'], model: 'minimax/minimax-m3:free' });
    expect(screen.queryByRole('combobox', { name: 'Model' })).not.toBeInTheDocument();
  });

  it('labels a cli: entry as the local Claude CLI rather than as a vendor', () => {
    renderHeader({
      models: ['nvidia/nemotron-3-super-120b-a12b:free', 'cli:haiku', 'cli:'],
      model: 'cli:haiku',
    });

    const picker = screen.getByRole('combobox', { name: 'Model' });
    expect(picker).toHaveValue('cli:haiku');
    expect(screen.getByRole('option', { name: 'haiku · Claude CLI' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Claude CLI' })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'nemotron-3-super-120b-a12b · free' }),
    ).toBeInTheDocument();
  });

  it('groups the picker into Claude CLI and OpenRouter so the choice of backend is visible', () => {
    renderHeader({
      models: [
        'cli:sonnet',
        'nvidia/nemotron-3-super-120b-a12b:free',
        'cli:haiku',
        'google/gemma-4-31b-it:free',
      ],
      model: 'cli:sonnet',
    });

    const cli = screen.getByRole('group', { name: 'Claude CLI' });
    const openRouter = screen.getByRole('group', { name: 'OpenRouter' });
    expect(cli.querySelectorAll('option')).toHaveLength(2);
    expect(openRouter.querySelectorAll('option')).toHaveLength(2);
    expect(cli).toHaveTextContent('sonnet · Claude CLI');
    expect(openRouter).toHaveTextContent('gemma-4-31b-it · free');
  });

  it('lets the person pick a model and reports the choice', async () => {
    const onSelectModel = vi.fn();
    renderHeader({
      models: ['minimax/minimax-m3:free', 'nvidia/nemotron-3-ultra-550b-a55b:free'],
      model: 'minimax/minimax-m3:free',
      onSelectModel,
    });

    const picker = screen.getByRole('combobox', { name: 'Model' });
    expect(picker).toHaveValue('minimax/minimax-m3:free');
    await userEvent.selectOptions(picker, 'nvidia/nemotron-3-ultra-550b-a55b:free');

    expect(onSelectModel).toHaveBeenCalledWith('nvidia/nemotron-3-ultra-550b-a55b:free');
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
