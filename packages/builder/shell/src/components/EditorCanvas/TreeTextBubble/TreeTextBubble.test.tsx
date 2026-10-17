import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  TREE_TEXT_ACTION_LABELS_AR,
  TREE_TEXT_ACTION_LABELS_EN,
} from '../../../overlay/tree-text-actions';
import { TreeTextBubble, type TreeTextBubbleProps } from './TreeTextBubble';

afterEach(cleanup);

function renderBubble(overrides: Partial<TreeTextBubbleProps> = {}) {
  const session = {
    format: vi.fn(() => ({ ok: true, message: '' })),
    refocus: vi.fn(),
    suspendBlur: vi.fn(),
  };
  const onCloseLink = vi.fn();
  const onAnnounce = vi.fn();
  const bold = vi.fn();
  const props: TreeTextBubbleProps = {
    dir: 'ltr',
    labels: TREE_TEXT_ACTION_LABELS_EN,
    actions: [{ id: 'bold', label: 'Bold', run: bold }],
    session,
    linkRange: null,
    onCloseLink,
    onAnnounce,
    ...overrides,
  };
  return { session, onCloseLink, onAnnounce, bold, ...render(<TreeTextBubble {...props} />) };
}

describe('TreeTextBubble (P7 tree text formatting)', () => {
  it('names its group with the labels and runs a mark on click', async () => {
    const { bold } = renderBubble();
    const group = screen.getByRole('group', { name: 'Formatting' });
    expect(group).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(bold).toHaveBeenCalledTimes(1);
  });

  it('speaks the editor language: Arabic labels name the group', () => {
    renderBubble({ labels: TREE_TEXT_ACTION_LABELS_AR, dir: 'rtl' });
    expect(
      screen.getByRole('group', { name: TREE_TEXT_ACTION_LABELS_AR.formatting }),
    ).toBeInTheDocument();
  });

  it('asks for a link address over a range and applies it as ONE format, then closes', async () => {
    const { session, onCloseLink, onAnnounce } = renderBubble({ linkRange: { start: 2, end: 6 } });
    const field = screen.getByRole('textbox', { name: 'Link address' });
    expect(field).toHaveFocus();
    await userEvent.type(field, 'https://example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onCloseLink).toHaveBeenCalledTimes(1);
    expect(session.suspendBlur).toHaveBeenCalledWith(false);
    expect(session.format).toHaveBeenCalledWith(
      { mark: 'a', href: 'https://example.com', label: 'Link' },
      { start: 2, end: 6 },
    );
    expect(onAnnounce).not.toHaveBeenCalled();
    expect(session.refocus).not.toHaveBeenCalled();
  });

  it('a refused link is announced and focus goes back into the text', async () => {
    const { session, onAnnounce } = renderBubble({ linkRange: { start: 0, end: 3 } });
    session.format.mockReturnValueOnce({ ok: false, message: 'Not a link' });
    await userEvent.type(screen.getByRole('textbox', { name: 'Link address' }), 'nope{Enter}');
    expect(onAnnounce).toHaveBeenCalledWith('Not a link');
    expect(session.refocus).toHaveBeenCalledTimes(1);
  });

  it('cancelling the prompt closes it, resumes blur commits and refocuses the text', async () => {
    const { session, onCloseLink } = renderBubble({ linkRange: { start: 0, end: 3 } });
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCloseLink).toHaveBeenCalledTimes(1);
    expect(session.suspendBlur).toHaveBeenCalledWith(false);
    expect(session.refocus).toHaveBeenCalledTimes(1);
    expect(session.format).not.toHaveBeenCalled();
  });

  it('Escape from the marks returns focus to the edited text', async () => {
    const { session } = renderBubble();
    screen.getByRole('button', { name: 'Bold' }).focus();
    await userEvent.keyboard('{Escape}');
    expect(session.refocus).toHaveBeenCalledTimes(1);
  });
});
