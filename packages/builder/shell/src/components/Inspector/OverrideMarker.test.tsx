import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OverrideMarker } from './OverrideMarker';

describe('OverrideMarker', () => {
  it('names the bucket, carries the marker id, and clears through its labelled button', async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();
    render(<OverrideMarker markerId="m-1" bucket="mobile" propKey="width" onClear={onClear} />);
    const marker = screen.getByText('mobile override');
    expect(marker).toHaveAttribute('id', 'm-1');
    expect(marker).toHaveClass('bldr-inspector__override');
    const clear = screen.getByRole('button', { name: 'Clear width override' });
    expect(clear).toHaveClass('bldr-inspector__override-clear');
    expect(clear.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    await user.click(clear);
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
