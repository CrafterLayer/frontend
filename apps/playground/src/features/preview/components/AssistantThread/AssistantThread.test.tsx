import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { initialRunProgress } from '../AssistantPanel/AssistantPanel.progress';
import type { Turn } from '../AssistantPanel/AssistantPanel.turns';
import type { AssistantThreadProps } from './AssistantThread';
import { AssistantThread } from './AssistantThread';

const face: AssistantThreadProps['face'] = {
  mood: 'thinking',
  line: { key: 'thinking', subject: 'the page' },
  typing: true,
  since: 0,
};

function renderThread(turns: readonly Turn[], overrides: Partial<AssistantThreadProps> = {}) {
  const props: AssistantThreadProps = {
    turns,
    face,
    locale: 'ar',
    mode: 'ask',
    busy: false,
    canWrite: true,
    threadRef: null,
    watchEmptyZone: null,
    holdEmptySeat: null,
    onApproval: vi.fn(),
    onUndoTask: vi.fn(),
    onRetrySkipped: vi.fn(),
    onRetry: vi.fn(),
    onBuild: vi.fn(),
    onApplyPlan: vi.fn(),
    onPreviewPlan: vi.fn(),
    onDiscardPlan: vi.fn(),
    onUndoPlan: vi.fn(),
    ...overrides,
  };
  const { container } = render(<AssistantThread {...props} />);
  return { props, container };
}

const you: Turn = { id: 't1', from: 'you', text: 'أضف قسم أسعار' };

const thinking: Turn = {
  id: 't2',
  from: 'assistant',
  kind: 'thinking',
  subject: 'the page',
  run: initialRunProgress('never', 0),
};

describe('AssistantThread', () => {
  it('is a reviewable log, not an announcer — the panel owns the one live region', () => {
    renderThread([you]);
    const log = screen.getByRole('log', { name: 'Conversation' });
    expect(log).toBeInTheDocument();
    expect(log).not.toHaveAttribute('aria-live');
  });

  it('invites a first request when there is nothing to show', () => {
    renderThread([]);
    expect(
      screen.getByText('Ask for a section and I will propose the exact changes.'),
    ).toBeInTheDocument();
  });

  it('drops the invitation the moment there is a conversation', () => {
    renderThread([you]);
    expect(
      screen.queryByText('Ask for a section and I will propose the exact changes.'),
    ).toBeNull();
  });

  it('lets what a person wrote declare its own direction', () => {
    renderThread([you]);
    expect(screen.getByText('أضف قسم أسعار')).toHaveAttribute('dir', 'auto');
  });

  it('tags every turn with where it came from and what it is', () => {
    const { container } = renderThread([you, thinking]);
    const articles = [...container.querySelectorAll('.pg-chat__turn')];
    expect(articles.at(0)).toHaveAttribute('data-from', 'you');
    expect(articles.at(0)).toHaveAttribute('data-kind', 'text');
    expect(articles.at(1)).toHaveAttribute('data-from', 'assistant');
    expect(articles.at(1)).toHaveAttribute('data-kind', 'thinking');
  });

  it('hides every avatar from screen readers — the mood is decoration', () => {
    renderThread([thinking]);
    for (const avatar of document.querySelectorAll('.pg-chat__avatar')) {
      expect(avatar).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('says what it is doing while thinking, and falls back to the subject', () => {
    renderThread([thinking]);
    expect(screen.getByText('Reading the page…')).toBeInTheDocument();
    expect(screen.getByText('Working on the page')).toBeInTheDocument();
  });

  it("prefers the provider's own words once it streams them", () => {
    renderThread([{ ...thinking, progress: 'أرتّب الأقسام…' }]);
    expect(screen.getByText('أرتّب الأقسام…')).toBeInTheDocument();
    expect(screen.queryByText('Reading the page…')).toBeNull();
  });

  it('renders each turn once, in the order it was written', () => {
    const { container } = renderThread([you, thinking]);
    expect(container.querySelectorAll('.pg-chat__turn')).toHaveLength(2);
  });
});
