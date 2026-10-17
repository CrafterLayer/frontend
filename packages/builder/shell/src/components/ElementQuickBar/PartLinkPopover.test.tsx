import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { installBrowserStandIns } from '../../style-manager/test-support';

import type { QuickWriteResult } from './element-bar-model';
import { PART_QUICK_BAR_LABELS_AR, PART_QUICK_BAR_LABELS_EN } from './ElementQuickBar.labels';
import { PartLinkPopover, type PartLinkPage } from './PartLinkPopover';

beforeAll(installBrowserStandIns);
afterEach(cleanup);

function Harness({
  onApply,
  pages,
  arabic = false,
}: {
  onApply: (value: { text: string; href: string }) => QuickWriteResult;
  pages?: readonly PartLinkPage[];
  arabic?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <PartLinkPopover
      text="Get started"
      href="/start"
      pages={pages}
      labels={arabic ? PART_QUICK_BAR_LABELS_AR : PART_QUICK_BAR_LABELS_EN}
      dir={arabic ? 'rtl' : 'ltr'}
      open={open}
      onOpenChange={setOpen}
      onApply={onApply}
    >
      <button type="button">Link</button>
    </PartLinkPopover>
  );
}

describe('PartLinkPopover (block-parts DESIGN §2.14)', () => {
  it('opens from its trigger with the stored text and address; the text takes its direction from what is typed', () => {
    render(<Harness onApply={() => ({ ok: true })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit link' });
    const text = screen.getByLabelText<HTMLInputElement>('Link text');
    const href = screen.getByLabelText<HTMLInputElement>('Link address');
    expect(dialog).toContainElement(text);
    expect(text.value).toBe('Get started');
    expect(text.getAttribute('dir')).toBe('auto');
    expect(href.value).toBe('/start');
    expect(href.getAttribute('dir')).toBe('ltr');
  });

  it('Apply writes text and address together, then closes', () => {
    const onApply = vi.fn(() => ({ ok: true }) as const);
    render(<Harness onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    fireEvent.change(screen.getByLabelText('Link text'), { target: { value: 'Start now' } });
    fireEvent.change(screen.getByLabelText('Link address'), { target: { value: 'https://example.com/go' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith({ text: 'Start now', href: 'https://example.com/go' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('an unsafe address is refused before anything is written, and the reason is shown by the field', () => {
    const onApply = vi.fn(() => ({ ok: true }) as const);
    render(<Harness onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    const href = screen.getByLabelText('Link address');
    fireEvent.change(href, { target: { value: 'javascript:alert(1)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('This address is not allowed');
    expect(href).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('a refused write keeps the form open with the door’s sentence', () => {
    render(<Harness onApply={() => ({ ok: false, message: 'The label is too long · shorten it' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('alert')).toHaveTextContent('The label is too long · shorten it');
  });

  it('a page of the site fills the address', () => {
    const onApply = vi.fn(() => ({ ok: true }) as const);
    render(<Harness onApply={onApply} pages={[{ title: 'About', href: '/about' }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    fireEvent.change(screen.getByLabelText('Page on this site'), { target: { value: '/about' } });
    expect(screen.getByLabelText<HTMLInputElement>('Link address').value).toBe('/about');
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith({ text: 'Get started', href: '/about' });
  });

  it('Cancel closes without writing; reopening starts again from the stored values', () => {
    const onApply = vi.fn(() => ({ ok: true }) as const);
    render(<Harness onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    fireEvent.change(screen.getByLabelText('Link text'), { target: { value: 'Draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    expect(screen.getByLabelText<HTMLInputElement>('Link text').value).toBe('Get started');
  });

  it('speaks Arabic in an Arabic editor', () => {
    render(<Harness arabic onApply={() => ({ ok: true })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    expect(screen.getByRole('dialog', { name: 'تحرير الرابط' })).toHaveAttribute('dir', 'rtl');
    expect(screen.getByLabelText('نص الرابط')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تطبيق' })).toBeInTheDocument();
  });
});
