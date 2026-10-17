import { useState } from 'react';

import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { TopBar, type TopBarDevice, type TopBarProps } from './TopBar';

const PRODUCT_LOGO = (
  <svg
    viewBox="0 0 16 16"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z" />
  </svg>
);

const meta = {
  title: 'Builder/Shell/TopBar',
  component: TopBar,
} satisfies Meta<typeof TopBar>;
export default meta;

type Story = StoryObj<typeof meta>;

function StatefulTopBar(props: TopBarProps) {
  const [device, setDevice] = useState<TopBarDevice>(props.device ?? 'desktop');

  return (
    <TopBar
      {...props}
      device={device}
      onDeviceChange={(nextDevice) => {
        setDevice(nextDevice);
        props.onDeviceChange?.(nextDevice);
      }}
    />
  );
}

const BASE_ARGS = {
  productName: 'CraftKit',
  logo: PRODUCT_LOGO,
  device: 'desktop',
  onDeviceChange: () => undefined,
  canUndo: true,
  canRedo: true,
  onUndo: () => undefined,
  onRedo: () => undefined,
  onPreview: () => undefined,
  onPublish: () => undefined,
  onPublishOptions: () => undefined,
} satisfies TopBarProps;

export const Default: Story = {
  args: BASE_ARGS,
  render: (args) => <StatefulTopBar {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const desktop = canvas.getByRole('radio', { name: 'Desktop' });
    const tablet = canvas.getByRole('radio', { name: 'Tablet' });

    await userEvent.click(desktop);
    await expect(desktop).toHaveFocus();
    await expect(desktop).toHaveAttribute('aria-checked', 'true');

    await userEvent.keyboard('{ArrowRight}');
    await expect(tablet).toHaveFocus();
    await expect(tablet).toHaveAttribute('aria-checked', 'true');
  },
};

export const WithExtra: Story = {
  args: {
    ...BASE_ARGS,
    extra: <span>All changes saved</span>,
  },
  render: (args) => <StatefulTopBar {...args} />,
};

/**
 * A host that fills `extra` with more than fits. The bar is only correct if the
 * host's content stays inside its own slot.
 */
export const CrowdedExtra: Story = {
  args: {
    ...BASE_ARGS,
    extra: (
      <div style={{ display: 'flex', gap: '12px', whiteSpace: 'nowrap' }}>
        {Array.from({ length: 12 }, (_, index) => (
          <button key={index} type="button" style={{ minInlineSize: '120px' }}>
            Harness control {index + 1}
          </button>
        ))}
      </div>
    ),
  },
  render: (args) => <StatefulTopBar {...args} />,
  play: async ({ canvasElement }) => {
    /*
      Measured, because this failed in a real browser and no test saw it. The
      slot carried `flex: none`, so 1062px of host content refused to shrink
      inside a 707px box and was painted straight across the centre track — the
      device switcher was still in the DOM, still focusable, and completely
      covered. jsdom cannot see an overlap; this can.
    */
    const bar = canvasElement.querySelector('.bldr-topbar');
    const devices = canvasElement.querySelector('.bldr-topbar__devices');
    const extra = canvasElement.querySelector('.bldr-topbar__extra');
    await expect(bar).not.toBeNull();
    await expect(devices).not.toBeNull();
    await expect(extra).not.toBeNull();
    if (bar === null || devices === null || extra === null) {
      throw new Error('The top bar did not render its three regions');
    }

    const barBox = bar.getBoundingClientRect();
    const deviceBox = devices.getBoundingClientRect();
    const extraBox = extra.getBoundingClientRect();

    // Non-vacuous: an empty slot would satisfy every assertion below.
    await expect(extraBox.width).toBeGreaterThan(100);
    await expect(deviceBox.width).toBeGreaterThan(0);

    // The host's slot starts after the device switcher ends, so the two boxes
    // cannot intersect however much the host puts in.
    await expect(extraBox.left).toBeGreaterThanOrEqual(deviceBox.right - 1);

    // And the whole bar stays inside itself.
    await expect(extraBox.right).toBeLessThanOrEqual(barBox.right + 1);
    await expect(bar.scrollWidth).toBeLessThanOrEqual(Math.ceil(barBox.width) + 1);
  },
};

/**
 * A host whose content WRAPS. The bar is a fixed band, so a second row has
 * nowhere to be.
 */
export const WrappingExtra: Story = {
  args: {
    ...BASE_ARGS,
    extra: (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        {Array.from({ length: 10 }, (_, index) => (
          <button key={index} type="button" style={{ minInlineSize: '140px' }}>
            Wrapping control {index + 1}
          </button>
        ))}
      </div>
    ),
  },
  render: (args) => <StatefulTopBar {...args} />,
  play: async ({ canvasElement }) => {
    /*
      Measured, because this is what actually happened: a host's control cluster
      wrapped to three rows spanning 0..148px inside a 56px bar, and the rows
      below the bar were painted over the preview iframe — still in the DOM,
      still focusable, and impossible to click. A slot that can grow past its
      band silently hides the host's own controls.
    */
    const bar = canvasElement.querySelector('.bldr-topbar');
    const extra = canvasElement.querySelector('.bldr-topbar__extra');
    if (bar === null || extra === null) {
      throw new Error('The top bar did not render its regions');
    }
    const barBox = bar.getBoundingClientRect();
    const extraBox = extra.getBoundingClientRect();

    // Non-vacuous: content that fitted on one line would prove nothing.
    await expect(extra.scrollHeight).toBeGreaterThan(Math.ceil(barBox.height));

    await expect(extraBox.height).toBeLessThanOrEqual(barBox.height + 1);
    await expect(extraBox.bottom).toBeLessThanOrEqual(barBox.bottom + 1);
    await expect(extraBox.top).toBeGreaterThanOrEqual(barBox.top - 1);
  },
};

export const UndoRedoDisabled: Story = {
  args: {
    ...BASE_ARGS,
    canUndo: false,
    canRedo: false,
  },
  render: (args) => <StatefulTopBar {...args} />,
};

export const RightToLeft: Story = {
  args: {
    ...BASE_ARGS,
    device: 'mobile',
    extra: <span>Saved</span>,
  },
  render: (args) => (
    <div dir="rtl">
      <StatefulTopBar {...args} />
    </div>
  ),
};
