import { useState } from 'react';

import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { DeviceBar, type DeviceState } from './DeviceBar';

const meta = {
  title: 'Builder/Shell/DeviceBar',
  component: DeviceBar,
} satisfies Meta<typeof DeviceBar>;
export default meta;

type Story = StoryObj<typeof meta>;

function StatefulDeviceBar({ initial }: { initial: DeviceState }) {
  const [device, setDevice] = useState<DeviceState>(initial);
  return (
    <>
      <DeviceBar value={device} onChange={setDevice} />
      <p data-testid="device-state">
        {device.width}px → {device.bucket}
      </p>
    </>
  );
}

export const Desktop: Story = {
  args: { value: { width: 1280, bucket: 'base' }, onChange: () => undefined },
  render: (args) => <StatefulDeviceBar initial={args.value} />,
};

export const SwitchDevices: Story = {
  args: { value: { width: 1280, bucket: 'base' }, onChange: () => undefined },
  render: (args) => <StatefulDeviceBar initial={args.value} />,
  play: async ({ canvasElement }) => {
    // Idempotent: ends by flipping back to Tablet regardless of prior state.
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Mobile' }));
    await expect(canvas.getByTestId('device-state')).toHaveTextContent('390px → mobile');
    await userEvent.click(canvas.getByRole('button', { name: 'Tablet' }));
    await expect(canvas.getByTestId('device-state')).toHaveTextContent('834px → tablet');
    await expect(canvas.getByRole('button', { name: 'Tablet' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  },
};

export const CustomWidth: Story = {
  args: { value: { width: 1280, bucket: 'base' }, onChange: () => undefined },
  render: (args) => <StatefulDeviceBar initial={args.value} />,
  play: async ({ canvasElement }) => {
    // The FR-006 headline: BOTH declared thresholds, both half-open boundaries,
    // committed on Enter only (a partially typed width never becomes state).
    const canvas = within(canvasElement);
    const input = canvas.getByRole('spinbutton', { name: 'Width' });
    const state = canvas.getByTestId('device-state');
    const typeWidth = async (width: string) => {
      await userEvent.clear(input);
      await userEvent.type(input, `${width}{Enter}`);
    };
    await typeWidth('767');
    await expect(state).toHaveTextContent('767px → mobile');
    await typeWidth('768');
    await expect(state).toHaveTextContent('768px → tablet');
    await typeWidth('1023');
    await expect(state).toHaveTextContent('1023px → tablet');
    await typeWidth('1024');
    await expect(state).toHaveTextContent('1024px → base');
    await typeWidth('1280'); // idempotent reset to the initial state
    await expect(state).toHaveTextContent('1280px → base');
  },
};

export const RightToLeft: Story = {
  args: { value: { width: 834, bucket: 'tablet' }, onChange: () => undefined },
  render: (args) => <StatefulDeviceBar initial={args.value} />,
  globals: { direction: 'rtl' },
};
