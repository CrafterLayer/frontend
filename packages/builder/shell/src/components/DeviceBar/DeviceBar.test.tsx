import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DeviceBar } from './DeviceBar';

afterEach(cleanup);

describe('DeviceBar (007 contract §3)', () => {
  it('presets emit their width mapped to the declared bucket', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DeviceBar value={{ width: 1280, bucket: 'base' }} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Tablet' }));
    expect(onChange).toHaveBeenLastCalledWith({ width: 834, bucket: 'tablet' });
    await user.click(screen.getByRole('button', { name: 'Mobile' }));
    expect(onChange).toHaveBeenLastCalledWith({ width: 390, bucket: 'mobile' });
    await user.click(screen.getByRole('button', { name: 'Desktop' }));
    expect(onChange).toHaveBeenLastCalledWith({ width: 1280, bucket: 'base' });
  });

  it('marks the active preset by width', () => {
    render(<DeviceBar value={{ width: 834, bucket: 'tablet' }} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Tablet' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Desktop' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('maps a custom width across both thresholds (SC-003 widths 500/800/1200)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DeviceBar value={{ width: 1280, bucket: 'base' }} onChange={onChange} />);
    const input = screen.getByRole('spinbutton', { name: 'Width' });

    await user.clear(input);
    await user.type(input, '500{Enter}');
    expect(onChange).toHaveBeenLastCalledWith({ width: 500, bucket: 'mobile' });
    await user.clear(input);
    await user.type(input, '800{Enter}');
    expect(onChange).toHaveBeenLastCalledWith({ width: 800, bucket: 'tablet' });
    await user.clear(input);
    await user.type(input, '1200');
    await user.tab(); // blur commits too
    expect(onChange).toHaveBeenLastCalledWith({ width: 1200, bucket: 'base' });
  });

  it('NEVER commits a partially typed width (review M2 — the bucket must not flap)', async () => {
    // A transient "1" would have narrowed the frame to 1px AND routed the next
    // inspector edit into the mobile bucket — a wrong-bucket document write.
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DeviceBar value={{ width: 1280, bucket: 'base' }} onChange={onChange} />);
    const input = screen.getByRole('spinbutton', { name: 'Width' });

    await user.clear(input);
    await user.type(input, '1200'); // keystrokes 1, 12, 120, 1200 — all drafts
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ width: 1200, bucket: 'base' });
  });

  it('announces every switch through its named polite region', async () => {
    const user = userEvent.setup();
    render(<DeviceBar value={{ width: 1280, bucket: 'base' }} onChange={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Tablet' }));
    expect(screen.getByRole('status', { name: 'Device messages' })).toHaveTextContent(
      '834px — editing tablet overrides',
    );
  });
});
