import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CanvasAnnouncements, type CanvasAnnouncementsProps } from './CanvasAnnouncements';

afterEach(cleanup);

const BASE: CanvasAnnouncementsProps = {
  selection: { text: 'Selected: Hero', nonce: 0 },
  gesture: { text: '', nonce: 0 },
  selectionLabel: 'Selection',
  gestureLabel: 'Canvas gesture',
};

describe('CanvasAnnouncements (polite live regions)', () => {
  it('exposes two named polite regions with their messages', () => {
    render(<CanvasAnnouncements {...BASE} gesture={{ text: 'Moved after Pricing', nonce: 1 }} />);
    const selection = screen.getByRole('status', { name: 'Selection' });
    const gesture = screen.getByRole('status', { name: 'Canvas gesture' });
    expect(selection).toHaveAttribute('aria-live', 'polite');
    expect(gesture).toHaveAttribute('aria-live', 'polite');
    expect(selection.textContent).toBe('Selected: Hero');
    expect(gesture.textContent.replace('​', '')).toBe('Moved after Pricing');
  });

  it('a REPEATED message still mutates the region: the nonce toggles a zero-width space', () => {
    const { rerender } = render(
      <CanvasAnnouncements {...BASE} gesture={{ text: 'Already last', nonce: 1 }} />,
    );
    const gesture = screen.getByRole('status', { name: 'Canvas gesture' });
    const first = gesture.textContent;
    rerender(<CanvasAnnouncements {...BASE} gesture={{ text: 'Already last', nonce: 2 }} />);
    const second = gesture.textContent;
    expect(first).toBe('Already last​');
    expect(second).toBe('Already last');
    expect(first).not.toBe(second);
  });

  it('a new selection with the same spoken name still changes the selection region', () => {
    const { rerender } = render(<CanvasAnnouncements {...BASE} />);
    const selection = screen.getByRole('status', { name: 'Selection' });
    const before = selection.textContent;
    rerender(<CanvasAnnouncements {...BASE} selection={{ text: 'Selected: Hero', nonce: 1 }} />);
    expect(selection.textContent).not.toBe(before);
  });

  it('names the regions in the editor language', () => {
    render(
      <CanvasAnnouncements
        {...BASE}
        selectionLabel="التحديد"
        gestureLabel="إيماءة اللوحة"
        selection={{ text: 'محدد: البطل', nonce: 0 }}
      />,
    );
    expect(screen.getByRole('status', { name: 'التحديد' }).textContent).toBe('محدد: البطل');
    expect(screen.getByRole('status', { name: 'إيماءة اللوحة' })).toBeInTheDocument();
  });
});
