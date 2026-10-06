import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BucketStateSwitcher } from './BucketStateSwitcher';
import { BUCKET_STATE_SWITCHER_LABELS_AR } from './BucketStateSwitcher.labels';
import { decodeBucket, encodeBucket } from './bucket-codec';

afterEach(cleanup);

function setup(overrides: Partial<Parameters<typeof BucketStateSwitcher>[0]> = {}) {
  const onBucketChange = vi.fn();
  const onStateChange = vi.fn();
  render(
    <BucketStateSwitcher
      bucket="base"
      state="default"
      onBucketChange={onBucketChange}
      onStateChange={onStateChange}
      {...overrides}
    />,
  );
  return { onBucketChange, onStateChange };
}

describe('BucketStateSwitcher', () => {
  it('offers the three device buckets and every state, with the current pair checked', () => {
    setup({ bucket: 'mobile', state: 'hover' });
    expect(screen.getByRole('radio', { name: 'Mobile' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Hover' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByRole('radio', { checked: false }).length).toBeGreaterThan(5);
  });

  it('switches the bucket and the state independently', async () => {
    const user = userEvent.setup();
    const { onBucketChange, onStateChange } = setup();
    await user.click(screen.getByRole('radio', { name: 'Tablet' }));
    await user.click(screen.getByRole('radio', { name: 'Focus' }));
    expect(onBucketChange).toHaveBeenCalledWith('tablet');
    expect(onStateChange).toHaveBeenCalledWith('focus');
  });

  it('lists custom breakpoints in use and offers to edit at a free device width', async () => {
    const user = userEvent.setup();
    const { onBucketChange } = setup({ customWidths: [600], freeWidth: 700 });
    await user.click(screen.getByRole('radio', { name: '≤ 600px' }));
    expect(onBucketChange).toHaveBeenLastCalledWith({ maxWidth: 600 });
    await user.click(screen.getByRole('button', { name: 'Edit at ≤ 700px' }));
    expect(onBucketChange).toHaveBeenLastCalledWith({ maxWidth: 700 });
  });

  it('does not offer a custom bucket for a preset device width', () => {
    setup({ freeWidth: 390 });
    expect(screen.queryByRole('button', { name: /Edit at/ })).not.toBeInTheDocument();
  });

  it('labels in Arabic', () => {
    setup({ labels: BUCKET_STATE_SWITCHER_LABELS_AR, dir: 'rtl' });
    expect(screen.getByRole('radiogroup', { name: 'حجم الشاشة' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'جوال' })).toBeInTheDocument();
  });

  it('round-trips bucket values', () => {
    expect(decodeBucket(encodeBucket({ maxWidth: 640 }))).toEqual({ maxWidth: 640 });
    expect(decodeBucket(encodeBucket('tablet'))).toBe('tablet');
    expect(decodeBucket('max-x')).toBe('base');
  });
});
