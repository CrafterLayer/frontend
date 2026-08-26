import type { Meta, StoryObj } from '@storybook/react-vite';

import { darkTheme, lightTheme } from '../../themes';
import { CanvasFrame } from './CanvasFrame';

const sample = (
  <div
    style={{
      background: 'var(--t-surface)',
      borderRadius: 'var(--t-radius)',
      color: 'var(--t-text)',
      fontFamily: 'system-ui, sans-serif',
      padding: 'var(--t-gap)',
    }}
  >
    <h1 style={{ color: 'var(--t-accent)' }}>Token-driven content</h1>
    <p style={{ color: 'var(--t-text-muted)' }}>Rendered inside the isolation frame.</p>
  </div>
);

const meta = {
  title: 'Builder/Renderer/CanvasFrame',
  component: CanvasFrame,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CanvasFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {
  args: { theme: lightTheme, dir: 'ltr', children: sample },
};

export const Dark: Story = {
  args: { theme: darkTheme, dir: 'ltr', children: sample },
};

export const RightToLeft: Story = {
  args: { theme: lightTheme, dir: 'rtl', children: sample },
};
