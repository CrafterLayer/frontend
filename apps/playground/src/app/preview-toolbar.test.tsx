import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { PreviewToolbar } from './preview-toolbar';

/*
  Audit §B.3.8: the "Flip direction (preview)" button was a raw <button>
  absolutely positioned over the preview frame. It is a toggle chip in a
  toolbar row of its own now — not positioned over anything.
*/

afterEach(cleanup);

function Harness({ language }: { readonly language: 'en' | 'ar' }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div>
      <PreviewToolbar
        language={language}
        dir={language === 'ar' ? 'rtl' : 'ltr'}
        flipLabel={language === 'ar' ? 'قلب الاتجاه (معاينة)' : 'Flip direction (preview)'}
        flipped={flipped}
        onFlip={() => {
          setFlipped((value) => !value);
        }}
      />
      <iframe title="Preview" />
    </div>
  );
}

describe('PreviewToolbar', () => {
  it('the flip chip lives in the toolbar region, before the frame, never positioned over it', async () => {
    const user = userEvent.setup();
    render(<Harness language="en" />);
    const toolbar = screen.getByRole('toolbar', { name: 'Preview tools' });
    const chip = within(toolbar).getByRole('button', { name: 'Flip direction (preview)' });
    expect(chip).toHaveClass('pg-preview-chip');
    expect(chip.getAttribute('style')).toBeNull();
    expect(toolbar.getAttribute('style')).toBeNull();
    // The toolbar is a sibling that comes first in the flow, not a child of the frame's box.
    const frame = screen.getByTitle('Preview');
    expect(toolbar.compareDocumentPosition(frame) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(toolbar.contains(frame)).toBe(false);

    expect(chip).toHaveAttribute('aria-pressed', 'false');
    await user.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard(' ');
    expect(chip).toHaveAttribute('aria-pressed', 'false');
  });

  it('speaks the editor language and mirrors in Arabic', () => {
    render(<Harness language="ar" />);
    const toolbar = screen.getByRole('toolbar', { name: 'أدوات المعاينة' });
    expect(toolbar).toHaveAttribute('dir', 'rtl');
    expect(toolbar).toHaveAttribute('lang', 'ar');
    expect(within(toolbar).getByRole('button', { name: 'قلب الاتجاه (معاينة)' })).toBeInTheDocument();
  });
});
