import { expect, userEvent, within } from 'storybook/test';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { SourceImpactBar } from './SourceImpactBar';

const meta = {
  title: 'Builder/Code view/SourceImpactBar',
  component: SourceImpactBar,
  args: {
    impact: { kind: 'instance', pageId: 'home', instanceId: 'hero-primary' },
    onApply: () => undefined,
    onOpenSource: () => undefined,
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof SourceImpactBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Local: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Instance only')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Apply to instance' }));
  },
};

export const Shared: Story = {
  args: {
    impact: {
      kind: 'shared',
      componentName: 'Site header',
      approval: {
        fingerprint: 'impact-7',
        pageIds: ['home', 'pricing', 'about'],
        instanceIds: ['header-home', 'header-pricing', 'header-about', 'header-blog'],
      },
    },
  },
};

export const Stale: Story = {
  args: {
    stale: true,
    impact: {
      kind: 'shared',
      componentName: 'Site header',
      approval: {
        fingerprint: 'impact-old',
        pageIds: ['home', 'pricing'],
        instanceIds: ['header-home', 'header-pricing'],
      },
    },
    onRefresh: () => undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Apply shared change' })).toBeDisabled();
    await userEvent.click(canvas.getByRole('button', { name: 'Refresh impact' }));
  },
};
