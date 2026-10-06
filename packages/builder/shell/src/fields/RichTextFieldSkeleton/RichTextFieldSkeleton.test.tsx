import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FieldServicesProvider } from '../field-services';
import { RichTextFieldSkeleton } from './RichTextFieldSkeleton';

afterEach(cleanup);

const DOC = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Why it holds' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Every edit is one transaction.' }] },
  ],
};

describe('RichTextFieldSkeleton', () => {
  it('while loading: a disabled frame holding the words, never JSON', () => {
    render(<RichTextFieldSkeleton value={DOC} state="loading" controlId="c" />);
    const surface = screen.getByRole('textbox');
    expect(surface).toBeDisabled();
    expect(surface).toHaveAttribute('dir', 'auto');
    expect(surface).toHaveValue('Why it holds\nEvery edit is one transaction.');
    expect((surface as HTMLTextAreaElement).value).not.toContain('"type"');
    expect(screen.getByRole('status')).toHaveTextContent('Loading the text editor…');
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('on failure: says what happened and offers Retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <RichTextFieldSkeleton
        value={DOC}
        state="failed"
        error="The editor chunk did not load."
        onRetry={onRetry}
        controlId="c"
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('The editor chunk did not load.');
    expect(screen.getByRole('textbox')).toHaveAttribute(
      'aria-describedby',
      expect.stringContaining('c-status'),
    );
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('speaks Arabic under an Arabic provider', () => {
    render(
      <FieldServicesProvider value={{ locale: 'ar' }}>
        <RichTextFieldSkeleton value={DOC} state="failed" onRetry={() => undefined} />
      </FieldServicesProvider>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('تعذّر تحميل محرّر النص.');
    expect(screen.getByRole('button', { name: 'إعادة المحاولة' })).toBeInTheDocument();
  });
});
